import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { StyleSheet, ActivityIndicator, SectionList, TouchableOpacity, Modal } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { fetchAllIrishRailStations, fetchIrishRailForecast } from '@/src/api/irish_rail_service';
import { fetchAllLuasStops, fetchLuasForecast } from '@/src/api/luas_forecast_service';
import { Station, Arrival } from '@/src/types/transport_types';
import * as Routes from '@/src/constants/transport_routes';
import { useFavourites } from '@/src/context/FavouritesContext';


interface ArrivalSection {
  title: string;
  data: Arrival[];
}


interface TransportRoute {
  id: string;
  name: string;
  color: string;
  branches: string[][];
  type: 'Luas' | 'Train' | 'DART';
}


type FilterType = 'All' | 'Luas' | 'Train' | string;


export default function MapHomeScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const palette = Colors[colorScheme];
  const mutedTextColor = isDark ? '#b7becb' : '#666666';
  const styles = useMemo(() => createStyles(isDark, palette), [isDark, palette]);
  const [stations, setStations] = useState<Station[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(null);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [arrivals, setArrivals] = useState<ArrivalSection[]>([]);
  const [isFetchingArrivals, setIsFetchingArrivals] = useState<boolean>(false);
  const [activeRouteIds, setActiveRouteIds] = useState<string[]>([]);
  const [currentFilter, setCurrentFilter] = useState<FilterType>('All');
  const [isFilterVisible, setIsFilterVisible] = useState<boolean>(false);
  const [isLineEditorVisible, setIsLineEditorVisible] = useState<boolean>(false);
  const [selectedLineIds, setSelectedLineIds] = useState<string[]>([]);
  const bottomSheetReference = useRef<BottomSheet>(null);
  const mapReference = useRef<MapView>(null);
  const insets = useSafeAreaInsets();
  const { isFavourite, addFavourite, removeFavourite } = useFavourites();
  const snapPoints = useMemo(() => ['10%', '50%', '90%'], []);
  const transportRoutes = useMemo((): TransportRoute[] => [
    { id: 'Luas-Red', name: 'Luas Red Line', color: '#e60000', branches: Routes.LUAS_RED_LINE, type: 'Luas' },
    { id: 'Luas-Green', name: 'Luas Green Line', color: '#00b300', branches: Routes.LUAS_GREEN_LINE, type: 'Luas' },
    { id: 'DART', name: 'DART', color: '#00cc00', branches: Routes.DART_LINE, type: 'DART' },
    { id: 'Maynooth', name: 'Maynooth Commuter', color: '#ff8c00', branches: Routes.MAYNOOTH_LINE, type: 'Train' },
    { id: 'M3-Parkway', name: 'M3 Parkway', color: '#9932cc', branches: Routes.M3_PARKWAY_LINE, type: 'Train' },
    { id: 'Northern', name: 'Northern Commuter', color: '#1e90ff', branches: Routes.NORTHERN_COMMUTER, type: 'Train' },
  ], []);
  useEffect(() => {
    const initialiseMapData = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
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
  const handleMarkerPress = useCallback(async (station: Station) => {
    setSelectedStation(station);
    setArrivals([]);
    setIsFetchingArrivals(true);
    const code = station.stationCode || station.id;
    const activeIds = transportRoutes
      .filter(route => route.branches.some(branch => branch.includes(code)))
      .map(route => route.id);
    setActiveRouteIds(activeIds);
    bottomSheetReference.current?.snapToIndex(1);
    try {
      const fetchedArrivals = station.type === 'Luas' 
        ? await fetchLuasForecast(station.id)
        : await fetchIrishRailForecast(station.id);
      const grouped = fetchedArrivals.reduce((sections: { [key: string]: Arrival[] }, arrival) => {
        const title = `To ${arrival.destination}`;
        if (!sections[title]) sections[title] = [];
        sections[title].push(arrival);
        return sections;
      }, {});
      setArrivals(Object.keys(grouped).map(title => ({
        title,
        data: grouped[title].sort((a, b) => a.minutesToDeparture - b.minutesToDeparture),
      })));
    } catch (error) {
      console.error(error);
    } finally {
      setIsFetchingArrivals(false);
    }
  }, [transportRoutes]);
  const getBranchCoordinates = (routeId: string, branch: string[]) => {
    const coords = branch
      .map(code => stations.find(station => (station.stationCode === code || station.id === code)))
      .filter((station): station is Station => !!station)
      .map(station => ({ latitude: station.latitude, longitude: station.longitude }));
    if (routeId === 'M3-Parkway' && branch.includes('BBRDG') && branch.includes('DCKLS')) {
      const broombridgeIndex = branch.indexOf('BBRDG');
      const docklandsIndex = branch.indexOf('DCKLS');
      if (broombridgeIndex !== -1 && docklandsIndex !== -1) {
        coords.splice(broombridgeIndex + 1, 0, Routes.DOCKLANDS_ROUTING_WAYPOINT);
      }
    }
    return coords;
  };
  const filteredRoutes = useMemo(() => {
    let baseRoutes = transportRoutes;
    if (currentFilter === 'Luas') {
      baseRoutes = transportRoutes.filter(r => r.type === 'Luas');
    } else if (currentFilter === 'Train') {
      baseRoutes = transportRoutes.filter(r => r.type === 'Train' || r.type === 'DART');
    } else if (currentFilter !== 'All') {
      baseRoutes = transportRoutes.filter(r => r.id === currentFilter);
    }

    if (selectedLineIds.length === 0 || currentFilter !== 'All') {
      return baseRoutes;
    }

    return baseRoutes.filter(r => selectedLineIds.includes(r.id));
  }, [currentFilter, selectedLineIds, transportRoutes]);

  const toggleLineSelection = useCallback((lineId: string) => {
    setSelectedLineIds(prev => (
      prev.includes(lineId)
        ? prev.filter(id => id !== lineId)
        : [...prev, lineId]
    ));
  }, []);

  const clearLineSelections = useCallback(() => {
    setSelectedLineIds([]);
  }, []);

  const filteredStations = useMemo(() => {
    if (currentFilter === 'All' && selectedLineIds.length === 0) {
      return stations;
    }

    if (currentFilter === 'Luas' && selectedLineIds.length === 0) {
      return stations.filter(station => station.type === 'Luas');
    }

    if (currentFilter === 'Train' && selectedLineIds.length === 0) {
      return stations.filter(station => station.type === 'Train' || station.type === 'DART');
    }

    const allowedCodes = new Set(filteredRoutes.flatMap(route => route.branches.flat()));
    if (allowedCodes.size === 0) {
      return stations;
    }

    return stations.filter(station => allowedCodes.has(station.stationCode || station.id));
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
        {filteredRoutes.map(route => (
          route.branches.map((branch, index) => (
            <Polyline
              key={`${route.id}-${index}`}
              coordinates={getBranchCoordinates(route.id, branch)}
              strokeColor={route.color}
              strokeWidth={activeRouteIds.includes(route.id) ? 6 : 2}
              lineDashPattern={activeRouteIds.includes(route.id) ? undefined : [5, 5]}
              zIndex={activeRouteIds.includes(route.id) ? 10 : 1}
            />
          ))
        ))}
        {filteredStations.map((station: Station) => (
          <Marker
            key={`${station.type}-${station.id}`}
            coordinate={{ latitude: station.latitude, longitude: station.longitude }}
            pinColor={station.type === 'Luas' ? (station.line === 'Red' ? '#e60000' : '#00b300') : (station.type === 'DART' ? '#00cc00' : '#0000ff')}
            onPress={() => handleMarkerPress(station)}
          />
        ))}
      </MapView>
      <View style={[styles.controlsContainer, { bottom: insets.bottom + 20 }]}>
        <TouchableOpacity style={styles.controlButton} onPress={() => setIsFilterVisible(true)}>
          <Ionicons name="funnel-outline" size={18} color={palette.text} />
          <Text style={styles.controlButtonText}>{currentFilter}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.controlButton} onPress={() => setIsLineEditorVisible(true)}>
          <Ionicons name="create-outline" size={18} color={palette.text} />
          <Text style={styles.controlButtonText}>Edit Lines</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={isFilterVisible} transparent animationType="fade" onRequestClose={() => setIsFilterVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setIsFilterVisible(false)}>
          <View style={[styles.filterMenu, { marginBottom: insets.bottom + 80 }]}>
            <Text style={styles.filterTitle}>Transport Filters</Text>
            {['All', 'Luas', 'Train'].map(f => (
              <TouchableOpacity key={f} style={styles.filterItem} onPress={() => { setCurrentFilter(f); setIsFilterVisible(false); }}>
                <Text style={[styles.filterText, currentFilter === f && styles.activeFilter]}>{f}</Text>
              </TouchableOpacity>
            ))}
            <View style={styles.separatorSmall} />
            {transportRoutes.map(r => (
              <TouchableOpacity key={r.id} style={styles.filterItem} onPress={() => { setCurrentFilter(r.id); setIsFilterVisible(false); }}>
                <Text style={[styles.filterText, currentFilter === r.id && styles.activeFilter]}>{r.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={isLineEditorVisible} transparent animationType="fade" onRequestClose={() => setIsLineEditorVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setIsLineEditorVisible(false)}>
          <View style={[styles.filterMenu, { marginBottom: insets.bottom + 80 }]}> 
            <View style={styles.lineEditorHeader}>
              <Text style={styles.filterTitle}>Choose Lines</Text>
              <TouchableOpacity onPress={clearLineSelections}>
                <Text style={styles.clearText}>Show all</Text>
              </TouchableOpacity>
            </View>

            {transportRoutes.map(route => {
              const selected = selectedLineIds.includes(route.id);
              return (
                <TouchableOpacity key={route.id} style={styles.lineEditorItem} onPress={() => toggleLineSelection(route.id)}>
                  <View style={[styles.routeDot, { backgroundColor: route.color }]} />
                  <Text style={[styles.filterText, selected && styles.activeFilter]}>{route.name}</Text>
                  <Ionicons
                    name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                    size={20}
                    color={selected ? palette.tint : mutedTextColor}
                  />
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>

      <BottomSheet ref={bottomSheetReference} index={-1} snapPoints={snapPoints} enablePanDownToClose onClose={() => setActiveRouteIds([])}>
        <BottomSheetView style={styles.bottomSheetContent}>
          {selectedStation && (
            <>
              <View style={styles.stationHeader}>
                <View style={{ flex: 1, backgroundColor: 'transparent' }}>
                  <Text style={styles.stationName}>{selectedStation.name}</Text>
                  <Text style={styles.stationType}>{selectedStation.type} {selectedStation.line ? `${selectedStation.line} Line` : ''}</Text>
                </View>
                <TouchableOpacity 
                  onPress={() => isFavourite(selectedStation.id) ? removeFavourite(selectedStation.id) : addFavourite(selectedStation.id)}
                  style={styles.favouriteButton}
                >
                  <Ionicons 
                    name={isFavourite(selectedStation.id) ? "heart" : "heart-outline"} 
                    size={28} 
                    color={isFavourite(selectedStation.id) ? "#ff4444" : mutedTextColor} 
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
                        <Text style={styles.destinationText}>{item.destination}</Text>
                        {item.status === 'Disrupted' && <Text style={styles.disruptionText}>Service Disrupted</Text>}
                      </View>
                      <View style={styles.timeInfo}>
                        <Text style={[styles.minutesText, item.status === 'Disrupted' && styles.disruptedTime]}>
                          {item.status === 'Disrupted' ? '-' : (item.minutesToDeparture === 0 ? 'Due' : `${item.minutesToDeparture} min`)}
                        </Text>
                      </View>
                    </View>
                  )}
                  renderSectionHeader={({ section: { title } }) => <Text style={styles.sectionHeader}>{title}</Text>}
                  ListEmptyComponent={<Text style={styles.emptyText}>No upcoming arrivals found.</Text>}
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
  const surface = isDark ? '#16191f' : '#ffffff';
  const muted = isDark ? '#b7becb' : '#666666';
  const border = isDark ? '#2b3240' : '#e6e8eb';
  const overlay = isDark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.3)';
  const sectionSurface = isDark ? '#202632' : '#f8f8f8';

  return StyleSheet.create({
    container: { flex: 1 },
    map: { width: '100%', height: '100%' },
    controlsContainer: { position: 'absolute', right: 16, gap: 10 },
    controlButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: surface,
      borderRadius: 28,
      borderWidth: 1,
      borderColor: border,
      paddingHorizontal: 14,
      paddingVertical: 10,
      elevation: 5,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.18,
      shadowRadius: 3,
    },
    controlButtonText: { fontSize: 14, fontWeight: '600', color: palette.text },
    modalOverlay: { flex: 1, backgroundColor: overlay, justifyContent: 'flex-end', alignItems: 'flex-end', paddingRight: 20 },
    filterMenu: { backgroundColor: surface, borderRadius: 12, padding: 15, width: 260, elevation: 10, borderWidth: 1, borderColor: border },
    filterTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, color: palette.text },
    filterItem: { paddingVertical: 10 },
    filterText: { fontSize: 16, color: muted },
    activeFilter: { color: palette.tint, fontWeight: 'bold' },
    separatorSmall: { height: 1, backgroundColor: border, marginVertical: 10 },
    lineEditorHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'transparent' },
    clearText: { color: palette.tint, fontWeight: '600' },
    lineEditorItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: border,
      backgroundColor: 'transparent',
    },
    routeDot: { width: 10, height: 10, borderRadius: 5 },
    bottomSheetContent: { flex: 1, padding: 20, backgroundColor: surface },
    stationHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, backgroundColor: 'transparent' },
    favouriteButton: { padding: 5, backgroundColor: 'transparent' },
    stationName: { fontSize: 22, fontWeight: 'bold', marginBottom: 4 },
    stationType: { fontSize: 16, color: muted, marginBottom: 20 },
    loader: { marginTop: 40 },
    arrivalsList: { flex: 1 },
    sectionHeader: { fontSize: 16, fontWeight: 'bold', backgroundColor: sectionSurface, padding: 8, marginTop: 10, borderRadius: 4, color: palette.text },
    arrivalItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: border, backgroundColor: 'transparent' },
    arrivalInfo: { backgroundColor: 'transparent', flex: 1 },
    destinationText: { fontSize: 18, fontWeight: '600' },
    disruptionText: { fontSize: 12, color: '#ff4444', fontWeight: 'bold' },
    timeInfo: { alignItems: 'flex-end', backgroundColor: 'transparent', marginLeft: 10 },
    minutesText: { fontSize: 18, fontWeight: 'bold', color: palette.tint },
    disruptedTime: { color: muted },
    emptyText: { textAlign: 'center', marginTop: 40, color: muted },
  });
}
