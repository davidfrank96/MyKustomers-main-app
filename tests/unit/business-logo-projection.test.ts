// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
vi.mock("server-only", () => ({}));
vi.mock("@/features/businesses/logo-public", () => ({
  getBusinessLogoPublicUrl: (path: string | null) =>
    path === "owned/logo.webp" ? "https://storage.example.invalid/owned/logo.webp" : null,
}));
import { readBusinessLogoPng } from "@/features/businesses/logo-projection";

afterEach(() => vi.unstubAllGlobals());
function serve(bytes: Buffer, headers = {}) {
  const fetchMock = vi
    .fn()
    .mockResolvedValue(new Response(new Uint8Array(bytes), { headers }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
describe("bounded canonical logo projection", () => {
  it("trims fully transparent margins, contains a wide mark, and preserves the source", async () => {
    const source = await sharp({
      create: { width: 40, height: 20, channels: 4, background: "#176b58" },
    })
      .extend({
        top: 90,
        bottom: 90,
        left: 80,
        right: 80,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .webp({ lossless: true })
      .toBuffer();
    const original = Buffer.from(source),
      fetchMock = serve(source);
    const result = await readBusinessLogoPng("owned/logo.webp");
    expect(result).not.toBeNull();
    expect(await sharp(result!).metadata()).toMatchObject({
      format: "png",
      width: 280,
      height: 280,
    });
    const trimmed = await sharp(result!).trim().metadata();
    expect(trimmed.format).toBe("png");
    const { info } = await sharp(result!).trim().toBuffer({ resolveWithObject: true });
    expect(info.width).toBe(280);
    expect(info.height).toBe(140);
    expect(source).toEqual(original);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://storage.example.invalid/owned/logo.webp",
      expect.objectContaining({
        cache: "no-store",
        redirect: "error",
        signal: expect.any(AbortSignal),
      }),
    );
  });
  it("preserves opaque whitespace and handles an entirely transparent logo", async () => {
    const white = await sharp({
      create: { width: 300, height: 200, channels: 4, background: "white" },
    })
      .webp()
      .toBuffer();
    serve(white);
    expect(await readBusinessLogoPng("owned/logo.webp")).not.toBeNull();
    const empty = await sharp({
      create: {
        width: 200,
        height: 200,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .webp()
      .toBuffer();
    serve(empty);
    expect(await readBusinessLogoPng("owned/logo.webp")).toBeNull();
  });
  it("rejects oversized payloads, dimensions, malformed and noncanonical formats", async () => {
    for (const source of [
      Buffer.alloc(201 * 1024),
      Buffer.from("not an image"),
      await sharp({ create: { width: 513, height: 20, channels: 3, background: "red" } })
        .webp()
        .toBuffer(),
      await sharp({ create: { width: 100, height: 100, channels: 3, background: "red" } })
        .png()
        .toBuffer(),
    ]) {
      serve(source);
      expect(await readBusinessLogoPng("owned/logo.webp")).toBeNull();
    }
    const mock = serve(Buffer.alloc(1));
    expect(await readBusinessLogoPng("https://evil.test/logo.webp")).toBeNull();
    expect(mock).not.toHaveBeenCalled();
    serve(Buffer.alloc(1), { "content-length": String(201 * 1024) });
    expect(await readBusinessLogoPng("owned/logo.webp")).toBeNull();
  });
  it("falls back safely when storage rejects or times out", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("unavailable")));
    expect(await readBusinessLogoPng("owned/logo.webp")).toBeNull();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 404 })),
    );
    expect(await readBusinessLogoPng("owned/logo.webp")).toBeNull();
  });
});
