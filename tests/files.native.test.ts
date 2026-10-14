import { beforeEach, describe, expect, it, vi } from "vitest";
const fs = vi.hoisted(() => ({
  download: vi.fn(),
  cancel: vi.fn(),
  mkdir: vi.fn(),
  getInfo: vi.fn(),
  remove: vi.fn(),
  permission: vi.fn(),
  createFile: vi.fn(),
  copy: vi.fn(),
}));
vi.mock("react-native", () => ({ Platform: { OS: "android" } }));
vi.mock("expo-file-system/legacy", () => ({
  documentDirectory: "file:///documents/",
  makeDirectoryAsync: fs.mkdir,
  getInfoAsync: fs.getInfo,
  deleteAsync: fs.remove,
  copyAsync: fs.copy,
  createDownloadResumable: () => ({
    downloadAsync: fs.download,
    cancelAsync: fs.cancel,
  }),
  StorageAccessFramework: {
    requestDirectoryPermissionsAsync: fs.permission,
    createFileAsync: fs.createFile,
  },
}));
vi.mock("expo-sharing", () => ({
  isAvailableAsync: async () => true,
  shareAsync: async () => undefined,
}));
import { downloadMedia, exportFile } from "../lib/media/files";
import type { DownloadRecord } from "../lib/media/contracts";
const record: DownloadRecord = {
  id: "x",
  name: "clip.mp4",
  status: "completed",
  progress: 100,
  createdAt: "2026-10-14T12:00:00Z",
  uri: "file:///documents/MediaLivre/clip.mp4",
  mime: "video/mp4",
};
beforeEach(() => {
  vi.clearAllMocks();
  fs.download.mockResolvedValue({
    uri: record.uri,
    status: 200,
    headers: { "Content-Type": "video/webm" },
  });
  fs.getInfo.mockResolvedValue({ exists: true, isDirectory: false, size: 42 });
  fs.mkdir.mockResolvedValue(undefined);
  fs.remove.mockResolvedValue(undefined);
  fs.permission.mockResolvedValue({
    granted: true,
    directoryUri: "content://folder",
  });
  fs.createFile.mockResolvedValue("content://folder/clip");
  fs.copy.mockResolvedValue(undefined);
});
describe("Android file contract", () => {
  it("uses actual headers when Android does not return mimeType", async () => {
    const result = await downloadMedia(
      "https://example.com/clip.mp4",
      "clip.mp4",
      "video/mp4",
      () => {},
      new AbortController().signal,
    );
    expect(result.mime).toBe("video/webm");
    expect(result.size).toBe(42);
  });
  it("rejects HTML disguised as MP4 and removes partial file", async () => {
    fs.download.mockResolvedValue({
      uri: record.uri,
      status: 200,
      headers: { "content-type": "text/html" },
    });
    await expect(
      downloadMedia(
        "https://example.com/clip.mp4",
        "clip.mp4",
        "video/mp4",
        () => {},
        new AbortController().signal,
      ),
    ).rejects.toThrow(/áudio\/vídeo/);
    expect(fs.remove).toHaveBeenCalled();
  });
  it("does not start an already cancelled transfer", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      downloadMedia(
        "https://example.com/clip.mp4",
        "clip.mp4",
        "video/mp4",
        () => {},
        controller.signal,
      ),
    ).rejects.toThrow(/cancelada/);
    expect(fs.download).not.toHaveBeenCalled();
  });
  it("preserves the private file when folder permission is denied", async () => {
    fs.permission.mockResolvedValue({ granted: false });
    await expect(exportFile(record)).rejects.toThrow(/permissão|permissão/);
    expect(fs.copy).not.toHaveBeenCalled();
    expect(fs.remove).not.toHaveBeenCalled();
  });
  it("copies to SAF without loading full contents and uses basename without extension", async () => {
    await exportFile(record);
    expect(fs.createFile).toHaveBeenCalledWith(
      "content://folder",
      "clip",
      "video/mp4",
    );
    expect(fs.copy).toHaveBeenCalledWith({
      from: record.uri,
      to: "content://folder/clip",
    });
  });
});
