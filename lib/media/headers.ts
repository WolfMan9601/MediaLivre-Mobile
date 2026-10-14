export function mediaMime(
  headers: Record<string, unknown>,
  fallback: string,
): string {
  const entry = Object.entries(headers).find(
    ([key]) => key.toLowerCase() === "content-type",
  );
  const value = entry ? String(entry[1] ?? "") : fallback;
  const mime = value.split(";")[0].trim().toLowerCase();
  if (
    !/^(?:audio|video)\/[a-z0-9.+-]+$/.test(mime) &&
    mime !== "application/octet-stream"
  )
    throw new Error("A origem não devolveu um ficheiro de áudio/vídeo válido.");
  return mime;
}
