export type AppLanguage = "en" | "de";
export type AppLocale = "en-AT" | "de-AT";

export interface PluralMessage {
  zero?: string;
  one: string;
  other: string;
}

export type MessageValue = string | PluralMessage;
export type MessageCatalog = Record<string, MessageValue>;

export type InterpolationValues = Record<string, string | number>;
