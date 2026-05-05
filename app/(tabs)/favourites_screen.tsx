import React, { useEffect, useState, useCallback } from 'react';
import { StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useFavourites } from '@/src/context/FavouritesContext';
import { fetchIrishRailForecast } from '@/src/api/irish_rail_service';
import { fetchLuasForecast } from '@/src/api/luas_forecast_service';
import { Station, Arrival } from '@/src/types/transport_types';


interface FavouriteStationWithArrivals extends Station {
  arrivals: Arrival[];
  isLoading: boolean;
  error?: string;
}


export default function FavouritesScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const palette = Colors[colorScheme];
  const styles = createStyles(isDark, palette);
  const { favourites, removeFavourite } = useFavourites();
  const [favouritesData, setFavouritesData] = useState<FavouriteStationWithArrivals[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);


  const fetchArrivalsForStation = useCallback(async (station: Station): Promise<Arrival[]> => {
    try {
      return station.type === 'Luas' 
        ? await fetchLuasForecast(station.id)
        : await fetchIrishRailForecast(station.id);
    } catch (error) {
      console.error(`Failed to fetch arrivals for ${station.name}:`, error);
      throw error;
    }
  }, []);


  const loadAllArrivals = useCallback(async () => {
    const initialData: FavouriteStationWithArrivals[] = favourites.map(f => ({
      ...f,
      arrivals: [],
      isLoading: true
    }));
    setFavouritesData(initialData);


    const updatedData = await Promise.all(
      favourites.map(async (station) => {
        try {
          const arrivals = await fetchArrivalsForStation(station);
          return {
            ...station,
            arrivals: arrivals.slice(0, 3), // Only show top 3
            isLoading: false
          };
        } catch (error) {
          return {
            ...station,
            arrivals: [],
            isLoading: false,
            error: 'Failed to load'
          };
        }
      })
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


  const renderFavouriteItem = ({ item }: { item: FavouriteStationWithArrivals }) => (
    <View key={item.id} style={styles.favouriteCard}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1, backgroundColor: 'transparent' }}>
          <Text style={styles.stationName}>{item.name}</Text>
          <Text style={styles.stationType}>{item.type} {item.line ? `${item.line} Line` : ''}</Text>
        </View>
        <TouchableOpacity onPress={() => removeFavourite(item.id)} style={styles.removeButton}>
          <Ionicons name="heart" size={24} color="#ff4444" />
        </TouchableOpacity>
      </View>


      <View style={styles.arrivalsContainer}>
        {item.isLoading ? (
          <ActivityIndicator size="small" color={palette.tint} />
        ) : item.error ? (
          <Text style={styles.errorText}>{item.error}</Text>
        ) : item.arrivals.length > 0 ? (
          item.arrivals.map((arrival, index) => (
            <View key={`${arrival.destination}-${index}`} style={styles.arrivalRow}>
              <Text style={styles.destinationText} numberOfLines={1}>{arrival.destination}</Text>
              <Text style={styles.minutesText}>
                {arrival.minutesToDeparture === 0 ? 'Due' : `${arrival.minutesToDeparture} min`}
              </Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyArrivals}>No upcoming arrivals</Text>
        )}
      </View>
    </View>
  );


  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={palette.tint} />
        }
      >
        {favouritesData.length > 0 ? (
          favouritesData.map((item) => renderFavouriteItem({ item }))
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="heart-outline" size={64} color="#ccc" />
            <Text style={styles.emptyTitle}>No Favourites Yet</Text>
            <Text style={styles.emptySubtitle}>Tap the heart icon on any station to add it here for quick access.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
function createStyles(isDark: boolean, palette: typeof Colors.light) {
  const page = isDark ? '#0e1117' : '#f8f9fa';
  const card = isDark ? '#161b24' : '#ffffff';
  const inner = isDark ? '#202734' : '#f1f3f5';
  const muted = isDark ? '#b8bfca' : '#666666';
  const textSoft = isDark ? '#d3d8e0' : '#495057';

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: page,
    },
    listContent: {
      padding: 16,
      paddingBottom: 32,
    },
    favouriteCard: {
      backgroundColor: card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      elevation: 3,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 12,
      backgroundColor: 'transparent',
    },
    stationName: {
      fontSize: 18,
      fontWeight: 'bold',
      color: palette.text,
    },
    stationType: {
      fontSize: 14,
      color: muted,
      marginTop: 2,
    },
    removeButton: {
      padding: 4,
      backgroundColor: 'transparent',
    },
    arrivalsContainer: {
      backgroundColor: inner,
      borderRadius: 8,
      padding: 12,
    },
    arrivalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 6,
      backgroundColor: 'transparent',
    },
    destinationText: {
      fontSize: 15,
      fontWeight: '500',
      color: textSoft,
      flex: 1,
      marginRight: 10,
    },
    minutesText: {
      fontSize: 15,
      fontWeight: 'bold',
      color: palette.tint,
    },
    errorText: {
      fontSize: 14,
      color: '#ff4444',
      textAlign: 'center',
    },
    emptyArrivals: {
      fontSize: 14,
      color: muted,
      textAlign: 'center',
    },
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 100,
      paddingHorizontal: 40,
      backgroundColor: 'transparent',
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: palette.text,
      marginTop: 20,
    },
    emptySubtitle: {
      fontSize: 16,
      color: muted,
      textAlign: 'center',
      marginTop: 10,
      lineHeight: 22,
    },
  });
}
