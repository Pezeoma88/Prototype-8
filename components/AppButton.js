import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import { colors, radius, spacing } from '../theme/theme';

// The one button style system for CarpoolBoard:
//   primary     filled blue/indigo, for the main action on a screen
//   secondary   dark outlined, for alternatives (Cancel, View Profile…)
//   destructive red, for cancelling a ride / leaving a seat
//   rider       filled orange, for Rider-specific primary actions
// Disabled buttons use a muted fill regardless of variant.
const VARIANTS = {
  primary: { bg: colors.primary, pressedBg: colors.primaryPressed, text: colors.textOnAccent },
  secondary: { bg: 'transparent', pressedBg: colors.surfaceRaised, text: colors.text, border: colors.borderStrong },
  destructive: { bg: colors.dangerSoft, pressedBg: colors.dangerPressed, text: colors.danger },
  rider: { bg: colors.rider, pressedBg: colors.riderPressed, text: colors.textOnAccent },
};

export default function AppButton({
  title,
  onPress,
  variant = 'primary',
  icon,
  disabled = false,
  loading = false,
  size = 'md',
  style,
}) {
  const v = VARIANTS[variant] || VARIANTS.primary;
  const isDisabled = disabled || loading;
  const textColor = isDisabled ? colors.textFaint : v.text;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      style={({ pressed }) => [
        styles.base,
        size === 'sm' && styles.small,
        { backgroundColor: isDisabled ? colors.muted : pressed ? v.pressedBg : v.bg },
        v.border && !isDisabled && { borderWidth: 1, borderColor: v.border },
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator size="small" color={textColor} style={styles.icon} />
        ) : icon ? (
          <Ionicons name={icon} size={size === 'sm' ? 15 : 18} color={textColor} style={styles.icon} />
        ) : null}
        <Text style={[styles.text, size === 'sm' && styles.textSmall, { color: textColor }]} numberOfLines={1}>
          {title}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  small: {
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: 14,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: spacing.sm,
  },
  text: {
    fontSize: 16,
    fontWeight: '700',
  },
  textSmall: {
    fontSize: 13,
  },
});
