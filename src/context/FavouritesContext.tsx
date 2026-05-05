import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Station } from '../types/transport_types';


interface FavouritesContextType {
  favourites: Station[];
  addFavourite: (station: Station) => Promise<void>;
  removeFavourite: (stationId: string) => Promise<void>;
  isFavourite: (stationId: string) => boolean;
}


const FavouritesContext = createContext<FavouritesContextType | undefined>(undefined);


const STORAGE_KEY = '@one_journey_favourites';


export const FavouritesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [favourites, setFavourites] = useState<Station[]>([]);


  useEffect(() => {
    loadFavourites();
  }, []);


  const loadFavourites = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        setFavourites(JSON.parse(stored));
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
    if (!favourites.some((f) => f.id === station.id)) {
      const newFavourites = [...favourites, station];
      setFavourites(newFavourites);
      await saveFavourites(newFavourites);
    }
  };


  const removeFavourite = async (stationId: string) => {
    const newFavourites = favourites.filter((f) => f.id !== stationId);
    setFavourites(newFavourites);
    await saveFavourites(newFavourites);
  };


  const isFavourite = (stationId: string) => {
    return favourites.some((f) => f.id === stationId);
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
