import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminMfaSecurity } from "@/components/admin/admin-mfa-security";
import { securityFixture } from "../fixtures/admin-health";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  create: vi.fn(),
  list: vi.fn(),
  enroll: vi.fn(),
  unenroll: vi.fn(),
  verify: vi.fn(),
  assurance: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/lib/supabase/client", () => ({ createClient: mocks.create }));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.create.mockReturnValue({
    auth: {
      mfa: {
        listFactors: mocks.list,
        enroll: mocks.enroll,
        unenroll: mocks.unenroll,
        challengeAndVerify: mocks.verify,
        getAuthenticatorAssuranceLevel: mocks.assurance,
      },
    },
  });
  mocks.list.mockResolvedValue({ data: { totp: [], all: [] }, error: null });
  // Deliberately invalid placeholder, never a real TOTP credential or screenshot fixture.
  mocks.enroll.mockResolvedValue({
    error: null,
    data: {
      type: "totp",
      id: "synthetic-factor",
      totp: { qr_code: "not-a-qr", secret: "NON_CREDENTIAL_TEST_PLACEHOLDER" },
    },
  });
  mocks.unenroll.mockResolvedValue({ error: null });
  mocks.verify.mockResolvedValue({ error: null });
  mocks.assurance.mockResolvedValue({ error: null, data: { currentLevel: "aal2" } });
});
afterEach(cleanup);

describe("unchanged MFA interactions in the compact security card", () => {
  it("does not call Auth on render; explicit setup remains inline and cancel cleans only its factor", async () => {
    render(<AdminMfaSecurity status={securityFixture().mfa!} />);
    expect(mocks.create).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Set up authenticator" }));
    await screen.findByRole("heading", { name: "Scan the authenticator code" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(mocks.enroll).toHaveBeenCalledWith({
      factorType: "totp",
      friendlyName: "My Kustomers Admin",
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancel setup" }));
    await screen.findByRole("button", { name: "Set up authenticator" });
    expect(mocks.unenroll).toHaveBeenCalledWith({ factorId: "synthetic-factor" });
    expect(screen.queryByText("Manual setup key")).not.toBeInTheDocument();
  });

  it("retains pending setup and safe failure without leaking provider diagnostics", async () => {
    let finish!: (value: unknown) => void;
    mocks.list.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    render(<AdminMfaSecurity status={securityFixture().mfa!} />);
    const button = screen.getByRole("button", { name: "Set up authenticator" });
    fireEvent.click(button);
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(mocks.list).toHaveBeenCalledTimes(1);
    await act(async () => finish({ error: { message: "PRIVATE_PROVIDER_DIAGNOSTIC" } }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Unable to verify right now. Try again shortly.",
    );
    expect(screen.queryByText("PRIVATE_PROVIDER_DIAGNOSTIC")).not.toBeInTheDocument();
    expect(button).toBeEnabled();
  });

  it("preserves cleanup of incomplete setup and never enrolls over a verified factor", async () => {
    mocks.list.mockResolvedValueOnce({ error: null, data: { totp: [{}], all: [] } });
    const view = render(<AdminMfaSecurity status={securityFixture().mfa!} />);
    fireEvent.click(screen.getByRole("button", { name: "Set up authenticator" }));
    await screen.findByRole("alert");
    expect(mocks.enroll).not.toHaveBeenCalled();
    expect(mocks.unenroll).not.toHaveBeenCalled();
    view.unmount();
    mocks.list.mockResolvedValueOnce({
      error: null,
      data: {
        totp: [],
        all: [{ id: "incomplete-factor", factor_type: "totp", status: "unverified" }],
      },
    });
    render(<AdminMfaSecurity status={securityFixture().mfa!} />);
    fireEvent.click(screen.getByRole("button", { name: "Set up authenticator" }));
    await screen.findByRole("heading", { name: "Scan the authenticator code" });
    expect(mocks.unenroll).toHaveBeenCalledWith({ factorId: "incomplete-factor" });
    expect(mocks.enroll).toHaveBeenCalledTimes(1);
  });

  it("validates input, rejects incorrect codes, and requires AAL2 before success", async () => {
    render(<AdminMfaSecurity status={securityFixture("configured").mfa!} />);
    const button = screen.getByRole("button", { name: "Verify this session" });
    fireEvent.click(button);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter the 6-digit verification code.",
    );
    expect(mocks.verify).not.toHaveBeenCalled();
    mocks.verify.mockResolvedValueOnce({ error: { message: "private" } });
    fireEvent.change(screen.getByLabelText("Authenticator code"), {
      target: { value: "123456" },
    });
    fireEvent.click(button);
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Invalid or expired verification code.",
      ),
    );
    expect(screen.getByLabelText("Authenticator code")).toHaveValue("");
    mocks.assurance.mockResolvedValueOnce({
      error: null,
      data: { currentLevel: "aal1" },
    });
    fireEvent.change(screen.getByLabelText("Authenticator code"), {
      target: { value: "123456" },
    });
    fireEvent.click(button);
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Unable to verify right now."),
    );
    expect(mocks.refresh).not.toHaveBeenCalled();
    fireEvent.click(button);
    await screen.findByRole("status");
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Authenticator code")).toHaveValue("");
  });

  it("does not offer setup or challenge when authoritative session verification is ready", () => {
    render(<AdminMfaSecurity status={securityFixture("healthy").mfa!} />);
    expect(
      screen.getByRole("heading", { name: "Privileged verification active" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
