import type { Express, Request, Response } from "express";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, readdir, stat, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { z } from "zod";
import { fileMime, type RemoteJob } from "../../lib/media/contracts";
import { validatePublicUrl } from "./security";

const optionsSchema = z
  .object({
    format: z.enum(["original", "mp4", "mp3"]),
    quality: z.enum(["best", "1080", "720", "480"]),
    cover: z.boolean(),
  })
  .strict();
const inputSchema = z
  .object({ url: z.string().max(2048), options: optionsSchema })
  .strict();
type StoredJob = RemoteJob & {
  directory: string;
  path?: string;
  process?: ChildProcess;
  timeout?: NodeJS.Timeout;
};
const jobs = new Map<string, StoredJob>();
const quotas = new Map<string, { count: number; until: number }>();
const root = join(tmpdir(), "medialivre-jobs");
const worker = resolve("processor/worker.py");
const MAX_BYTES = 250 * 1024 * 1024;
const TTL = 30 * 60 * 1000;
function responseJob(job: StoredJob) {
  return {
    id: job.id,
    token: job.token,
    status: job.status,
    progress: job.progress,
    title: job.title,
    error: job.error,
    file: job.file,
    expiresAt: job.expiresAt,
  };
}
function stop(job: StoredJob) {
  if (job.timeout) clearTimeout(job.timeout);
  if (job.process?.pid) {
    try {
      process.kill(-job.process.pid, "SIGKILL");
    } catch {
      /* already stopped */
    }
  }
}
function authorize(req: Request, res: Response): StoredJob | undefined {
  const job = jobs.get(String(req.params.id));
  const token = req.headers.authorization?.replace(/^Bearer /, "") ?? "";
  if (
    !job ||
    !/^[a-f0-9]{64}$/.test(token) ||
    !timingSafeEqual(Buffer.from(token), Buffer.from(job.token))
  ) {
    res.status(404).json({ error: "Trabalho não encontrado ou expirado." });
    return;
  }
  if (new Date(job.expiresAt).getTime() < Date.now()) {
    res.status(410).json({ error: "O ficheiro temporário expirou." });
    return;
  }
  return job;
}
function quota(req: Request): void {
  const key = req.ip ?? "unknown";
  const now = Date.now();
  const entry = quotas.get(key);
  if (entry && entry.until > now && entry.count >= 10)
    throw new Error(
      "Limite de 10 pedidos por 15 minutos atingido. Tente mais tarde.",
    );
  quotas.set(key, {
    count: entry && entry.until > now ? entry.count + 1 : 1,
    until: entry && entry.until > now ? entry.until : now + 15 * 60 * 1000,
  });
  capacity();
}
function capacity(): void {
  if (
    Array.from(jobs.values()).filter((x) => x.status === "processing").length >=
      2 ||
    jobs.size >= 30 ||
    Array.from(jobs.values()).reduce(
      (sum, x) =>
        sum +
        (x.file?.size ??
          (["queued", "processing"].includes(x.status) ? MAX_BYTES : 0)),
      0,
    ) +
      MAX_BYTES >
      2 * MAX_BYTES
  )
    throw new Error("O servidor está ocupado. Tente novamente mais tarde.");
}
async function launch(
  job: StoredJob,
  url: string,
  options: z.infer<typeof optionsSchema>,
) {
  await mkdir(job.directory, { recursive: true, mode: 0o700 });
  if (job.status === "cancelled")
    throw new Error("Pedido cancelado antes de iniciar o processador.");
  const child = spawn(
    process.env.MEDIALIVRE_PYTHON ?? "python3",
    ["-u", worker],
    {
      detached: true,
      stdio: ["pipe", "pipe", "ignore"],
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        LANG: "C.UTF-8",
        NODE_ENV: "production",
      },
    },
  );
  job.process = child;
  job.status = "processing";
  let pending = "";
  child.stdout?.on("data", (chunk) => {
    pending += String(chunk);
    if (pending.length > 65536) pending = pending.slice(-32768);
    const lines = pending.split("\n");
    pending = lines.pop() ?? "";
    for (const line of lines) {
      try {
        const event = JSON.parse(line);
        if (typeof event.progress === "number")
          job.progress = Math.max(job.progress, Math.min(95, event.progress));
        if (typeof event.title === "string")
          job.title = event.title.slice(0, 200);
        if (typeof event.error === "string")
          job.error = event.error.slice(0, 500);
      } catch {
        /* non-event output ignored */
      }
    }
  });
  child.once("error", () => {
    job.status = "failed";
    job.error = "O processador Python não está disponível neste servidor.";
    stop(job);
  });
  child.once("close", async (code) => {
    if (job.timeout) clearTimeout(job.timeout);
    job.process = undefined;
    if (job.status === "cancelled" || job.status === "failed") return;
    try {
      if (code !== 0)
        throw new Error(job.error || "Falha ao processar este conteúdo.");
      const names = (await readdir(job.directory)).filter((x) =>
        /\.(mp4|mp3|m4a|webm|mkv|mov|wav|ogg|aac)$/i.test(x),
      );
      if (names.length !== 1)
        throw new Error(
          "O conteúdo não gerou um único ficheiro de media. Cole uma ligação individual.",
        );
      const path = join(job.directory, names[0]);
      const info = await stat(path);
      if (!info.isFile() || info.size <= 0 || info.size > MAX_BYTES)
        throw new Error(
          "O ficheiro excede os limites do servidor ou está vazio.",
        );
      job.path = path;
      job.file = { name: names[0], size: info.size, mime: fileMime(names[0]) };
      job.progress = 100;
      job.status = "ready";
    } catch (error) {
      job.status = "failed";
      job.error =
        error instanceof Error ? error.message : "Falha de processamento.";
      await rm(job.directory, { recursive: true, force: true });
    }
  });
  job.timeout = setTimeout(
    () => {
      job.status = "failed";
      job.error = "O processamento excedeu o limite de 10 minutos.";
      stop(job);
      void rm(job.directory, { recursive: true, force: true });
    },
    10 * 60 * 1000,
  );
  child.stdin?.end(JSON.stringify({ url, options, directory: job.directory }));
}
export function registerMediaRoutes(app: Express) {
  const available =
    spawnSync(
      process.env.MEDIALIVRE_PYTHON ?? "python3",
      [
        "-c",
        "import yt_dlp, mutagen; import shutil; assert shutil.which('ffmpeg') and shutil.which('ffprobe')",
      ],
      { timeout: 10000, stdio: "ignore" },
    ).status === 0;
  app.get("/api/media/health", (_req, res) =>
    res.status(available ? 200 : 503).json({
      ok: available,
      version: "0.1.0",
      maxBytes: MAX_BYTES,
      formats: ["original", "mp4", "mp3"],
      temporaryMinutes: 30,
      error: available
        ? undefined
        : "Instale Python, yt-dlp e FFmpeg no servidor.",
    }),
  );
  app.post("/api/media/jobs", async (req, res) => {
    let disconnected = false;
    let ownedJob: StoredJob | undefined;
    res.once("close", () => {
      if (res.writableEnded) return;
      disconnected = true;
      if (ownedJob) {
        ownedJob.status = "cancelled";
        stop(ownedJob);
        jobs.delete(ownedJob.id);
        void rm(ownedJob.directory, { recursive: true, force: true }).catch(
          () => undefined,
        );
      }
    });
    try {
      if (!available) {
        res.status(503).json({
          error: "O servidor de processamento ainda não está configurado.",
        });
        return;
      }
      quota(req);
      const input = inputSchema.parse(req.body);
      const url = await validatePublicUrl(input.url);
      const parsed = new URL(url);
      if (
        parsed.searchParams.has("list") ||
        /\/playlist|\/channel\/|\/stories\/|\/@[^/]+\/?$/.test(parsed.pathname)
      )
        throw new Error(
          "Cole uma ligação individual. Esta versão mobile não expande coleções.",
        );
      if (disconnected) return;
      capacity();
      const id = randomUUID();
      const job: StoredJob = {
        id,
        token: randomBytes(32).toString("hex"),
        status: "queued",
        progress: 0,
        title: "A preparar o conteúdo…",
        expiresAt: new Date(Date.now() + TTL).toISOString(),
        directory: join(root, id),
      };
      jobs.set(id, job);
      ownedJob = job;
      try {
        await launch(job, url, input.options);
      } catch (error) {
        jobs.delete(id);
        await rm(job.directory, { recursive: true, force: true });
        throw error;
      }
      res.status(202).json(responseJob(job));
    } catch (error) {
      res.status(error instanceof z.ZodError ? 400 : 422).json({
        error:
          error instanceof z.ZodError
            ? "Opções ou ligação inválidas."
            : error instanceof Error
              ? error.message
              : "Pedido inválido.",
      });
    }
  });
  app.get("/api/media/jobs/:id", (req, res) => {
    const job = authorize(req, res);
    if (job) {
      res.setHeader("Cache-Control", "no-store");
      res.json(responseJob(job));
    }
  });
  app.get("/api/media/jobs/:id/file", (req, res) => {
    const job = authorize(req, res);
    if (!job) return;
    if (job.status !== "ready" || !job.path || !job.file) {
      res.status(409).json({ error: "O ficheiro ainda não está disponível." });
      return;
    }
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", job.file.mime);
    res.download(job.path, job.file.name);
  });
  app.delete("/api/media/jobs/:id", async (req, res) => {
    const job = authorize(req, res);
    if (!job) return;
    job.status = "cancelled";
    stop(job);
    await rm(job.directory, { recursive: true, force: true });
    jobs.delete(job.id);
    res.json({ ok: true });
  });
  const cleaner = setInterval(() => {
    const now = Date.now();
    for (const [id, job] of jobs)
      if (Date.parse(job.expiresAt) <= now) {
        stop(job);
        jobs.delete(id);
        void rm(job.directory, { recursive: true, force: true });
      }
    for (const [key, value] of quotas)
      if (value.until <= now) quotas.delete(key);
    void readdir(root)
      .then((names) =>
        Promise.all(
          names.map(async (name) => {
            if (!/^[a-f0-9-]{36}$/.test(name) || jobs.has(name)) return;
            const path = join(root, name);
            const info = await stat(path);
            if (now - info.mtimeMs > TTL)
              await rm(path, { recursive: true, force: true });
          }),
        ),
      )
      .catch(() => undefined);
  }, 60000);
  cleaner.unref();
}
