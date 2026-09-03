import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/toast";
import { MYKUSTOMERS_BRAND_ASSETS } from "@/lib/brand/assets";
import { publicEnv } from "@/lib/config/public-env";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.NEXT_PUBLIC_APP_URL),
  title: {
    default: "My Kustomers",
    template: "%s | My Kustomers",
  },
  description:
    "A mobile-first customer and booking operations platform for small businesses.",
  applicationName: "My Kustomers",
  alternates: { canonical: "/" },
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
    siteName: "My Kustomers",
    type: "website",
    images: [
      {
        url: MYKUSTOMERS_BRAND_ASSETS.openGraph,
        width: 1200,
        height: 630,
        alt: "MyKustomers.com",
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
