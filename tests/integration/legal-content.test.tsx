import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { TermsContent } from "@/components/legal/terms-content";

it("preserves the approved 8 October 2026 legal text byte for byte", () => {
  const source = readFileSync("components/legal/terms-content.tsx", "utf8");
  const text = source.split("const sections = ")[1].split(" as const;")[0];
  // Approved source at main 1aa41cc: headings, ordering, paragraphs and punctuation.
  expect(createHash("sha256").update(text).digest("hex")).toBe(
    "5236adaaaffd49863105ecd2c57b13419c9cbd91a207356dda6164940f4870d9",
  );
  const { container } = render(<TermsContent />);
  expect(screen.getAllByText("8 October 2026")).toHaveLength(2);
  expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(16);
  expect(container.querySelectorAll(".legal-body p")).toHaveLength(16);
});

it("exposes disclosure relationships and retains the full text when collapsed", () => {
  render(<TermsContent />);
  const first = screen.getByRole("button", { name: "1. About My Kustomers" });
  const second = screen.getByRole("button", { name: "2. Accounts" });
  expect(first).toHaveAttribute("aria-expanded", "true");
  expect(second).toHaveAttribute("aria-expanded", "false");
  const body = document.getElementById(second.getAttribute("aria-controls")!)!;
  expect(body).toHaveAttribute("aria-labelledby", second.id);
  expect(body).not.toBeVisible();
  expect(body.textContent).toContain("report suspected unauthorised access promptly.");
  fireEvent.click(second);
  expect(body).toBeVisible();
  expect(second).toHaveAttribute("aria-expanded", "true");
  fireEvent.click(second);
  expect(body).not.toBeVisible();
});
