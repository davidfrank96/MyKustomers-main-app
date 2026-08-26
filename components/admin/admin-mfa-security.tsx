"use client";

import { CheckCircle2, KeyRound, Loader2, ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AdminMfaSecurityStatus } from "@/features/admin/security";
import { createClient } from "@/lib/supabase/client";

type Enrollment = {
  factorId: string;
  qrCode: string | null;
  secret: string;
};

type Notice = { kind: "error" | "success"; message: string } | null;

function safeErrorMessage() {
  return "Unable to verify right now. Try again shortly.";
}

function normalizeQrCode(value: string) {
  return value.startsWith("data:image/svg+xml") ? value : null;
}

export function AdminMfaSecurity({ status }: { status: AdminMfaSecurityStatus }) {
  const router = useRouter();
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const verifiedFactor = status.verifiedFactors[0] ?? null;
  const isPrivilegedAccessReady = status.privilegedAccessReady;

  async function beginEnrollment() {
    setPending(true);
    setNotice(null);

    try {
      const supabase = createClient();
      const factors = await supabase.auth.mfa.listFactors();

      if (factors.error) {
        setNotice({ kind: "error", message: safeErrorMessage() });
        return;
      }

      if (factors.data.totp.length > 0) {
        setNotice({
          kind: "error",
          message: "An authenticator is already configured. Verify it to continue.",
        });
        router.refresh();
        return;
      }

      for (const factor of factors.data.all) {
        if (factor.factor_type === "totp" && factor.status === "unverified") {
          const cleanup = await supabase.auth.mfa.unenroll({ factorId: factor.id });
          if (cleanup.error) {
            setNotice({ kind: "error", message: safeErrorMessage() });
            return;
          }
        }
      }

      const result = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "My Kustomers Admin",
      });

      if (result.error || result.data.type !== "totp") {
        setNotice({ kind: "error", message: safeErrorMessage() });
        return;
      }

      setEnrollment({
        factorId: result.data.id,
        qrCode: normalizeQrCode(result.data.totp.qr_code),
        secret: result.data.totp.secret,
      });
      setCode("");
    } catch {
      setNotice({ kind: "error", message: safeErrorMessage() });
    } finally {
      setPending(false);
    }
  }

  async function cancelEnrollment() {
    if (!enrollment) return;

    setPending(true);
    setNotice(null);
    try {
      const supabase = createClient();
      const result = await supabase.auth.mfa.unenroll({
        factorId: enrollment.factorId,
      });

      if (result.error) {
        setNotice({ kind: "error", message: safeErrorMessage() });
        return;
      }

      setEnrollment(null);
      setCode("");
      router.refresh();
    } catch {
      setNotice({ kind: "error", message: safeErrorMessage() });
    } finally {
      setPending(false);
    }
  }

  async function verify(factorId: string) {
    const normalizedCode = code.replace(/\s/g, "");
    if (!/^\d{6}$/.test(normalizedCode)) {
      setNotice({ kind: "error", message: "Enter the 6-digit verification code." });
      return;
    }

    setPending(true);
    setNotice(null);
    try {
      const supabase = createClient();
      const result = await supabase.auth.mfa.challengeAndVerify({
        factorId,
        code: normalizedCode,
      });

      if (result.error) {
        setCode("");
        setNotice({ kind: "error", message: "Invalid or expired verification code." });
        return;
      }

      const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assurance.error || assurance.data.currentLevel !== "aal2") {
        setNotice({ kind: "error", message: safeErrorMessage() });
        return;
      }

      setEnrollment(null);
      setCode("");
      setNotice({
        kind: "success",
        message: "Authenticator verified. This session is now at AAL2.",
      });
      router.refresh();
    } catch {
      setNotice({ kind: "error", message: safeErrorMessage() });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <section
        className="border border-border bg-card p-5 shadow-sm"
        aria-labelledby="mfa-status"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 id="mfa-status" className="text-base font-semibold">
              Multi-factor authentication
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Protect privileged platform actions with a TOTP authenticator app.
            </p>
          </div>
          <Badge variant={verifiedFactor ? "default" : "outline"}>
            {verifiedFactor ? "Configured" : "Not configured"}
          </Badge>
        </div>

        <dl className="mt-5 grid gap-4 border-t border-border pt-5 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase text-muted-foreground">
              Current assurance
            </dt>
            <dd className="mt-1 text-sm font-semibold uppercase">
              {status.currentLevel}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-muted-foreground">
              Verified authenticators
            </dt>
            <dd className="mt-1 text-sm font-semibold">
              {status.verifiedFactors.length}
            </dd>
          </div>
        </dl>

        {verifiedFactor ? (
          <div className="mt-5 flex items-start gap-3 border-t border-border pt-5">
            <CheckCircle2
              className="mt-0.5 size-5 shrink-0 text-primary"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm font-medium">MFA configured</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Privileged actions still require this session to be verified at AAL2.
              </p>
            </div>
          </div>
        ) : null}

        {status.unverifiedFactorCount > 0 && !enrollment ? (
          <p className="mt-5 text-sm text-muted-foreground">
            An incomplete setup will be cleared when setup starts again.
          </p>
        ) : null}
      </section>

      {notice ? (
        <p
          role={notice.kind === "error" ? "alert" : "status"}
          aria-live="polite"
          className={
            notice.kind === "error"
              ? "border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
              : "border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-foreground"
          }
        >
          {notice.message}
        </p>
      ) : null}

      {!verifiedFactor && !enrollment ? (
        <section className="border-t border-border pt-6" aria-labelledby="setup-mfa">
          <div className="flex items-start gap-3">
            <KeyRound className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <div>
              <h2 id="setup-mfa" className="text-base font-semibold">
                Set up an authenticator
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Use an authenticator app to add the required second factor.
              </p>
              <Button
                className="mt-4"
                type="button"
                onClick={beginEnrollment}
                disabled={pending}
              >
                {pending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : null}
                Set up authenticator
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      {enrollment ? (
        <section
          className="border border-border bg-card p-5 shadow-sm"
          aria-labelledby="scan-code"
        >
          <h2 id="scan-code" className="text-base font-semibold">
            Scan the authenticator code
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Scan this QR code, then enter the current 6-digit code. The setup key is shown
            only while this enrollment is open.
          </p>

          {enrollment.qrCode ? (
            // The QR is a short-lived Supabase data URL; image optimization would retain sensitive material.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={enrollment.qrCode}
              alt="Authenticator enrollment QR code"
              width={240}
              height={240}
              className="mt-5 aspect-square w-full max-w-60 border border-border bg-white p-2"
            />
          ) : null}

          <div className="mt-5 min-w-0">
            <p className="text-sm font-medium">Manual setup key</p>
            <code className="mt-2 block max-w-full break-all border border-border bg-muted p-3 text-sm">
              {enrollment.secret}
            </code>
          </div>

          <div className="mt-5 max-w-sm">
            <Label htmlFor="enrollment-code">Verification code</Label>
            <Input
              id="enrollment-code"
              className="mt-2"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              aria-describedby="enrollment-code-help"
            />
            <p id="enrollment-code-help" className="mt-2 text-xs text-muted-foreground">
              Enter the 6-digit code from your authenticator app.
            </p>
          </div>

          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row">
            <Button
              type="button"
              variant="secondary"
              onClick={cancelEnrollment}
              disabled={pending}
            >
              Cancel setup
            </Button>
            <Button
              type="button"
              onClick={() => verify(enrollment.factorId)}
              disabled={pending}
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              Verify and enable
            </Button>
          </div>
        </section>
      ) : null}

      {verifiedFactor && !isPrivilegedAccessReady ? (
        <section
          className="border border-border bg-card p-5 shadow-sm"
          aria-labelledby="verify-session"
        >
          <div className="flex items-start gap-3">
            <ShieldAlert
              className="mt-0.5 size-5 shrink-0 text-destructive"
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <h2 id="verify-session" className="text-base font-semibold">
                Additional verification required
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Verify your authenticator before a privileged platform action can proceed.
              </p>
              <div className="mt-5 max-w-sm">
                <Label htmlFor="challenge-code">Authenticator code</Label>
                <Input
                  id="challenge-code"
                  className="mt-2"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                />
              </div>
              <Button
                className="mt-4"
                type="button"
                onClick={() => verify(verifiedFactor.id)}
                disabled={pending}
              >
                {pending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : null}
                Verify this session
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      {verifiedFactor && isPrivilegedAccessReady ? (
        <section className="border-t border-border pt-6" aria-labelledby="session-ready">
          <h2 id="session-ready" className="text-base font-semibold">
            Privileged verification active
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Supabase reports this session at AAL2. Platform authority is still rechecked
            for every privileged action.
          </p>
        </section>
      ) : null}
    </div>
  );
}
