import { StyleSheet, Text, View } from 'react-native';
import { colors, roleColor, spacing, typography } from '../theme/theme';

// Section title with a small role-colored accent bar (blue = Driver offers,
// orange = Rider needs) and an optional element on the right.
export default function SectionHeader({ title, role, right, style }) {
  return (
    <View style={[styles.row, style]}>
      {role ? <View style={[styles.accent, { backgroundColor: roleColor(role) }]} /> : null}
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  accent: {
    width: 4,
    height: 16,
    borderRadius: 2,
    marginRight: spacing.sm,
  },
  title: {
    ...typography.title,
    color: colors.text,
    flex: 1,
  },
  right: {
    marginLeft: spacing.sm,
  },
});
