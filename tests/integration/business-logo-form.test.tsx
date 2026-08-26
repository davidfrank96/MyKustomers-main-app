import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BusinessLogoForm } from "@/components/forms/business-logo-form";
import {
  MAX_BUSINESS_LOGO_SOURCE_BYTES,
  MAX_BUSINESS_LOGO_TRANSPORT_BYTES,
} from "@/features/businesses/logo-policy";

const navigation = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => navigation,
}));

const requestTimeoutMs = 120_000;

function unresolvedRequestThatRejectsOnAbort() {
  return vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        reject(new DOMException("The operation was aborted.", "AbortError"));
      });
    }),
  );
}

function renderLogoForm(currentLogoUrl: string | null = null) {
  render(
    <BusinessLogoForm
      businessId="00000000-0000-4000-8000-000000000001"
      businessName="Test business"
      currentLogoUrl={currentLogoUrl}
      isOwner
    />,
  );
}

function largeJpeg(bytes: number, name = "phone-photo.jpg") {
  return new File(
    [Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]), new Uint8Array(bytes - 4)],
    name,
    { type: "image/jpeg" },
  );
}

function installPreparationMocks(encodedBytes = 450_000) {
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async () => ({
      close: vi.fn(),
      height: 3000,
      width: 4000,
    })),
  );
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    clearRect: vi.fn(),
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
    (callback) =>
      callback(new Blob([new Uint8Array(encodedBytes)], { type: "image/jpeg" })),
  );
}

describe("BusinessLogoForm request lifecycle", () => {
  beforeEach(() => {
    navigation.refresh.mockReset();
    vi.stubGlobal("fetch", unresolvedRequestThatRejectsOnAbort());
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => "blob:test-logo"),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("terminates a stalled upload and allows the same selected file to retry", async () => {
    vi.useFakeTimers();
    renderLogoForm();
    const input = screen.getByLabelText("Logo image");
    const logo = new File(["valid image bytes"], "logo.png", { type: "image/png" });

    fireEvent.change(input, { target: { files: [logo] } });
    fireEvent.click(screen.getByRole("button", { name: "Upload logo" }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(requestTimeoutMs);
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Upload timed out. Please try again.",
    );
    expect(input).toHaveValue("");
    const retry = screen.getByRole("button", { name: "Upload logo" });
    expect(retry).toBeEnabled();

    fireEvent.click(retry);
    await act(async () => {
      await Promise.resolve();
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("terminates a stalled removal and restores both controls", async () => {
    vi.useFakeTimers();
    renderLogoForm("https://example.com/logo.webp");

    fireEvent.click(screen.getByRole("button", { name: "Remove logo" }));
    expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(requestTimeoutMs);
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Request timed out. Please try again.",
    );
    expect(screen.getByRole("button", { name: "Replace logo" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Remove logo" })).toBeEnabled();
  });

  it("surfaces a safe API validation error and restores the upload control", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({ status: "error", message: "Unsupported image type." }),
          { status: 400, headers: { "content-type": "application/json" } },
        ),
      ),
    );
    renderLogoForm();
    fireEvent.change(screen.getByLabelText("Logo image"), {
      target: {
        files: [new File(["bad"], "bad.png", { type: "image/png" })],
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Upload logo" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unsupported image type.",
    );
    expect(screen.getByLabelText("Logo image")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Upload logo" })).toBeEnabled();
  });

  it("fails closed on a malformed response instead of remaining pending", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("gateway response", { status: 502 })),
    );
    renderLogoForm();
    fireEvent.change(screen.getByLabelText("Logo image"), {
      target: {
        files: [new File(["image"], "logo.webp", { type: "image/webp" })],
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Upload logo" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to upload the logo. Please try again.",
    );
    expect(screen.getByRole("button", { name: "Upload logo" })).toBeEnabled();
  });

  it("refreshes identity after one successful request", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          status: "success",
          message: "Business logo uploaded.",
          logoUrl: "https://example.com/logo.webp",
        }),
      ),
    );
    renderLogoForm();
    fireEvent.change(screen.getByLabelText("Logo image"), {
      target: {
        files: [new File(["image"], "logo.png", { type: "image/png" })],
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Upload logo" }));

    expect(await screen.findByText("Business logo uploaded.")).toHaveTextContent(
      "Business logo uploaded.",
    );
    await waitFor(() => expect(navigation.refresh).toHaveBeenCalledTimes(1));
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("uses an immediate in-flight guard against duplicate submissions", async () => {
    renderLogoForm();
    fireEvent.change(screen.getByLabelText("Logo image"), {
      target: {
        files: [new File(["image"], "logo.png", { type: "image/png" })],
      },
    });
    const upload = screen.getByRole("button", { name: "Upload logo" });

    act(() => {
      upload.click();
      upload.click();
    });

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  });

  it("aborts an active request when navigation unmounts the form", async () => {
    const { unmount } = render(
      <BusinessLogoForm
        businessId="00000000-0000-4000-8000-000000000001"
        businessName="Test business"
        currentLogoUrl={null}
        isOwner
      />,
    );
    fireEvent.change(screen.getByLabelText("Logo image"), {
      target: {
        files: [new File(["image"], "logo.png", { type: "image/png" })],
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Upload logo" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const signal = vi.mocked(fetch).mock.calls[0]?.[1]?.signal;

    expect(signal?.aborted).toBe(false);
    unmount();
    expect(signal?.aborted).toBe(true);
  });

  it("prepares a 4-5 MiB source before sending one bounded multipart request", async () => {
    installPreparationMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          status: "success",
          message: "Business logo uploaded.",
          logoUrl: "https://example.com/logo.webp",
        }),
      ),
    );
    renderLogoForm();
    fireEvent.change(screen.getByLabelText("Logo image"), {
      target: { files: [largeJpeg(4_800_000)] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Upload logo" }));

    expect(screen.getByRole("button", { name: "Preparing image..." })).toBeDisabled();
    expect(screen.getByRole("status", { name: "" })).toHaveTextContent(
      "Preparing image.",
    );
    expect(await screen.findByText("Business logo uploaded.")).toHaveTextContent(
      "Business logo uploaded.",
    );
    expect(fetch).toHaveBeenCalledTimes(1);
    const body = vi.mocked(fetch).mock.calls[0]?.[1]?.body as FormData;
    const prepared = body.get("logo") as File;
    expect(prepared.size).toBeLessThanOrEqual(MAX_BUSINESS_LOGO_TRANSPORT_BYTES);
    expect(prepared.size).toBe(450_000);
  });

  it("rejects a source above 5 MiB before preprocessing or upload", () => {
    renderLogoForm();
    fireEvent.change(screen.getByLabelText("Logo image"), {
      target: { files: [largeJpeg(MAX_BUSINESS_LOGO_SOURCE_BYTES + 1)] },
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Logo image must be 5 MB or smaller.",
    );
    expect(screen.getByLabelText("Logo image")).toHaveValue("");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("recovers from client preprocessing failure without a server request", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn(async () => Promise.reject(new Error("bad"))));
    renderLogoForm();
    fireEvent.change(screen.getByLabelText("Logo image"), {
      target: { files: [largeJpeg(4_800_000)] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Upload logo" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to prepare this image. Try another image.",
    );
    expect(screen.getByRole("button", { name: "Upload logo" })).toBeEnabled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("ignores stale preprocessing when the selected source changes", async () => {
    let resolveBitmap!: (bitmap: ImageBitmap) => void;
    const createBitmap = vi.fn(
      () =>
        new Promise<ImageBitmap>((resolve) => {
          resolveBitmap = resolve;
        }),
    );
    vi.stubGlobal(
      "createImageBitmap",
      createBitmap,
    );
    renderLogoForm();
    const input = screen.getByLabelText("Logo image");
    fireEvent.change(input, { target: { files: [largeJpeg(4_800_000, "first.jpg")] } });
    fireEvent.click(screen.getByRole("button", { name: "Upload logo" }));
    expect(screen.getByRole("button", { name: "Preparing image..." })).toBeDisabled();
    await waitFor(() => expect(createBitmap).toHaveBeenCalledTimes(1));

    const replacement = new File(["small"], "replacement.jpg", { type: "image/jpeg" });
    fireEvent.change(input, { target: { files: [replacement] } });
    fireEvent.click(screen.getByRole("button", { name: "Upload logo" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));

    resolveBitmap({ close: vi.fn(), height: 3000, width: 4000 } as unknown as ImageBitmap);
    await act(async () => {
      await Promise.resolve();
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    const body = vi.mocked(fetch).mock.calls[0]?.[1]?.body as FormData;
    expect(body.get("logo")).toBe(replacement);
  });
});
