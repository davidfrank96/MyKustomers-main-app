import Image from "next/image";
import { cn } from "@/lib/utils/cn";
import { MYKUSTOMERS_BRAND_ASSETS } from "@/lib/brand/assets";

export type BrandLogoVariant =
  | "icon"
  | "icon-dark"
  | "icon-inverse"
  | "horizontal"
  | "horizontal-dark"
  | "inverse"
  | "stacked"
  | "wordmark";

const logoByVariant = {
  icon: {
    src: MYKUSTOMERS_BRAND_ASSETS.logo.icon,
    width: 120,
    height: 120,
  },
  "icon-dark": {
    src: MYKUSTOMERS_BRAND_ASSETS.logo.iconDark,
    width: 1254,
    height: 1254,
  },
  "icon-inverse": {
    src: MYKUSTOMERS_BRAND_ASSETS.logo.iconWhite,
    width: 1254,
    height: 1254,
  },
  horizontal: {
    src: MYKUSTOMERS_BRAND_ASSETS.logo.horizontal,
    width: 512,
    height: 169,
  },
  "horizontal-dark": {
    src: MYKUSTOMERS_BRAND_ASSETS.logo.horizontalDark,
    width: 2172,
    height: 724,
  },
  inverse: {
    src: MYKUSTOMERS_BRAND_ASSETS.logo.horizontalWhite,
    width: 2172,
    height: 724,
  },
  stacked: {
    src: MYKUSTOMERS_BRAND_ASSETS.logo.stacked,
    width: 1254,
    height: 1254,
  },
  wordmark: {
    src: MYKUSTOMERS_BRAND_ASSETS.logo.wordmark,
    width: 2172,
    height: 724,
  },
} satisfies Record<BrandLogoVariant, { src: string; width: number; height: number }>;

type BrandLogoProps = {
  variant?: BrandLogoVariant;
  className?: string;
  decorative?: boolean;
  priority?: boolean;
};

export function BrandLogo({
  variant = "horizontal",
  className,
  decorative = false,
  priority = false,
}: BrandLogoProps) {
  const asset = logoByVariant[variant];

  return (
    <Image
      src={asset.src}
      width={asset.width}
      height={asset.height}
      alt={decorative ? "" : "MyKustomers.com"}
      aria-hidden={decorative || undefined}
      className={cn("block shrink-0 object-contain", className)}
      priority={priority}
      unoptimized
      data-brand-logo={variant}
    />
  );
}
