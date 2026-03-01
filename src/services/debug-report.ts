import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

const DEBUG_REPORTS_DIR = `${FileSystem.documentDirectory}debug-reports`;

export interface InitDebugReportInput {
  errorMessage: string;
  rawError: string;
  errorName: string;
  stack?: string;
  migrationVersion?: number;
  timestampIso: string;
}

async function ensureDebugReportsDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(DEBUG_REPORTS_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(DEBUG_REPORTS_DIR, { intermediates: true });
  }
}

export async function createInitDebugReport(
  input: InitDebugReportInput
): Promise<{ fileUri: string; fileName: string }> {
  await ensureDebugReportsDir();

  const safeTimestamp = input.timestampIso.replaceAll(":", "-");
  const fileName = `init-failure-${safeTimestamp}.json`;
  const fileUri = `${DEBUG_REPORTS_DIR}/${fileName}`;
  const payload = {
    app: "SteuerFuchs",
    event: "app-initialization-failure",
    ...input,
  };

  await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(payload, null, 2), {
    encoding: FileSystem.EncodingType.UTF8,
  });

  return { fileUri, fileName };
}

export async function shareDebugReport(fileUri: string): Promise<void> {
  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new Error("Share sheet is not available on this platform.");
  }

  await Sharing.shareAsync(fileUri, {
    mimeType: "application/json",
    dialogTitle: "Share initialization debug report",
    UTI: "public.json",
  });
}
