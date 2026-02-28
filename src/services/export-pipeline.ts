import * as FileSystem from "expo-file-system/legacy";

import { uploadFileToSelectedOneDriveFolder } from "@/services/onedrive-auth";

export interface ExportProgress {
  stage: "local" | "upload";
  progressPercent: number;
  message: string;
}

export interface ExportPipelineResult {
  localFileUri: string;
  localFileName: string;
  uploadStatus: "skipped" | "uploaded" | "failed";
  uploadedFileName: string | null;
  uploadError: string | null;
}

export interface RunExportPipelineParams {
  fileName: string;
  content: string;
  uploadToOneDrive: boolean;
  onProgress?: (progress: ExportProgress) => void;
}

const EXPORT_DIR = `${FileSystem.documentDirectory}exports`;

async function ensureExportDirectory(): Promise<void> {
  const info = await FileSystem.getInfoAsync(EXPORT_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(EXPORT_DIR, { intermediates: true });
  }
}

export async function runExportPipeline(
  params: RunExportPipelineParams
): Promise<ExportPipelineResult> {
  const { fileName, content, uploadToOneDrive, onProgress } = params;

  onProgress?.({
    stage: "local",
    progressPercent: 0,
    message: "Creating local export file...",
  });
  await ensureExportDirectory();

  const localFileUri = `${EXPORT_DIR}/${fileName}`;
  await FileSystem.writeAsStringAsync(localFileUri, content, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  onProgress?.({
    stage: "local",
    progressPercent: 100,
    message: "Local export created.",
  });

  if (!uploadToOneDrive) {
    return {
      localFileUri,
      localFileName: fileName,
      uploadStatus: "skipped",
      uploadedFileName: null,
      uploadError: null,
    };
  }

  try {
    onProgress?.({
      stage: "upload",
      progressPercent: 0,
      message: "Uploading export to OneDrive...",
    });
    await uploadFileToSelectedOneDriveFolder(localFileUri, fileName, (progressPercent) => {
      onProgress?.({
        stage: "upload",
        progressPercent,
        message: "Uploading export to OneDrive...",
      });
    });
    return {
      localFileUri,
      localFileName: fileName,
      uploadStatus: "uploaded",
      uploadedFileName: fileName,
      uploadError: null,
    };
  } catch (error) {
    return {
      localFileUri,
      localFileName: fileName,
      uploadStatus: "failed",
      uploadedFileName: null,
      uploadError:
        error instanceof Error
          ? error.message
          : "Upload failed, but local export is available.",
    };
  }
}
