// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BUSINESS_LOGO_PREPARATION_TIMEOUT_MS,
  BusinessLogoPreparationError,
  prepareBusinessLogoForUpload,
  validateBusinessLogoSource,
} from "@/features/businesses/logo-client";
import {
  MAX_BUSINESS_LOGO_SOURCE_BYTES,
  MAX_BUSINESS_LOGO_TRANSPORT_BYTES,
  MAX_LOGO_TRANSPORT_EDGE,
} from "@/features/businesses/logo-policy";

const jpegHeader = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]);
const pngHeader = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function sourceFile({
  bytes,
  header = jpegHeader,
  name = "phone-photo.jpg",
  type = "image/jpeg",
}: {
  bytes: number;
  header?: Uint8Array;
  name?: string;
  type?: string;
}) {
  return new File(
    [Uint8Array.from(header).buffer, new ArrayBuffer(bytes - header.byteLength)],
    name,
    { type },
  );
}

function installCanvasMocks({
  encodedBytes = 420_000,
  encodedType = "image/jpeg",
  height = 3000,
  width = 4000,
}: {
  encodedBytes?: number;
  encodedType?: string;
  height?: number;
  width?: number;
} = {}) {
  const close = vi.fn();
  const drawImage = vi.fn();
  const clearRect = vi.fn();
  const bitmap = { close, height, width } as unknown as ImageBitmap;
  const createBitmap = vi.fn(async () => bitmap);
  vi.stubGlobal("createImageBitmap", createBitmap);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    clearRect,
    drawImage,
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
    (callback, requestedType) => {
      callback(
        new Blob([new Uint8Array(encodedBytes)], {
          type: encodedType || requestedType || "image/jpeg",
        }),
      );
    },
  );
  return { clearRect, close, createBitmap, drawImage };
}

describe("business logo client transport preparation", () => {
  beforeEach(() => {
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => "blob:logo-source"),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("leaves sources at and below the 3 MiB transport boundary unchanged", async () => {
    for (const bytes of [1_500_000, 2 * 1024 * 1024, MAX_BUSINESS_LOGO_TRANSPORT_BYTES]) {
      const source = sourceFile({ bytes });
      const prepared = await prepareBusinessLogoForUpload(source);

      expect(prepared.file).toBe(source);
      expect(prepared.preprocessed).toBe(false);
      expect(prepared.transportBytes).toBe(bytes);
    }
  });

  it("accepts a real 4-5 MiB source and emits a bounded metadata-free transport file", async () => {
    const mocks = installCanvasMocks();
    const source = sourceFile({ bytes: 4_800_000 });
    const prepared = await prepareBusinessLogoForUpload(source);

    expect(prepared).toMatchObject({
      preprocessed: true,
      sourceBytes: 4_800_000,
      sourceHeight: 3000,
      sourceWidth: 4000,
      transportBytes: 420_000,
    });
    expect(prepared.file.name).toBe("prepared-business-logo.jpg");
    expect(mocks.createBitmap).toHaveBeenCalledWith(source, {
      imageOrientation: "from-image",
    });
    expect(mocks.drawImage).toHaveBeenCalledWith(
      expect.anything(),
      0,
      0,
      MAX_LOGO_TRANSPORT_EDGE,
      1536,
    );
    expect(mocks.close).toHaveBeenCalledOnce();
  });

  it("accepts exactly 5 MiB and rejects one byte above it", async () => {
    installCanvasMocks();
    await expect(
      prepareBusinessLogoForUpload(sourceFile({ bytes: MAX_BUSINESS_LOGO_SOURCE_BYTES })),
    ).resolves.toMatchObject({ preprocessed: true });

    const oversized = sourceFile({ bytes: MAX_BUSINESS_LOGO_SOURCE_BYTES + 1 });
    expect(validateBusinessLogoSource(oversized)).toBe(
      "Logo image must be 5 MB or smaller.",
    );
    await expect(prepareBusinessLogoForUpload(oversized)).rejects.toMatchObject({
      code: "source_too_large",
    });
  });

  it("uses WebP transport for transparent PNG sources", async () => {
    installCanvasMocks({ encodedType: "image/webp" });
    const prepared = await prepareBusinessLogoForUpload(
      sourceFile({
        bytes: 4_200_000,
        header: pngHeader,
        name: "transparent.png",
        type: "image/png",
      }),
    );

    expect(prepared.file.type).toBe("image/webp");
    expect(prepared.file.name).toBe("prepared-business-logo.webp");
    expect(HTMLCanvasElement.prototype.toBlob).toHaveBeenCalledWith(
      expect.any(Function),
      "image/webp",
      0.88,
    );
  });

  it("rejects MIME spoofing before preprocessing normalizes the source", async () => {
    installCanvasMocks();
    await expect(
      prepareBusinessLogoForUpload(
        sourceFile({ bytes: 4_200_000, header: pngHeader, type: "image/jpeg" }),
      ),
    ).rejects.toMatchObject({ code: "content_mismatch" });
  });

  it("preserves the original dimension policy before client resizing", async () => {
    installCanvasMocks({ height: 4000, width: 7000 });
    await expect(
      prepareBusinessLogoForUpload(sourceFile({ bytes: 4_200_000 })),
    ).rejects.toMatchObject({ code: "dimensions_too_large" });
  });

  it("fails safely when decode cannot complete", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn(async () => Promise.reject(new Error("bad"))));
    await expect(
      prepareBusinessLogoForUpload(sourceFile({ bytes: 4_200_000 })),
    ).rejects.toEqual(
      expect.objectContaining<Partial<BusinessLogoPreparationError>>({
        code: "unable_to_prepare",
      }),
    );
  });

  it("fails safely when canvas encoding cannot complete", async () => {
    installCanvasMocks();
    vi.mocked(HTMLCanvasElement.prototype.toBlob).mockImplementation((callback) => {
      callback(null);
    });

    await expect(
      prepareBusinessLogoForUpload(sourceFile({ bytes: 4_200_000 })),
    ).rejects.toMatchObject({ code: "unable_to_prepare" });
  });

  it("bounds preprocessing and honors caller cancellation", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("createImageBitmap", vi.fn(() => new Promise<ImageBitmap>(() => {})));
    const timedOut = expect(
      prepareBusinessLogoForUpload(sourceFile({ bytes: 4_200_000 })),
    ).rejects.toMatchObject({ code: "unable_to_prepare" });
    await vi.advanceTimersByTimeAsync(BUSINESS_LOGO_PREPARATION_TIMEOUT_MS);
    await timedOut;

    const controller = new AbortController();
    const aborted = prepareBusinessLogoForUpload(sourceFile({ bytes: 4_200_000 }), {
      signal: controller.signal,
    });
    controller.abort();
    await expect(aborted).rejects.toMatchObject({ code: "aborted" });
  });
});
