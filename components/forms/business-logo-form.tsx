"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
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
}: {
  businessId: string;
  businessName: string;
  currentLogoUrl: string | null;
  isOwner: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [persistedUrl, setPersistedUrl] = useState(currentLogoUrl);
  const [message, setMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "pending" | "success" | "error">("idle");

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
    setPreviewUrl(file ? URL.createObjectURL(file) : null);
    setMessage(null);
    setStatus("idle");
  }

  async function submitLogo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = inputRef.current?.files?.[0];
    if (!file) {
      setStatus("error");
      setMessage("Choose a logo image to upload.");
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
        router.refresh();
      }
    } catch {
      setStatus("error");
      setMessage("The logo request could not be completed. Please try again.");
    }
  }

  async function removeLogo() {
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
        router.refresh();
      }
    } catch {
      setStatus("error");
      setMessage("The logo request could not be completed. Please try again.");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <BusinessLogo
          name={businessName}
          url={previewUrl ?? persistedUrl}
          className="size-20 sm:size-24"
        />
        <div className="min-w-0">
          <p className="font-medium">{businessName}</p>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            {persistedUrl ? "Current business logo" : "Business initials are used until a logo is added."}
          </p>
        </div>
      </div>

      {isOwner ? (
        <form onSubmit={submitLogo} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="business-logo">Logo image</Label>
            <Input
              ref={inputRef}
              id="business-logo"
              name="logo"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => selectPreview(event.target.files?.[0])}
              disabled={status === "pending"}
            />
            <p className="text-xs leading-5 text-muted-foreground">
              PNG, JPEG, or WebP up to 2 MB. Saved as a WebP no larger than 512px and 200 KB.
            </p>
          </div>

          {message ? (
            <p
              className={status === "error" ? "text-sm text-destructive" : "text-sm text-muted-foreground"}
              role={status === "error" ? "alert" : "status"}
            >
              {message}
            </p>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="submit" disabled={status === "pending"} className="w-full sm:w-fit">
              <ImageUp className="size-4" aria-hidden="true" />
              {status === "pending" ? "Saving..." : persistedUrl ? "Replace logo" : "Upload logo"}
            </Button>
            {persistedUrl ? (
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
        </form>
      ) : null}
    </div>
  );
}
