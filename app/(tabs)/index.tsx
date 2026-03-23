import { useFocusEffect } from '@react-navigation/native';
import { startTransition, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { PlannerSearchPill } from '@/components/planner-search-pill';
import { TripSelectorSheet } from '@/components/trip-selector-sheet';
import { Colors } from '@/constants/theme';
import {
  findTripsBetweenStops,
  formatGtfsTime,
  formatServiceDate,
  getRouteById,
  getStopById,
  goTrainData,
  secondsSinceMidnight,
} from '@/lib/go-train-data';
import {
  getFavoriteJourney,
  setFavoriteJourney,
  type FavoriteJourney,
} from '@/lib/local-preferences';

const REFRESH_INTERVAL_MS = 60_000;
const MAX_RESULTS = 12;

function useNowSeconds() {
  const [nowSeconds, setNowSeconds] = useState(() => secondsSinceMidnight());

  useEffect(() => {
    const interval = setInterval(() => {
      setNowSeconds(secondsSinceMidnight());
    }, REFRESH_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);

  return nowSeconds;
}

export default function RoutesTimesScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const nowSeconds = useNowSeconds();

  const [isSheetVisible, setSheetVisible] = useState(false);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [selectedStartStopId, setSelectedStartStopId] = useState<string | null>(null);
  const [selectedEndStopId, setSelectedEndStopId] = useState<string | null>(null);
  const [favoriteJourney, setFavoriteJourneyState] = useState<FavoriteJourney | null>(null);

  const selectedRoute = getRouteById(selectedRouteId);
  const selectedStartStop = getStopById(selectedStartStopId);
  const selectedEndStop = getStopById(selectedEndStopId);

  const tripOptions = useMemo(() => {
    return findTripsBetweenStops({
      routeId: selectedRouteId,
      startStopId: selectedStartStopId,
      endStopId: selectedEndStopId,
      nowSeconds,
      limit: MAX_RESULTS,
    });
  }, [nowSeconds, selectedEndStopId, selectedRouteId, selectedStartStopId]);

  const hasCompleteJourney = Boolean(selectedRoute && selectedStartStop && selectedEndStop);

  const completedJourneyTitle =
    hasCompleteJourney && selectedStartStop && selectedEndStop
      ? `${selectedStartStop.stopName} to ${selectedEndStop.stopName}`
      : null;

  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      const loadFavorite = async () => {
        try {
          const nextFavoriteJourney = await getFavoriteJourney();
          if (!mounted) {
            return;
          }

          setFavoriteJourneyState(nextFavoriteJourney);

          if (!nextFavoriteJourney) {
            startTransition(() => {
              setSelectedRouteId(null);
              setSelectedStartStopId(null);
              setSelectedEndStopId(null);
            });
            return;
          }

          startTransition(() => {
            setSelectedRouteId(nextFavoriteJourney.routeId);
            setSelectedStartStopId(nextFavoriteJourney.startStopId);
            setSelectedEndStopId(nextFavoriteJourney.endStopId);
          });
        } catch {
          if (!mounted) {
            return;
          }

          setFavoriteJourneyState(null);
          startTransition(() => {
            setSelectedRouteId(null);
            setSelectedStartStopId(null);
            setSelectedEndStopId(null);
          });
        }
      };

      loadFavorite();
      return () => {
        mounted = false;
      };
    }, []),
  );

  function handleApplySelection(selection: {
    routeId: string;
    startStopId: string;
    endStopId: string;
  }) {
    startTransition(() => {
      setSelectedRouteId(selection.routeId);
      setSelectedStartStopId(selection.startStopId);
      setSelectedEndStopId(selection.endStopId);
    });
  }

  async function handleFavoriteSelection() {
    if (!selectedRouteId || !selectedStartStopId || !selectedEndStopId) {
      return;
    }

    const nextFavoriteJourney = {
      routeId: selectedRouteId,
      startStopId: selectedStartStopId,
      endStopId: selectedEndStopId,
    };

    setFavoriteJourneyState(nextFavoriteJourney);

    try {
      await setFavoriteJourney(nextFavoriteJourney);
    } catch {
      // Keep the current planner state even if local storage is unavailable.
    }
  }

  const isCurrentSelectionFavorite =
    favoriteJourney?.routeId === selectedRouteId &&
    favoriteJourney?.startStopId === selectedStartStopId &&
    favoriteJourney?.endStopId === selectedEndStopId;

  const pillTitle = completedJourneyTitle || selectedRoute?.routeLongName || 'Plan your GO train trip';

  const pillSubtitle = hasCompleteJourney
    ? `${selectedRoute?.routeLongName || 'Selected line'} - Change line or stations`
    : selectedRoute
      ? 'Pick your start and destination'
      : 'Choose a line, origin, and destination';

  const heroAccent = selectedRoute?.routeColor || palette.tint;
  const heroStartLabel = selectedStartStop
    ? `From ${selectedStartStop.stopName}`
    : 'From your selected station';
  const heroEndLabel = selectedEndStop ? `To ${selectedEndStop.stopName}` : 'To your destination';
  const heroMetaLine = selectedRoute
    ? `${selectedRoute.routeShortName} - ${selectedRoute.routeLongName}`
    : `${goTrainData.stats.routeCount} GO train lines ready to browse`;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: palette.background }]}>
      <View
        style={[
          styles.backgroundGlow,
          {
            backgroundColor: `${heroAccent}14`,
          },
        ]}
      />

      <FlatList
        data={tripOptions}
        keyExtractor={(item) => item.tripId}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          return (
            <View
              style={[
                styles.timeCard,
                {
                  backgroundColor: `${heroAccent}10`,
                  borderColor: `${palette.icon}24`,
                },
              ]}>
              <View style={styles.timeCopy}>
                <Text style={[styles.timeRange, { color: palette.text }]}>
                  {formatGtfsTime(item.departureTime)}
                  {' -> '}
                  {formatGtfsTime(item.arrivalTime)}
                </Text>
                <Text numberOfLines={1} style={[styles.timeMeta, { color: palette.icon }]}>
                  {item.headsign}
                </Text>
              </View>

              <View
                style={[
                  styles.durationBadge,
                  {
                    borderColor: `${palette.icon}35`,
                  },
                ]}>
                <Text style={[styles.durationText, { color: palette.text }]}>
                  {item.durationMinutes} min
                </Text>
              </View>
            </View>
          );
        }}
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <View
              style={[
                styles.heroCard,
                {
                  backgroundColor: `${heroAccent}16`,
                  borderColor: `${heroAccent}30`,
                },
              ]}>
              <View
                style={[
                  styles.heroOrb,
                  {
                    backgroundColor: `${heroAccent}26`,
                  },
                ]}
              />

              <View style={styles.heroTopRow}>
                <View
                  style={[
                    styles.routeBadge,
                    {
                      backgroundColor: `${heroAccent}24`,
                      borderColor: `${heroAccent}44`,
                    },
                  ]}>
                  <Text style={[styles.routeBadgeText, { color: palette.text }]}>
                    {selectedRoute?.routeShortName || 'GO'}
                  </Text>
                </View>
                <Text style={[styles.heroMeta, { color: palette.icon }]}>
                  Static schedule - {formatServiceDate(goTrainData.serviceDate)}
                </Text>
              </View>

              <View style={styles.heroJourneyStack}>
                <Text style={[styles.heroStartLine, { color: palette.text }]}>{heroStartLabel}</Text>
                <Text style={[styles.heroEndLine, { color: palette.text }]}>{heroEndLabel}</Text>
              </View>

              <Text style={[styles.heroSubtitle, { color: palette.icon }]}>{heroMetaLine}</Text>
            </View>

            <View style={styles.sectionHeader}>
              <View style={styles.sectionCopy}>
                <Text style={[styles.sectionTitle, { color: palette.text }]}>Upcoming trips</Text>
                <Text style={[styles.sectionSubtitle, { color: palette.icon }]}>
                  {hasCompleteJourney
                    ? `${selectedRoute?.routeLongName || 'Selected line'} timetable`
                    : 'Times appear after you finish your selection'}
                </Text>
              </View>

              <Pressable
                disabled={!hasCompleteJourney}
                onPress={handleFavoriteSelection}
                style={[
                  styles.favoriteButton,
                  {
                    borderColor: `${palette.icon}30`,
                    backgroundColor: isCurrentSelectionFavorite
                      ? `${heroAccent}20`
                      : `${palette.background}`,
                    opacity: hasCompleteJourney ? 1 : 0.45,
                  },
                ]}>
                <MaterialIcons
                  color={isCurrentSelectionFavorite ? heroAccent : palette.text}
                  name={isCurrentSelectionFavorite ? 'favorite' : 'favorite-border'}
                  size={16}
                />
                <Text style={[styles.favoriteButtonText, { color: palette.text }]}>
                  {isCurrentSelectionFavorite ? 'Favourited' : 'Favourite'}
                </Text>
              </Pressable>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View
            style={[
              styles.emptyCard,
              {
                borderColor: `${palette.icon}28`,
                backgroundColor: `${palette.icon}08`,
              },
            ]}>
            <Text style={[styles.emptyTitle, { color: palette.text }]}>
              {hasCompleteJourney ? 'No direct trips available right now' : 'No trip selected yet'}
            </Text>
            <Text style={[styles.emptyBody, { color: palette.icon }]}>
              {hasCompleteJourney
                ? 'Try reversing the stations or picking another train line from the bottom search pill.'
                : 'Open the bottom search pill to choose a train line, then select your start and destination stations.'}
            </Text>
          </View>
        }
      />

      <PlannerSearchPill
        accentColor={selectedRoute?.routeColor}
        onPress={() => setSheetVisible(true)}
        subtitle={pillSubtitle}
        title={pillTitle}
      />

      <TripSelectorSheet
        visible={isSheetVisible}
        routeId={selectedRouteId}
        startStopId={selectedStartStopId}
        endStopId={selectedEndStopId}
        favoriteJourney={favoriteJourney}
        onApply={handleApplySelection}
        onClose={() => setSheetVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  backgroundGlow: {
    borderBottomLeftRadius: 180,
    borderBottomRightRadius: 180,
    height: 260,
    left: -60,
    position: 'absolute',
    right: -60,
    top: -24,
  },
  listContent: {
    paddingBottom: 122,
    paddingHorizontal: 16,
  },
  headerBlock: {
    gap: 18,
    paddingTop: 12,
    paddingBottom: 18,
  },
  heroCard: {
    borderRadius: 28,
    borderWidth: 1,
    minHeight: 192,
    overflow: 'hidden',
    padding: 18,
  },
  heroOrb: {
    borderRadius: 999,
    height: 156,
    position: 'absolute',
    right: -16,
    top: -22,
    width: 156,
  },
  heroTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  routeBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  routeBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  heroMeta: {
    fontSize: 12,
  },
  heroJourneyStack: {
    gap: 4,
  },
  heroStartLine: {
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 27,
    maxWidth: '88%',
  },
  heroEndLine: {
    fontSize: 21,
    fontWeight: '700',
    lineHeight: 26,
    maxWidth: '88%',
  },
  heroSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 10,
    maxWidth: '90%',
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 2,
    justifyContent: 'space-between',
  },
  sectionCopy: {
    flex: 1,
    gap: 2,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '700',
  },
  sectionSubtitle: {
    fontSize: 13,
  },
  favoriteButton: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  favoriteButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
  timeCard: {
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  timeCopy: {
    flex: 1,
    gap: 3,
  },
  timeRange: {
    fontSize: 18,
    fontWeight: '700',
  },
  timeMeta: {
    fontSize: 12,
  },
  durationBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  durationText: {
    fontSize: 12,
    fontWeight: '700',
  },
  emptyCard: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptyBody: {
    fontSize: 13,
    lineHeight: 19,
  },
});
