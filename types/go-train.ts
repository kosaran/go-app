export type GoTrainRoute = {
  routeId: string;
  routeShortName: string;
  routeLongName: string;
  routeColor: string;
};

export type GoTrainStop = {
  stopId: string;
  stopName: string;
  latitude: number;
  longitude: number;
};

export type GoTrainTripStopTime = {
  stopId: string;
  arrivalTime: string;
  departureTime: string;
  arrivalSeconds: number;
  departureSeconds: number;
  stopSequence: number;
};

export type GoTrainTrip = {
  tripId: string;
  routeId: string;
  headsign: string;
  directionId: string;
  stopTimes: GoTrainTripStopTime[];
};

export type GoTrainStaticData = {
  generatedAt: string;
  serviceDate: string;
  serviceDateISO: string;
  stats: {
    routeCount: number;
    stopCount: number;
    tripCount: number;
  };
  routes: GoTrainRoute[];
  stops: GoTrainStop[];
  routeStops: Record<string, string[]>;
  routeTrips: Record<string, GoTrainTrip[]>;
};
