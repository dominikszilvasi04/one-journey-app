import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { Station } from "../types/transport_types";
import { getStationKey, deduplicateStations } from "../utils/stationIdentity";

interface FavouritesContextType {
  favourites: Station[];
  addFavourite: (station: Station) => Promise<void>;
  removeFavourite: (station: Station) => Promise<void>;
  isFavourite: (station: Station) => boolean;
}

const FavouritesContext = createContext<FavouritesContextType | undefined>(
  undefined,
);

const STORAGE_KEY = "@one_journey_favourites";

export const FavouritesProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [favourites, setFavourites] = useState<Station[]>([]);

  useEffect(() => {
    loadFavourites();
  }, []);

  const loadFavourites = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Station[];
        const normalised = deduplicateStations(parsed);
        setFavourites(normalised);

        if (normalised.length !== parsed.length) {
          await saveFavourites(normalised);
        }
      }
    } catch (error) {
      console.error("Failed to load favourites:", error);
    }
  };

  const saveFavourites = async (newFavourites: Station[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newFavourites));
    } catch (error) {
      console.error("Failed to save favourites:", error);
    }
  };

  const addFavourite = async (station: Station) => {
    const stationKey = getStationKey(station);
    let updatedFavourites: Station[] = [];

    setFavourites((previousFavourites) => {
      if (previousFavourites.some((favourite) => getStationKey(favourite) === stationKey)) {
        updatedFavourites = previousFavourites;
        return previousFavourites;
      }
      updatedFavourites = [...previousFavourites, station];
      return updatedFavourites;
    });

    if (updatedFavourites.length > 0) {
      await saveFavourites(updatedFavourites);
    }
  };

  const removeFavourite = async (station: Station) => {
    const stationKey = getStationKey(station);
    let updatedFavourites: Station[] = [];

    setFavourites((previousFavourites) => {
      updatedFavourites = previousFavourites.filter(
        (favourite) => getStationKey(favourite) !== stationKey
      );
      return updatedFavourites;
    });

    await saveFavourites(updatedFavourites);
  };

  const isFavourite = (station: Station) => {
    const stationKey = getStationKey(station);
    return favourites.some((favourite) => getStationKey(favourite) === stationKey);
  };

  return (
    <FavouritesContext.Provider
      value={{ favourites, addFavourite, removeFavourite, isFavourite }}
    >
      {children}
    </FavouritesContext.Provider>
  );
};

export const useFavourites = () => {
  const context = useContext(FavouritesContext);
  if (context === undefined) {
    throw new Error("useFavourites must be used within a FavouritesProvider");
  }
  return context;
};
