import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  if (process.env.NEXT_PUBLIC_LOCAL_DEV_AUTH === "true") {
    const accessToken = process.env.NEXT_PUBLIC_LOCAL_DEV_AUTH_TOKEN;
    if (!accessToken) {
      throw new Error("NEXT_PUBLIC_LOCAL_DEV_AUTH_TOKEN is required in local development");
    }

    const localSession = {
      access_token: accessToken,
      provider_token: "local-dev-provider-token",
      provider_refresh_token: "local-dev-refresh-token",
    };
    const localUser = {
      id: "00000000-0000-4000-8000-000000000001",
      email: "developer@localhost",
    };

    return {
      auth: {
        getSession: async () => ({ data: { session: localSession as any }, error: null }),
        getUser: async () => ({ data: { user: localUser as any }, error: null }),
        signInWithOAuth: async () => ({ data: { provider: "google", url: null }, error: null }),
        signOut: async () => ({ error: null }),
        onAuthStateChange: (_callback: any) => ({
          data: { subscription: { unsubscribe: () => {} } },
        }),
      },
    } as any;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
