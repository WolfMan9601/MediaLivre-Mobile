import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createJob,
  defaultProcessor,
  delay,
  deleteJob,
  normalizeProcessor,
  readJob,
} from "@/lib/media/api";
import { downloadMedia } from "@/lib/media/files";
import {
  fileMime,
  requiresProcessor,
  safeFileName,
  validateMediaUrl,
  type DownloadRecord,
  type MediaOptions,
  type RemoteJob,
} from "@/lib/media/contracts";
import { restoreHistory } from "@/lib/media/history";
type DownloadsValue = {
  records: DownloadRecord[];
  busy: boolean;
  processor: string;
  start: (url: string, options: MediaOptions) => Promise<void>;
  cancel: () => void;
  setProcessor: (value: string) => Promise<void>;
};
const Context = createContext<DownloadsValue | null>(null);
export function DownloadsProvider({ children }: { children: ReactNode }) {
  const [records, setRecords] = useState<DownloadRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [processor, setProcessorState] = useState(defaultProcessor());
  const [hydrated, setHydrated] = useState(false);
  const current = useRef<AbortController | null>(null);
  useEffect(() => {
    let live = true;
    Promise.all([
      AsyncStorage.getItem("medialivre.history"),
      AsyncStorage.getItem("medialivre.processor"),
    ])
      .then(([history, endpoint]) => {
        if (!live) return;
        setRecords(restoreHistory(history));
        if (endpoint) {
          try {
            setProcessorState(normalizeProcessor(endpoint));
          } catch {
            /* invalid endpoint ignored */
          }
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (live) setHydrated(true);
      });
    return () => {
      live = false;
      current.current?.abort();
    };
  }, []);
  const storedHistory = JSON.stringify(
    records.map((record) => ({
      ...record,
      progress: record.status === "completed" ? 100 : 0,
    })),
  );
  useEffect(() => {
    if (hydrated)
      void AsyncStorage.setItem("medialivre.history", storedHistory).catch(
        () => undefined,
      );
  }, [storedHistory, hydrated]);
  const patch = (id: string, change: Partial<DownloadRecord>) =>
    setRecords((old) =>
      old.map((x) => (x.id === id ? { ...x, ...change } : x)),
    );
  const setProcessor = async (value: string) => {
    const normalized = normalizeProcessor(value);
    await AsyncStorage.setItem("medialivre.processor", normalized);
    setProcessorState(normalized || defaultProcessor());
  };
  const start = async (value: string, options: MediaOptions) => {
    if (!hydrated) throw new Error("A carregar a Biblioteca. Tente novamente.");
    if (current.current) throw new Error("Já existe uma transferência ativa.");
    const url = validateMediaUrl(value);
    const processing = requiresProcessor(url, options);
    const base = processor.replace(/\/$/, "");
    if (processing && !base)
      throw new Error(
        "Configure o servidor HTTPS em Ajustes para processar páginas e conversões. Ficheiros diretos podem ser transferidos sem servidor.",
      );
    let name = new URL(url).pathname.split("/").pop() || "media";
    try {
      name = decodeURIComponent(name);
    } catch {
      /* keep encoded filename */
    }
    name = safeFileName(name);
    const controller = new AbortController();
    current.current = controller;
    setBusy(true);
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const initial: DownloadRecord = {
      id,
      name,
      status: processing ? "processing" : "downloading",
      progress: 0,
      createdAt: new Date().toISOString(),
    };
    setRecords((old) => [initial, ...old]);
    let remote: RemoteJob | undefined;
    try {
      let source = url;
      let mime = fileMime(name);
      let headers: Record<string, string> = {};
      if (processing) {
        // Keep the bounded creation response so an early cancel still obtains the token for DELETE.
        remote = await createJob(base, url, options);
        if (controller.signal.aborted)
          throw new Error("Transferência cancelada.");
        const deadline = Date.now() + 11 * 60 * 1000;
        while (remote.status === "queued" || remote.status === "processing") {
          if (Date.now() > deadline)
            throw new Error("O servidor demorou demasiado tempo.");
          patch(id, {
            progress: Math.floor(remote.progress * 0.6),
            name: remote.title,
          });
          await delay(1200, controller.signal);
          remote = await readJob(base, remote, controller.signal);
        }
        if (remote.status !== "ready" || !remote.file)
          throw new Error(remote.error || "O processamento não terminou.");
        name = remote.file.name;
        mime = remote.file.mime;
        source = `${base}/api/media/jobs/${remote.id}/file`;
        headers = { Authorization: `Bearer ${remote.token}` };
        patch(id, { status: "downloading", name, progress: 60 });
      }
      const result = await downloadMedia(
        source,
        name,
        mime,
        (pct) =>
          patch(id, {
            progress: processing ? 60 + Math.floor(pct * 0.4) : pct,
          }),
        controller.signal,
        headers,
      );
      patch(id, { ...result, status: "completed", progress: 100 });
    } catch (error) {
      patch(id, {
        status: controller.signal.aborted ? "cancelled" : "failed",
        error: controller.signal.aborted
          ? "Transferência cancelada."
          : error instanceof Error
            ? error.message
            : "Não foi possível transferir.",
      });
    } finally {
      if (remote) void deleteJob(base, remote);
      current.current = null;
      setBusy(false);
    }
  };
  return (
    <Context.Provider
      value={{
        records,
        busy,
        processor,
        start,
        cancel: () => current.current?.abort(),
        setProcessor,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useDownloads() {
  const value = useContext(Context);
  if (!value) throw new Error("DownloadsProvider ausente.");
  return value;
}
