import { StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../theme/theme';

// Small status pill. Tones map to the request/ride states used across the
// app, so "Pending" is always amber, "Confirmed" always green, and so on.
const TONES = {
  driver: { bg: colors.driverSoft, text: colors.driver },
  rider: { bg: colors.riderSoft, text: colors.rider },
  pending: { bg: colors.pendingSoft, text: colors.pending },
  success: { bg: colors.successSoft, text: colors.success },
  danger: { bg: colors.dangerSoft, text: colors.danger },
  muted: { bg: colors.mutedSoft, text: colors.textMuted },
  primary: { bg: colors.primarySoft, text: colors.primary },
};

export default function Badge({ label, tone = 'muted', style }) {
  const t = TONES[tone] || TONES.muted;
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }, style]}>
      <Text style={[styles.text, { color: t.text }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  text: {
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
