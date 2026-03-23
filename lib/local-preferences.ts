import AsyncStorage from '@react-native-async-storage/async-storage';

const FAVORITE_JOURNEY_KEY = 'goapp.favoriteJourney';
const LEGACY_SAVED_JOURNEY_KEY = 'goapp.savedJourney';

export type FavoriteJourney = {
  routeId: string;
  startStopId: string;
  endStopId: string;
};

function parseJourney(rawValue: string | null): FavoriteJourney | null {
  if (!rawValue) {
    return null;
  }

  const parsed = JSON.parse(rawValue) as Partial<FavoriteJourney>;
  if (!parsed.routeId || !parsed.startStopId || !parsed.endStopId) {
    return null;
  }

  return {
    routeId: parsed.routeId,
    startStopId: parsed.startStopId,
    endStopId: parsed.endStopId,
  };
}

export async function getFavoriteJourney(): Promise<FavoriteJourney | null> {
  const currentValue = parseJourney(await AsyncStorage.getItem(FAVORITE_JOURNEY_KEY));
  if (currentValue) {
    return currentValue;
  }

  return parseJourney(await AsyncStorage.getItem(LEGACY_SAVED_JOURNEY_KEY));
}

export async function setFavoriteJourney(journey: FavoriteJourney): Promise<void> {
  await AsyncStorage.setItem(FAVORITE_JOURNEY_KEY, JSON.stringify(journey));
  await AsyncStorage.removeItem(LEGACY_SAVED_JOURNEY_KEY);
}

export async function clearFavoriteJourney(): Promise<void> {
  await AsyncStorage.multiRemove([FAVORITE_JOURNEY_KEY, LEGACY_SAVED_JOURNEY_KEY]);
}
