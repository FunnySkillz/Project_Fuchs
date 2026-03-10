import * as FileSystem from "expo-file-system/legacy";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const EXPORT_DESTINATION_DIRECTORY_URI_KEY = "export.destination.directory-uri";

export interface PickExportDirectoryResult {
  granted: boolean;
  directoryUri: string | null;
}

export interface SaveExportCopyToDirectoryParams {
  sourceFileUri: string;
  sourceFileName: string;
  mimeType: string;
  directoryUri: string;
}

export interface SaveExportCopyToDirectoryResult {
  directoryUri: string;
  fileUri: string;
}

function resolveDocumentDirectory(): string {
  if (!FileSystem.documentDirectory) {
    throw new Error("Document directory is not available.");
  }
  return FileSystem.documentDirectory;
}

function stripFileExtension(fileName: string): string {
  const trimmed = fileName.trim();
  if (!trimmed) {
    return `steuerfuchs-export-${Date.now()}`;
  }
  const index = trimmed.lastIndexOf(".");
  if (index <= 0) {
    return trimmed;
  }
  return trimmed.slice(0, index);
}

export function isExportDirectoryPickerSupported(): boolean {
  return Platform.OS === "android";
}

export function getLocalExportDirectoryUri(): string {
  return `${resolveDocumentDirectory()}exports`;
}

export async function getSavedExportDirectoryUri(): Promise<string | null> {
  if (!isExportDirectoryPickerSupported()) {
    return null;
  }
  return (await SecureStore.getItemAsync(EXPORT_DESTINATION_DIRECTORY_URI_KEY)) ?? null;
}

export async function clearSavedExportDirectoryUri(): Promise<void> {
  await SecureStore.deleteItemAsync(EXPORT_DESTINATION_DIRECTORY_URI_KEY);
}

export async function pickAndPersistExportDirectory(
  initialDirectoryUri?: string | null
): Promise<PickExportDirectoryResult> {
  if (!isExportDirectoryPickerSupported()) {
    return {
      granted: false,
      directoryUri: null,
    };
  }

  const selection = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync(
    initialDirectoryUri ?? null
  );

  if (!selection.granted || !selection.directoryUri) {
    return {
      granted: false,
      directoryUri: null,
    };
  }

  await SecureStore.setItemAsync(EXPORT_DESTINATION_DIRECTORY_URI_KEY, selection.directoryUri);

  return {
    granted: true,
    directoryUri: selection.directoryUri,
  };
}

export async function saveExportCopyToDirectory(
  params: SaveExportCopyToDirectoryParams
): Promise<SaveExportCopyToDirectoryResult> {
  if (!isExportDirectoryPickerSupported()) {
    throw new Error("Saving to a selected export folder is only available on Android.");
  }

  const { sourceFileUri, sourceFileName, mimeType, directoryUri } = params;
  const targetFileUri = await FileSystem.StorageAccessFramework.createFileAsync(
    directoryUri,
    stripFileExtension(sourceFileName),
    mimeType
  );

  const base64Payload = await FileSystem.readAsStringAsync(sourceFileUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  await FileSystem.writeAsStringAsync(targetFileUri, base64Payload, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return {
    directoryUri,
    fileUri: targetFileUri,
  };
}

export function formatDirectoryUriForDisplay(directoryUri: string): string {
  const treeToken = directoryUri.match(/\/tree\/([^/?]+)/)?.[1];
  if (!treeToken) {
    return decodeURIComponent(directoryUri);
  }

  const decodedToken = decodeURIComponent(treeToken);
  if (decodedToken.startsWith("primary:")) {
    const relativePath = decodedToken.slice("primary:".length);
    return relativePath ? `Internal storage/${relativePath}` : "Internal storage";
  }

  return decodedToken;
}
