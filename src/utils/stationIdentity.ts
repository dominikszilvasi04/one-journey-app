import { Station } from "../types/transport_types";

export const getStationKey = (station: Station): string => {
  const baseIdentifier = station.stationCode ?? station.id;
  const lineIdentifier = station.line ?? "none";
  return `${station.type}:${baseIdentifier}:${lineIdentifier}`;
};

export const stationsEqual = (station1: Station, station2: Station): boolean => {
  return getStationKey(station1) === getStationKey(station2);
};

export const deduplicateStations = (stations: Station[]): Station[] => {
  const uniqueByKey = new Map<string, Station>();
  stations.forEach((station) => {
    uniqueByKey.set(getStationKey(station), station);
  });
  return Array.from(uniqueByKey.values());
};
