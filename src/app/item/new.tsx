import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from "react-native";

import { Badge, Button, Card } from "@/components/ui";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import type { AttachmentType } from "@/models/attachment";
import type { StoredAttachmentFile } from "@/services/attachment-storage";
import {
  capturePhotoAttachment,
  pickAttachmentFromDevice,
} from "@/services/attachment-storage";
import {
  addAttachmentToDraft,
  createItemDraft,
  getItemDraftAttachments,
  removeAttachmentFromDraft,
} from "@/services/item-draft-store";

function toSingleParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes || bytes <= 0) {
    return "unknown size";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function withType(
  attachment: StoredAttachmentFile,
  type: AttachmentType
): StoredAttachmentFile {
  return {
    ...attachment,
    type,
  };
}

export default function NewItemRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ draftId?: string | string[]; step?: string | string[] }>();
  const draftId = toSingleParam(params.draftId);
  const step = toSingleParam(params.step) ?? "1";

  const [isInitializing, setIsInitializing] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<StoredAttachmentFile[]>([]);

  const receiptAttachments = useMemo(
    () => attachments.filter((attachment) => attachment.type === "RECEIPT"),
    [attachments]
  );
  const extraPhotos = useMemo(
    () => attachments.filter((attachment) => attachment.type === "PHOTO"),
    [attachments]
  );

  const reloadDraftAttachments = useCallback((id: string) => {
    setAttachments(getItemDraftAttachments(id));
  }, []);

  useEffect(() => {
    if (draftId) {
      reloadDraftAttachments(draftId);
      setIsInitializing(false);
      return;
    }

    const createdDraftId = createItemDraft();
    router.replace({
      pathname: "/item/new",
      params: { draftId: createdDraftId, step: "1" },
    });
  }, [draftId, reloadDraftAttachments, router]);

  const addReceiptFromCamera = async () => {
    if (!draftId) {
      return;
    }
    setIsBusy(true);
    setErrorMessage(null);
    try {
      const captured = await capturePhotoAttachment();
      if (!captured) {
        return;
      }
      addAttachmentToDraft(draftId, withType(captured, "RECEIPT"));
      reloadDraftAttachments(draftId);
    } catch (error) {
      console.error("Failed to capture receipt", error);
      setErrorMessage("Could not capture receipt photo.");
    } finally {
      setIsBusy(false);
    }
  };

  const uploadReceipt = async () => {
    if (!draftId) {
      return;
    }
    setIsBusy(true);
    setErrorMessage(null);
    try {
      const picked = await pickAttachmentFromDevice();
      if (!picked) {
        return;
      }
      addAttachmentToDraft(draftId, withType(picked, "RECEIPT"));
      reloadDraftAttachments(draftId);
    } catch (error) {
      console.error("Failed to upload receipt", error);
      setErrorMessage("Could not upload receipt.");
    } finally {
      setIsBusy(false);
    }
  };

  const addExtraPhoto = async () => {
    if (!draftId) {
      return;
    }
    setIsBusy(true);
    setErrorMessage(null);
    try {
      const captured = await capturePhotoAttachment();
      if (!captured) {
        return;
      }
      addAttachmentToDraft(draftId, withType(captured, "PHOTO"));
      reloadDraftAttachments(draftId);
    } catch (error) {
      console.error("Failed to capture extra photo", error);
      setErrorMessage("Could not capture extra photo.");
    } finally {
      setIsBusy(false);
    }
  };

  const removeAttachment = async (filePath: string) => {
    if (!draftId) {
      return;
    }
    try {
      await removeAttachmentFromDraft(draftId, filePath);
      reloadDraftAttachments(draftId);
    } catch (error) {
      console.error("Failed to remove attachment", error);
      setErrorMessage("Could not remove attachment.");
    }
  };

  if (isInitializing) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator />
        <ThemedText>Preparing item draft...</ThemedText>
      </ThemedView>
    );
  }

  if (step === "2") {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.content}>
          <Badge text="Step 2 (next issue)" />
          <ThemedText type="title">Core Fields Coming Next</ThemedText>
          <ThemedText themeColor="textSecondary">
            You can already proceed from attachment step without blocking.
          </ThemedText>
          <Card>
            <ThemedText type="smallBold">Draft Summary</ThemedText>
            <ThemedText type="small">Receipts: {receiptAttachments.length}</ThemedText>
            <ThemedText type="small">Extra photos: {extraPhotos.length}</ThemedText>
          </Card>
          <Button
            variant="secondary"
            label="Back to Step 1"
            onPress={() =>
              router.replace({
                pathname: "/item/new",
                params: { draftId: draftId ?? "", step: "1" },
              })
            }
          />
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Badge text="Step 1 of 2" />
        <ThemedText type="title">Add Item: Attachments</ThemedText>
        <ThemedText themeColor="textSecondary">
          Add a receipt photo/upload and optional extra photos. You can continue without attachments.
        </ThemedText>

        {errorMessage && <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>}

        <Card>
          <ThemedText type="smallBold">Receipt</ThemedText>
          <View style={styles.row}>
            <Button
              variant="secondary"
              label={isBusy ? "Working..." : "Capture Receipt Photo"}
              onPress={() => void addReceiptFromCamera()}
              disabled={isBusy}
            />
            <Button
              variant="secondary"
              label={isBusy ? "Working..." : "Upload PDF/Image"}
              onPress={() => void uploadReceipt()}
              disabled={isBusy}
            />
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            Receipts attached: {receiptAttachments.length}
          </ThemedText>
        </Card>

        <Card>
          <ThemedText type="smallBold">Extra Photos (product/box/serial)</ThemedText>
          <Button
            variant="secondary"
            label={isBusy ? "Working..." : "Add Extra Photo"}
            onPress={() => void addExtraPhoto()}
            disabled={isBusy}
          />
          <ThemedText type="small" themeColor="textSecondary">
            Extra photos attached: {extraPhotos.length}
          </ThemedText>
        </Card>

        {attachments.length > 0 && (
          <Card>
            <ThemedText type="smallBold">Attached Files</ThemedText>
            {attachments.map((attachment) => (
              <View key={attachment.filePath} style={styles.attachmentRow}>
                <View style={styles.attachmentMeta}>
                  <ThemedText type="smallBold">
                    {attachment.type === "RECEIPT" ? "Receipt" : "Photo"}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {attachment.originalFileName ?? "Unnamed file"}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {formatFileSize(attachment.fileSizeBytes)}
                  </ThemedText>
                </View>
                <Button
                  variant="ghost"
                  label="Remove"
                  onPress={() => {
                    Alert.alert(
                      "Remove attachment",
                      "This will delete the local draft file. Continue?",
                      [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Remove",
                          style: "destructive",
                          onPress: () => void removeAttachment(attachment.filePath),
                        },
                      ]
                    );
                  }}
                />
              </View>
            ))}
          </Card>
        )}

        <Button
          label="Continue to Step 2"
          onPress={() =>
            router.replace({
              pathname: "/item/new",
              params: { draftId: draftId ?? "", step: "2" },
            })
          }
        />
        <ThemedText type="small" themeColor="textSecondary">
          You can continue even with no attachments. Missing receipt is flagged later.
        </ThemedText>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.two,
    padding: Spacing.four,
  },
  content: {
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
    padding: Spacing.four,
    gap: Spacing.three,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
  },
  attachmentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: Spacing.two,
  },
  attachmentMeta: {
    flex: 1,
    gap: 2,
  },
  errorText: {
    color: "#B00020",
  },
});
