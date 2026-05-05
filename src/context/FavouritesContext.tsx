import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Station } from '../types/transport_types';


interface FavouritesContextType {
  favourites: Station[];
  addFavourite: (station: Station) => Promise<void>;
  removeFavourite: (station: Station) => Promise<void>;
  isFavourite: (station: Station) => boolean;
}


const FavouritesContext = createContext<FavouritesContextType | undefined>(undefined);


const STORAGE_KEY = '@one_journey_favourites';

const getStationKey = (station: Station) => {
  const baseId = station.stationCode ?? station.id;
  const lineId = station.line ?? 'none';
  return `${station.type}:${baseId}:${lineId}`;
};


export const FavouritesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [favourites, setFavourites] = useState<Station[]>([]);


  useEffect(() => {
    loadFavourites();
  }, []);


  const loadFavourites = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Station[];
        const uniqueByKey = new Map<string, Station>();
        parsed.forEach((station) => {
          uniqueByKey.set(getStationKey(station), station);
        });
        const normalized = Array.from(uniqueByKey.values());
        setFavourites(normalized);

        if (normalized.length !== parsed.length) {
          await saveFavourites(normalized);
        }
      }
    } catch (error) {
      console.error('Failed to load favourites:', error);
    }
  };


  const saveFavourites = async (newFavourites: Station[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newFavourites));
    } catch (error) {
      console.error('Failed to save favourites:', error);
    }
  };


  const addFavourite = async (station: Station) => {
    const stationKey = getStationKey(station);
    let updatedFavourites: Station[] = [];

    setFavourites((prev) => {
      if (prev.some((f) => getStationKey(f) === stationKey)) {
        updatedFavourites = prev;
        return prev;
      }
      updatedFavourites = [...prev, station];
      return updatedFavourites;
    });

    if (updatedFavourites.length > 0) {
      await saveFavourites(updatedFavourites);
    }
  };


  const removeFavourite = async (station: Station) => {
    const stationKey = getStationKey(station);
    let updatedFavourites: Station[] = [];

    setFavourites((prev) => {
      updatedFavourites = prev.filter((f) => getStationKey(f) !== stationKey);
      return updatedFavourites;
    });

    await saveFavourites(updatedFavourites);
  };


  const isFavourite = (station: Station) => {
    const stationKey = getStationKey(station);
    return favourites.some((f) => getStationKey(f) === stationKey);
  };


  return (
    <FavouritesContext.Provider value={{ favourites, addFavourite, removeFavourite, isFavourite }}>
      {children}
    </FavouritesContext.Provider>
  );
};


export const useFavourites = () => {
  const context = useContext(FavouritesContext);
  if (context === undefined) {
    throw new Error('useFavourites must be used within a FavouritesProvider');
  }
  return context;
};
