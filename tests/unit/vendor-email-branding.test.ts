import { describe, expect, it } from "vitest";
import { vendorEmailFixtures } from "../fixtures/vendor-email";
import { getBusinessEmailLogoUrl } from "@/features/businesses/email-logo";

describe("shared vendor email identity", () => {
  it("covers every implemented event with a logo and the existing initials fallback", () => {
    const withLogo = vendorEmailFixtures();
    const withoutLogo = vendorEmailFixtures("Harbour Studio", null);
    expect(Object.keys(withLogo)).toHaveLength(9);
    for (const key of Object.keys(withLogo) as (keyof typeof withLogo)[]) {
      const email = withLogo[key];
      const doc = new DOMParser().parseFromString(email.html, "text/html");
      expect(doc.querySelectorAll(".vendor-logo")).toHaveLength(1);
      expect(doc.querySelector(".vendor-logo")?.getAttribute("src")).toBe(
        "https://mykustomers.com/brand/business/20000000-0000-4000-8000-000000000001/logo.png",
      );
      expect(doc.querySelector(".vendor-logo")?.getAttribute("alt")).toBe(
        "Harbour Studio",
      );
      expect(doc.querySelector(".vendor-logo")?.getAttribute("width")).toBe("52");
      expect(doc.querySelector(".vendor-logo")?.getAttribute("height")).toBe("52");
      expect(doc.querySelector(".vendor-name")?.textContent).toBe("Harbour Studio");
      expect(doc.querySelector(".vendor-initial")).toBeNull();
      const fallback = new DOMParser().parseFromString(
        withoutLogo[key].html,
        "text/html",
      );
      expect(fallback.querySelector(".vendor-logo")).toBeNull();
      expect(fallback.querySelector(".vendor-initial")?.textContent).toBe("H");
      expect(fallback.querySelector(".vendor-name")?.textContent).toBe("Harbour Studio");
      for (const field of ["to", "subject", "text", "idempotencyKey"] as const)
        expect(email[field]).toEqual(withoutLogo[key][field]);
      expect(doc.querySelectorAll('img[alt="MyKustomers.com"]')).toHaveLength(1);
    }
  });

  it("keeps A and B separate across all templates and escapes hostile names", () => {
    const a = vendorEmailFixtures(
      "Cedar <Studio>",
      "20000000-0000-4000-8000-000000000001/logo.webp",
    );
    const b = vendorEmailFixtures(
      "Birch & Workshop",
      "20000000-0000-4000-8000-000000000002/logo.webp",
    );
    for (const email of Object.values(a)) {
      expect(email.html).toContain("Cedar &lt;Studio&gt;");
      expect(email.html).not.toContain("<Studio>");
      expect(email.html).not.toContain("20000000-0000-4000-8000-000000000002");
    }
    for (const email of Object.values(b)) {
      expect(email.html).toContain("Birch &amp; Workshop");
      expect(email.html).not.toContain("20000000-0000-4000-8000-000000000001");
    }
  });

  it.each([
    null,
    "https://evil.test/logo.webp",
    "../logo.webp",
    "20000000-0000-4000-8000-000000000001/logo.webp?token=secret",
    "signed/temporary.webp",
  ])("rejects noncanonical image source %s", (path) => {
    expect(getBusinessEmailLogoUrl(path)).toBeNull();
    for (const email of Object.values(vendorEmailFixtures("Harbour", path))) {
      expect(email.html).toContain('class="vendor-initial"');
      expect(email.html).not.toContain('class="vendor-logo"');
    }
  });
});
