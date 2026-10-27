import { StyleSheet, Text, View } from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import AppButton from './AppButton';
import { colors, radius, spacing, typography } from '../theme/theme';

// Friendly placeholder for screens/sections with nothing to show yet, with an
// optional action button (e.g. Refresh).
export default function EmptyState({ icon = 'sparkles-outline', title, message, actionLabel, onAction, style }) {
  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.iconCircle}>
        <Ionicons name={icon} size={26} color={colors.primary} />
      </View>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {actionLabel && onAction ? (
        <AppButton title={actionLabel} onPress={onAction} variant="secondary" size="sm" style={styles.action} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.title,
    color: colors.text,
    textAlign: 'center',
  },
  message: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 21,
    marginTop: spacing.xs,
  },
  action: {
    marginTop: spacing.lg,
  },
});
