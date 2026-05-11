import { useCallback, useState } from "react";
import { Station } from "../types/transport_types";
import {
    ArrivalSection,
    fetchArrivalsForStation,
    groupArrivalsByDestination,
} from "../utils/arrivals";

interface FavouriteStationWithArrivals extends Station {
  arrivals: ArrivalSection[];
  isLoading: boolean;
  error?: string;
}

export const useFavouritesArrivals = (favourites: Station[]) => {
  const [favouritesData, setFavouritesData] = useState<
    FavouriteStationWithArrivals[]
  >([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadAllArrivals = useCallback(async () => {
    const initialData: FavouriteStationWithArrivals[] = favourites.map(
      (favourite) => ({
        ...favourite,
        arrivals: [],
        isLoading: true,
      }),
    );
    setFavouritesData(initialData);

    const updatedData = await Promise.all(
      favourites.map(async (station) => {
        try {
          const arrivals = await fetchArrivalsForStation(station);
          const limitedArrivals = arrivals.slice(0, 3);
          const grouped = groupArrivalsByDestination(limitedArrivals);
          return {
            ...station,
            arrivals: grouped,
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
  }, [favourites]);

  const onRefresh = async () => {
    setIsRefreshing(true);
    await loadAllArrivals();
    setIsRefreshing(false);
  };

  return {
    favouritesData,
    isRefreshing,
    onRefresh,
    loadAllArrivals,
  };
};
