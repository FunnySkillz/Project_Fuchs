import React from "react";
import { View, type ViewProps } from "react-native";

export function Card({ style, ...props }: ViewProps) {
  return <View {...props} style={style} className="rounded-ui-lg border border-ui-border bg-ui-card p-ui-md gap-ui-sm" />;
}
