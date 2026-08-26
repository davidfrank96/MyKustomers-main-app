import path from "node:path";
import sharp from "sharp";
import {
  MAX_BUSINESS_LOGO_TRANSPORT_BYTES,
  MAX_LOGO_OUTPUT_BYTES,
  MAX_LOGO_OUTPUT_EDGE,
  MAX_LOGO_SOURCE_EDGE,
  MAX_LOGO_SOURCE_PIXELS,
} from "@/features/businesses/logo-policy";

export {
  MAX_BUSINESS_LOGO_TRANSPORT_BYTES,
  MAX_LOGO_OUTPUT_BYTES,
  MAX_LOGO_OUTPUT_EDGE,
  MAX_LOGO_SOURCE_EDGE,
  MAX_LOGO_SOURCE_PIXELS,
} from "@/features/businesses/logo-policy";

export const BUSINESS_LOGO_BUCKET = "business-logos";
export const BUSINESS_LOGO_FILE_NAME = "logo.webp";
export const BUSINESS_LOGO_OUTPUT_MIME = "image/webp";

const allowedSources = {
  "image/jpeg": { formats: ["jpeg"], extensions: [".jpg", ".jpeg"] },
  "image/png": { formats: ["png"], extensions: [".png"] },
  "image/webp": { formats: ["webp"], extensions: [".webp"] },
} as const;

export type BusinessLogoErrorCode =
  | "empty"
  | "input_too_large"
  | "unsupported_type"
  | "extension_mismatch"
  | "invalid_image"
  | "content_mismatch"
  | "dimensions_too_large"
  | "animated_image"
  | "output_too_large";

export class BusinessLogoValidationError extends Error {
  constructor(public readonly code: BusinessLogoErrorCode, message: string) {
    super(message);
    this.name = "BusinessLogoValidationError";
  }
}

export type OptimizedBusinessLogo = {
  buffer: Buffer;
  width: number;
  height: number;
  size: number;
  contentType: typeof BUSINESS_LOGO_OUTPUT_MIME;
};

export function businessLogoPath(businessId: string) {
  return `${businessId}/${BUSINESS_LOGO_FILE_NAME}`;
}

export async function optimizeBusinessLogo({
  buffer,
  contentType,
  fileName,
}: {
  buffer: Buffer;
  contentType: string;
  fileName: string;
}): Promise<OptimizedBusinessLogo> {
  if (buffer.byteLength === 0) {
    throw new BusinessLogoValidationError("empty", "Choose a logo image to upload.");
  }

  if (buffer.byteLength > MAX_BUSINESS_LOGO_TRANSPORT_BYTES) {
    throw new BusinessLogoValidationError(
      "input_too_large",
      "Prepared logo uploads must be 3 MB or smaller.",
    );
  }

  const sourcePolicy = allowedSources[contentType as keyof typeof allowedSources];
  if (!sourcePolicy) {
    throw new BusinessLogoValidationError(
      "unsupported_type",
      "Choose a PNG, JPEG, or WebP logo.",
    );
  }

  const extension = path.extname(fileName).toLowerCase();
  if (!(sourcePolicy.extensions as readonly string[]).includes(extension)) {
    throw new BusinessLogoValidationError(
      "extension_mismatch",
      "The logo filename does not match its file type.",
    );
  }

  let metadata;
  try {
    metadata = await sharp(buffer, {
      failOn: "warning",
      limitInputPixels: MAX_LOGO_SOURCE_PIXELS,
    }).metadata();
  } catch {
    throw new BusinessLogoValidationError(
      "invalid_image",
      "The uploaded file is not a valid supported image.",
    );
  }

  if (
    !metadata.format ||
    !(sourcePolicy.formats as readonly string[]).includes(metadata.format)
  ) {
    throw new BusinessLogoValidationError(
      "content_mismatch",
      "The logo content does not match its declared file type.",
    );
  }

  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (
    width === 0 ||
    height === 0 ||
    width > MAX_LOGO_SOURCE_EDGE ||
    height > MAX_LOGO_SOURCE_EDGE ||
    width * height > MAX_LOGO_SOURCE_PIXELS
  ) {
    throw new BusinessLogoValidationError(
      "dimensions_too_large",
      "Logo dimensions must be no larger than 6000 pixels per side and 25 megapixels.",
    );
  }

  if ((metadata.pages ?? 1) > 1) {
    throw new BusinessLogoValidationError(
      "animated_image",
      "Animated logo files are not supported.",
    );
  }

  const outputAttempts = [
    { edge: 512, quality: 82 },
    { edge: 512, quality: 72 },
    { edge: 384, quality: 72 },
    { edge: 256, quality: 68 },
  ];

  for (const attempt of outputAttempts) {
    const result = await sharp(buffer, {
      failOn: "warning",
      limitInputPixels: MAX_LOGO_SOURCE_PIXELS,
    })
      .rotate()
      .resize({
        width: attempt.edge,
        height: attempt.edge,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: attempt.quality, effort: 4 })
      .toBuffer({ resolveWithObject: true });

    if (
      result.data.byteLength <= MAX_LOGO_OUTPUT_BYTES &&
      result.info.width <= MAX_LOGO_OUTPUT_EDGE &&
      result.info.height <= MAX_LOGO_OUTPUT_EDGE
    ) {
      return {
        buffer: result.data,
        width: result.info.width,
        height: result.info.height,
        size: result.data.byteLength,
        contentType: BUSINESS_LOGO_OUTPUT_MIME,
      };
    }
  }

  throw new BusinessLogoValidationError(
    "output_too_large",
    "This logo could not be reduced below the 200 KB storage limit.",
  );
}
