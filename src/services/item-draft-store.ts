import * as Crypto from "expo-crypto";

import { getAttachmentRepository } from "@/repositories/create-core-repositories";
import type { StoredAttachmentFile } from "@/services/attachment-storage";
import { deleteLocalAttachmentFile } from "@/services/attachment-storage";

interface ItemDraftState {
  id: string;
  attachments: StoredAttachmentFile[];
}

const drafts = new Map<string, ItemDraftState>();

function ensureDraft(id: string): ItemDraftState {
  const existing = drafts.get(id);
  if (existing) {
    return existing;
  }

  const created: ItemDraftState = {
    id,
    attachments: [],
  };
  drafts.set(id, created);
  return created;
}

export function createItemDraft(): string {
  const id = Crypto.randomUUID();
  drafts.set(id, { id, attachments: [] });
  return id;
}

export function getItemDraftAttachments(draftId: string): StoredAttachmentFile[] {
  return [...ensureDraft(draftId).attachments];
}

export function addAttachmentToDraft(draftId: string, attachment: StoredAttachmentFile): void {
  const draft = ensureDraft(draftId);
  draft.attachments.push(attachment);
}

export async function removeAttachmentFromDraft(
  draftId: string,
  attachmentFilePath: string
): Promise<void> {
  const draft = ensureDraft(draftId);
  const index = draft.attachments.findIndex(
    (attachment) => attachment.filePath === attachmentFilePath
  );
  if (index === -1) {
    return;
  }

  const [removed] = draft.attachments.splice(index, 1);
  await deleteLocalAttachmentFile(removed.filePath);
}

export async function clearItemDraft(draftId: string): Promise<void> {
  const draft = drafts.get(draftId);
  if (!draft) {
    return;
  }

  for (const attachment of draft.attachments) {
    await deleteLocalAttachmentFile(attachment.filePath);
  }
  drafts.delete(draftId);
}

export async function linkDraftAttachmentsToItem(
  draftId: string,
  itemId: string
): Promise<void> {
  const draft = drafts.get(draftId);
  if (!draft || draft.attachments.length === 0) {
    drafts.delete(draftId);
    return;
  }

  const attachmentRepository = await getAttachmentRepository();
  for (const attachment of draft.attachments) {
    await attachmentRepository.add({
      itemId,
      type: attachment.type,
      mimeType: attachment.mimeType,
      filePath: attachment.filePath,
      originalFileName: attachment.originalFileName,
      fileSizeBytes: attachment.fileSizeBytes,
    });
  }

  drafts.delete(draftId);
}
