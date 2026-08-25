"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImageUp, Trash2 } from "lucide-react";
import { BusinessLogo } from "@/components/shared/business-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type LogoResponse = {
  status: "success" | "error";
  message: string;
  logoUrl?: string | null;
};

export function BusinessLogoForm({
  businessId,
  businessName,
  currentLogoUrl,
  isOwner,
  mode = "settings",
  onSelectionChange,
  onPersisted,
}: {
  businessId: string | null;
  businessName: string;
  currentLogoUrl: string | null;
  isOwner: boolean;
  mode?: "settings" | "onboarding";
  onSelectionChange?: (selected: boolean) => void;
  onPersisted?: () => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedFileRef = useRef<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [persistedUrl, setPersistedUrl] = useState(currentLogoUrl);
  const [message, setMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "pending" | "success" | "error">("idle");
  const uploadedBusinessIdRef = useRef<string | null>(null);
  const completionNotifiedRef = useRef(false);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  function selectPreview(file: File | undefined) {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
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
    if (!businessId || status === "pending") {
      return;
    }

    setStatus("pending");
    setMessage(null);
    const body = new FormData();
    body.set("logo", file);

    try {
      const response = await fetch(`/api/businesses/${businessId}/logo`, {
        method: "POST",
        body,
      });
      const result = (await response.json()) as LogoResponse;

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
      }
    } catch {
      setStatus("error");
      setMessage("The logo request could not be completed. Please try again.");
    }
  }, [businessId, onPersisted, previewUrl, router, status]);

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
    if (!businessId) {
      return;
    }
    setStatus("pending");
    setMessage(null);

    try {
      const response = await fetch(`/api/businesses/${businessId}/logo`, {
        method: "DELETE",
      });
      const result = (await response.json()) as LogoResponse;

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
    } catch {
      setStatus("error");
      setMessage("The logo request could not be completed. Please try again.");
    }
  }

  return (
    <section
      className="space-y-5"
      aria-label={
        mode === "onboarding" ? "Required business logo" : "Business logo settings"
      }
    >
      <div className="flex items-center gap-4">
        <BusinessLogo
          name={businessName}
          url={previewUrl ?? persistedUrl}
          className="size-20 sm:size-24"
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
          <div className="space-y-2">
            <Label htmlFor="business-logo">Logo image</Label>
            <Input
              ref={inputRef}
              id="business-logo"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => selectPreview(event.target.files?.[0])}
              disabled={
                status === "pending" || Boolean(persistedUrl && mode === "onboarding")
              }
              required={mode === "onboarding"}
              aria-invalid={status === "error"}
              aria-describedby={
                message
                  ? "business-logo-help business-logo-message"
                  : "business-logo-help"
              }
            />
            <p
              id="business-logo-help"
              className="text-xs leading-5 text-muted-foreground"
            >
              PNG, JPEG, or WebP up to 2 MB. Saved as a WebP no larger than 512px and 200
              KB.
            </p>
          </div>

          {message ? (
            <p
              id="business-logo-message"
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
                disabled={status === "pending" || !businessId}
                className="w-full sm:w-fit"
                onClick={() => void submitLogo()}
              >
                <ImageUp className="size-4" aria-hidden="true" />
                {status === "pending"
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
                  disabled={status === "pending"}
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
