import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { useFavourites } from "@/src/context/FavouritesContext";
import { useFavouritesArrivals } from "@/src/hooks/useFavouritesArrivals";
import { getStationKey } from "@/src/utils/stationIdentity";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from "react-native";

export default function FavouritesScreen() {
  const colourScheme = useColorScheme() ?? "light";
  const isDark = colourScheme === "dark";
  const palette = Colors[colourScheme];
  const styles = createStyles(isDark, palette);
  const { favourites, removeFavourite } = useFavourites();
  const { favouritesData, isRefreshing, onRefresh, loadAllArrivals } =
    useFavouritesArrivals(favourites);

  useEffect(() => {
    loadAllArrivals();
  }, [loadAllArrivals]);

  const renderFavouriteItem = (item: typeof favouritesData[0]) => (
    <View style={styles.favouriteCard}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.stationName}>{item.name}</Text>
          <Text style={styles.stationType}>
            {item.type} {item.line ? `${item.line} Line` : ""}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => removeFavourite(item)}
          style={styles.removeButton}
        >
          <Ionicons name="heart" size={24} colour="#ff4444" />
        </TouchableOpacity>
      </View>

      {item.isLoading ? (
        <ActivityIndicator size="small" color={palette.tint} />
      ) : item.error ? (
        <Text style={styles.errorText}>{item.error}</Text>
      ) : item.arrivals.length > 0 ? (
        <View style={styles.arrivalsContainer}>
          {item.arrivals.map((section) =>
            section.data.map((arrival, index) => (
              <View
                key={`${arrival.destination}-${index}`}
                style={styles.arrivalRow}
              >
                <Text style={styles.destinationText} numberOfLines={1}>
                  {arrival.destination}
                </Text>
                <Text style={styles.minutesText}>
                  {arrival.minutesToDeparture === 0
                    ? "Due"
                    : `${arrival.minutesToDeparture} min`}
                </Text>
              </View>
            ))
          )}
        </View>
      ) : (
        <Text style={styles.emptyArrivals}>No upcoming arrivals</Text>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={palette.tint}
          />
        }
      >
        {favouritesData.length > 0 ? (
          favouritesData.map((item) => (
            <View key={getStationKey(item)} style={styles.cardWrapper}>
              {renderFavouriteItem(item)}
            </View>
          ))
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="heart-outline" size={64} colour="#ccc" />
            <Text style={styles.emptyTitle}>No Favourites Yet</Text>
            <Text style={styles.emptySubtitle}>
              Tap the heart icon on any station to add it here for quick access.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
function createStyles(isDark: boolean, palette: typeof Colors.light) {
  const page = isDark ? "#0c1016" : "#f5f7fb";
  const card = isDark ? "#151b24" : "#ffffff";
  const border = isDark ? "#283041" : "#dfe5ee";
  const muted = isDark ? "#b4bcc9" : "#667085";
  const textSoft = isDark ? "#e4e9f0" : "#344054";

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: page,
    },
    listContent: {
      paddingHorizontal: 16,
      paddingTop: 18,
      paddingBottom: 32,
    },
    cardWrapper: {
      marginBottom: 16,
      backgroundColor: "transparent",
    },
    favouriteCard: {
      backgroundColor: card,
      borderRadius: 18,
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 14,
      borderWidth: 1,
      borderColor: border,
      overflow: "hidden",
      elevation: 1,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.06,
      shadowRadius: 12,
    },
    cardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 14,
    },
    stationName: {
      fontSize: 20,
      fontWeight: "700",
      color: palette.text,
    },
    stationType: {
      fontSize: 12,
      textTransform: "uppercase",
      letterSpacing: 0.8,
      color: muted,
      marginTop: 6,
    },
    removeButton: {
      width: 40,
      height: 40,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 20,
      backgroundColor: isDark ? "#24181b" : "#fff5f6",
    },
    arrivalsContainer: {
      marginTop: 10,
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: border,
    },
    arrivalRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 10,
    },
    destinationText: {
      fontSize: 15,
      fontWeight: "600",
      color: textSoft,
      flex: 1,
      marginRight: 10,
    },
    minutesText: {
      fontSize: 15,
      fontWeight: "700",
      color: palette.tint,
    },
    errorText: {
      fontSize: 14,
      color: "#ff4444",
      textAlign: "center",
    },
    emptyArrivals: {
      fontSize: 14,
      color: muted,
      textAlign: "center",
    },
    emptyContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 100,
      paddingHorizontal: 40,
    },
    emptyTitle: {
      fontSize: 22,
      fontWeight: "700",
      color: palette.text,
      marginTop: 20,
    },
    emptySubtitle: {
      fontSize: 16,
      color: muted,
      textAlign: "center",
      marginTop: 10,
      lineHeight: 22,
    },
  });
}
