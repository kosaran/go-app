import { ReactNode, useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, useColorScheme, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Colors } from '@/constants/theme';

type BottomSheetShellProps = {
  visible: boolean;
  onClose: () => void;
  header?: ReactNode;
  children: ReactNode;
};

export function BottomSheetShell({ visible, onClose, header, children }: BottomSheetShellProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const maxHeight = Math.min(height * 0.78, height - insets.top - 24);

  const [mounted, setMounted] = useState(visible);
  const progress = useSharedValue(visible ? 1 : 0);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      progress.value = withTiming(1, {
        duration: 260,
        easing: Easing.out(Easing.cubic),
      });
      return;
    }

    if (!mounted) {
      return;
    }

    progress.value = withTiming(
      0,
      {
        duration: 220,
        easing: Easing.in(Easing.cubic),
      },
      (finished) => {
        if (finished) {
          runOnJS(setMounted)(false);
        }
      },
    );
  }, [mounted, progress, visible]);

  const backdropStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(progress.value, [0, 1], [0, 1]),
    };
  });

  const sheetStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateY: interpolate(progress.value, [0, 1], [maxHeight, 0]),
        },
        {
          scale: interpolate(progress.value, [0, 1], [0.98, 1]),
        },
      ],
    };
  });

  if (!mounted) {
    return null;
  }

  return (
    <Modal transparent visible statusBarTranslucent animationType="none" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
          <Animated.View style={[styles.backdrop, backdropStyle]} />
        </Pressable>

        <Animated.View
          style={[
            styles.sheet,
            sheetStyle,
            {
              backgroundColor: palette.background,
              borderColor: `${palette.icon}50`,
              maxHeight,
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}>
          <View style={[styles.handle, { backgroundColor: `${palette.icon}66` }]} />
          {header}
          <View style={styles.content}>{children}</View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(6, 10, 18, 0.34)',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
    shadowColor: '#09111F',
    shadowOffset: {
      width: 0,
      height: -8,
    },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 18,
  },
  handle: {
    alignSelf: 'center',
    borderRadius: 999,
    height: 5,
    marginBottom: 14,
    width: 56,
  },
  content: {
    flexGrow: 1,
  },
});
