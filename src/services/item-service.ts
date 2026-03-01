import { getAttachmentRepository, getItemRepository } from "@/repositories/create-core-repositories";
import { deleteAttachment } from "@/services/attachment-service";

export async function deleteItemWithAttachments(itemId: string): Promise<void> {
  const [itemRepository, attachmentRepository] = await Promise.all([
    getItemRepository(),
    getAttachmentRepository(),
  ]);

  const linkedAttachments = await attachmentRepository.listByItem(itemId);
  for (const attachment of linkedAttachments) {
    await deleteAttachment(attachment.id);
  }

  await itemRepository.softDelete(itemId);
}
