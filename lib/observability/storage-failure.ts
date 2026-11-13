// Never retain raw database messages, details, hints, parameters, or causes.
// Only reviewed infrastructure codes may cross the telemetry boundary.
const STORAGE_CODES = new Set([
  "PGRST000",
  "PGRST001",
  "PGRST002",
  "PGRST003",
  "PGRST202",
  "42501",
  "57014",
  "53300",
  "08006",
  "08001",
]);

export function storageFailureCode(error: unknown): string {
  if (error instanceof StorageFailure) return error.storageCode;
  if (typeof error !== "object" || error === null || !("code" in error)) return "unknown";
  return typeof error.code === "string" && STORAGE_CODES.has(error.code)
    ? error.code
    : "unknown";
}

export class StorageFailure extends Error {
  readonly storageCode: string;
  constructor(message: string, error: unknown) {
    super(message);
    this.name = "StorageFailure";
    this.storageCode = storageFailureCode(error);
  }
}

export function storageFailureTags(error: unknown) {
  return { storage_code: storageFailureCode(error) };
}
