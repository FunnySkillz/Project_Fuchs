import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollView } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Box,
  Button,
  ButtonText,
  Card,
  Heading,
  HStack,
  Input,
  InputField,
  Spinner,
  Switch,
  Text,
  VStack,
} from "@gluestack-ui/themed";

import { useI18n } from "@/contexts/language-context";
import { estimateAustrianMarginalRateBpsFromAnnualGrossCents } from "@/domain/austrian-marginal-rate";
import { useTheme } from "@/hooks/use-theme";
import {
  buildTaxCalculationPreview,
  type TaxCalculationSettingsFormInput,
  validateTaxCalculationSettingsFormInput,
} from "@/domain/tax-calculation-settings";
import { bpsToPercent, type ProfileSettings } from "@/models/profile-settings";
import { getProfileSettingsRepository } from "@/repositories/create-profile-settings-repository";
import { emitProfileSettingsSaved } from "@/services/app-events";
import { formatCents } from "@/utils/money";

type FieldKey =
  | "taxYearDefault"
  | "monthlyGrossIncomeEuros"
  | "manualMarginalRatePercent"
  | "gwgThresholdEuros"
  | "defaultWorkPercent";

const fieldOrder: FieldKey[] = [
  "taxYearDefault",
  "monthlyGrossIncomeEuros",
  "manualMarginalRatePercent",
  "gwgThresholdEuros",
  "defaultWorkPercent",
];

type FocusTarget = {
  focus?: () => void;
};

type SaveButtonState = "idle" | "saving" | "saved";

function formatPercent(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

function parseNumberish(value: string): number | null {
  const trimmed = value.trim().replace(",", ".");
  if (!trimmed) {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function createFormState(settings: ProfileSettings): TaxCalculationSettingsFormInput {
  return {
    taxYearDefault: String(settings.taxYearDefault),
    monthlyGrossIncomeEuros: (settings.monthlyGrossIncomeCents / 100).toFixed(2),
    salaryPaymentsPerYear: settings.salaryPaymentsPerYear,
    useManualMarginalTaxRate: settings.useManualMarginalTaxRate,
    manualMarginalRatePercent: formatPercent(bpsToPercent(settings.manualMarginalRateBps)),
    defaultWorkPercent: String(settings.defaultWorkPercent),
    gwgThresholdEuros: (settings.gwgThresholdCents / 100).toFixed(2),
    applyHalfYearRule: settings.applyHalfYearRule,
    werbungskostenPauschaleEnabled: settings.werbungskostenPauschaleEnabled,
    werbungskostenPauschaleAmountCents: settings.werbungskostenPauschaleAmountCents,
  };
}

export default function SettingsTaxCalculationRoute() {
  const router = useRouter();
  const theme = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const canGoBack =
    typeof (router as { canGoBack?: () => boolean }).canGoBack === "function"
      ? (router as { canGoBack: () => boolean }).canGoBack()
      : false;

  const [formState, setFormState] = useState<TaxCalculationSettingsFormInput | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saveButtonState, setSaveButtonState] = useState<SaveButtonState>("idle");
  const [isAdvancedDefaultsOpen, setIsAdvancedDefaultsOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [touchedFields, setTouchedFields] = useState<Partial<Record<FieldKey, boolean>>>({});

  const scrollRef = useRef<ScrollView | null>(null);
  const fieldYRef = useRef<Partial<Record<FieldKey, number>>>({});
  const inputRef = useRef<Partial<Record<FieldKey, FocusTarget | null>>>({});
  const saveStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearSaveStatusTimer = useCallback(() => {
    if (saveStatusTimerRef.current !== null) {
      clearTimeout(saveStatusTimerRef.current);
      saveStatusTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearSaveStatusTimer();
    };
  }, [clearSaveStatusTimer]);

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const repository = await getProfileSettingsRepository();
      const settings = await repository.getSettings();
      setFormState(createFormState(settings));
      setSubmitAttempted(false);
      setTouchedFields({});
    } catch (error) {
      console.error("Failed to load tax settings", error);
      setLoadError(t("settings.taxCalculation.loadError"));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const validation = useMemo(() => {
    if (!formState) {
      return {
        valid: false,
        fieldErrors: { formState: t("settings.taxCalculation.loading") } as Record<string, string>,
      } as const;
    }
    return validateTaxCalculationSettingsFormInput(formState);
  }, [formState, t]);

  const preview = useMemo(() => {
    if (!validation.valid) {
      return null;
    }
    return buildTaxCalculationPreview(validation.values);
  }, [validation]);

  const marginalRateEstimate = useMemo(() => {
    if (!formState) {
      return null;
    }
    const taxYear = parseNumberish(formState.taxYearDefault);
    const monthlyGrossIncomeEuros = parseNumberish(formState.monthlyGrossIncomeEuros);
    if (taxYear === null || monthlyGrossIncomeEuros === null || monthlyGrossIncomeEuros < 0) {
      return null;
    }
    const annualGrossCents = Math.round(monthlyGrossIncomeEuros * 100) * formState.salaryPaymentsPerYear;
    return estimateAustrianMarginalRateBpsFromAnnualGrossCents(annualGrossCents, Math.round(taxYear));
  }, [formState]);

  const shouldShowFieldError = useCallback(
    (field: FieldKey) => Boolean((submitAttempted || touchedFields[field]) && validation.fieldErrors[field]),
    [submitAttempted, touchedFields, validation.fieldErrors]
  );

  const isSubmitDisabled = (submitAttempted && !validation.valid) || saveButtonState !== "idle";

  const setFieldTouched = useCallback((field: FieldKey) => {
    setTouchedFields((current) => ({ ...current, [field]: true }));
  }, []);

  const scrollToField = useCallback((field: FieldKey) => {
    const y = fieldYRef.current[field];
    if (typeof y !== "number") {
      return;
    }
    scrollRef.current?.scrollTo({ y: Math.max(0, y - 20), animated: true });
  }, []);

  const focusField = useCallback((field: FieldKey) => {
    const target = inputRef.current[field];
    if (!target || typeof target.focus !== "function") {
      return;
    }
    requestAnimationFrame(() => {
      target.focus?.();
    });
  }, []);

  const focusAndScrollFirstInvalid = useCallback(() => {
    const firstInvalid = fieldOrder.find((field) => validation.fieldErrors[field]);
    if (!firstInvalid) {
      return;
    }
    if (firstInvalid === "defaultWorkPercent") {
      setIsAdvancedDefaultsOpen(true);
    }
    scrollToField(firstInvalid);
    focusField(firstInvalid);
  }, [focusField, scrollToField, validation.fieldErrors]);

  const updateFormField = <K extends keyof TaxCalculationSettingsFormInput>(
    key: K,
    value: TaxCalculationSettingsFormInput[K]
  ) => {
    setFormState((current) => (current ? { ...current, [key]: value } : current));
    clearSaveStatusTimer();
    setSaveButtonState("idle");
    setSaveError(null);
    setSaveSuccess(null);
  };

  const handleSave = async () => {
    setSubmitAttempted(true);
    if (!validation.valid || saveButtonState !== "idle") {
      focusAndScrollFirstInvalid();
      return;
    }

    clearSaveStatusTimer();
    setSaveButtonState("saving");
    setSaveError(null);
    setSaveSuccess(null);
    try {
      const repository = await getProfileSettingsRepository();
      await repository.upsertSettings({
        taxYearDefault: validation.values.taxYearDefault,
        monthlyGrossIncomeCents: validation.values.monthlyGrossIncomeCents,
        salaryPaymentsPerYear: validation.values.salaryPaymentsPerYear,
        useManualMarginalTaxRate: validation.values.useManualMarginalTaxRate,
        manualMarginalRateBps: validation.values.manualMarginalRateBps,
        marginalRateBps: validation.values.effectiveMarginalRateBps,
        defaultWorkPercent: validation.values.defaultWorkPercent,
        gwgThresholdCents: validation.values.gwgThresholdCents,
        applyHalfYearRule: validation.values.applyHalfYearRule,
        werbungskostenPauschaleEnabled: validation.values.werbungskostenPauschaleEnabled,
        werbungskostenPauschaleAmountCents: validation.values.werbungskostenPauschaleAmountCents,
      });
      setSaveSuccess(t("settings.taxCalculation.saveSuccess"));
      emitProfileSettingsSaved();
      setSaveButtonState("saved");
      saveStatusTimerRef.current = setTimeout(() => {
        setSaveButtonState("idle");
        setSaveSuccess(null);
        saveStatusTimerRef.current = null;
      }, 1200);
    } catch (error) {
      console.error("Failed to save tax settings", error);
      setSaveError(t("settings.taxCalculation.saveError"));
      setSaveButtonState("idle");
    }
  };

  if (isLoading || !formState) {
    return (
      <SafeAreaView style={{ flex: 1 }} edges={["bottom"]}>
        <Box flex={1} px="$5" py="$6" alignItems="center" justifyContent="center">
          <VStack space="md" alignItems="center">
            <Spinner size="large" />
            <Text size="sm" color={theme.textSecondary}>{t("settings.taxCalculation.loading")}</Text>
          </VStack>
        </Box>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["bottom"]}>
      <Box flex={1} px="$5">
        <ScrollView
          ref={scrollRef}
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustContentInsets={false}
          contentContainerStyle={{
            width: "100%",
            maxWidth: 860,
            alignSelf: "center",
            paddingTop: 24,
            paddingBottom: insets.bottom + 24,
          }}
        >
          <VStack space="lg">
            {!canGoBack && (
              <Button
                variant="outline"
                action="secondary"
                alignSelf="flex-start"
                onPress={() => router.replace("/(tabs)/settings")}
                testID="settings-back-to-main-fallback"
              >
                <ButtonText color={theme.text}>{t("common.action.backToSettings")}</ButtonText>
              </Button>
            )}

            <VStack space="xs">
              <Heading size="xl" color={theme.text}>{t("settings.taxCalculation.title")}</Heading>
              <Text size="sm" color={theme.textSecondary}>
                {t("settings.taxCalculation.subtitle")}
              </Text>
            </VStack>

            {loadError && (
              <Card borderWidth="$1" borderColor="$error300">
                <Text size="sm" color={theme.danger}>{loadError}</Text>
              </Card>
            )}

            <Card borderWidth="$1" borderColor="$border200">
              <VStack space="md">
                <Heading size="md" color={theme.text}>{t("settings.taxCalculation.profileTitle")}</Heading>

                <VStack
                  space="xs"
                  onLayout={(event) => {
                    fieldYRef.current.taxYearDefault = event.nativeEvent.layout.y;
                  }}
                  testID="settings-tax-input-taxYearDefault"
                >
                  <Text bold size="sm" color={theme.textSecondary}>
                    {t("settings.taxCalculation.taxYearDefault")}
                  </Text>
                  <Input
                    variant="outline"
                    borderColor={shouldShowFieldError("taxYearDefault") ? "$error600" : "$border200"}
                  >
                    <InputField
                      ref={(node) => {
                        inputRef.current.taxYearDefault = node as FocusTarget | null;
                      }}
                      value={formState.taxYearDefault}
                      onChangeText={(value) => updateFormField("taxYearDefault", value)}
                      onBlur={() => setFieldTouched("taxYearDefault")}
                      keyboardType="number-pad"
                      maxLength={4}
                      placeholder="2026"
                      testID="settings-tax-year-input"
                      accessibilityState={
                        ({ invalid: shouldShowFieldError("taxYearDefault") } as any)
                      }
                    />
                  </Input>
                  {shouldShowFieldError("taxYearDefault") && (
                    <Text size="xs" color={theme.danger} testID="settings-tax-error-taxYearDefault">
                      {validation.fieldErrors.taxYearDefault}
                    </Text>
                  )}
                </VStack>

                <VStack
                  space="xs"
                  onLayout={(event) => {
                    fieldYRef.current.monthlyGrossIncomeEuros = event.nativeEvent.layout.y;
                  }}
                  testID="settings-tax-input-monthlyGrossIncomeEuros"
                >
                  <Text bold size="sm" color={theme.textSecondary}>
                    {t("settings.taxCalculation.monthlyGrossIncome")}
                  </Text>
                  <Input
                    variant="outline"
                    borderColor={
                      shouldShowFieldError("monthlyGrossIncomeEuros") ? "$error600" : "$border200"
                    }
                  >
                    <InputField
                      ref={(node) => {
                        inputRef.current.monthlyGrossIncomeEuros = node as FocusTarget | null;
                      }}
                      value={formState.monthlyGrossIncomeEuros}
                      onChangeText={(value) => updateFormField("monthlyGrossIncomeEuros", value)}
                      onBlur={() => setFieldTouched("monthlyGrossIncomeEuros")}
                      keyboardType="decimal-pad"
                      placeholder="3000.00"
                      testID="settings-monthly-gross-input"
                      accessibilityState={
                        ({ invalid: shouldShowFieldError("monthlyGrossIncomeEuros") } as any)
                      }
                    />
                  </Input>
                  {shouldShowFieldError("monthlyGrossIncomeEuros") && (
                    <Text size="xs" color={theme.danger} testID="settings-tax-error-monthlyGrossIncomeEuros">
                      {validation.fieldErrors.monthlyGrossIncomeEuros}
                    </Text>
                  )}
                </VStack>

                <VStack space="xs">
                  <Text bold size="sm" color={theme.textSecondary}>
                    {t("settings.taxCalculation.salaryPaymentsPerYear")}
                  </Text>
                  <HStack space="sm">
                    <Button
                      size="sm"
                      variant={formState.salaryPaymentsPerYear === 12 ? "solid" : "outline"}
                      action={formState.salaryPaymentsPerYear === 12 ? "primary" : "secondary"}
                      onPress={() => updateFormField("salaryPaymentsPerYear", 12)}
                      testID="settings-salary-payments-12"
                    >
                      <ButtonText color={formState.salaryPaymentsPerYear === 12 ? theme.textOnPrimary : theme.text}>
                        12
                      </ButtonText>
                    </Button>
                    <Button
                      size="sm"
                      variant={formState.salaryPaymentsPerYear === 14 ? "solid" : "outline"}
                      action={formState.salaryPaymentsPerYear === 14 ? "primary" : "secondary"}
                      onPress={() => updateFormField("salaryPaymentsPerYear", 14)}
                      testID="settings-salary-payments-14"
                    >
                      <ButtonText color={formState.salaryPaymentsPerYear === 14 ? theme.textOnPrimary : theme.text}>
                        14
                      </ButtonText>
                    </Button>
                  </HStack>
                </VStack>

                <VStack space="xs">
                  <Text bold size="sm" color={theme.textSecondary}>
                    {t("settings.taxCalculation.autoMarginalRate")}
                  </Text>
                  <Text size="sm" color={theme.text} testID="settings-auto-marginal-rate">
                    {marginalRateEstimate
                      ? `${formatPercent(bpsToPercent(marginalRateEstimate.marginalRateBps))}%`
                      : t("settings.taxCalculation.notAvailable")}
                  </Text>
                  {marginalRateEstimate && (
                    <Text size="sm" color={theme.textSecondary}>
                      {t("settings.taxCalculation.estimatedAnnualGross", {
                        amount: formatCents(marginalRateEstimate.annualGrossCents),
                      })}
                    </Text>
                  )}
                  <Text size="xs" color={theme.textMuted}>
                    {t("settings.taxCalculation.estimateOnly", {
                      year:
                        marginalRateEstimate?.usedTaxYear ??
                        t("settings.taxCalculation.selectedYearFallback"),
                    })}
                  </Text>
                </VStack>

                <HStack justifyContent="space-between" alignItems="center">
                  <VStack space="xs" flex={1}>
                    <Text size="sm" color={theme.textSecondary}>
                      {t("settings.taxCalculation.manualRateTitle")}
                    </Text>
                    <Text size="xs" color={theme.textMuted}>
                      {t("settings.taxCalculation.manualRateHint")}
                    </Text>
                  </VStack>
                  <Switch
                    value={formState.useManualMarginalTaxRate}
                    onValueChange={(value) => updateFormField("useManualMarginalTaxRate", value)}
                    testID="settings-manual-rate-toggle"
                  />
                </HStack>

                {formState.useManualMarginalTaxRate && (
                  <VStack
                    space="xs"
                    onLayout={(event) => {
                      fieldYRef.current.manualMarginalRatePercent = event.nativeEvent.layout.y;
                    }}
                    testID="settings-tax-input-manualMarginalRatePercent"
                  >
                    <Text bold size="sm" color={theme.textSecondary}>
                      {t("settings.taxCalculation.manualRateInputLabel")}
                    </Text>
                    <Input
                      variant="outline"
                      borderColor={
                        shouldShowFieldError("manualMarginalRatePercent")
                          ? "$error600"
                          : "$border200"
                      }
                    >
                      <InputField
                        ref={(node) => {
                          inputRef.current.manualMarginalRatePercent = node as FocusTarget | null;
                        }}
                        value={formState.manualMarginalRatePercent}
                        onChangeText={(value) => updateFormField("manualMarginalRatePercent", value)}
                        onBlur={() => setFieldTouched("manualMarginalRatePercent")}
                        keyboardType="decimal-pad"
                        placeholder="40"
                        testID="settings-marginal-rate-input"
                        accessibilityState={
                          ({ invalid: shouldShowFieldError("manualMarginalRatePercent") } as any)
                        }
                      />
                    </Input>
                    {shouldShowFieldError("manualMarginalRatePercent") && (
                      <Text size="xs" color={theme.danger} testID="settings-tax-error-manualMarginalRatePercent">
                        {validation.fieldErrors.manualMarginalRatePercent}
                      </Text>
                    )}
                  </VStack>
                )}
              </VStack>
            </Card>

            <Card borderWidth="$1" borderColor="$border200">
              <VStack space="md">
                <Heading size="md" color={theme.text}>{t("settings.taxCalculation.deductionRulesTitle")}</Heading>

                <VStack
                  space="xs"
                  onLayout={(event) => {
                    fieldYRef.current.gwgThresholdEuros = event.nativeEvent.layout.y;
                  }}
                  testID="settings-tax-input-gwgThresholdEuros"
                >
                  <Text bold size="sm" color={theme.textSecondary}>
                    {t("settings.taxCalculation.gwgThreshold")}
                  </Text>
                  <Input
                    variant="outline"
                    borderColor={shouldShowFieldError("gwgThresholdEuros") ? "$error600" : "$border200"}
                  >
                    <InputField
                      ref={(node) => {
                        inputRef.current.gwgThresholdEuros = node as FocusTarget | null;
                      }}
                      value={formState.gwgThresholdEuros}
                      onChangeText={(value) => updateFormField("gwgThresholdEuros", value)}
                      onBlur={() => setFieldTouched("gwgThresholdEuros")}
                      keyboardType="decimal-pad"
                      placeholder="1000.00"
                      testID="settings-gwg-threshold-input"
                      accessibilityState={
                        ({ invalid: shouldShowFieldError("gwgThresholdEuros") } as any)
                      }
                    />
                  </Input>
                  {shouldShowFieldError("gwgThresholdEuros") && (
                    <Text size="xs" color={theme.danger} testID="settings-tax-error-gwgThresholdEuros">
                      {validation.fieldErrors.gwgThresholdEuros}
                    </Text>
                  )}
                </VStack>

                <HStack justifyContent="space-between" alignItems="center">
                  <Text size="sm" color={theme.textSecondary}>
                    {t("settings.taxCalculation.applyHalfYearRule")}
                  </Text>
                  <Switch
                    value={formState.applyHalfYearRule}
                    onValueChange={(value) => updateFormField("applyHalfYearRule", value)}
                    testID="settings-half-year-rule-toggle"
                  />
                </HStack>

                <HStack justifyContent="space-between" alignItems="center">
                  <Text size="sm" color={theme.textSecondary}>
                    {t("settings.taxCalculation.werbungskostenEnabled")}
                  </Text>
                  <Switch
                    value={formState.werbungskostenPauschaleEnabled}
                    onValueChange={(value) => updateFormField("werbungskostenPauschaleEnabled", value)}
                    testID="settings-werbungskosten-enabled"
                  />
                </HStack>

                {formState.werbungskostenPauschaleEnabled && (
                  <Text size="xs" color={theme.textMuted} testID="settings-tax-werbung-info">
                    {t("settings.taxCalculation.werbungskostenInfo", {
                      amount: formatCents(formState.werbungskostenPauschaleAmountCents),
                    })}
                  </Text>
                )}
              </VStack>
            </Card>

            <Card borderWidth="$1" borderColor="$border200">
              <VStack space="md">
                <HStack justifyContent="space-between" alignItems="center">
                  <Heading size="md" color={theme.text}>{t("settings.taxCalculation.advancedDefaultsTitle")}</Heading>
                  <Button
                    size="sm"
                    variant="outline"
                    action="secondary"
                    onPress={() => setIsAdvancedDefaultsOpen((current) => !current)}
                    testID="settings-tax-advanced-toggle"
                  >
                    <ButtonText color={theme.text}>
                      {isAdvancedDefaultsOpen
                        ? t("settings.taxCalculation.collapse")
                        : t("settings.taxCalculation.expand")}
                    </ButtonText>
                  </Button>
                </HStack>
                {isAdvancedDefaultsOpen && (
                  <VStack
                    space="xs"
                    onLayout={(event) => {
                      fieldYRef.current.defaultWorkPercent = event.nativeEvent.layout.y;
                    }}
                    testID="settings-tax-input-defaultWorkPercent"
                  >
                    <Text bold size="sm" color={theme.textSecondary}>
                      {t("settings.taxCalculation.defaultWorkPercent")}
                    </Text>
                    <Input
                      variant="outline"
                      borderColor={shouldShowFieldError("defaultWorkPercent") ? "$error600" : "$border200"}
                    >
                      <InputField
                        ref={(node) => {
                          inputRef.current.defaultWorkPercent = node as FocusTarget | null;
                        }}
                        value={formState.defaultWorkPercent}
                        onChangeText={(value) => updateFormField("defaultWorkPercent", value)}
                        onBlur={() => setFieldTouched("defaultWorkPercent")}
                        keyboardType="number-pad"
                        placeholder="100"
                        testID="settings-default-work-percent-input"
                        accessibilityState={
                          ({ invalid: shouldShowFieldError("defaultWorkPercent") } as any)
                        }
                      />
                    </Input>
                    {shouldShowFieldError("defaultWorkPercent") && (
                      <Text size="xs" color={theme.danger} testID="settings-tax-error-defaultWorkPercent">
                        {validation.fieldErrors.defaultWorkPercent}
                      </Text>
                    )}
                    <Text size="xs" color={theme.textMuted}>
                      {t("settings.taxCalculation.defaultWorkPercentHint")}
                    </Text>
                  </VStack>
                )}
              </VStack>
            </Card>

            {preview && (
              <Card borderWidth="$1" borderColor="$border200">
                <VStack space="xs">
                  <Heading size="sm" color={theme.text}>
                    {t("settings.taxCalculation.previewTitle")}
                  </Heading>
                  <Text size="sm" color={theme.text}>
                    {t("settings.taxCalculation.previewSampleAmount", {
                      amount: formatCents(preview.sampleItemCents),
                    })}
                  </Text>
                  <Text size="sm" color={theme.text}>
                    {t("settings.taxCalculation.previewWorkRelevant", {
                      amount: formatCents(preview.workRelevantCents),
                    })}
                  </Text>
                  <Text size="sm" color={theme.text}>
                    {t("settings.taxCalculation.previewDeductible", {
                      amount: formatCents(preview.deductibleThisYearCents),
                    })}
                  </Text>
                  <Text size="sm" color={theme.text}>
                    {t("settings.taxCalculation.previewRefund", {
                      amount: formatCents(preview.estimatedRefundCents),
                    })}
                  </Text>
                  <Text size="sm" color={theme.text}>
                    {t("settings.taxCalculation.previewMode", { mode: preview.modeLabel })}
                  </Text>
                  <Text size="sm" color={theme.text}>
                    {t("settings.taxCalculation.previewRate", {
                      rate: `${formatPercent(bpsToPercent(preview.marginalRateUsedBps))}%`,
                    })}
                  </Text>
                  {formState.werbungskostenPauschaleEnabled && (
                    <Text size="xs" color={theme.textMuted}>
                      {t("settings.taxCalculation.previewWerbungHint")}
                    </Text>
                  )}
                </VStack>
              </Card>
            )}

            <Card borderWidth="$1" borderColor="$border200" testID="settings-tax-disclaimer-card">
              <VStack space="xs">
                <Heading size="sm" color={theme.text}>{t("settings.taxCalculation.infoTitle")}</Heading>
                <Text size="sm" color={theme.textSecondary}>
                  {t("settings.taxCalculation.infoLine1")}
                </Text>
                <Text size="sm" color={theme.textSecondary}>
                  {t("settings.taxCalculation.infoLine2")}
                </Text>
                <Text size="sm" color={theme.textSecondary}>{t("settings.taxCalculation.infoLine3")}</Text>
              </VStack>
            </Card>

            <Card borderWidth="$1" borderColor="$border200">
              <VStack space="md">
                {saveError && <Text size="sm" color={theme.danger}>{saveError}</Text>}
                {saveSuccess && <Text size="sm" color={theme.success}>{saveSuccess}</Text>}
                <Box testID="settings-tax-btn-submit">
                  <Button
                    onPress={() => void handleSave()}
                    disabled={isSubmitDisabled}
                    testID="settings-tax-save"
                    accessibilityState={{ disabled: isSubmitDisabled }}
                  >
                    <ButtonText color={theme.textOnPrimary}>
                      {saveButtonState === "saving"
                        ? t("settings.taxCalculation.saving")
                        : saveButtonState === "saved"
                          ? t("common.status.saved")
                          : t("settings.taxCalculation.saveCta")}
                    </ButtonText>
                  </Button>
                </Box>
              </VStack>
            </Card>
          </VStack>
        </ScrollView>
      </Box>
    </SafeAreaView>
  );
}
