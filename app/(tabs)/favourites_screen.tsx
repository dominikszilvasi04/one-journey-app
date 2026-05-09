import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { fetchIrishRailForecast } from "@/src/api/irish_rail_service";
import { fetchLuasForecast } from "@/src/api/luas_forecast_service";
import { useFavourites } from "@/src/context/FavouritesContext";
import { Arrival, Station } from "@/src/types/transport_types";
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
} from "react-native";

interface FavouriteStationWithArrivals extends Station {
  arrivals: Arrival[];
  isLoading: boolean;
  error?: string;
}

const getStationKey = (station: Station) => {
  const baseId = station.stationCode ?? station.id;
  const lineId = station.line ?? "none";
  return `${station.type}:${baseId}:${lineId}`;
};

export default function FavouritesScreen() {
  const colorScheme = useColorScheme() ?? "light";
  const isDark = colorScheme === "dark";
  const palette = Colors[colorScheme];
  const styles = createStyles(isDark, palette);
  const { favourites, removeFavourite } = useFavourites();
  const [favouritesData, setFavouritesData] = useState<
    FavouriteStationWithArrivals[]
  >([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchArrivalsForStation = useCallback(
    async (station: Station): Promise<Arrival[]> => {
      try {
        return station.type === "Luas"
          ? await fetchLuasForecast(station.id)
          : await fetchIrishRailForecast(station.id);
      } catch (error) {
        console.error(`Failed to fetch arrivals for ${station.name}:`, error);
        throw error;
      }
    },
    [],
  );

  const loadAllArrivals = useCallback(async () => {
    const initialData: FavouriteStationWithArrivals[] = favourites.map((f) => ({
      ...f,
      arrivals: [],
      isLoading: true,
    }));
    setFavouritesData(initialData);

    const updatedData = await Promise.all(
      favourites.map(async (station) => {
        try {
          const arrivals = await fetchArrivalsForStation(station);
          return {
            ...station,
            arrivals: arrivals.slice(0, 3), // Only show top 3
            isLoading: false,
          };
        } catch (error) {
          return {
            ...station,
            arrivals: [],
            isLoading: false,
            error: "Failed to load",
          };
        }
      }),
    );
    setFavouritesData(updatedData);
  }, [favourites, fetchArrivalsForStation]);

  useEffect(() => {
    loadAllArrivals();
  }, [loadAllArrivals]);

  const onRefresh = async () => {
    setIsRefreshing(true);
    await loadAllArrivals();
    setIsRefreshing(false);
  };

  const renderFavouriteItem = ({
    item,
  }: {
    item: FavouriteStationWithArrivals;
  }) => (
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
          <Ionicons name="heart" size={24} color="#ff4444" />
        </TouchableOpacity>
      </View>

      {item.isLoading ? (
        <ActivityIndicator size="small" color={palette.tint} />
      ) : item.error ? (
        <Text style={styles.errorText}>{item.error}</Text>
      ) : item.arrivals.length > 0 ? (
        <View style={styles.arrivalsContainer}>
          {item.arrivals.map((arrival, index) => (
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
          ))}
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
              {renderFavouriteItem({ item })}
            </View>
          ))
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="heart-outline" size={64} color="#ccc" />
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
  const inner = isDark ? "#1d2430" : "#f2f5f9";
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
    },
    favouriteCard: {
      backgroundColor: "transparent",
      paddingHorizontal: 4,
      paddingTop: 8,
      paddingBottom: 6,
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
      marginTop: 8,
      paddingTop: 10,
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
