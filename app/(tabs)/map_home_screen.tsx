import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import {
  fetchAllIrishRailStations,
} from "@/src/api/irish_rail_service";
import {
  fetchAllLuasStops,
} from "@/src/api/luas_forecast_service";
import { useFavourites } from "@/src/context/FavouritesContext";
import { Station } from "@/src/types/transport_types";
import { Ionicons } from "@expo/vector-icons";
import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";
import * as Location from "expo-location";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  SectionList,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import MapView, { Marker, PROVIDER_DEFAULT, Polyline } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getAllTransportRoutes, getBranchCoordinates as getUtilBranchCoordinates, TransportRoute } from "@/src/utils/transportRoutes";
import { fetchAndGroupArrivals } from "@/src/utils/arrivals";

type FilterType = "All" | "Luas" | "Train" | string;

export default function MapHomeScreen() {
  const colourScheme = useColorScheme() ?? "light";
  const isDark = colourScheme === "dark";
  const palette = Colors[colourScheme];
  const mutedTextColour = isDark ? "#b7becb" : "#666666";
  const styles = useMemo(
    () => createStyles(isDark, palette),
    [isDark, palette],
  );
  const [stations, setStations] = useState<Station[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [userLocation, setUserLocation] =
    useState<Location.LocationObject | null>(null);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [arrivals, setArrivals] = useState<any[]>([]);
  const [isFetchingArrivals, setIsFetchingArrivals] = useState<boolean>(false);
  const [activeRouteIds, setActiveRouteIds] = useState<string[]>([]);
  const [currentFilter, setCurrentFilter] = useState<FilterType>("All");
  const [isFilterVisible, setIsFilterVisible] = useState<boolean>(false);
  const [isLineEditorVisible, setIsLineEditorVisible] =
    useState<boolean>(false);
  const [selectedLineIds, setSelectedLineIds] = useState<string[]>([]);
  const bottomSheetReference = useRef<BottomSheet>(null);
  const mapReference = useRef<MapView>(null);
  const insets = useSafeAreaInsets();
  const { isFavourite, addFavourite, removeFavourite } = useFavourites();
  const snapPoints = useMemo(() => ["10%", "50%", "90%"], []);
  const transportRoutes = useMemo(() => getAllTransportRoutes(), []);
  useEffect(() => {
    const initialiseMapData = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const location = await Location.getCurrentPositionAsync({});
          setUserLocation(location);
        }
        const [irishRailStations, luasStops] = await Promise.all([
          fetchAllIrishRailStations(),
          fetchAllLuasStops(),
        ]);
        setStations([...irishRailStations, ...luasStops]);
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };
    initialiseMapData();
  }, []);
  const handleMarkerPress = useCallback(
    async (station: Station) => {
      setSelectedStation(station);
      setArrivals([]);
      setIsFetchingArrivals(true);
      const stationCode = station.stationCode || station.id;
      const activeIds = transportRoutes
        .filter((route) =>
          route.branches.some((branch) => branch.includes(stationCode)),
        )
        .map((route) => route.id);
      setActiveRouteIds(activeIds);
      bottomSheetReference.current?.snapToIndex(1);
      try {
        const sections = await fetchAndGroupArrivals(station);
        setArrivals(sections);
      } catch (error) {
        console.error(error);
      } finally {
        setIsFetchingArrivals(false);
      }
    },
    [transportRoutes],
  );
  const getBranchCoordinates = (routeId: string, branch: string[]) => {
    return getUtilBranchCoordinates(routeId, branch, stations);
  };
  const getRouteStrokeWidth = (routeId: string) =>
    activeRouteIds.includes(routeId) ? 6 : 3;

  const getRouteDashPattern = (routeId: string, coordinatesLength: number) => {
    if (activeRouteIds.includes(routeId) || coordinatesLength < 2) {
      return undefined;
    }
    return [10, 8];
  };

  const filteredRoutes = useMemo(() => {
    let baseRoutes = transportRoutes;
    if (currentFilter === "Luas") {
      baseRoutes = transportRoutes.filter((route) => route.type === "Luas");
    } else if (currentFilter === "Train") {
      baseRoutes = transportRoutes.filter(
        (route) => route.type === "Train" || route.type === "DART",
      );
    } else if (currentFilter !== "All") {
      baseRoutes = transportRoutes.filter((route) => route.id === currentFilter);
    }

    if (selectedLineIds.length === 0 || currentFilter !== "All") {
      return baseRoutes;
    }

    return baseRoutes.filter((route) => selectedLineIds.includes(route.id));
  }, [currentFilter, selectedLineIds, transportRoutes]);

  const toggleLineSelection = useCallback((lineId: string) => {
    setSelectedLineIds((previousLineIds) =>
      previousLineIds.includes(lineId)
        ? previousLineIds.filter((id) => id !== lineId)
        : [...previousLineIds, lineId],
    );
  }, []);

  const clearLineSelections = useCallback(() => {
    setSelectedLineIds([]);
  }, []);

  const filteredStations = useMemo(() => {
    if (currentFilter === "All" && selectedLineIds.length === 0) {
      return stations;
    }

    if (currentFilter === "Luas" && selectedLineIds.length === 0) {
      return stations.filter((station) => station.type === "Luas");
    }

    if (currentFilter === "Train" && selectedLineIds.length === 0) {
      return stations.filter(
        (station) => station.type === "Train" || station.type === "DART",
      );
    }

    const allowedCodes = new Set(
      filteredRoutes.flatMap((route) => route.branches.flat()),
    );
    if (allowedCodes.size === 0) {
      return stations;
    }

    return stations.filter((station) =>
      allowedCodes.has(station.stationCode || station.id),
    );
  }, [currentFilter, filteredRoutes, selectedLineIds.length, stations]);
  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={palette.tint} />
      </View>
    );
  }
  return (
    <View style={styles.container}>
      <MapView
        ref={mapReference}
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={{
          latitude: userLocation?.coords.latitude ?? 53.3498,
          longitude: userLocation?.coords.longitude ?? -6.2603,
          latitudeDelta: 0.1,
          longitudeDelta: 0.1,
        }}
        showsUserLocation={true}
      >
        {filteredRoutes.map((route) =>
          route.branches.map((branch, index) => (
            (() => {
              const coordinates = getBranchCoordinates(route.id, branch);
              if (coordinates.length < 2) {
                return null;
              }

              return (
                <Polyline
                  key={`${route.id}-${index}`}
                  coordinates={coordinates}
                  strokeColor={route.colour}
                  strokeWidth={getRouteStrokeWidth(route.id)}
                  lineDashPattern={getRouteDashPattern(route.id, coordinates.length)}
                  zIndex={activeRouteIds.includes(route.id) ? 10 : 1}
                />
              );
            })()
          )),
        )}
        {filteredStations.map((station: Station) => (
          <Marker
            key={`${station.type}-${station.id}`}
            coordinate={{
              latitude: station.latitude,
              longitude: station.longitude,
            }}
            pinColor={
              station.type === "Luas"
                ? station.line === "Red"
                  ? "#e60000"
                  : "#00b300"
                : station.type === "DART"
                  ? "#00cc00"
                  : "#0000ff"
            }
            onPress={() => handleMarkerPress(station)}
          />
        ))}
      </MapView>
      <View style={[styles.controlsContainer, { bottom: insets.bottom + 20 }]}>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={() => setIsFilterVisible(true)}
        >
          <Ionicons name="funnel-outline" size={22} color={palette.text} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={() => setIsLineEditorVisible(true)}
        >
          <Ionicons name="create-outline" size={22} color={palette.text} />
        </TouchableOpacity>
      </View>

      <Modal
        visible={isFilterVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsFilterVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsFilterVisible(false)}
        >
          <View
            style={[styles.filterMenu, { marginBottom: insets.bottom + 80 }]}
          >
            <Text style={styles.filterTitle}>Transport Filters</Text>
            {["All", "Luas", "Train"].map((f) => (
              <TouchableOpacity
                key={f}
                style={styles.filterItem}
                onPress={() => {
                  setCurrentFilter(f);
                  setIsFilterVisible(false);
                }}
              >
                <Text
                  style={[
                    styles.filterText,
                    currentFilter === f && styles.activeFilter,
                  ]}
                >
                  {f}
                </Text>
              </TouchableOpacity>
            ))}
            <View style={styles.separatorSmall} />
            {transportRoutes.map((r) => (
              <TouchableOpacity
                key={r.id}
                style={styles.filterItem}
                onPress={() => {
                  setCurrentFilter(r.id);
                  setIsFilterVisible(false);
                }}
              >
                <Text
                  style={[
                    styles.filterText,
                    currentFilter === r.id && styles.activeFilter,
                  ]}
                >
                  {r.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={isLineEditorVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsLineEditorVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsLineEditorVisible(false)}
        >
          <View
            style={[styles.filterMenu, { marginBottom: insets.bottom + 80 }]}
          >
            <View style={styles.lineEditorHeader}>
              <Text style={styles.filterTitle}>Choose Lines</Text>
              <TouchableOpacity onPress={clearLineSelections}>
                <Text style={styles.clearText}>Show all</Text>
              </TouchableOpacity>
            </View>

            {transportRoutes.map((route) => {
              const selected = selectedLineIds.includes(route.id);
              return (
                <TouchableOpacity
                  key={route.id}
                  style={styles.lineEditorItem}
                  onPress={() => toggleLineSelection(route.id)}
                >
                  <View
                    style={[styles.routeDot, { backgroundColor: route.colour }]}
                  />
                  <Text
                    style={[styles.filterText, selected && styles.activeFilter]}
                  >
                    {route.name}
                  </Text>
                  <Ionicons
                    name={selected ? "checkmark-circle" : "ellipse-outline"}
                    size={20}
                    colour={selected ? palette.tint : mutedTextColour}
                  />
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>

      <BottomSheet
        ref={bottomSheetReference}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        onClose={() => setActiveRouteIds([])}
      >
        <BottomSheetView style={styles.bottomSheetContent}>
          {selectedStation && (
            <>
              <View style={styles.stationHeader}>
                <View style={{ flex: 1, backgroundColor: "transparent" }}>
                  <Text style={styles.stationName}>{selectedStation.name}</Text>
                  <Text style={styles.stationType}>
                    {selectedStation.type}{" "}
                    {selectedStation.line ? `${selectedStation.line} Line` : ""}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() =>
                    isFavourite(selectedStation)
                      ? removeFavourite(selectedStation)
                      : addFavourite(selectedStation)
                  }
                  style={styles.favouriteButton}
                >
                  <Ionicons
                    name={
                      isFavourite(selectedStation) ? "heart" : "heart-outline"
                    }
                    size={28}
                    colour={
                      isFavourite(selectedStation) ? "#ff4444" : mutedTextColour
                    }
                  />
                </TouchableOpacity>
              </View>
              {isFetchingArrivals ? (
                <ActivityIndicator style={styles.loader} color={palette.tint} />
              ) : (
                <SectionList
                  sections={arrivals}
                  keyExtractor={(item, index) => `${item.destination}-${index}`}
                  renderItem={({ item }) => (
                    <View style={styles.arrivalItem}>
                      <View style={styles.arrivalInfo}>
                        <Text style={styles.destinationText}>
                          {item.destination}
                        </Text>
                        {item.status === "Disrupted" && (
                          <Text style={styles.disruptionText}>
                            Service Disrupted
                          </Text>
                        )}
                      </View>
                      <View style={styles.timeInfo}>
                        <Text
                          style={[
                            styles.minutesText,
                            item.status === "Disrupted" && styles.disruptedTime,
                          ]}
                        >
                          {item.status === "Disrupted"
                            ? "-"
                            : item.minutesToDeparture === 0
                              ? "Due"
                              : `${item.minutesToDeparture} min`}
                        </Text>
                      </View>
                    </View>
                  )}
                  renderSectionHeader={({ section: { title } }) => (
                    <Text style={styles.sectionHeader}>{title}</Text>
                  )}
                  ListEmptyComponent={
                    <Text style={styles.emptyText}>
                      No upcoming arrivals found.
                    </Text>
                  }
                  style={styles.arrivalsList}
                />
              )}
            </>
          )}
        </BottomSheetView>
      </BottomSheet>
    </View>
  );
}

function createStyles(isDark: boolean, palette: typeof Colors.light) {
  const surface = isDark ? "#16191f" : "#ffffff";
  const surfaceSoft = isDark ? "#1d232d" : "#f5f7fb";
  const muted = isDark ? "#b7becb" : "#666666";
  const border = isDark ? "#2b3240" : "#e6e8eb";
  const overlay = isDark ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0.3)";
  const sectionSurface = isDark ? "#202632" : "#f8f8f8";

  return StyleSheet.create({
    container: { flex: 1 },
    map: { width: "100%", height: "100%" },
    controlsContainer: {
      position: "absolute",
      right: 16,
      gap: 12,
      alignItems: "flex-end",
      backgroundColor: "transparent",
    },
    controlButton: {
      alignItems: "center",
      gap: 8,
      justifyContent: "center",
      width: 54,
      height: 54,
      borderRadius: 27,
      backgroundColor: surface,
      borderWidth: 1,
      borderColor: border,
      elevation: 6,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.16,
      shadowRadius: 14,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: overlay,
      justifyContent: "flex-end",
      alignItems: "flex-end",
      paddingRight: 20,
    },
    filterMenu: {
      backgroundColor: surface,
      borderRadius: 20,
      padding: 16,
      width: 280,
      elevation: 12,
      borderWidth: 1,
      borderColor: border,
    },
    filterTitle: {
      fontSize: 18,
      fontWeight: "700",
      marginBottom: 12,
      color: palette.text,
    },
    filterItem: {
      paddingVertical: 11,
      paddingHorizontal: 10,
      borderRadius: 12,
      marginHorizontal: -6,
    },
    filterText: { fontSize: 15, color: muted, fontWeight: "500" },
    activeFilter: { color: palette.tint, fontWeight: "bold" },
    separatorSmall: { height: 1, backgroundColor: border, marginVertical: 8 },
    lineEditorHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    clearText: { color: palette.tint, fontWeight: "600" },
    lineEditorItem: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      paddingVertical: 12,
      paddingHorizontal: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: border,
    },
    routeDot: { width: 10, height: 10, borderRadius: 5 },
    bottomSheetContent: {
      flex: 1,
      paddingHorizontal: 20,
      paddingTop: 18,
      paddingBottom: 10,
      backgroundColor: surface,
    },
    stationHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 12,
    },
    favouriteButton: {
      width: 40,
      height: 40,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 20,
      backgroundColor: "transparent",
    },
    stationName: { fontSize: 24, fontWeight: "700", marginBottom: 4 },
    stationType: {
      fontSize: 12,
      color: muted,
      marginBottom: 18,
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    loader: { marginTop: 40 },
    arrivalsList: { flex: 1 },
    sectionHeader: {
      fontSize: 13,
      fontWeight: "700",
      backgroundColor: sectionSurface,
      paddingVertical: 8,
      paddingHorizontal: 12,
      marginTop: 12,
      borderRadius: 999,
      color: palette.text,
      overflow: "hidden",
    },
    arrivalItem: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: border,
    },
    arrivalInfo: { flex: 1 },
    destinationText: { fontSize: 17, fontWeight: "600", color: palette.text },
    disruptionText: { fontSize: 12, color: "#ff4444", fontWeight: "bold" },
    timeInfo: {
      alignItems: "flex-end",
      marginLeft: 10,
    },
    minutesText: { fontSize: 18, fontWeight: "700", color: palette.tint },
    disruptedTime: { color: muted },
    emptyText: {
      textAlign: "center",
      marginTop: 40,
      color: muted,
      paddingHorizontal: 20,
    },
  });
}
