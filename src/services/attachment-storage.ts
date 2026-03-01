import * as Crypto from "expo-crypto";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";

import type { AttachmentType } from "@/models/attachment";

const ATTACHMENT_ROOT_DIR = `${FileSystem.documentDirectory}attachments`;

export interface StoredAttachmentFile {
  filePath: string;
  mimeType: string;
  originalFileName: string | null;
  fileSizeBytes: number | null;
  type: AttachmentType;
}

interface PickedAsset {
  uri: string;
  mimeType: string | null;
  fileName: string | null;
  fileSize: number | null;
}

function inferAttachmentType(mimeType: string): AttachmentType {
  return mimeType === "application/pdf" ? "RECEIPT" : "PHOTO";
}

function isImageMimeType(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

function extensionFromMimeType(mimeType: string): string {
  if (mimeType === "application/pdf") {
    return "pdf";
  }
  if (mimeType === "image/png") {
    return "png";
  }
  if (mimeType === "image/heic") {
    return "heic";
  }
  if (mimeType === "image/webp") {
    return "webp";
  }
  return "jpg";
}

async function ensureAttachmentRootDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(ATTACHMENT_ROOT_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(ATTACHMENT_ROOT_DIR, { intermediates: true });
  }
}

function sanitizeAttachmentFileName(fileName: string): string {
  return fileName.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").trim();
}

export function getAttachmentRootDir(): string {
  return ATTACHMENT_ROOT_DIR;
}

export function buildAttachmentFilePath(fileName: string): string {
  const sanitized = sanitizeAttachmentFileName(fileName);
  if (!sanitized) {
    throw new Error("Attachment file name cannot be empty.");
  }

  return `${ATTACHMENT_ROOT_DIR}/${sanitized}`;
}

function buildThumbnailPath(filePath: string): string {
  return filePath.replace(/\.[^.]+$/, ".thumb.jpg");
}

async function createImageThumbnail(filePath: string): Promise<void> {
  const thumbnailPath = buildThumbnailPath(filePath);
  const result = await manipulateAsync(
    filePath,
    [{ resize: { width: 320 } }],
    { compress: 0.72, format: SaveFormat.JPEG }
  );
  await FileSystem.copyAsync({
    from: result.uri,
    to: thumbnailPath,
  });
}

async function copyAssetIntoSandbox(asset: PickedAsset): Promise<StoredAttachmentFile> {
  await ensureAttachmentRootDir();

  const normalizedMimeType = asset.mimeType ?? "image/jpeg";
  const extension = extensionFromMimeType(normalizedMimeType);
  const fileName = `${Crypto.randomUUID()}.${extension}`;
  const destinationPath = `${ATTACHMENT_ROOT_DIR}/${fileName}`;
  await FileSystem.copyAsync({
    from: asset.uri,
    to: destinationPath,
  });
  if (isImageMimeType(normalizedMimeType)) {
    try {
      await createImageThumbnail(destinationPath);
    } catch (error) {
      console.warn("Failed to generate attachment thumbnail", error);
    }
  }

  const destinationInfo = await FileSystem.getInfoAsync(destinationPath);
  const fileSizeBytes =
    destinationInfo.exists && typeof destinationInfo.size === "number"
      ? destinationInfo.size
      : asset.fileSize;
  return {
    filePath: destinationPath,
    mimeType: normalizedMimeType,
    originalFileName: asset.fileName,
    fileSizeBytes,
    type: inferAttachmentType(normalizedMimeType),
  };
}

export async function capturePhotoAttachment(): Promise<StoredAttachmentFile | null> {
  let permission: ImagePicker.PermissionResponse;
  try {
    permission = await ImagePicker.requestCameraPermissionsAsync();
  } catch {
    throw new Error(
      "Camera permission could not be requested. Please allow camera access in system settings and try again."
    );
  }
  if (!permission.granted) {
    throw new Error(
      "Camera permission denied. Enable camera access in your device settings to capture receipt photos."
    );
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ["images"],
    quality: 0.92,
  });
  if (result.canceled || result.assets.length === 0) {
    return null;
  }

  const asset = result.assets[0];
  return copyAssetIntoSandbox({
    uri: asset.uri,
    mimeType: asset.mimeType ?? "image/jpeg",
    fileName: asset.fileName ?? null,
    fileSize: asset.fileSize ?? null,
  });
}

export async function pickAttachmentFromDevice(): Promise<StoredAttachmentFile | null> {
  let result: DocumentPicker.DocumentPickerResult;
  try {
    result = await DocumentPicker.getDocumentAsync({
      multiple: false,
      type: ["application/pdf", "image/*"],
      copyToCacheDirectory: true,
    });
  } catch {
    throw new Error(
      "File picker access failed. Please allow file/photo access in system settings and try again."
    );
  }
  if (result.canceled || result.assets.length === 0) {
    return null;
  }

  const asset = result.assets[0];
  return copyAssetIntoSandbox({
    uri: asset.uri,
    mimeType: asset.mimeType ?? "application/pdf",
    fileName: asset.name ?? null,
    fileSize: asset.size ?? null,
  });
}

export async function saveFromCamera(): Promise<StoredAttachmentFile | null> {
  return capturePhotoAttachment();
}

export async function saveFromPicker(): Promise<StoredAttachmentFile | null> {
  return pickAttachmentFromDevice();
}

export async function deleteLocalAttachmentFile(filePath: string): Promise<void> {
  const info = await FileSystem.getInfoAsync(filePath);
  if (info.exists) {
    await FileSystem.deleteAsync(filePath, { idempotent: true });
  }

  const thumbnailPath = buildThumbnailPath(filePath);
  const thumbInfo = await FileSystem.getInfoAsync(thumbnailPath);
  if (thumbInfo.exists) {
    await FileSystem.deleteAsync(thumbnailPath, { idempotent: true });
  }
}

export async function deleteAllLocalAttachmentFiles(): Promise<void> {
  const info = await FileSystem.getInfoAsync(ATTACHMENT_ROOT_DIR);
  if (!info.exists) {
    return;
  }

  await FileSystem.deleteAsync(ATTACHMENT_ROOT_DIR, { idempotent: true });
}

export async function attachmentFileExists(filePath: string): Promise<boolean> {
  const info = await FileSystem.getInfoAsync(filePath);
  return info.exists;
}

export async function resolveAttachmentPreviewUri(
  filePath: string,
  mimeType: string
): Promise<string> {
  if (!isImageMimeType(mimeType)) {
    return filePath;
  }

  const thumbnailPath = buildThumbnailPath(filePath);
  const thumbInfo = await FileSystem.getInfoAsync(thumbnailPath);
  if (thumbInfo.exists) {
    return thumbnailPath;
  }

  return filePath;
}
