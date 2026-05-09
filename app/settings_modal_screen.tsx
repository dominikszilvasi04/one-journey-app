import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Platform, Pressable, StyleSheet } from "react-native";

export default function SettingsModalScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? "light";
  const isDark = colorScheme === "dark";
  const palette = Colors[colorScheme];
  const styles = createStyles(isDark, palette);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>Quick actions for the app</Text>
      </View>

      <View style={styles.actionsRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open map"
          style={styles.actionButton}
          onPress={() => router.push("/(tabs)/map_home_screen")}
        >
          <View style={styles.actionIcon}>
            <Ionicons name="map-outline" size={28} color="#ffffff" />
          </View>
          <Text style={styles.actionLabel}>Map</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open favourites"
          style={styles.actionButton}
          onPress={() => router.push("/(tabs)/favourites_screen")}
        >
          <View style={styles.actionIcon}>
            <Ionicons name="heart-outline" size={28} color="#ffffff" />
          </View>
          <Text style={styles.actionLabel}>Favourites</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close settings"
          style={styles.actionButton}
          onPress={() => router.back()}
        >
          <View style={[styles.actionIcon, styles.closeIcon]}>
            <Ionicons name="close" size={28} color="#ffffff" />
          </View>
          <Text style={styles.actionLabel}>Close</Text>
        </Pressable>
      </View>

      <Text style={styles.helperText}>
        These shortcuts replace the boxy placeholder and keep the screen light.
      </Text>
      <StatusBar
        style={Platform.OS === "ios" ? (isDark ? "light" : "dark") : "auto"}
      />
    </View>
  );
}

function createStyles(isDark: boolean, palette: typeof Colors.light) {
  const page = isDark ? "#0c1117" : "#f6f8fb";
  const muted = isDark ? "#98a2b3" : "#667085";
  const softText = isDark ? "#e5e7eb" : "#344054";
  const iconBase = isDark ? "#2c6bed" : "#2563eb";
  const closeBase = isDark ? "#313847" : "#e4e7ec";

  return StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: 24,
      paddingTop: 72,
      backgroundColor: page,
    },
    header: {
      marginBottom: 32,
    },
    title: {
      fontSize: 32,
      fontWeight: "700",
      color: palette.text,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 16,
      lineHeight: 22,
      color: muted,
    },
    actionsRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 14,
    },
    actionButton: {
      flex: 1,
      alignItems: "center",
    },
    actionIcon: {
      width: 68,
      height: 68,
      borderRadius: 34,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: iconBase,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.18,
      shadowRadius: 16,
      elevation: 6,
    },
    closeIcon: {
      backgroundColor: closeBase,
    },
    actionLabel: {
      marginTop: 12,
      fontSize: 14,
      fontWeight: "600",
      color: softText,
      textAlign: "center",
    },
    helperText: {
      marginTop: 28,
      fontSize: 14,
      lineHeight: 20,
      color: muted,
    },
  });
}
