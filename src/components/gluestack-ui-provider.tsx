import { GluestackUIProvider } from "@gluestack-ui/themed";
import React from "react";
import { gluestackConfig } from "@/theme/gluestack.config";

interface AppGluestackUIProviderProps {
  children: React.ReactNode;
  colorMode: "light" | "dark";
}

export function AppGluestackUIProvider({ children, colorMode }: AppGluestackUIProviderProps) {
  return (
    <GluestackUIProvider config={gluestackConfig} colorMode={colorMode}>
      {children}
    </GluestackUIProvider>
  );
}
