import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HapticTab } from "@/components/haptic-tab";
import { palette } from "@/components/media-ui";
export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const bottom = Platform.OS === "web" ? 12 : Math.max(insets.bottom, 8);
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarActiveTintColor: palette.blue,
        tabBarInactiveTintColor: palette.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700" },
        tabBarStyle: {
          paddingTop: 9,
          paddingBottom: bottom,
          height: 60 + bottom,
          backgroundColor: "white",
          borderTopColor: palette.border,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Transferir",
          tabBarIcon: ({ color }) => (
            <Ionicons name="download-outline" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: "Biblioteca",
          tabBarIcon: ({ color }) => (
            <Ionicons name="folder-outline" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Ajustes",
          tabBarIcon: ({ color }) => (
            <Ionicons name="options-outline" size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
