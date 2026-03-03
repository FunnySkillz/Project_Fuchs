import { useIsFocused } from "@react-navigation/native";
import NewItemRoute from "@/app/item/new";

export default function AddTabRoute() {
  const isFocused = useIsFocused();
  if (!isFocused) {
    return null;
  }
  return <NewItemRoute />;
}
