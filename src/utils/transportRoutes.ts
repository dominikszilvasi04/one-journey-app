import { Station } from "../types/transport_types";
import * as RoutesConstant from "../constants/transport_routes";

export interface TransportRoute {
  id: string;
  name: string;
  colour: string;
  branches: string[][];
  type: "Luas" | "Train" | "DART";
}

export interface RouteCoordinates {
  latitude: number;
  longitude: number;
}

export const getRouteColour = (type: "Luas" | "Train" | "DART"): string => {
  const colourMap: { [key: string]: string } = {
    Luas: "#ff6b35",
    Train: "#004e89",
    DART: "#00b300",
  };
  return colourMap[type] ?? "#999999";
};

export const filterRoutesByLineIdentifiers = (
  allRoutes: TransportRoute[],
  selectedLineIdentifiers: string[]
): TransportRoute[] => {
  if (selectedLineIdentifiers.length === 0) {
    return allRoutes;
  }
  return allRoutes.filter((route) => selectedLineIdentifiers.includes(route.id));
};

export const getBranchCoordinates = (
  routeId: string,
  branch: string[],
  stations: Station[]
): RouteCoordinates[] => {
  const coordinates = branch
    .map((code) =>
      stations.find(
        (station) => station.stationCode === code || station.id === code
      )
    )
    .filter((station): station is Station => !!station)
    .map((station) => ({
      latitude: station.latitude,
      longitude: station.longitude,
    }));

  if (
    routeId === "M3-Parkway" &&
    branch.includes("BBRDG") &&
    branch.includes("DCKLS")
  ) {
    const broombridgeIndex = branch.indexOf("BBRDG");
    const docklandsIndex = branch.indexOf("DCKLS");

    if (broombridgeIndex < docklandsIndex) {
      coordinates.splice(
        broombridgeIndex + 1,
        0,
        RoutesConstant.DOCKLANDS_ROUTING_WAYPOINT
      );
    }
  }

  return coordinates;
};

export const getAllTransportRoutes = (): TransportRoute[] => [
  {
    id: "Luas-Red",
    name: "Luas Red Line",
    colour: "#e60000",
    branches: RoutesConstant.LUAS_RED_LINE,
    type: "Luas",
  },
  {
    id: "Luas-Green",
    name: "Luas Green Line",
    colour: "#00b300",
    branches: RoutesConstant.LUAS_GREEN_LINE,
    type: "Luas",
  },
  {
    id: "DART",
    name: "DART",
    colour: "#00cc00",
    branches: RoutesConstant.DART_LINE,
    type: "DART",
  },
  {
    id: "Maynooth",
    name: "Maynooth Commuter",
    colour: "#ff8c00",
    branches: RoutesConstant.MAYNOOTH_LINE,
    type: "Train",
  },
  {
    id: "M3-Parkway",
    name: "M3 Parkway Commuter",
    colour: "#ff9900",
    branches: RoutesConstant.M3_PARKWAY_LINE,
    type: "Train",
  },
  {
    id: "Northern",
    name: "Northern Commuter",
    colour: "#ffcc00",
    branches: RoutesConstant.NORTHERN_COMMUTER,
    type: "Train",
  },
  {
    id: "Connolly-Hazelhatch",
    name: "Connolly to Hazelhatch",
    colour: "#0066ff",
    branches: RoutesConstant.CONNOLLY_HAZELHATCH_LINE,
    type: "Train",
  },
];
