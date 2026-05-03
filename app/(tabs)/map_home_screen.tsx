import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { StyleSheet, ActivityIndicator, Alert, SectionList, TouchableOpacity, Modal } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, View } from '@/components/Themed';
import { fetchAllIrishRailStations, fetchIrishRailForecast } from '@/src/api/irish_rail_service';
import { fetchAllLuasStops, fetchLuasForecast } from '@/src/api/luas_forecast_service';
import { Station, Arrival } from '@/src/types/transport_types';
import * as Routes from '@/src/constants/transport_routes';


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
  const [stations, setStations] = useState<Station[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(null);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [arrivals, setArrivals] = useState<ArrivalSection[]>([]);
  const [isFetchingArrivals, setIsFetchingArrivals] = useState<boolean>(false);
  const [activeRouteIds, setActiveRouteIds] = useState<string[]>([]);
  const [currentFilter, setCurrentFilter] = useState<FilterType>('All');
  const [isFilterVisible, setIsFilterVisible] = useState<boolean>(false);
  const bottomSheetReference = useRef<BottomSheet>(null);
  const mapReference = useRef<MapView>(null);
  const insets = useSafeAreaInsets();
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
    if (currentFilter === 'All') return transportRoutes;
    if (currentFilter === 'Luas') return transportRoutes.filter(r => r.type === 'Luas');
    if (currentFilter === 'Train') return transportRoutes.filter(r => r.type === 'Train' || r.type === 'DART');
    return transportRoutes.filter(r => r.id === currentFilter);
  }, [currentFilter, transportRoutes]);
  const filteredStations = useMemo(() => {
    if (currentFilter === 'All') return stations;
    const allowedTypes = currentFilter === 'Luas' ? ['Luas'] : 
                         currentFilter === 'Train' ? ['Train', 'DART'] : [];
    if (allowedTypes.length > 0) return stations.filter(s => allowedTypes.includes(s.type));
    const activeRoute = transportRoutes.find(r => r.id === currentFilter);
    if (activeRoute) {
      const allCodes = activeRoute.branches.flat();
      return stations.filter(s => allCodes.includes(s.stationCode || s.id));
    }
    return stations;
  }, [currentFilter, stations, transportRoutes]);
  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#2e78b7" />
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
      <TouchableOpacity style={[styles.filterButton, { bottom: insets.bottom + 20 }]} onPress={() => setIsFilterVisible(true)}>
        <Ionicons name="menu" size={28} color="black" />
      </TouchableOpacity>
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
      <BottomSheet ref={bottomSheetReference} index={-1} snapPoints={snapPoints} enablePanDownToClose onClose={() => setActiveRouteIds([])}>
        <BottomSheetView style={styles.bottomSheetContent}>
          {selectedStation && (
            <>
              <Text style={styles.stationName}>{selectedStation.name}</Text>
              <Text style={styles.stationType}>{selectedStation.type} {selectedStation.line ? `${selectedStation.line} Line` : ''}</Text>
              {isFetchingArrivals ? (
                <ActivityIndicator style={styles.loader} color="#2e78b7" />
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


const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width: '100%', height: '100%' },
  filterButton: { position: 'absolute', right: 20, backgroundColor: 'white', padding: 12, borderRadius: 30, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-end', alignItems: 'flex-end', paddingRight: 20 },
  filterMenu: { backgroundColor: 'white', borderRadius: 12, padding: 15, width: 220, elevation: 10 },
  filterTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, color: '#333' },
  filterItem: { paddingVertical: 10 },
  filterText: { fontSize: 16, color: '#666' },
  activeFilter: { color: '#2e78b7', fontWeight: 'bold' },
  separatorSmall: { height: 1, backgroundColor: '#eee', marginVertical: 10 },
  bottomSheetContent: { flex: 1, padding: 20, backgroundColor: 'white' },
  stationName: { fontSize: 22, fontWeight: 'bold', marginBottom: 4 },
  stationType: { fontSize: 16, color: '#666', marginBottom: 20 },
  loader: { marginTop: 40 },
  arrivalsList: { flex: 1 },
  sectionHeader: { fontSize: 16, fontWeight: 'bold', backgroundColor: '#f8f8f8', padding: 8, marginTop: 10, borderRadius: 4 },
  arrivalItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#eee', backgroundColor: 'transparent' },
  arrivalInfo: { backgroundColor: 'transparent', flex: 1 },
  destinationText: { fontSize: 18, fontWeight: '600' },
  disruptionText: { fontSize: 12, color: '#ff4444', fontWeight: 'bold' },
  timeInfo: { alignItems: 'flex-end', backgroundColor: 'transparent', marginLeft: 10 },
  minutesText: { fontSize: 18, fontWeight: 'bold', color: '#2e78b7' },
  disruptedTime: { color: '#999' },
  emptyText: { textAlign: 'center', marginTop: 40, color: '#999' },
});
