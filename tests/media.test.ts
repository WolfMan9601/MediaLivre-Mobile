import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import type { Server } from "node:http";
import {
  DEFAULT_OPTIONS,
  fileMime,
  isDirectMedia,
  requiresProcessor,
  safeFileName,
  validateMediaUrl,
} from "../lib/media/contracts";
import { isPublicAddress, validatePublicUrl } from "../server/media/security";
import { registerMediaRoutes } from "../server/media/routes";

describe("media contracts", () => {
  it("accepts HTTPS and rejects unsafe inputs", () => {
    expect(validateMediaUrl(" https://example.com/video.mp4 ")).toBe(
      "https://example.com/video.mp4",
    );
    for (const value of [
      "file:///tmp/a.mp4",
      "javascript:alert(1)",
      "http://example.com/a.mp4",
      "https://user:pass@example.com/a",
      "https://example.com/#token",
      "not a URL",
    ])
      expect(() => validateMediaUrl(value)).toThrow();
  });
  it("routes native direct files separately from extraction/conversion", () => {
    expect(isDirectMedia("https://example.com/A.MP4?signature=x")).toBe(true);
    expect(
      requiresProcessor("https://example.com/A.MP4", DEFAULT_OPTIONS),
    ).toBe(false);
    expect(
      requiresProcessor("https://www.youtube.com/watch?v=abc", DEFAULT_OPTIONS),
    ).toBe(true);
    expect(
      requiresProcessor("https://example.com/a.mp4", {
        ...DEFAULT_OPTIONS,
        format: "mp3",
      }),
    ).toBe(true);
    expect(
      requiresProcessor("https://example.com/a.mp4", {
        ...DEFAULT_OPTIONS,
        quality: "720",
      }),
    ).toBe(true);
  });
  it("sanitizes filenames and maps MIME", () => {
    expect(safeFileName("../a:evil.mp4")).not.toContain("/");
    expect(fileMime("song.mp3")).toBe("audio/mpeg");
    expect(fileMime("clip.mp4")).toBe("video/mp4");
  });
});
describe("network guard", () => {
  it("rejects loopback/private/reserved/multicast addresses", () => {
    for (const ip of [
      "127.0.0.1",
      "10.2.3.4",
      "172.16.1.1",
      "192.168.1.2",
      "169.254.169.254",
      "100.64.0.1",
      "0.0.0.0",
      "224.0.0.1",
      "::1",
      "fc00::1",
      "fe80::1",
      "::ffff:127.0.0.1",
      "2001:db8::1",
    ])
      expect(isPublicAddress(ip), ip).toBe(false);
    expect(isPublicAddress("8.8.8.8")).toBe(true);
    expect(isPublicAddress("2606:4700:4700::1111")).toBe(true);
  });
  it("blocks private HTTPS destinations before any worker starts", async () => {
    await expect(
      validatePublicUrl("https://127.0.0.1/file.mp4"),
    ).rejects.toThrow();
    await expect(
      validatePublicUrl("https://example.com:8443/file.mp4"),
    ).rejects.toThrow();
  });
});
describe("processor HTTP contract", () => {
  let server: Server;
  let base: string;
  beforeAll(async () => {
    const app = express();
    app.use(express.json({ limit: "8kb" }));
    registerMediaRoutes(app);
    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No address");
    base = `http://127.0.0.1:${address.port}`;
  });
  afterAll(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  });
  it("reports capabilities", async () => {
    const response = await fetch(`${base}/api/media/health`);
    const value = await response.json();
    expect([200, 503]).toContain(response.status);
    expect(value.maxBytes).toBe(250 * 1024 * 1024);
    expect(value.formats).toEqual(["original", "mp4", "mp3"]);
  });
  it("does not expose unknown jobs or files without token", async () => {
    for (const path of [
      "/api/media/jobs/not-a-job",
      "/api/media/jobs/not-a-job/file",
    ])
      expect((await fetch(base + path)).status).toBe(404);
    expect(
      (await fetch(base + "/api/media/jobs/not-a-job", { method: "DELETE" }))
        .status,
    ).toBe(404);
  });
  it("refuses arbitrary arguments and private network requests", async () => {
    const health = await fetch(`${base}/api/media/health`);
    if (health.status === 503) return;
    const privateResponse = await fetch(`${base}/api/media/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "https://127.0.0.1/a.mp4",
        options: DEFAULT_OPTIONS,
      }),
    });
    expect(privateResponse.status).toBe(422);
    const args = await fetch(`${base}/api/media/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "https://example.com",
        options: { ...DEFAULT_OPTIONS, args: "--exec evil" },
      }),
    });
    expect(args.status).toBe(400);
  });
});
