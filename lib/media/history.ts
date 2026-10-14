import { safeFileName, type DownloadRecord } from "./contracts";
const statuses = new Set([
  "processing",
  "downloading",
  "completed",
  "failed",
  "cancelled",
]);
export function restoreHistory(raw: string | null): DownloadRecord[] {
  try {
    const values: unknown = JSON.parse(raw ?? "[]");
    if (!Array.isArray(values)) return [];
    return values.flatMap((value: unknown): DownloadRecord[] => {
      if (!value || typeof value !== "object") return [];
      const record = value as Record<string, unknown>;
      if (
        typeof record.id !== "string" ||
        typeof record.name !== "string" ||
        typeof record.status !== "string" ||
        !statuses.has(record.status) ||
        typeof record.createdAt !== "string" ||
        !Number.isFinite(Date.parse(record.createdAt))
      )
        return [];
      const interrupted = ["processing", "downloading"].includes(record.status);
      return [
        {
          id: record.id,
          name: safeFileName(record.name),
          status: interrupted
            ? "failed"
            : (record.status as DownloadRecord["status"]),
          progress: record.status === "completed" ? 100 : 0,
          createdAt: record.createdAt,
          uri:
            typeof record.uri === "string" && record.uri.startsWith("file://")
              ? record.uri
              : undefined,
          mime: typeof record.mime === "string" ? record.mime : undefined,
          size:
            typeof record.size === "number" && record.size > 0
              ? record.size
              : undefined,
          error: interrupted
            ? "Transferência interrompida. Inicie novamente."
            : typeof record.error === "string"
              ? record.error
              : undefined,
        },
      ];
    });
  } catch {
    return [];
  }
}
