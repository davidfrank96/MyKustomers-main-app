import "server-only";
import { isSupabasePublicEnvConfigured, publicEnv } from "@/lib/config/public-env";

type AuthSettings = {
  external?: {
    google?: boolean;
  };
};

export async function isGoogleAuthEnabled() {
  if (
    !isSupabasePublicEnvConfigured() ||
    !publicEnv.NEXT_PUBLIC_SUPABASE_URL ||
    !publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ) {
    return false;
  }

  try {
    const settingsUrl = new URL(
      "/auth/v1/settings",
      publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    );
    const response = await fetch(settingsUrl, {
      headers: {
        apikey: publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      },
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      return false;
    }

    const settings = (await response.json()) as AuthSettings;
    return settings.external?.google === true;
  } catch {
    return false;
  }
}
