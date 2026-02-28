export function friendlyFileErrorMessage(
  error: unknown,
  fallback: string
): string {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  if (message.includes("permission") || message.includes("denied") || message.includes("not granted")) {
    return "Permission is missing. Please allow file/camera access and try again.";
  }
  if (message.includes("not found") || message.includes("no such file") || message.includes("enoent")) {
    return "A referenced file is missing. Please re-attach the file and retry.";
  }
  if (message.includes("share sheet is not available") || message.includes("sharing")) {
    return "Sharing is not available on this device/platform.";
  }
  if (message.includes("cancel")) {
    return "Action canceled.";
  }

  return fallback;
}
