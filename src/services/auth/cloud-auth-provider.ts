import type { AuthProvider } from "@/services/auth/auth-provider";

/**
 * Stub for future generic cloud auth (Firebase/Supabase/etc.) in V2+.
 * V1 intentionally ships without introducing any Firebase/Supabase dependency.
 */
export class CloudAuthProvider implements AuthProvider {
  async isConnected(): Promise<boolean> {
    // TODO(V2+): return real cloud session state.
    return false;
  }

  async connect(): Promise<void> {
    // TODO(V2+): implement provider-specific connect flow.
    throw new Error("CloudAuthProvider is not implemented in V1.");
  }

  async disconnect(): Promise<void> {
    // TODO(V2+): implement provider-specific disconnect flow.
    throw new Error("CloudAuthProvider is not implemented in V1.");
  }
}
