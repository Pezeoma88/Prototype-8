import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import { colors, radius, roleColor, spacing, typography } from '../theme/theme';

const MODES = [
  { key: 'driver', label: 'Driver', icon: 'car-sport', hint: 'Offer rides and manage requests for them' },
  { key: 'rider', label: 'Rider', icon: 'walk', hint: 'Browse rides and request a seat' },
];

// Driver | Rider switch for the session's activeMode, shown on Home,
// Requests, and Profile. The active side is filled with its role color
// (blue Driver, orange Rider) so the current mode is obvious at a glance.
// Tapping the side that's already active does nothing. Screen readers hear
// it as a two-option radio group ("Driver mode, selected").
export default function ModeToggle({ activeMode, onChange, style }) {
  return (
    <View style={[styles.track, style]} accessibilityRole="radiogroup" accessibilityLabel="Mode">
      {MODES.map((mode) => {
        const isActive = mode.key === activeMode;
        const tint = roleColor(mode.key);
        return (
          <Pressable
            key={mode.key}
            onPress={() => {
              if (!isActive) onChange(mode.key);
            }}
            accessibilityRole="radio"
            accessibilityState={{ checked: isActive, selected: isActive }}
            accessibilityLabel={`${mode.label} mode`}
            accessibilityHint={isActive ? undefined : mode.hint}
            hitSlop={4}
            style={({ pressed }) => [
              styles.segment,
              isActive && { backgroundColor: tint },
              pressed && !isActive && styles.pressed,
            ]}
          >
            <Ionicons
              name={isActive ? mode.icon : `${mode.icon}-outline`}
              size={18}
              color={isActive ? colors.textOnAccent : colors.textMuted}
            />
            <Text style={[styles.label, isActive && styles.labelActive]} numberOfLines={1}>
              {mode.label}
            </Text>
            {isActive && (
              <Ionicons name="checkmark" size={15} color={colors.textOnAccent} style={styles.check} />
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
  },
  segment: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
  },
  pressed: {
    backgroundColor: colors.border,
  },
  label: {
    ...typography.bodyStrong,
    color: colors.textMuted,
    marginLeft: spacing.sm,
  },
  labelActive: {
    color: colors.textOnAccent,
    fontWeight: '700',
  },
  check: {
    marginLeft: spacing.xs,
  },
});
