export type MediaOptions = {
  format: "original" | "mp4" | "mp3";
  quality: "best" | "1080" | "720" | "480";
  cover: boolean;
};
export type JobStatus =
  | "queued"
  | "processing"
  | "ready"
  | "failed"
  | "cancelled";
export type RemoteJob = {
  id: string;
  token: string;
  status: JobStatus;
  progress: number;
  title: string;
  error?: string;
  file?: { name: string; size: number; mime: string };
  expiresAt: string;
};
export type DownloadRecord = {
  id: string;
  name: string;
  status: "processing" | "downloading" | "completed" | "failed" | "cancelled";
  progress: number;
  uri?: string;
  mime?: string;
  size?: number;
  error?: string;
  createdAt: string;
};
export const DEFAULT_OPTIONS: MediaOptions = {
  format: "original",
  quality: "best",
  cover: true,
};
export function validateMediaUrl(value: string): string {
  const text = value.trim();
  if (!text || text.length > 2048)
    throw new Error("Cole uma ligação HTTPS válida (até 2048 caracteres).");
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw new Error("A ligação não é válida. Use https://…");
  }
  if (
    url.protocol !== "https:" ||
    !url.hostname ||
    url.username ||
    url.password ||
    url.hash
  )
    throw new Error("Use uma ligação HTTPS sem credenciais ou fragmentos.");
  return url.toString();
}
export function isDirectMedia(value: string): boolean {
  return /\.(mp4|mp3|m4a|webm|mov|mkv|wav|ogg|aac)$/i.test(
    new URL(value).pathname,
  );
}
export function safeFileName(value: string): string {
  return (
    value
      .replace(/[\\/:*?"<>|\x00-\x1f]/g, "_")
      .replace(/^\.+/, "_")
      .slice(0, 160) || "media"
  );
}
export function fileMime(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase();
  return (
    (
      {
        mp3: "audio/mpeg",
        mp4: "video/mp4",
        m4a: "audio/mp4",
        webm: "video/webm",
        mkv: "video/x-matroska",
        wav: "audio/wav",
        ogg: "audio/ogg",
        mov: "video/quicktime",
        aac: "audio/aac",
      } as Record<string, string>
    )[ext ?? ""] ?? "application/octet-stream"
  );
}
export function requiresProcessor(url: string, options: MediaOptions): boolean {
  return (
    !isDirectMedia(url) ||
    options.format !== "original" ||
    options.quality !== "best"
  );
}
