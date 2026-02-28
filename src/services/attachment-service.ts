import { getAttachmentRepository } from "@/repositories/create-core-repositories";
import { deleteLocalAttachmentFile } from "@/services/attachment-storage";

export async function deleteAttachment(attachmentId: string): Promise<void> {
  const repository = await getAttachmentRepository();
  const existing = await repository.getById(attachmentId);
  if (!existing) {
    return;
  }

  await repository.softDelete(attachmentId);
  await deleteLocalAttachmentFile(existing.filePath);
}
