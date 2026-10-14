import { mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
const [source, base = "http://127.0.0.1:3000"] = process.argv.slice(2);
if (!source?.startsWith("https://"))
  throw new Error("Pass an owned synthetic HTTPS media URL.");
await mkdir("/tmp/medialivre-integration", { recursive: true });
for (const format of ["original", "mp4", "mp3"]) {
  const created = await fetch(`${base}/api/media/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: source,
      options: { format, quality: "best", cover: false },
    }),
  });
  let job = await created.json();
  if (created.status !== 202) throw new Error(job.error || "Creation failed");
  const headers = { Authorization: `Bearer ${job.token}` };
  const id = job.id;
  const until = Date.now() + 180000;
  try {
    if (
      (
        await fetch(`${base}/api/media/jobs/${id}`, {
          headers: { Authorization: "Bearer " + "é".repeat(64) },
        })
      ).status !== 404
    )
      throw new Error("Malformed token was not rejected.");
    while (["queued", "processing"].includes(job.status)) {
      if (Date.now() > until) throw new Error("Processing timed out.");
      console.log(`${format}: ${job.status} ${job.progress}%`);
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const status = await fetch(`${base}/api/media/jobs/${id}`, { headers });
      job = await status.json();
    }
    if (job.status !== "ready")
      throw new Error(job.error || "Processing failed");
    const response = await fetch(`${base}/api/media/jobs/${id}/file`, {
      headers,
    });
    if (!response.ok) throw new Error("File failed");
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length !== job.file.size) throw new Error("File size mismatch");
    const path = `/tmp/medialivre-integration/${format}.${job.file.name.split(".").pop()}`;
    await writeFile(path, bytes);
    const probe = JSON.parse(
      execFileSync(
        "ffprobe",
        [
          "-v",
          "error",
          "-show_entries",
          "stream=codec_name,codec_type",
          "-of",
          "json",
          path,
        ],
        { encoding: "utf8" },
      ),
    );
    const codecs = probe.streams.map((x) => x.codec_name);
    if (
      format === "mp4" &&
      !(codecs.includes("h264") && codecs.includes("aac"))
    )
      throw new Error("MP4 is not H.264/AAC");
    if (format === "mp3" && !codecs.includes("mp3")) throw new Error("Not MP3");
    console.log(
      `${format}: READY ${bytes.length} bytes; codecs=${codecs.join(",")}`,
    );
  } finally {
    await fetch(`${base}/api/media/jobs/${id}`, { method: "DELETE", headers });
  }
}
console.log("All synthetic-media integration cases passed.");
