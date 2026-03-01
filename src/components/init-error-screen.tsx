import React from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

interface Props {
  message: string;
  onRetry: () => void;
  onResetData: () => Promise<void> | void;
  onExportDebugInfo: () => Promise<void> | void;
}

export function InitErrorScreen({ message, onRetry, onResetData, onExportDebugInfo }: Props) {
  const theme = useTheme();
  const [showResetConfirm, setShowResetConfirm] = React.useState(false);
  const [isExportingDebug, setIsExportingDebug] = React.useState(false);
  const [isResettingData, setIsResettingData] = React.useState(false);
  const [feedbackMessage, setFeedbackMessage] = React.useState<string | null>(null);

  const handleExportDebugInfo = async () => {
    setIsExportingDebug(true);
    setFeedbackMessage(null);
    try {
      await onExportDebugInfo();
      setFeedbackMessage("Debug report created.");
    } catch {
      setFeedbackMessage("Could not export debug report.");
    } finally {
      setIsExportingDebug(false);
    }
  };

  const handleResetData = async () => {
    setIsResettingData(true);
    setFeedbackMessage(null);
    try {
      await onResetData();
    } catch {
      setFeedbackMessage("Could not reset local data.");
    } finally {
      setIsResettingData(false);
      setShowResetConfirm(false);
    }
  };

  return (
    <View style={styles.container}>
      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="subtitle" style={styles.center}>
          App Initialization Failed
        </ThemedText>
        <ThemedText style={styles.center} themeColor="textSecondary">
          {message}
        </ThemedText>
        <ThemedText style={styles.center} type="small" themeColor="textSecondary">
          Try retrying first. If this keeps failing, you can reset local data to reinitialize the database.
        </ThemedText>
        <Pressable
          style={({ pressed }) => [
            styles.primaryButton,
            {
              borderColor: theme.border,
              backgroundColor: theme.backgroundElement,
            },
            pressed && styles.pressed,
          ]}
          testID="init-error-retry"
          onPress={onRetry}
        >
          <ThemedText type="smallBold">Retry Initialization</ThemedText>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.secondaryButton,
            {
              borderColor: theme.border,
              backgroundColor: theme.backgroundElement,
            },
            pressed && styles.pressed,
          ]}
          testID="init-error-export-debug"
          onPress={() => void handleExportDebugInfo()}
          disabled={isExportingDebug || isResettingData}
        >
          <ThemedText type="smallBold">
            {isExportingDebug ? "Exporting Debug Info..." : "Export Debug Info"}
          </ThemedText>
        </Pressable>
        {!showResetConfirm ? (
          <Pressable
            style={({ pressed }) => [
              styles.dangerButton,
              {
                borderColor: theme.danger,
                backgroundColor: theme.backgroundSelected,
              },
              pressed && styles.pressed,
            ]}
            testID="init-error-reset-open-confirm"
            onPress={() => setShowResetConfirm(true)}
            disabled={isResettingData}
          >
            <ThemedText type="smallBold">Reset Local Data</ThemedText>
          </Pressable>
        ) : (
          <View style={styles.confirmWrap}>
            <ThemedText style={styles.center} type="small" themeColor="textSecondary">
              This will delete all local data on this device. Continue?
            </ThemedText>
            <View style={styles.confirmButtonsRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.confirmCancelButton,
                  {
                    borderColor: theme.border,
                    backgroundColor: theme.backgroundElement,
                  },
                  pressed && styles.pressed,
                ]}
                testID="init-error-reset-cancel"
                onPress={() => setShowResetConfirm(false)}
                disabled={isResettingData}
              >
                <ThemedText type="smallBold">Cancel</ThemedText>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.confirmDangerButton,
                  {
                    borderColor: theme.danger,
                    backgroundColor: theme.backgroundSelected,
                  },
                  pressed && styles.pressed,
                ]}
                testID="init-error-reset-confirm"
                onPress={() => void handleResetData()}
                disabled={isResettingData}
              >
                <ThemedText type="smallBold">
                  {isResettingData ? "Resetting..." : "Confirm Reset"}
                </ThemedText>
              </Pressable>
            </View>
          </View>
        )}
        {feedbackMessage && (
          <ThemedText style={styles.center} type="small" themeColor="textSecondary">
            {feedbackMessage}
          </ThemedText>
        )}
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.four,
  },
  card: {
    width: "100%",
    maxWidth: 640,
    borderRadius: Spacing.four,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  center: {
    textAlign: "center",
  },
  primaryButton: {
    borderWidth: 1,
    borderRadius: 10,
    alignItems: "center",
    paddingVertical: 12,
  },
  secondaryButton: {
    borderWidth: 1,
    borderRadius: 10,
    alignItems: "center",
    paddingVertical: 12,
  },
  dangerButton: {
    borderWidth: 1,
    borderRadius: 10,
    alignItems: "center",
    paddingVertical: 12,
  },
  confirmWrap: {
    gap: Spacing.two,
  },
  confirmButtonsRow: {
    flexDirection: "row",
    gap: Spacing.two,
  },
  confirmCancelButton: {
    borderWidth: 1,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    flex: 1,
  },
  confirmDangerButton: {
    borderWidth: 1,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    flex: 1,
  },
  pressed: {
    opacity: 0.75,
  },
});
