import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../theme/theme';

// Pill-style segmented control, e.g. the Available Rides sort options.
// options: [{ key, label }]. The selected segment is filled with `tint`.
export default function SegmentedControl({ options, value, onChange, tint = colors.primary, style }) {
  return (
    <View style={[styles.track, style]}>
      {options.map((option) => {
        const isActive = option.key === value;
        return (
          <Pressable
            key={option.key}
            onPress={() => onChange(option.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            style={({ pressed }) => [
              styles.segment,
              isActive && { backgroundColor: tint },
              pressed && !isActive && styles.pressed,
            ]}
          >
            <Text style={[styles.text, isActive && styles.textActive]} numberOfLines={1}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 3,
  },
  segment: {
    flex: 1,
    borderRadius: radius.pill,
    paddingVertical: 7,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
  },
  pressed: {
    backgroundColor: colors.surfaceRaised,
  },
  text: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.textMuted,
  },
  textActive: {
    color: colors.textOnAccent,
  },
});
