import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BrandLogo } from "@/components/shared/brand-logo";

describe("BrandLogo", () => {
  it.each([
    ["icon", 120, 120],
    ["horizontal", 512, 169],
    ["inverse", 2172, 724],
  ] as const)(
    "renders the supplied %s asset with intrinsic dimensions",
    (variant, width, height) => {
      render(<BrandLogo variant={variant} />);

      const logo = screen.getByRole("img", { name: "MyKustomers.com" });
      expect(logo).toHaveAttribute("data-brand-logo", variant);
      expect(logo).toHaveAttribute("width", String(width));
      expect(logo).toHaveAttribute("height", String(height));
      expect(logo).toHaveClass("object-contain");
    },
  );

  it("is silent when adjacent copy or a parent link already names the brand", () => {
    const { container } = render(<BrandLogo variant="wordmark" decorative />);

    const logo = container.querySelector("img");
    expect(logo).toHaveAttribute("alt", "");
    expect(logo).toHaveAttribute("aria-hidden", "true");
  });
});
