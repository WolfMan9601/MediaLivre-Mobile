import { describe, expect, it } from "vitest";
import { mediaMime } from "../lib/media/headers";
describe("download Content-Type", () => {
  it("uses real headers regardless of casing", () => {
    expect(
      mediaMime({ "Content-Type": "VIDEO/MP4; charset=binary" }, "audio/mpeg"),
    ).toBe("video/mp4");
  });
  it("rejects HTML even when the filename says MP4", () => {
    expect(() =>
      mediaMime({ "content-type": "text/html" }, "video/mp4"),
    ).toThrow();
    expect(() =>
      mediaMime({ "Content-Type": "application/json" }, "video/mp4"),
    ).toThrow();
  });
  it("only falls back if Content-Type is absent", () => {
    expect(mediaMime({}, "video/mp4")).toBe("video/mp4");
    expect(() => mediaMime({ "content-type": "" }, "video/mp4")).toThrow();
  });
});
