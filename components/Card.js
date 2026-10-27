import { Pressable, StyleSheet, View } from 'react-native';
import { colors, radius, shadow, spacing } from '../theme/theme';

// Layered dark card with a thin border. Pass onPress to make the whole card
// tappable (it dims slightly while pressed).
export default function Card({ children, onPress, style }) {
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        style={({ pressed }) => [styles.card, pressed && styles.pressed, style]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadow.card,
  },
  pressed: {
    backgroundColor: colors.surfaceRaised,
  },
});
