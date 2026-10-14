import { describe, expect, it } from "vitest";
import { restoreHistory } from "../lib/media/history";
const item = {
  id: "x",
  name: "clip.mp4",
  status: "completed",
  progress: 100,
  createdAt: "2026-10-14T12:00:00Z",
  uri: "file:///documents/MediaLivre/clip.mp4",
};
describe("local library", () => {
  it("keeps older files accessible beyond fifty records", () => {
    const values = Array.from({ length: 60 }, (_, i) => ({
      ...item,
      id: String(i),
    }));
    expect(restoreHistory(JSON.stringify(values))).toHaveLength(60);
  });
  it("marks interrupted jobs failed and strips source/token fields", () => {
    const [record] = restoreHistory(
      JSON.stringify([
        {
          ...item,
          status: "processing",
          token: "secret",
          url: "https://origin.example",
        },
      ]),
    );
    expect(record.status).toBe("failed");
    expect(record.error).toMatch(/interrompida/);
    expect(record).not.toHaveProperty("token");
    expect(record).not.toHaveProperty("url");
  });
  it("ignores corrupt state and invalid records", () => {
    expect(restoreHistory("{broken")).toEqual([]);
    expect(
      restoreHistory(
        JSON.stringify([
          null,
          { ...item, createdAt: "bad" },
          { ...item, status: "invented" },
        ]),
      ),
    ).toEqual([]);
  });
});
