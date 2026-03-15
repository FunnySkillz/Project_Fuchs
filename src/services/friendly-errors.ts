import { translate } from "@/i18n/translate";
import { getCachedLanguagePreference } from "@/services/language-preference";

function t(key: Parameters<typeof translate>[1]): string {
  return translate(getCachedLanguagePreference(), key);
}

export function friendlyFileErrorMessage(
  error: unknown,
  fallback: string
): string {
  const rawMessage = error instanceof Error ? error.message : String(error);
  const message = rawMessage.toLowerCase();

  if (message.includes("camera permission denied")) {
    return t("errors.friendly.cameraPermissionDenied");
  }
  if (message.includes("file picker access failed")) {
    return t("errors.friendly.filePickerAccessFailed");
  }

  if (message.includes("permission") || message.includes("denied") || message.includes("not granted")) {
    return t("errors.friendly.permissionMissing");
  }
  if (
    message.includes("no space left") ||
    message.includes("enospc") ||
    message.includes("disk") ||
    message.includes("storage") ||
    message.includes("read-only") ||
    message.includes("write")
  ) {
    return t("errors.friendly.storageWriteFailed");
  }
  if (message.includes("not found") || message.includes("no such file") || message.includes("enoent")) {
    return t("errors.friendly.fileMissing");
  }
  if (message.includes("share sheet is not available") || message.includes("sharing")) {
    return t("errors.friendly.sharingUnavailable");
  }
  if (message.includes("cancel")) {
    return t("errors.friendly.actionCanceled");
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
