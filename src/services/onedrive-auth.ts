import * as AuthSession from "expo-auth-session";
import * as SecureStore from "expo-secure-store";
import * as FileSystem from "expo-file-system/legacy";

const CLIENT_ID = process.env.EXPO_PUBLIC_ONEDRIVE_CLIENT_ID;
const DISCOVERY: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
  tokenEndpoint: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
  revocationEndpoint: "https://login.microsoftonline.com/common/oauth2/v2.0/logout",
};

const TOKEN_KEY = "onedrive_oauth_tokens_v1";
const FOLDER_SELECTION_KEY = "onedrive_export_folder_v1";
const SCOPES = ["offline_access", "Files.ReadWrite"];
const GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0";
const ONEDRIVE_NOT_CONFIGURED_ERROR =
  "OneDrive OAuth is not configured. Set EXPO_PUBLIC_ONEDRIVE_CLIENT_ID.";

export interface OneDriveTokenRecord {
  accessToken: string;
  refreshToken: string | null;
  tokenType: string | null;
  issuedAtEpochMs: number;
  expiresIn: number | null;
}

export interface OneDriveFolder {
  id: string;
  name: string;
  path: string;
}

export interface OneDriveFolderSelection {
  id: string;
  path: string;
}

interface GraphFolderItem {
  id: string;
  name: string;
  folder?: Record<string, unknown>;
  parentReference?: {
    path?: string;
  };
}

interface GraphListResponse {
  value?: GraphFolderItem[];
}

function canUseLocalStorage(): boolean {
  return typeof globalThis !== "undefined" && "localStorage" in globalThis;
}

async function getSecureValue(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    if (canUseLocalStorage()) {
      return globalThis.localStorage.getItem(key);
    }
    return null;
  }
}

async function setSecureValue(key: string, value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, value);
    return;
  } catch {
    if (canUseLocalStorage()) {
      globalThis.localStorage.setItem(key, value);
    }
  }
}

async function deleteSecureValue(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key);
    return;
  } catch {
    if (canUseLocalStorage()) {
      globalThis.localStorage.removeItem(key);
    }
  }
}

function assertClientId(): string {
  if (!isOneDriveConfigured()) {
    throw new Error(ONEDRIVE_NOT_CONFIGURED_ERROR);
  }
  return CLIENT_ID!.trim();
}

export function isOneDriveConfigured(): boolean {
  return typeof CLIENT_ID === "string" && CLIENT_ID.trim().length > 0;
}

function isTokenExpired(record: OneDriveTokenRecord): boolean {
  if (record.expiresIn === null) {
    return false;
  }
  return Date.now() >= record.issuedAtEpochMs + Math.max(0, record.expiresIn - 60) * 1000;
}

async function saveTokens(record: OneDriveTokenRecord): Promise<void> {
  await setSecureValue(TOKEN_KEY, JSON.stringify(record));
}

async function getValidAccessToken(): Promise<string> {
  const stored = await getStoredOneDriveTokens();
  if (!stored) {
    throw new Error("OneDrive is not connected. Connect your account first.");
  }

  if (!isTokenExpired(stored)) {
    return stored.accessToken;
  }

  if (!stored.refreshToken) {
    throw new Error("OneDrive session expired. Please reconnect.");
  }

  const clientId = assertClientId();
  const refreshed = await AuthSession.refreshAsync(
    {
      clientId,
      refreshToken: stored.refreshToken,
    },
    DISCOVERY
  );

  const nextRecord: OneDriveTokenRecord = {
    accessToken: refreshed.accessToken,
    refreshToken: refreshed.refreshToken ?? stored.refreshToken,
    tokenType: refreshed.tokenType ?? stored.tokenType,
    expiresIn: refreshed.expiresIn ?? stored.expiresIn,
    issuedAtEpochMs: Date.now(),
  };
  await saveTokens(nextRecord);
  return nextRecord.accessToken;
}

async function graphRequest(path: string, init?: RequestInit): Promise<Response> {
  const accessToken = await getValidAccessToken();
  return fetch(`${GRAPH_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {}),
    },
  });
}

export function getOneDriveRedirectUri(): string {
  return AuthSession.makeRedirectUri({
    path: "oauth/onedrive",
  });
}

export async function hasOneDriveConnection(): Promise<boolean> {
  const existing = await getSecureValue(TOKEN_KEY);
  return existing !== null;
}

export async function getStoredOneDriveTokens(): Promise<OneDriveTokenRecord | null> {
  const existing = await getSecureValue(TOKEN_KEY);
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
  await saveTokens(record);
  return record;
}

export async function disconnectOneDrive(): Promise<void> {
  await deleteSecureValue(TOKEN_KEY);
  await deleteSecureValue(FOLDER_SELECTION_KEY);
}

export async function getSelectedOneDriveFolder(): Promise<OneDriveFolderSelection | null> {
  const raw = await getSecureValue(FOLDER_SELECTION_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<OneDriveFolderSelection>;
    if (typeof parsed.id !== "string" || typeof parsed.path !== "string") {
      return null;
    }
    return { id: parsed.id, path: parsed.path };
  } catch {
    return null;
  }
}

export async function setSelectedOneDriveFolder(folder: OneDriveFolderSelection): Promise<void> {
  await setSecureValue(FOLDER_SELECTION_KEY, JSON.stringify(folder));
}

export async function listOneDriveFolders(): Promise<OneDriveFolder[]> {
  const response = await graphRequest("/me/drive/root/children?$select=id,name,parentReference,folder");
  if (!response.ok) {
    throw new Error("Could not load OneDrive folders. Reconnect and try again.");
  }

  const json = (await response.json()) as GraphListResponse;
  return (json.value ?? [])
    .filter((item) => Boolean(item.folder))
    .map((item) => {
      const parentPath = item.parentReference?.path ?? "/drive/root:";
      const normalizedParent = parentPath.replace("/drive/root:", "");
      return {
        id: item.id,
        name: item.name,
        path: `${normalizedParent}/${item.name}`.replace(/\/+/g, "/"),
      };
    });
}

export async function ensureSelectedFolderAccessible(): Promise<OneDriveFolderSelection> {
  const selected = await getSelectedOneDriveFolder();
  if (!selected) {
    throw new Error("Select a OneDrive folder before uploading exports.");
  }

  const response = await graphRequest(`/me/drive/items/${selected.id}?$select=id,name,parentReference`);
  if (response.status === 404 || response.status === 403) {
    throw new Error(
      "Selected OneDrive folder is missing or permission was revoked. Please re-select a folder."
    );
  }
  if (!response.ok) {
    throw new Error("Could not access selected OneDrive folder. Please try again.");
  }

  return selected;
}

export async function uploadTextToSelectedOneDriveFolder(
  fileName: string,
  content: string
): Promise<void> {
  const selected = await ensureSelectedFolderAccessible();
  const response = await graphRequest(
    `/me/drive/items/${selected.id}:/${encodeURIComponent(fileName)}:/content`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
      body: content,
    }
  );

  if (response.status === 404 || response.status === 403) {
    throw new Error(
      "Upload failed because selected folder is unavailable. Re-select your OneDrive folder."
    );
  }
  if (!response.ok) {
    throw new Error("Upload failed. Please verify OneDrive permissions and try again.");
  }
}

export async function uploadFileToSelectedOneDriveFolder(
  fileUri: string,
  fileName: string,
  onProgress?: (progressPercent: number) => void
): Promise<void> {
  const selected = await ensureSelectedFolderAccessible();
  const info = await FileSystem.getInfoAsync(fileUri);
  if (!info.exists || typeof info.size !== "number") {
    throw new Error("Local export file not found for OneDrive upload.");
  }

  const simpleUploadMaxBytes = 4 * 1024 * 1024;
  const handleUploadError = (status: number) => {
    if (status === 404 || status === 403) {
      throw new Error(
        "Upload failed because selected folder is unavailable. Re-select your OneDrive folder."
      );
    }
    throw new Error("Upload failed. Please verify OneDrive permissions and try again.");
  };

  if (info.size <= simpleUploadMaxBytes) {
    const accessToken = await getValidAccessToken();
    const uploadTask = FileSystem.createUploadTask(
      `${GRAPH_BASE_URL}/me/drive/items/${selected.id}:/${encodeURIComponent(fileName)}:/content`,
      fileUri,
      {
        httpMethod: "PUT",
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/octet-stream",
        },
      },
      (event) => {
        if (event.totalBytesExpectedToSend > 0) {
          const pct = Math.round(
            (event.totalBytesSent / event.totalBytesExpectedToSend) * 100
          );
          onProgress?.(pct);
        }
      }
    );
    const response = await uploadTask.uploadAsync();
    if (!response || response.status < 200 || response.status >= 300) {
      handleUploadError(response?.status ?? 500);
    }
    onProgress?.(100);
    return;
  }

  const sessionResponse = await graphRequest(
    `/me/drive/items/${selected.id}:/${encodeURIComponent(fileName)}:/createUploadSession`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        item: {
          "@microsoft.graph.conflictBehavior": "replace",
          name: fileName,
        },
      }),
    }
  );
  if (!sessionResponse.ok) {
    handleUploadError(sessionResponse.status);
  }
  const sessionJson = (await sessionResponse.json()) as { uploadUrl?: string };
  if (!sessionJson.uploadUrl) {
    throw new Error("Could not create upload session for OneDrive.");
  }

  const rangeHeader = `bytes 0-${info.size - 1}/${info.size}`;
  const task = FileSystem.createUploadTask(
    sessionJson.uploadUrl,
    fileUri,
    {
      httpMethod: "PUT",
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: {
        "Content-Range": rangeHeader,
        "Content-Length": String(info.size),
        "Content-Type": "application/octet-stream",
      },
    },
    (event) => {
      if (event.totalBytesExpectedToSend > 0) {
        const pct = Math.round(
          (event.totalBytesSent / event.totalBytesExpectedToSend) * 100
        );
        onProgress?.(pct);
      }
    }
  );

  const result = await task.uploadAsync();
  if (!result || result.status < 200 || result.status >= 300) {
    handleUploadError(result?.status ?? 500);
  }
  onProgress?.(100);
}
