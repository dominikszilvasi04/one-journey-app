import { Arrival, Station } from "../types/transport_types";
import { fetchIrishRailForecast } from "../api/irish_rail_service";
import { fetchLuasForecast } from "../api/luas_forecast_service";

export interface ArrivalSection {
  title: string;
  data: Arrival[];
}

export const fetchArrivalsForStation = async (
  station: Station
): Promise<Arrival[]> => {
  try {
    return station.type === "Luas"
      ? await fetchLuasForecast(station.id)
      : await fetchIrishRailForecast(station.id);
  } catch (error) {
    console.error(`Failed to fetch arrivals for ${station.name}:`, error);
    throw error;
  }
};

export const groupArrivalsByDestination = (
  arrivals: Arrival[]
): ArrivalSection[] => {
  const grouped = arrivals.reduce(
    (sections: { [key: string]: Arrival[] }, arrival) => {
      const title = `To ${arrival.destination}`;
      if (!sections[title]) sections[title] = [];
      sections[title].push(arrival);
      return sections;
    },
    {}
  );

  return Object.keys(grouped).map((title) => ({
    title,
    data: grouped[title].sort(
      (previous, next) => previous.minutesToDeparture - next.minutesToDeparture
    ),
  }));
};

export const fetchAndGroupArrivals = async (
  station: Station
): Promise<ArrivalSection[]> => {
  const arrivals = await fetchArrivalsForStation(station);
  return groupArrivalsByDestination(arrivals);
};
