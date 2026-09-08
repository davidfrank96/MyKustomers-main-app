import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/toast";
import { MYKUSTOMERS_BRAND_ASSETS } from "@/lib/brand/assets";
import {
  PRIVATE_ROBOTS,
  SEO_SITE,
  isProductionSeoDeployment,
} from "@/lib/seo/site";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  metadataBase: new URL(SEO_SITE.origin),
  title: {
    default: SEO_SITE.title,
    template: "%s | My Kustomers",
  },
  description: SEO_SITE.description,
  applicationName: SEO_SITE.name,
  robots: isProductionSeoDeployment() ? undefined : PRIVATE_ROBOTS,
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: MYKUSTOMERS_BRAND_ASSETS.favicon.ico },
      {
        url: MYKUSTOMERS_BRAND_ASSETS.favicon.size16,
        type: "image/png",
        sizes: "16x16",
      },
      {
        url: MYKUSTOMERS_BRAND_ASSETS.favicon.size32,
        type: "image/png",
        sizes: "32x32",
      },
      {
        url: MYKUSTOMERS_BRAND_ASSETS.favicon.size48,
        type: "image/png",
        sizes: "48x48",
      },
    ],
    apple: [
      {
        url: MYKUSTOMERS_BRAND_ASSETS.pwa.appleTouchIcon,
        type: "image/png",
        sizes: "180x180",
      },
    ],
  },
  openGraph: {
    siteName: SEO_SITE.name,
    type: "website",
    images: [
      {
        url: MYKUSTOMERS_BRAND_ASSETS.openGraph,
        width: 1200,
        height: 630,
        alt: "My Kustomers booking and customer management platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: [MYKUSTOMERS_BRAND_ASSETS.openGraph],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#fbfaf7",
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
