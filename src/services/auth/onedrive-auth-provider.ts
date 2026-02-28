import type { AuthProvider } from "@/services/auth/auth-provider";
import {
  connectOneDrive,
  disconnectOneDrive,
  hasOneDriveConnection,
} from "@/services/onedrive-auth";

export class OneDriveAuthProvider implements AuthProvider {
  async isConnected(): Promise<boolean> {
    return hasOneDriveConnection();
  }

  async connect(): Promise<void> {
    await connectOneDrive();
  }

  async disconnect(): Promise<void> {
    await disconnectOneDrive();
  }
}

let providerInstance: OneDriveAuthProvider | null = null;

export function getOneDriveAuthProvider(): AuthProvider {
  if (!providerInstance) {
    providerInstance = new OneDriveAuthProvider();
  }
  return providerInstance;
}
