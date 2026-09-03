"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { ImageUp, Trash2 } from "lucide-react";
import { BusinessLogo } from "@/components/shared/business-logo";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  BusinessLogoPreparationError,
  prepareBusinessLogoForUpload,
  validateBusinessLogoSource,
} from "@/features/businesses/logo-client";

type LogoResponse = {
  status: "success" | "error";
  message: string;
  logoUrl?: string | null;
};

export const BUSINESS_LOGO_REQUEST_TIMEOUT_MS = 120_000;

class BusinessLogoRequestError extends Error {
  constructor(public readonly code: "timeout" | "network" | "invalid_response") {
    super(code);
    this.name = "BusinessLogoRequestError";
  }
}

function isLogoResponse(value: unknown): value is LogoResponse {
  if (!value || typeof value !== "object") return false;
  const result = value as Record<string, unknown>;
  return (
    (result.status === "success" || result.status === "error") &&
    typeof result.message === "string" &&
    (result.logoUrl === undefined ||
      result.logoUrl === null ||
      typeof result.logoUrl === "string")
  );
}

async function requestBusinessLogo({
  businessId,
  method,
  body,
  operationSignal,
}: {
  businessId: string;
  method: "POST" | "DELETE";
  body?: FormData;
  operationSignal: AbortSignal;
}) {
  const controller = new AbortController();
  const abortRequest = () => controller.abort();
  operationSignal.addEventListener("abort", abortRequest, { once: true });
  let timedOut = false;
  const timeout = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, BUSINESS_LOGO_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`/api/businesses/${businessId}/logo`, {
      method,
      body,
      signal: controller.signal,
    });
    let result: unknown;
    try {
      result = await response.json();
    } catch {
      throw new BusinessLogoRequestError("invalid_response");
    }
    if (!isLogoResponse(result)) {
      throw new BusinessLogoRequestError("invalid_response");
    }
    return { response, result };
  } catch (error) {
    if (timedOut) throw new BusinessLogoRequestError("timeout");
    if (error instanceof BusinessLogoRequestError) throw error;
    throw new BusinessLogoRequestError("network");
  } finally {
    window.clearTimeout(timeout);
    operationSignal.removeEventListener("abort", abortRequest);
  }
}

export function BusinessLogoForm({
  businessId,
  businessName,
  currentLogoUrl,
  isOwner,
  mode = "settings",
  inputId: inputIdProp,
  onSelectionChange,
  onPersisted,
}: {
  businessId: string | null;
  businessName: string;
  currentLogoUrl: string | null;
  isOwner: boolean;
  mode?: "settings" | "onboarding";
  inputId?: string;
  onSelectionChange?: (selected: boolean) => void;
  onPersisted?: () => void;
}) {
  const router = useRouter();
  const generatedInputId = useId();
  const inputId = inputIdProp ?? `business-logo-${generatedInputId}`;
  const helpId = `${inputId}-help`;
  const messageId = `${inputId}-message`;
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedFileRef = useRef<File | null>(null);
  const activeOperationRef = useRef<AbortController | null>(null);
  const operationPhaseRef = useRef<"preparing" | "uploading" | null>(null);
  const selectionVersionRef = useRef(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [persistedUrl, setPersistedUrl] = useState(currentLogoUrl);
  const [message, setMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<
    "idle" | "preparing" | "pending" | "success" | "error"
  >("idle");
  const uploadedBusinessIdRef = useRef<string | null>(null);
  const completionNotifiedRef = useRef(false);

  useEffect(() => {
    const operationRef = activeOperationRef;
    return () => operationRef.current?.abort();
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  function selectPreview(file: File | undefined) {
    if (operationPhaseRef.current === "preparing") {
      activeOperationRef.current?.abort();
      activeOperationRef.current = null;
      operationPhaseRef.current = null;
    }
    selectionVersionRef.current += 1;
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    const validationMessage = file ? validateBusinessLogoSource(file) : null;
    if (validationMessage) {
      selectedFileRef.current = null;
      setPreviewUrl(null);
      onSelectionChange?.(false);
      setMessage(validationMessage);
      setStatus("error");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    selectedFileRef.current = file ?? null;
    setPreviewUrl(file ? URL.createObjectURL(file) : null);
    if (mode === "onboarding" && businessId) {
      uploadedBusinessIdRef.current = null;
    }
    onSelectionChange?.(Boolean(file));
    setMessage(null);
    setStatus("idle");
  }

  const submitLogo = useCallback(async () => {
    const file = selectedFileRef.current ?? inputRef.current?.files?.[0];
    if (!file) {
      setStatus("error");
      setMessage("Choose a logo image to upload.");
      return;
    }
    if (!businessId || activeOperationRef.current) {
      return;
    }

    const controller = new AbortController();
    const selectionVersion = selectionVersionRef.current;
    activeOperationRef.current = controller;
    operationPhaseRef.current = "preparing";
    setStatus("preparing");
    setMessage(null);

    try {
      const prepared = await prepareBusinessLogoForUpload(file, {
        signal: controller.signal,
      });
      if (selectionVersion !== selectionVersionRef.current) return;

      operationPhaseRef.current = "uploading";
      setStatus("pending");
      const body = new FormData();
      body.set("logo", prepared.file);
      const { response, result } = await requestBusinessLogo({
        businessId,
        method: "POST",
        body,
        operationSignal: controller.signal,
      });

      setStatus(response.ok ? "success" : "error");
      setMessage(result.message);
      if (response.ok) {
        setPersistedUrl(result.logoUrl ? `${result.logoUrl}?v=${Date.now()}` : null);
        if (previewUrl) {
          URL.revokeObjectURL(previewUrl);
        }
        setPreviewUrl(null);
        if (inputRef.current) {
          inputRef.current.value = "";
        }
        selectedFileRef.current = null;
        router.refresh();
        onPersisted?.();
      } else if (inputRef.current) {
        inputRef.current.value = "";
      }
    } catch (error) {
      if (
        error instanceof BusinessLogoPreparationError &&
        error.code === "aborted" &&
        selectionVersion !== selectionVersionRef.current
      ) {
        return;
      }
      setStatus("error");
      setMessage(
        error instanceof BusinessLogoPreparationError
          ? error.message
          : error instanceof BusinessLogoRequestError && error.code === "timeout"
            ? "Upload timed out. Please try again."
            : "Unable to upload the logo. Please try again.",
      );
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    } finally {
      if (activeOperationRef.current === controller) {
        activeOperationRef.current = null;
        operationPhaseRef.current = null;
      }
    }
  }, [businessId, onPersisted, previewUrl, router]);

  useEffect(() => {
    if (
      mode !== "onboarding" ||
      !businessId ||
      !selectedFileRef.current ||
      uploadedBusinessIdRef.current === businessId
    ) {
      return;
    }

    uploadedBusinessIdRef.current = businessId;
    void submitLogo();
  }, [businessId, mode, submitLogo]);

  useEffect(() => {
    if (
      mode === "onboarding" &&
      businessId &&
      currentLogoUrl &&
      !completionNotifiedRef.current
    ) {
      completionNotifiedRef.current = true;
      onPersisted?.();
    }
  }, [businessId, currentLogoUrl, mode, onPersisted]);

  async function removeLogo() {
    if (!businessId || activeOperationRef.current) {
      return;
    }
    const controller = new AbortController();
    activeOperationRef.current = controller;
    operationPhaseRef.current = "uploading";
    setStatus("pending");
    setMessage(null);

    try {
      const { response, result } = await requestBusinessLogo({
        businessId,
        method: "DELETE",
        operationSignal: controller.signal,
      });

      setStatus(response.ok ? "success" : "error");
      setMessage(result.message);
      if (response.ok) {
        setPersistedUrl(null);
        if (previewUrl) {
          URL.revokeObjectURL(previewUrl);
        }
        setPreviewUrl(null);
        if (inputRef.current) {
          inputRef.current.value = "";
        }
        selectedFileRef.current = null;
        router.refresh();
      }
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof BusinessLogoRequestError && error.code === "timeout"
          ? "Request timed out. Please try again."
          : "Unable to remove the logo. Please try again.",
      );
    } finally {
      if (activeOperationRef.current === controller) {
        activeOperationRef.current = null;
        operationPhaseRef.current = null;
      }
    }
  }

  const isBusy = status === "preparing" || status === "pending";

  return (
    <section
      className="space-y-4"
      aria-busy={isBusy}
      aria-label={
        mode === "onboarding" ? "Required business logo" : "Business logo settings"
      }
    >
      <div className="flex items-center gap-3 sm:gap-4">
        <BusinessLogo
          name={businessName}
          url={previewUrl ?? persistedUrl}
          className={
            mode === "onboarding"
              ? "size-20 rounded-lg bg-primary/5 text-lg text-primary"
              : "size-16 sm:size-20"
          }
        />
        <div className="min-w-0">
          <p className="font-medium">{businessName}</p>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            {mode === "onboarding"
              ? "Customers will see this logo on your booking confirmation pages."
              : persistedUrl
                ? "Current business logo"
                : "Business initials are used until a logo is added."}
          </p>
        </div>
      </div>

      {isOwner ? (
        <div className="space-y-4">
          {isBusy ? (
            <p className="sr-only" role="status" aria-live="polite">
              {status === "preparing" ? "Preparing image." : "Uploading logo."}
            </p>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor={inputId}>
              Logo image{" "}
              {mode === "onboarding" ? (
                <span className="text-destructive" aria-hidden="true">
                  *
                </span>
              ) : null}
            </Label>
            <div>
              <input
                ref={inputRef}
                id={inputId}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  event.currentTarget.value = "";
                  if (file) selectPreview(file);
                }}
                disabled={
                  isBusy || Boolean(persistedUrl && mode === "onboarding")
                }
                required={mode === "onboarding"}
                className="peer sr-only"
                aria-invalid={status === "error"}
                aria-describedby={message ? `${helpId} ${messageId}` : helpId}
              />
              <Label
                htmlFor={inputId}
                aria-disabled={
                  isBusy || Boolean(persistedUrl && mode === "onboarding")
                }
                className={`${buttonVariants({ variant: "secondary", size: "md" })} w-full cursor-pointer peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 sm:w-fit ${
                  isBusy || Boolean(persistedUrl && mode === "onboarding")
                    ? "pointer-events-none opacity-50"
                    : ""
                }`}
              >
                <ImageUp className="size-4" aria-hidden="true" />
                {previewUrl || persistedUrl
                  ? "Choose another image"
                  : "Choose image"}
              </Label>
            </div>
            <p
              id={helpId}
              className="text-xs leading-5 text-muted-foreground"
            >
              {mode === "settings"
                ? "PNG, JPEG, or WebP up to 5 MB."
                : "PNG, JPEG, or WebP up to 5 MB. Saved as a WebP no larger than 512px and 200 KB."}
            </p>
          </div>

          {message ? (
            <p
              id={messageId}
              className={
                status === "error"
                  ? "text-sm text-destructive"
                  : "text-sm text-muted-foreground"
              }
              role={status === "error" ? "alert" : "status"}
            >
              {message}
            </p>
          ) : null}

          {mode === "settings" || (businessId && status === "error") ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                disabled={isBusy || !businessId}
                className="w-full sm:w-fit"
                onClick={() => void submitLogo()}
              >
                <ImageUp className="size-4" aria-hidden="true" />
                {status === "preparing"
                  ? "Preparing image..."
                  : status === "pending"
                    ? "Saving..."
                  : mode === "onboarding" && status === "error"
                    ? "Retry logo upload"
                    : persistedUrl
                      ? "Replace logo"
                      : "Upload logo"}
              </Button>
              {persistedUrl && mode === "settings" ? (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={isBusy}
                  onClick={removeLogo}
                  className="w-full sm:w-fit"
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                  Remove logo
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
