import { getApiBaseUrl } from "@/constants/oauth";
import type { MediaOptions, RemoteJob } from "./contracts";
export function defaultProcessor(): string {
  if (__DEV__) return getApiBaseUrl();
  try {
    return normalizeProcessor(process.env.EXPO_PUBLIC_PROCESSOR_URL ?? "");
  } catch {
    return "";
  }
}
export function normalizeProcessor(value: string): string {
  if (!value.trim()) return "";
  const url = new URL(value.trim());
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error("O servidor deve ser um endereço HTTPS sem credenciais.");
  return url.toString().replace(/\/$/, "");
}
export async function requestJson<T>(
  url: string,
  options: RequestInit = {},
  signal?: AbortSignal,
): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) controller.abort();
  const timer = setTimeout(abort, 30000);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: { "Content-Type": "application/json", ...options.headers },
    });
    const data = await response.json();
    if (!response.ok)
      throw new Error(data.error || `Servidor respondeu ${response.status}.`);
    return data as T;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}
export function createJob(
  base: string,
  url: string,
  options: MediaOptions,
  signal?: AbortSignal,
) {
  return requestJson<RemoteJob>(
    `${base}/api/media/jobs`,
    { method: "POST", body: JSON.stringify({ url, options }) },
    signal,
  );
}
export function readJob(base: string, job: RemoteJob, signal: AbortSignal) {
  return requestJson<RemoteJob>(
    `${base}/api/media/jobs/${job.id}`,
    { headers: { Authorization: `Bearer ${job.token}` } },
    signal,
  );
}
export async function deleteJob(base: string, job: RemoteJob) {
  await requestJson(`${base}/api/media/jobs/${job.id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${job.token}` },
  }).catch(() => undefined);
}
export function delay(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      reject(new Error("Transferência cancelada."));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, ms);
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
  });
}
