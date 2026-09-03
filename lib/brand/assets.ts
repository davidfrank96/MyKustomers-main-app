export const MYKUSTOMERS_BRAND_ASSET_ROOT = "/brand/mykustomers/v1";

export const MYKUSTOMERS_BRAND_ASSETS = {
  logo: {
    horizontal: `${MYKUSTOMERS_BRAND_ASSET_ROOT}/logo/mykustomers-logo-horizontal-512w.png`,
    horizontalDark: `${MYKUSTOMERS_BRAND_ASSET_ROOT}/logo/mykustomers-horizontal-dark.svg`,
    horizontalWhite: `${MYKUSTOMERS_BRAND_ASSET_ROOT}/logo/mykustomers-horizontal-white.svg`,
    icon: `${MYKUSTOMERS_BRAND_ASSET_ROOT}/logo/mykustomers-icon-120x120.png`,
    iconDark: `${MYKUSTOMERS_BRAND_ASSET_ROOT}/logo/mykustomers-icon-dark.svg`,
    iconWhite: `${MYKUSTOMERS_BRAND_ASSET_ROOT}/logo/mykustomers-icon-white.svg`,
    stacked: `${MYKUSTOMERS_BRAND_ASSET_ROOT}/logo/mykustomers-stacked-color.svg`,
    wordmark: `${MYKUSTOMERS_BRAND_ASSET_ROOT}/logo/mykustomers-wordmark-color.svg`,
  },
  favicon: {
    ico: `${MYKUSTOMERS_BRAND_ASSET_ROOT}/favicon/favicon.ico`,
    size16: `${MYKUSTOMERS_BRAND_ASSET_ROOT}/favicon/favicon-16x16.png`,
    size32: `${MYKUSTOMERS_BRAND_ASSET_ROOT}/favicon/favicon-32x32.png`,
    size48: `${MYKUSTOMERS_BRAND_ASSET_ROOT}/favicon/favicon-48x48.png`,
  },
  pwa: {
    appleTouchIcon: `${MYKUSTOMERS_BRAND_ASSET_ROOT}/pwa/apple-touch-icon.png`,
    size192: `${MYKUSTOMERS_BRAND_ASSET_ROOT}/pwa/mykustomers-icon-192x192.png`,
    size512: `${MYKUSTOMERS_BRAND_ASSET_ROOT}/pwa/mykustomers-icon-512x512.png`,
    maskable512: `${MYKUSTOMERS_BRAND_ASSET_ROOT}/pwa/mykustomers-icon-maskable-512x512.png`,
    monochrome192: `${MYKUSTOMERS_BRAND_ASSET_ROOT}/pwa/mykustomers-icon-monochrome-192x192.png`,
    monochrome512: `${MYKUSTOMERS_BRAND_ASSET_ROOT}/pwa/mykustomers-icon-monochrome-512x512.png`,
  },
  openGraph: `${MYKUSTOMERS_BRAND_ASSET_ROOT}/social/mykustomers-open-graph-1200x630.png`,
  email: `${MYKUSTOMERS_BRAND_ASSET_ROOT}/email/mykustomers-email-logo-512w.png`,
} as const;
