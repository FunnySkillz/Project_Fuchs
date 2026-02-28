import * as AuthSession from "expo-auth-session";
import * as SecureStore from "expo-secure-store";

const CLIENT_ID = process.env.EXPO_PUBLIC_ONEDRIVE_CLIENT_ID;
const DISCOVERY: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
  tokenEndpoint: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
  revocationEndpoint: "https://login.microsoftonline.com/common/oauth2/v2.0/logout",
};

const TOKEN_KEY = "onedrive_oauth_tokens_v1";
const FOLDER_SELECTION_KEY = "onedrive_export_folder_v1";

const SCOPES = ["offline_access", "Files.ReadWrite.AppFolder"];

export interface OneDriveTokenRecord {
  accessToken: string;
  refreshToken: string | null;
  tokenType: string | null;
  issuedAtEpochMs: number;
  expiresIn: number | null;
}

function assertClientId(): string {
  if (!CLIENT_ID || CLIENT_ID.trim().length === 0) {
    throw new Error(
      "OneDrive OAuth is not configured. Set EXPO_PUBLIC_ONEDRIVE_CLIENT_ID."
    );
  }

  return CLIENT_ID;
}

export function getOneDriveRedirectUri(): string {
  return AuthSession.makeRedirectUri({
    path: "oauth/onedrive",
  });
}

export async function hasOneDriveConnection(): Promise<boolean> {
  const existing = await SecureStore.getItemAsync(TOKEN_KEY);
  return existing !== null;
}

export async function getStoredOneDriveTokens(): Promise<OneDriveTokenRecord | null> {
  const existing = await SecureStore.getItemAsync(TOKEN_KEY);
  if (!existing) {
    return null;
  }

  try {
    const parsed = JSON.parse(existing) as OneDriveTokenRecord;
    if (!parsed.accessToken || typeof parsed.accessToken !== "string") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function connectOneDrive(): Promise<OneDriveTokenRecord> {
  const clientId = assertClientId();
  const redirectUri = getOneDriveRedirectUri();
  const request = new AuthSession.AuthRequest({
    clientId,
    responseType: AuthSession.ResponseType.Code,
    usePKCE: true,
    scopes: SCOPES,
    redirectUri,
  });

  const response = await request.promptAsync(DISCOVERY);
  if (response.type !== "success" || !response.params.code) {
    throw new Error("OneDrive sign-in was canceled or failed.");
  }

  const tokenResult = await AuthSession.exchangeCodeAsync(
    {
      clientId,
      code: response.params.code,
      redirectUri,
      extraParams: {
        code_verifier: request.codeVerifier ?? "",
      },
    },
    DISCOVERY
  );

  const record: OneDriveTokenRecord = {
    accessToken: tokenResult.accessToken,
    refreshToken: tokenResult.refreshToken ?? null,
    tokenType: tokenResult.tokenType ?? null,
    expiresIn: tokenResult.expiresIn ?? null,
    issuedAtEpochMs: Date.now(),
  };

  await SecureStore.setItemAsync(TOKEN_KEY, JSON.stringify(record));
  return record;
}

export async function disconnectOneDrive(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(FOLDER_SELECTION_KEY);
}
