import { config } from "@gluestack-ui/config";
import { GluestackUIProvider } from "@gluestack-ui/themed";
import React from "react";

interface AppGluestackUIProviderProps {
  children: React.ReactNode;
  colorMode: "light" | "dark";
}

export function AppGluestackUIProvider({ children, colorMode }: AppGluestackUIProviderProps) {
  return (
    <GluestackUIProvider config={config} colorMode={colorMode}>
      {children}
    </GluestackUIProvider>
  );
}
