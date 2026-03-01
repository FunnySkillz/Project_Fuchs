export function friendlyFileErrorMessage(
  error: unknown,
  fallback: string
): string {
  const rawMessage = error instanceof Error ? error.message : String(error);
  const message = rawMessage.toLowerCase();

  if (message.includes("camera permission denied")) {
    return "Camera access is denied. Open device Settings and allow camera permission for SteuerFuchs.";
  }
  if (message.includes("file picker access failed")) {
    return "File access is blocked. Open device Settings and allow file/photo access for SteuerFuchs.";
  }

  if (message.includes("permission") || message.includes("denied") || message.includes("not granted")) {
    return "Permission is missing. Open device Settings, allow access, then retry.";
  }
  if (
    message.includes("no space left") ||
    message.includes("enospc") ||
    message.includes("disk") ||
    message.includes("storage") ||
    message.includes("read-only") ||
    message.includes("write")
  ) {
    return "Could not save file to local storage. Free up device space and retry.";
  }
  if (message.includes("not found") || message.includes("no such file") || message.includes("enoent")) {
    return "A referenced file is missing. Re-attach the file and retry.";
  }
  if (message.includes("share sheet is not available") || message.includes("sharing")) {
    return "Sharing is not available on this device/platform.";
  }
  if (message.includes("cancel")) {
    return "Action canceled.";
  }

  return fallback;
}

export function isUserCancellationError(error: unknown): boolean {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return (
    message.includes("cancel") ||
    message.includes("canceled") ||
    message.includes("cancelled") ||
    message.includes("user_cancel")
  );
}

export function shouldOfferOpenSettingsForError(error: unknown): boolean {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return (
    message.includes("permission") ||
    message.includes("denied") ||
    message.includes("not granted") ||
    message.includes("camera access") ||
    message.includes("file access")
  );
}
