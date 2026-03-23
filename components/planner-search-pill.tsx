import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';

type PlannerSearchPillProps = {
  title: string;
  subtitle: string;
  accentColor?: string | null;
  onPress: () => void;
};

export function PlannerSearchPill({
  title,
  subtitle,
  accentColor,
  onPress,
}: PlannerSearchPillProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const insets = useSafeAreaInsets();

  return (
    <View pointerEvents="box-none" style={[styles.wrapper, { bottom: insets.bottom + 14 }]}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.pill,
          {
            backgroundColor: palette.background,
            borderColor: `${palette.icon}55`,
            opacity: pressed ? 0.94 : 1,
          },
        ]}>
        <View
          style={[
            styles.leadingBadge,
            {
              backgroundColor: accentColor ? `${accentColor}20` : `${palette.tint}16`,
            },
          ]}>
          <MaterialIcons
            color={accentColor || palette.tint}
            name="travel-explore"
            size={18}
          />
        </View>

        <View style={styles.copyWrap}>
          <Text numberOfLines={1} style={[styles.title, { color: palette.text }]}>
            {title}
          </Text>
          <Text numberOfLines={1} style={[styles.subtitle, { color: palette.icon }]}>
            {subtitle}
          </Text>
        </View>

        <MaterialIcons color={palette.text} name="keyboard-arrow-up" size={26} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    left: 16,
    position: 'absolute',
    right: 16,
  },
  pill: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 64,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: '#08101D',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 10,
  },
  leadingBadge: {
    alignItems: 'center',
    borderRadius: 999,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  copyWrap: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
  },
});
