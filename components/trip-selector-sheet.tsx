import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { BottomSheetShell } from '@/components/bottom-sheet-shell';
import { Colors } from '@/constants/theme';
import {
  getRouteById,
  getStopById,
  searchRoutes,
  searchStopsOnRoute,
} from '@/lib/go-train-data';
import type { FavoriteJourney } from '@/lib/local-preferences';
import type { GoTrainRoute } from '@/types/go-train';

type TripSelectorSheetProps = {
  visible: boolean;
  routeId: string | null;
  startStopId: string | null;
  endStopId: string | null;
  favoriteJourney: FavoriteJourney | null;
  onClose: () => void;
  onApply: (selection: { routeId: string; startStopId: string; endStopId: string }) => void;
};

type ResultItem = {
  key: string;
  title: string;
  subtitle?: string;
  accentColor?: string;
  selected?: boolean;
};

function formatRouteLabel(route: GoTrainRoute) {
  return `${route.routeShortName} - ${route.routeLongName}`;
}

function SearchResultsList({
  items,
  palette,
  onSelect,
}: {
  items: ResultItem[];
  palette: (typeof Colors)['light'];
  onSelect: (key: string) => void;
}) {
  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.key}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.resultsContent}
      showsVerticalScrollIndicator={false}
      style={styles.resultsList}
      renderItem={({ item }) => {
        return (
          <Pressable
            onPress={() => onSelect(item.key)}
            style={({ pressed }) => [
              styles.resultItem,
              {
                borderColor: item.selected ? `${palette.tint}66` : `${palette.icon}30`,
                backgroundColor: item.selected
                  ? `${palette.tint}14`
                  : pressed
                    ? `${palette.icon}14`
                    : 'transparent',
              },
            ]}>
            <View style={styles.resultCopy}>
              <Text style={[styles.resultTitle, { color: palette.text }]}>{item.title}</Text>
              {item.subtitle ? (
                <Text style={[styles.resultSubtitle, { color: palette.icon }]}>{item.subtitle}</Text>
              ) : null}
            </View>

            {item.accentColor ? (
              <View style={[styles.resultDot, { backgroundColor: item.accentColor }]} />
            ) : null}

            {item.selected ? (
              <MaterialIcons color={palette.tint} name="check-circle" size={20} />
            ) : null}
          </Pressable>
        );
      }}
      ListEmptyComponent={
        <View style={[styles.emptyState, { borderColor: `${palette.icon}30` }]}>
          <Text style={[styles.emptyStateText, { color: palette.icon }]}>No matches.</Text>
        </View>
      }
    />
  );
}

export function TripSelectorSheet({
  visible,
  routeId,
  startStopId,
  endStopId,
  favoriteJourney,
  onClose,
  onApply,
}: TripSelectorSheetProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const { width, height } = useWindowDimensions();
  const pageWidth = width - 32;
  const pageHeight = Math.min(height * 0.48, 420);

  const [stepIndex, setStepIndex] = useState(0);
  const [localRouteId, setLocalRouteId] = useState<string | null>(routeId);
  const [localStartStopId, setLocalStartStopId] = useState<string | null>(startStopId);
  const [localEndStopId, setLocalEndStopId] = useState<string | null>(endStopId);

  const [routeQuery, setRouteQuery] = useState('');
  const [startQuery, setStartQuery] = useState('');
  const [endQuery, setEndQuery] = useState('');
  const [isRouteSearchVisible, setRouteSearchVisible] = useState(false);
  const [isStartSearchVisible, setStartSearchVisible] = useState(false);
  const [isEndSearchVisible, setEndSearchVisible] = useState(false);

  const deferredRouteQuery = useDeferredValue(routeQuery);
  const deferredStartQuery = useDeferredValue(startQuery);
  const deferredEndQuery = useDeferredValue(endQuery);

  const selectedRoute = getRouteById(localRouteId);
  const selectedStartStop = getStopById(localStartStopId);
  const selectedEndStop = getStopById(localEndStopId);

  const pagerOffset = useSharedValue(0);

  useEffect(() => {
    if (!visible) {
      return;
    }

    setStepIndex(0);
    setLocalRouteId(routeId);
    setLocalStartStopId(startStopId);
    setLocalEndStopId(endStopId);
    setRouteQuery('');
    setStartQuery('');
    setEndQuery('');
    setRouteSearchVisible(false);
    setStartSearchVisible(false);
    setEndSearchVisible(false);
  }, [endStopId, routeId, startStopId, visible]);

  useEffect(() => {
    pagerOffset.value = withTiming(stepIndex * pageWidth, {
      duration: 280,
      easing: Easing.out(Easing.cubic),
    });
  }, [pageWidth, pagerOffset, stepIndex]);

  const pagerStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: -pagerOffset.value }],
    };
  });

  const routeResults = useMemo(() => {
    return searchRoutes(deferredRouteQuery).map((route) => ({
      key: route.routeId,
      title: route.routeLongName,
      subtitle: route.routeShortName,
      accentColor: route.routeColor,
      selected: route.routeId === localRouteId,
    }));
  }, [deferredRouteQuery, localRouteId]);

  const startResults = useMemo(() => {
    return searchStopsOnRoute(localRouteId, deferredStartQuery, localEndStopId).map((stop) => ({
      key: stop.stopId,
      title: stop.stopName,
      subtitle: stop.stopId,
      selected: stop.stopId === localStartStopId,
    }));
  }, [deferredStartQuery, localEndStopId, localRouteId, localStartStopId]);

  const endResults = useMemo(() => {
    return searchStopsOnRoute(localRouteId, deferredEndQuery, localStartStopId).map((stop) => ({
      key: stop.stopId,
      title: stop.stopName,
      subtitle: stop.stopId,
      selected: stop.stopId === localEndStopId,
    }));
  }, [deferredEndQuery, localEndStopId, localRouteId, localStartStopId]);

  function handleBack() {
    if (stepIndex === 0) {
      onClose();
      return;
    }

    setStepIndex((currentStep) => currentStep - 1);
  }

  function handleRouteSelect(nextRouteId: string) {
    setLocalRouteId(nextRouteId);
    setLocalStartStopId(null);
    setLocalEndStopId(null);
    setStartQuery('');
    setEndQuery('');
    setStartSearchVisible(false);
    setEndSearchVisible(false);
    setStepIndex(1);
  }

  function handleStartSelect(nextStartStopId: string) {
    setLocalStartStopId(nextStartStopId);
    setLocalEndStopId(null);
    setEndQuery('');
    setEndSearchVisible(false);
    setStepIndex(2);
  }

  function handleEndSelect(nextEndStopId: string) {
    if (!localRouteId || !localStartStopId) {
      return;
    }

    setLocalEndStopId(nextEndStopId);
    onApply({
      routeId: localRouteId,
      startStopId: localStartStopId,
      endStopId: nextEndStopId,
    });
    onClose();
  }

  const headerTitle =
    stepIndex === 0
      ? 'Select a train line'
      : stepIndex === 1
        ? 'Choose your start station'
        : 'Choose your destination';

  const headerSubtitle =
    stepIndex === 0
      ? 'Search GO train lines'
      : stepIndex === 1
        ? selectedRoute?.routeLongName || 'Pick the line first'
        : selectedStartStop?.stopName || 'Pick the start station first';

  return (
    <BottomSheetShell
      visible={visible}
      onClose={onClose}
      header={
        <View style={styles.header}>
          <View style={styles.headerActions}>
            <Pressable
              onPress={handleBack}
              style={[styles.iconButton, { borderColor: `${palette.icon}35` }]}>
              <MaterialIcons color={palette.text} name="west" size={18} />
            </Pressable>

            <Pressable
              onPress={onClose}
              style={[styles.iconButton, { borderColor: `${palette.icon}35` }]}>
              <MaterialIcons color={palette.text} name="close" size={18} />
            </Pressable>
          </View>

          <View style={styles.titleRow}>
            <Text style={[styles.headerTitle, { color: palette.text }]}>{headerTitle}</Text>
            {stepIndex === 0 ? (
              <Pressable
                disabled={!favoriteJourney}
                onPress={() => {
                  if (!favoriteJourney) {
                    return;
                  }

                  onApply(favoriteJourney);
                  onClose();
                }}
                style={[
                  styles.favoriteLoadButton,
                  {
                    borderColor: `${palette.icon}35`,
                    opacity: favoriteJourney ? 1 : 0.45,
                  },
                ]}>
                <MaterialIcons color={palette.text} name="favorite" size={16} />
                <Text style={[styles.favoriteLoadText, { color: palette.text }]}>
                  Load favourite
                </Text>
              </Pressable>
            ) : null}
          </View>
          <Text style={[styles.headerSubtitle, { color: palette.icon }]}>{headerSubtitle}</Text>

          <View style={styles.progressRow}>
            {[0, 1, 2].map((step) => (
              <View
                key={step}
                style={[
                  styles.progressPill,
                  {
                    backgroundColor:
                      step <= stepIndex ? selectedRoute?.routeColor || palette.tint : `${palette.icon}26`,
                  },
                ]}
              />
            ))}
          </View>
        </View>
      }>
      <View style={[styles.viewport, { height: pageHeight }]}>
        <Animated.View
          style={[
            styles.pager,
            pagerStyle,
            {
              width: pageWidth * 3,
            },
          ]}>
          <View style={[styles.page, { width: pageWidth }]}>
            <View style={styles.pageHeader}>
              <View style={styles.pageCopy}>
                <Text style={[styles.pageTitle, { color: palette.text }]}>Browse lines</Text>
                <Text style={[styles.pageSubtitle, { color: palette.icon }]}>
                  Pick from the list first. Search only if needed.
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  const nextVisible = !isRouteSearchVisible;
                  setRouteSearchVisible(nextVisible);
                  if (!nextVisible) {
                    setRouteQuery('');
                  }
                }}
                style={[styles.searchToggle, { borderColor: `${palette.icon}35` }]}>
                <MaterialIcons
                  color={palette.text}
                  name={isRouteSearchVisible ? 'close' : 'search'}
                  size={16}
                />
                <Text style={[styles.searchToggleText, { color: palette.text }]}>
                  {isRouteSearchVisible ? 'Hide' : 'Search'}
                </Text>
              </Pressable>
            </View>
            {isRouteSearchVisible ? (
              <TextInput
                value={routeQuery}
                onChangeText={setRouteQuery}
                placeholder="Search line name"
                placeholderTextColor={palette.icon}
                autoCorrect={false}
                autoCapitalize="none"
                style={[styles.input, { color: palette.text, borderColor: `${palette.icon}35` }]}
              />
            ) : null}
            <SearchResultsList items={routeResults} palette={palette} onSelect={handleRouteSelect} />
          </View>

          <View style={[styles.page, { width: pageWidth }]}>
            <View style={[styles.selectionBanner, { backgroundColor: `${selectedRoute?.routeColor || palette.tint}16` }]}>
              <Text style={[styles.selectionEyebrow, { color: palette.icon }]}>Line</Text>
              <Text style={[styles.selectionValue, { color: palette.text }]}>
                {selectedRoute ? formatRouteLabel(selectedRoute) : 'Choose a line'}
              </Text>
            </View>
            <View style={styles.pageHeader}>
              <View style={styles.pageCopy}>
                <Text style={[styles.pageTitle, { color: palette.text }]}>Choose your start</Text>
                <Text style={[styles.pageSubtitle, { color: palette.icon }]}>
                  Start stations are filtered to the selected line.
                </Text>
              </View>
              <Pressable
                disabled={!localRouteId}
                onPress={() => {
                  const nextVisible = !isStartSearchVisible;
                  setStartSearchVisible(nextVisible);
                  if (!nextVisible) {
                    setStartQuery('');
                  }
                }}
                style={[
                  styles.searchToggle,
                  {
                    borderColor: `${palette.icon}35`,
                    opacity: localRouteId ? 1 : 0.45,
                  },
                ]}>
                <MaterialIcons
                  color={palette.text}
                  name={isStartSearchVisible ? 'close' : 'search'}
                  size={16}
                />
                <Text style={[styles.searchToggleText, { color: palette.text }]}>
                  {isStartSearchVisible ? 'Hide' : 'Search'}
                </Text>
              </Pressable>
            </View>
            {isStartSearchVisible ? (
              <TextInput
                value={startQuery}
                onChangeText={setStartQuery}
                placeholder="Search start station"
                placeholderTextColor={palette.icon}
                autoCorrect={false}
                autoCapitalize="none"
                editable={Boolean(localRouteId)}
                style={[
                  styles.input,
                  {
                    color: palette.text,
                    borderColor: `${palette.icon}35`,
                    opacity: localRouteId ? 1 : 0.5,
                  },
                ]}
              />
            ) : null}
            <SearchResultsList items={startResults} palette={palette} onSelect={handleStartSelect} />
          </View>

          <View style={[styles.page, { width: pageWidth }]}>
            <View style={[styles.selectionBanner, { backgroundColor: `${selectedRoute?.routeColor || palette.tint}16` }]}>
              <Text style={[styles.selectionEyebrow, { color: palette.icon }]}>From</Text>
              <Text style={[styles.selectionValue, { color: palette.text }]}>
                {selectedStartStop?.stopName || 'Choose a start station'}
              </Text>
            </View>
            <View style={styles.pageHeader}>
              <View style={styles.pageCopy}>
                <Text style={[styles.pageTitle, { color: palette.text }]}>Choose your destination</Text>
                <Text style={[styles.pageSubtitle, { color: palette.icon }]}>
                  Destination options stay on the same line.
                </Text>
              </View>
              <Pressable
                disabled={!localStartStopId}
                onPress={() => {
                  const nextVisible = !isEndSearchVisible;
                  setEndSearchVisible(nextVisible);
                  if (!nextVisible) {
                    setEndQuery('');
                  }
                }}
                style={[
                  styles.searchToggle,
                  {
                    borderColor: `${palette.icon}35`,
                    opacity: localStartStopId ? 1 : 0.45,
                  },
                ]}>
                <MaterialIcons
                  color={palette.text}
                  name={isEndSearchVisible ? 'close' : 'search'}
                  size={16}
                />
                <Text style={[styles.searchToggleText, { color: palette.text }]}>
                  {isEndSearchVisible ? 'Hide' : 'Search'}
                </Text>
              </Pressable>
            </View>
            {isEndSearchVisible ? (
              <TextInput
                value={endQuery}
                onChangeText={setEndQuery}
                placeholder="Search destination station"
                placeholderTextColor={palette.icon}
                autoCorrect={false}
                autoCapitalize="none"
                editable={Boolean(localStartStopId)}
                style={[
                  styles.input,
                  {
                    color: palette.text,
                    borderColor: `${palette.icon}35`,
                    opacity: localStartStopId ? 1 : 0.5,
                  },
                ]}
              />
            ) : null}
            <SearchResultsList items={endResults} palette={palette} onSelect={handleEndSelect} />
          </View>
        </Animated.View>
      </View>

      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: palette.icon }]}>
          {selectedRoute ? selectedRoute.routeLongName : 'Choose a line'}
          {selectedStartStop ? ` - ${selectedStartStop.stopName}` : ''}
          {selectedEndStop ? ` - ${selectedEndStop.stopName}` : ''}
        </Text>
      </View>
    </BottomSheetShell>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: 8,
    marginBottom: 12,
  },
  headerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  iconButton: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  headerTitle: {
    flexShrink: 1,
    fontSize: 22,
    fontWeight: '700',
  },
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  headerSubtitle: {
    fontSize: 13,
  },
  progressRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  favoriteLoadButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  favoriteLoadText: {
    fontSize: 12,
    fontWeight: '700',
  },
  progressPill: {
    borderRadius: 999,
    flex: 1,
    height: 4,
  },
  viewport: {
    overflow: 'hidden',
  },
  pager: {
    flexDirection: 'row',
    height: '100%',
  },
  page: {
    flex: 1,
    gap: 10,
    height: '100%',
    paddingRight: 8,
  },
  pageHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  pageCopy: {
    flex: 1,
    gap: 2,
  },
  pageTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  pageSubtitle: {
    fontSize: 12,
    lineHeight: 17,
  },
  input: {
    borderRadius: 14,
    borderWidth: 1,
    fontSize: 15,
    height: 48,
    paddingHorizontal: 14,
  },
  searchToggle: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  searchToggleText: {
    fontSize: 12,
    fontWeight: '700',
  },
  resultsContent: {
    gap: 8,
    paddingBottom: 8,
  },
  resultsList: {
    flex: 1,
  },
  resultItem: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 58,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  resultCopy: {
    flex: 1,
    gap: 3,
  },
  resultTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  resultSubtitle: {
    fontSize: 12,
  },
  resultDot: {
    borderRadius: 999,
    height: 10,
    width: 10,
  },
  emptyState: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  emptyStateText: {
    fontSize: 13,
  },
  selectionBanner: {
    borderRadius: 16,
    gap: 2,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  selectionEyebrow: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  selectionValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  footer: {
    marginTop: 8,
  },
  footerText: {
    fontSize: 12,
  },
});
