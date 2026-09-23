"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  qrSchema,
  controlStatusSchema,
  type PairingQr,
} from "@/features/whatsapp/control-model";

export function PairingDialog() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary">Open pairing code</Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Connect WhatsApp</DialogTitle>
          <DialogDescription>
            On the phone you want to use, open WhatsApp → Settings → Linked devices → Link
            a device.
          </DialogDescription>
        </DialogHeader>
        {open ? <PairingCode /> : null}
      </DialogContent>
    </Dialog>
  );
}
function PairingCode() {
  const router = useRouter();
  const [qr, setQr] = useState<PairingQr | null>(null);
  const [message, setMessage] = useState("Loading pairing code…");
  const [generation, setGeneration] = useState(0);
  const [stopped, setStopped] = useState(false);
  const ended = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    let expiry: ReturnType<typeof setTimeout> | undefined;
    void (async () => {
      try {
        const response = await fetch("/api/admin/whatsapp/qr", {
          cache: "no-store",
          signal: controller.signal,
        });
        const parsed = qrSchema.safeParse(await response.json());
        if (!response.ok || !parsed.success) throw Error("unavailable");
        if (controller.signal.aborted || ended.current) return;
        setQr(parsed.data);
        setMessage("Waiting for connection…");
        expiry = setTimeout(() => {
          setQr(null);
          setMessage(
            "Pairing code expired. Refresh the code if pairing is still active.",
          );
        }, parsed.data.expiresInSeconds * 1000);
      } catch {
        if (!controller.signal.aborted) {
          setQr(null);
          setMessage(
            "Pairing code unavailable. Verify your Admin security or start pairing again.",
          );
        }
      }
    })();
    return () => {
      controller.abort();
      if (expiry) clearTimeout(expiry);
    };
  }, [generation]);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = Date.now() + 120000;
    const stop = (message: string) => {
      ended.current = true;
      setQr(null);
      setMessage(message);
      setStopped(true);
    };
    const poll = async () => {
      if (Date.now() >= deadline) {
        stop("Pairing expired. Close this dialog and start pairing again.");
        return;
      }
      try {
        const response = await fetch("/api/admin/whatsapp/status", {
          cache: "no-store",
          signal: controller.signal,
        });
        const body = await response.json();
        const parsed = controlStatusSchema.safeParse(body.status);
        if (controller.signal.aborted || ended.current) return;
        if (!response.ok || !parsed.success) {
          stop("Gateway unavailable. Close this dialog and refresh status.");
          return;
        }
        if (parsed.data.status === "CONNECTED") {
          stop("Account connected. Close this dialog, then verify and resume sending.");
          router.refresh();
          return;
        }
        if (!["PAIRING", "CONNECTING"].includes(parsed.data.status)) {
          stop("Pairing is no longer active. Close this dialog and refresh status.");
          return;
        }
        timer = setTimeout(() => void poll(), 4000);
      } catch {
        if (!controller.signal.aborted)
          stop("Status unavailable. Close this dialog and refresh status.");
      }
    };
    timer = setTimeout(() => void poll(), 4000);
    return () => {
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [router]);
  return (
    <div className="min-w-0 space-y-4 pt-3" data-sentry-mask>
      {qr && !stopped ? (
        <Image
          unoptimized
          src={qr.image}
          alt="Temporary WhatsApp pairing code"
          width={280}
          height={280}
          className="mx-auto h-auto w-full max-w-[280px]"
        />
      ) : null}
      <p role="status" className="text-sm text-muted-foreground">
        {message}
      </p>
      {!qr && !stopped ? (
        <Button variant="secondary" onClick={() => setGeneration((value) => value + 1)}>
          Refresh pairing code
        </Button>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Sending stays paused until connection is verified. Never share or save this code.
      </p>
    </div>
  );
}
