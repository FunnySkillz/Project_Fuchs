import { resetDatabase } from "@/db/sqlite";
import { deleteAllLocalAttachmentFiles } from "@/services/attachment-storage";
import { clearPinAsync } from "@/services/pin-auth";

export async function deleteAllLocalData(): Promise<void> {
  await clearPinAsync();
  await deleteAllLocalAttachmentFiles();
  await resetDatabase();
}
