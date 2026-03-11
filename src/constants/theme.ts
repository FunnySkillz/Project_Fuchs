/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#1B2330',
    background: '#F7F9FC',
    backgroundElement: '#EEF2F7',
    backgroundSelected: '#DFE6F0',
    textSecondary: '#66758A',
    textMuted: '#7A889C',
    border: '#C8D1DE',
    primary: '#4E7FCF',
    danger: '#C54444',
    success: '#2F8A52',
    textOnPrimary: '#F2F6FC',
  },
  dark: {
    text: '#E9EEF6',
    background: '#131922',
    backgroundElement: '#1C2430',
    backgroundSelected: '#2A3544',
    textSecondary: '#A6B2C3',
    textMuted: '#8A98AB',
    border: '#38475D',
    primary: '#6E97DF',
    danger: '#E66B6B',
    success: '#5CC98A',
    textOnPrimary: '#F1F5FB',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
