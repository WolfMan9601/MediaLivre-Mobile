import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
export const palette = {
  navy: "#112240",
  blue: "#2454AE",
  yellow: "#FFD337",
  background: "#F3F5F9",
  ink: "#12213A",
  muted: "#64748B",
  border: "#DEE5F0",
  white: "#FFFFFF",
  danger: "#B83038",
  success: "#227751",
};
export function Page({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <SafeAreaView
      edges={["top"]}
      style={{ flex: 1, backgroundColor: palette.navy }}
    >
      <View style={styles.header}>
        <Image
          source={require("@/assets/images/icon.png")}
          style={{ width: 36, height: 36, borderRadius: 8 }}
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.brand}>MediaLivre</Text>
          <Text style={{ color: "#C7D5EC", fontSize: 12 }}>
            ANDROID · {title.toUpperCase()}
          </Text>
        </View>
        <Ionicons name="musical-notes" size={22} color={palette.yellow} />
      </View>
      <View style={{ flex: 1, backgroundColor: palette.background }}>
        <View style={styles.heading}>
          <Text className="font-bold" style={styles.title}>
            {title}
          </Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        {children}
      </View>
    </SafeAreaView>
  );
}
export function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}
export function Button({
  label,
  onPress,
  disabled,
  secondary,
  icon,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondary,
        { opacity: disabled ? 0.45 : pressed ? 0.8 : 1 },
      ]}
    >
      {icon && (
        <Ionicons
          name={icon}
          size={20}
          color={secondary ? palette.blue : palette.navy}
        />
      )}
      <Text
        style={{
          color: secondary ? palette.blue : palette.navy,
          fontSize: 15,
          fontWeight: "700",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
export function Label({ children }: { children: ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}
export function Progress({ value }: { value: number }) {
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: value }}
      style={styles.track}
    >
      <View
        style={{
          width: `${Math.max(0, Math.min(100, value))}%`,
          height: 6,
          backgroundColor: palette.blue,
          borderRadius: 8,
        }}
      />
    </View>
  );
}
export const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    paddingHorizontal: 22,
    paddingVertical: 18,
  },
  brand: {
    color: "white",
    fontSize: 23,
    fontWeight: "800",
    letterSpacing: -0.6,
  },
  heading: { paddingHorizontal: 22, paddingTop: 24, paddingBottom: 18 },
  title: {
    color: palette.ink,
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.7,
  },
  subtitle: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 7,
  },
  card: {
    backgroundColor: "white",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 18,
    gap: 14,
    marginBottom: 16,
  },
  label: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.3,
    color: palette.muted,
  },
  input: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: palette.ink,
    backgroundColor: "#F8FAFD",
    minHeight: 54,
  },
  button: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    backgroundColor: palette.yellow,
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  secondary: {
    backgroundColor: "#EEF3FC",
    borderColor: "#DCE5F5",
    borderWidth: 1,
  },
  track: {
    height: 6,
    backgroundColor: "#E5EBF4",
    borderRadius: 8,
    overflow: "hidden",
  },
  body: { color: palette.muted, fontSize: 13, lineHeight: 20 },
  error: { color: palette.danger, fontSize: 13, lineHeight: 20 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  small: { fontSize: 12, color: palette.muted },
});
