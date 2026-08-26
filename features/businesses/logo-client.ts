import {
  BUSINESS_LOGO_SOURCE_TYPES,
  MAX_BUSINESS_LOGO_SOURCE_BYTES,
  MAX_BUSINESS_LOGO_TRANSPORT_BYTES,
  MAX_LOGO_SOURCE_EDGE,
  MAX_LOGO_SOURCE_PIXELS,
  MAX_LOGO_TRANSPORT_EDGE,
  type BusinessLogoSourceType,
} from "@/features/businesses/logo-policy";

export const BUSINESS_LOGO_PREPARATION_TIMEOUT_MS = 30_000;

type BusinessLogoPreparationErrorCode =
  | "aborted"
  | "content_mismatch"
  | "dimensions_too_large"
  | "extension_mismatch"
  | "source_too_large"
  | "unable_to_prepare"
  | "unsupported_type";

export class BusinessLogoPreparationError extends Error {
  constructor(
    public readonly code: BusinessLogoPreparationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "BusinessLogoPreparationError";
  }
}

export type PreparedBusinessLogo = {
  file: File;
  sourceBytes: number;
  sourceHeight: number | null;
  sourceWidth: number | null;
  transportBytes: number;
  preprocessed: boolean;
};

const sourceExtensions: Record<BusinessLogoSourceType, readonly string[]> = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
};

function extensionForType(type: string) {
  if (type === "image/jpeg") return ".jpg";
  if (type === "image/png") return ".png";
  if (type === "image/webp") return ".webp";
  return null;
}

function fileExtension(name: string) {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot).toLowerCase() : "";
}

export function validateBusinessLogoSource(file: File) {
  if (file.size > MAX_BUSINESS_LOGO_SOURCE_BYTES) {
    return "Logo image must be 5 MB or smaller.";
  }
  if (!BUSINESS_LOGO_SOURCE_TYPES.includes(file.type as BusinessLogoSourceType)) {
    return "Choose a PNG, JPEG, or WebP logo.";
  }
  if (
    !sourceExtensions[file.type as BusinessLogoSourceType].includes(
      fileExtension(file.name),
    )
  ) {
    return "The logo filename does not match its file type.";
  }
  return null;
}

function detectedSourceType(bytes: Uint8Array): BusinessLogoSourceType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every(
      (value, index) => bytes[index] === value,
    )
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

function abortable<T>(promise: Promise<T>, signal: AbortSignal) {
  if (signal.aborted) {
    return Promise.reject(new DOMException("The operation was aborted.", "AbortError"));
  }

  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(new DOMException("The operation was aborted.", "AbortError"));
    signal.addEventListener("abort", abort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}

function readBlob(blob: Blob, signal: AbortSignal) {
  if (typeof blob.arrayBuffer === "function") {
    return abortable(blob.arrayBuffer(), signal);
  }

  const reader = new FileReader();
  const result = new Promise<ArrayBuffer>((resolve, reject) => {
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error ?? new Error("read_failed"));
    reader.onabort = () => reject(new DOMException("The operation was aborted.", "AbortError"));
    reader.readAsArrayBuffer(blob);
  });
  const abortReader = () => reader.abort();
  signal.addEventListener("abort", abortReader, { once: true });
  return abortable(result, signal).finally(() =>
    signal.removeEventListener("abort", abortReader),
  );
}

async function decodeSource(file: File, signal: AbortSignal) {
  if (typeof createImageBitmap === "function") {
    const bitmap = await abortable(
      createImageBitmap(file, { imageOrientation: "from-image" }),
      signal,
    );
    return {
      source: bitmap as CanvasImageSource,
      width: bitmap.width,
      height: bitmap.height,
      close: () => bitmap.close(),
    };
  }

  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = "async";
  const loaded = new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("decode_failed"));
    image.src = objectUrl;
  });

  try {
    await abortable(loaded, signal);
    return {
      source: image as CanvasImageSource,
      width: image.naturalWidth,
      height: image.naturalHeight,
      close: () => URL.revokeObjectURL(objectUrl),
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

function encodeCanvas(
  canvas: HTMLCanvasElement,
  type: "image/jpeg" | "image/webp",
  quality: number,
  signal: AbortSignal,
) {
  const encoded = new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("encode_failed"))),
      type,
      quality,
    );
  });
  return abortable(encoded, signal);
}

async function preprocessBusinessLogo(file: File, signal: AbortSignal) {
  const header = new Uint8Array(await readBlob(file.slice(0, 12), signal));
  const detectedType = detectedSourceType(header);
  if (!detectedType || detectedType !== file.type) {
    throw new BusinessLogoPreparationError(
      "content_mismatch",
      "The logo content does not match its declared file type.",
    );
  }

  const decoded = await decodeSource(file, signal);
  try {
    if (
      decoded.width < 1 ||
      decoded.height < 1 ||
      decoded.width > MAX_LOGO_SOURCE_EDGE ||
      decoded.height > MAX_LOGO_SOURCE_EDGE ||
      decoded.width * decoded.height > MAX_LOGO_SOURCE_PIXELS
    ) {
      throw new BusinessLogoPreparationError(
        "dimensions_too_large",
        "Logo dimensions must be no larger than 6000 pixels per side and 25 megapixels.",
      );
    }

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("canvas_unavailable");

    const outputType = file.type === "image/jpeg" ? "image/jpeg" : "image/webp";
    const attempts = [
      { edge: MAX_LOGO_TRANSPORT_EDGE, quality: 0.88 },
      { edge: 1600, quality: 0.82 },
      { edge: 1280, quality: 0.76 },
      { edge: 1024, quality: 0.72 },
    ];

    for (const attempt of attempts) {
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      const scale = Math.min(1, attempt.edge / Math.max(decoded.width, decoded.height));
      canvas.width = Math.max(1, Math.round(decoded.width * scale));
      canvas.height = Math.max(1, Math.round(decoded.height * scale));
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(decoded.source, 0, 0, canvas.width, canvas.height);

      const blob = await encodeCanvas(canvas, outputType, attempt.quality, signal);
      const extension = extensionForType(blob.type);
      if (
        extension &&
        blob.size > 0 &&
        blob.size <= MAX_BUSINESS_LOGO_TRANSPORT_BYTES
      ) {
        return {
          file: new File([blob], `prepared-business-logo${extension}`, {
            type: blob.type,
            lastModified: Date.now(),
          }),
          sourceBytes: file.size,
          sourceHeight: decoded.height,
          sourceWidth: decoded.width,
          transportBytes: blob.size,
          preprocessed: true,
        } satisfies PreparedBusinessLogo;
      }
    }
  } finally {
    decoded.close();
  }

  throw new BusinessLogoPreparationError(
    "unable_to_prepare",
    "Unable to prepare this image. Try another image.",
  );
}

export async function prepareBusinessLogoForUpload(
  file: File,
  options: { signal?: AbortSignal } = {},
): Promise<PreparedBusinessLogo> {
  const validationMessage = validateBusinessLogoSource(file);
  if (validationMessage) {
    throw new BusinessLogoPreparationError(
      file.size > MAX_BUSINESS_LOGO_SOURCE_BYTES
        ? "source_too_large"
        : BUSINESS_LOGO_SOURCE_TYPES.includes(file.type as BusinessLogoSourceType)
          ? "extension_mismatch"
          : "unsupported_type",
      validationMessage,
    );
  }

  if (file.size <= MAX_BUSINESS_LOGO_TRANSPORT_BYTES) {
    return {
      file,
      sourceBytes: file.size,
      sourceHeight: null,
      sourceWidth: null,
      transportBytes: file.size,
      preprocessed: false,
    };
  }

  const controller = new AbortController();
  const relayAbort = () => controller.abort();
  options.signal?.addEventListener("abort", relayAbort, { once: true });
  const timeout = window.setTimeout(
    () => controller.abort(),
    BUSINESS_LOGO_PREPARATION_TIMEOUT_MS,
  );

  try {
    return await preprocessBusinessLogo(file, controller.signal);
  } catch (error) {
    if (error instanceof BusinessLogoPreparationError) throw error;
    if (options.signal?.aborted) {
      throw new BusinessLogoPreparationError("aborted", "Image preparation was cancelled.");
    }
    throw new BusinessLogoPreparationError(
      "unable_to_prepare",
      "Unable to prepare this image. Try another image.",
    );
  } finally {
    window.clearTimeout(timeout);
    options.signal?.removeEventListener("abort", relayAbort);
  }
}
