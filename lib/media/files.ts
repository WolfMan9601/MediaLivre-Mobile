import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { safeFileName, type DownloadRecord } from "./contracts";
import { mediaMime } from "./headers";
const MAX_BYTES = 250 * 1024 * 1024;
export async function downloadMedia(
  source: string,
  name: string,
  mime: string,
  progress: (percent: number) => void,
  signal: AbortSignal,
  headers: Record<string, string> = {},
) {
  const filename = safeFileName(name);
  if (Platform.OS === "web") {
    const response = await fetch(source, { headers, signal });
    if (!response.ok)
      throw new Error(
        "A origem não devolveu um ficheiro de áudio/vídeo válido.",
      );
    const receivedMime = mediaMime(
      Object.fromEntries(response.headers.entries()),
      mime,
    );
    const total = Number(response.headers.get("content-length") || 0);
    if (total > MAX_BYTES) throw new Error("Limite de 250 MB por ficheiro.");
    const reader = response.body?.getReader();
    if (!reader) throw new Error("O browser não suporta esta transferência.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const item = await reader.read();
      if (item.done) break;
      size += item.value.byteLength;
      if (size > MAX_BYTES) {
        await reader.cancel();
        throw new Error("Limite de 250 MB por ficheiro.");
      }
      chunks.push(item.value);
      progress(total ? Math.min(99, Math.floor((size / total) * 100)) : 0);
    }
    if (!size) throw new Error("O ficheiro recebido está vazio.");
    const blob = new Blob(chunks as BlobPart[], { type: receivedMime });
    const uri = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = uri;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(uri), 60000);
    return { name: filename, size, mime: receivedMime, uri: undefined };
  }
  if (!FileSystem.documentDirectory)
    throw new Error("Armazenamento local indisponível.");
  const folder = `${FileSystem.documentDirectory}MediaLivre/`;
  await FileSystem.makeDirectoryAsync(folder, { intermediates: true });
  const path = `${folder}${Date.now()}-${filename}`;
  let exceeded = false;
  const task = FileSystem.createDownloadResumable(
    source,
    path,
    { headers },
    (data) => {
      if (
        data.totalBytesWritten > MAX_BYTES ||
        data.totalBytesExpectedToWrite > MAX_BYTES
      ) {
        exceeded = true;
        void task.cancelAsync();
      }
      progress(
        data.totalBytesExpectedToWrite > 0
          ? Math.min(
              99,
              Math.floor(
                (data.totalBytesWritten / data.totalBytesExpectedToWrite) * 100,
              ),
            )
          : 0,
      );
    },
  );
  const abort = () => {
    void task.cancelAsync();
  };
  signal.addEventListener("abort", abort, { once: true });
  if (signal.aborted) {
    signal.removeEventListener("abort", abort);
    throw new Error("Transferência cancelada.");
  }
  try {
    const result = await task.downloadAsync();
    if (exceeded) throw new Error("Limite de 250 MB por ficheiro.");
    if (signal.aborted || !result) throw new Error("Transferência cancelada.");
    if (result.status < 200 || result.status >= 300)
      throw new Error("A origem não devolveu media válida.");
    const receivedMime = mediaMime(result.headers, result.mimeType ?? mime);
    const info = await FileSystem.getInfoAsync(result.uri);
    if (!info.exists || info.isDirectory || info.size <= 0)
      throw new Error("O ficheiro recebido está vazio.");
    return {
      name: filename,
      uri: result.uri,
      mime: receivedMime,
      size: info.size,
    };
  } catch (error) {
    await FileSystem.deleteAsync(path, { idempotent: true }).catch(
      () => undefined,
    );
    throw error;
  } finally {
    signal.removeEventListener("abort", abort);
  }
}
export async function shareFile(record: DownloadRecord) {
  if (!record.uri || !(await Sharing.isAvailableAsync()))
    throw new Error(
      "A partilha está disponível no Android para ficheiros locais.",
    );
  await Sharing.shareAsync(record.uri, {
    mimeType: record.mime,
    dialogTitle: "Guardar ou partilhar MediaLivre",
  });
}
export async function exportFile(record: DownloadRecord) {
  if (Platform.OS !== "android" || !record.uri) {
    await shareFile(record);
    return;
  }
  const permission =
    await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!permission.granted)
    throw new Error(
      "Não foi dada permissão à pasta. O ficheiro permanece na Biblioteca.",
    );
  const file = await FileSystem.StorageAccessFramework.createFileAsync(
    permission.directoryUri,
    record.name.replace(/\.[^.]+$/, ""),
    record.mime ?? "application/octet-stream",
  );
  try {
    await FileSystem.copyAsync({ from: record.uri, to: file });
  } catch (error) {
    await FileSystem.deleteAsync(file, { idempotent: true }).catch(
      () => undefined,
    );
    throw error;
  }
}
