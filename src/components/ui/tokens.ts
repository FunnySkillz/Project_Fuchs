import { Spacing } from "@/constants/theme";

/**
 * NativeWind-style design tokens for reusable UI primitives.
 * These map to consistent spacing/radius/size values without one-off inline styles.
 */
export const UiTokens = {
  radius: {
    sm: 8,
    md: 10,
    lg: 14,
    xl: 18,
  },
  borderWidth: {
    thin: 1,
    thick: 2,
  },
  spacing: {
    xs: Spacing.one,
    sm: Spacing.two,
    md: Spacing.three,
    lg: Spacing.four,
  },
  fontSize: {
    sm: 14,
    md: 16,
  },
  minHeight: {
    control: 44,
    textarea: 104,
  },
} as const;
