import { Redirect } from "expo-router";

export default function RootIndexRoute() {
  return <Redirect href="/(tabs)/home" />;
}
