import { config as defaultConfig } from "@gluestack-ui/config";

const financePalette = {
  primary50: "#E8F0FB",
  primary100: "#D4E3F8",
  primary200: "#B7CEF1",
  primary300: "#92B2E8",
  primary400: "#6E97DF",
  primary500: "#4E7FCF",
  primary600: "#3F68AA",
  primary700: "#315185",
  primary800: "#233A60",
  primary900: "#182741",

  backgroundLight0: "#F7F9FC",
  backgroundLight50: "#F2F5FA",
  backgroundLight100: "#E8EDF5",
  backgroundLight200: "#D7DFEC",
  backgroundLight300: "#C2CDDF",
  backgroundLight400: "#9AA8BE",
  backgroundLight500: "#7887A0",
  backgroundLight600: "#5D6A80",
  backgroundLight700: "#454F60",
  backgroundLight800: "#313846",
  backgroundLight900: "#1F252F",
  backgroundLight950: "#161B24",

  backgroundDark0: "#EEF2F8",
  backgroundDark50: "#E3E9F2",
  backgroundDark100: "#D1D9E7",
  backgroundDark200: "#BBC7DA",
  backgroundDark300: "#9FAEC5",
  backgroundDark400: "#7D8CA3",
  backgroundDark500: "#606E82",
  backgroundDark600: "#4A5566",
  backgroundDark700: "#343D4B",
  backgroundDark800: "#232A35",
  backgroundDark900: "#171D26",
  backgroundDark950: "#10151D",

  textLight900: "#1B2330",
  textDark50: "#E8EDF5",
  textDark100: "#D6DDE9",
  textDark200: "#C3CCDA",
  textDark300: "#A6B2C3",
  textDark400: "#8A98AB",
  textDark500: "#6E7B8F",

  borderLight300: "#C6D0DE",
  borderLight400: "#A2AFC1",
  borderDark700: "#414D5F",
  borderDark800: "#313A49",
} as const;

export const gluestackConfig = {
  ...defaultConfig,
  tokens: {
    ...defaultConfig.tokens,
    colors: {
      ...defaultConfig.tokens.colors,
      ...financePalette,
    },
  },
};
