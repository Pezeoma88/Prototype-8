import { StyleSheet, Text, View } from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import Card from './Card';
import Avatar from './Avatar';
import Badge from './Badge';
import AppButton from './AppButton';
import RatingSummary from './RatingSummary';
import RouteLine from './RouteLine';
import { colors, spacing, typography } from '../theme/theme';

// Full-width Available Ride card (a Driver's OFFER). `ride` is one entry of
// App's `drivers` state. Shows who is driving, where they're going, when,
// and seats, plus the action that fits the viewer and their current mode
// (App's activeMode):
//   - your own ride, Driver mode:  Manage Ride
//   - your own ride, Rider mode:   "Your ride" (switch to Driver to manage)
//   - Rider mode:                  Request Ride (or its current status)
// `myRequestStatus` is the signed-in person's request status for this ride
// from Supabase, if any. A denied or cancelled request is final, so those
// show as a status instead of a Request button.
//   - anyone else:                 View Details
// A ride with a pickup spot shows it above the destination; without one,
// RouteLine shows the destination only. The driver's average rating and
// review count sit under their name (ride.driverRating).
export default function RideCard({ ride, currentUser, activeMode, myRequestStatus, onView, onRequest }) {
  const isOwn = ride.driverAccountId === currentUser.id;
  const isFull = ride.seats === 0;
  const isRider = activeMode === 'rider';
  const alreadyConfirmed = ride.matchedRiders.some((r) => r.id === currentUser.id);
  const alreadyPending = ride.pendingRequests.some((req) => req.riderId === currentUser.id);

  let primaryAction = null;
  if (isOwn && !isRider) {
    primaryAction = <AppButton title="Manage Ride" icon="settings-outline" size="sm" onPress={onView} style={styles.flex} />;
  } else if (isOwn) {
    // Driver controls stay in Driver mode; Details offers the switch.
    primaryAction = <StatusPill icon="car-sport" label="Your ride" color={colors.driver} />;
  } else if (isRider) {
    if (alreadyConfirmed) {
      primaryAction = <StatusPill icon="checkmark-circle" label="Seat confirmed" color={colors.success} />;
    } else if (alreadyPending) {
      primaryAction = <StatusPill icon="time" label="Request pending" color={colors.pending} />;
    } else if (myRequestStatus === 'denied') {
      primaryAction = <StatusPill icon="close-circle" label="Request denied" color={colors.danger} />;
    } else if (myRequestStatus === 'cancelled') {
      primaryAction = <StatusPill icon="close-circle" label="Request cancelled" color={colors.textMuted} />;
    } else {
      primaryAction = (
        <AppButton
          title={isFull ? 'Full' : 'Request Ride'}
          icon={isFull ? undefined : 'hand-right-outline'}
          size="sm"
          disabled={isFull}
          onPress={onRequest}
          style={styles.flex}
        />
      );
    }
  }

  return (
    <Card onPress={onView} style={styles.card}>
      <View style={styles.topRow}>
        <Avatar name={ride.name} role="driver" uri={ride.avatarUrl} size={44} />
        <View style={styles.nameCol}>
          <Text style={styles.name} numberOfLines={1}>
            {ride.name}
          </Text>
          <View style={styles.subRow}>
            <Ionicons name="car-sport" size={13} color={colors.driver} />
            <Text style={styles.subText} numberOfLines={1}>
              {isOwn && isRider
                ? 'Your ride · switch to Driver to manage'
                : isOwn
                  ? 'Your ride'
                  : 'Driver · offering seats'}
            </Text>
          </View>
          <RatingSummary rating={ride.driverRating} style={styles.ratingRow} />
        </View>
        <Badge
          label={isFull ? 'Full' : `${ride.seats} seat${ride.seats === 1 ? '' : 's'} left`}
          tone={isFull ? 'danger' : 'driver'}
        />
      </View>

      <View style={styles.route}>
        <RouteLine pickup={ride.pickup?.label} destination={ride.destination} tint={colors.driver} />
      </View>

      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Ionicons name="time-outline" size={15} color={colors.textMuted} />
          <Text style={styles.metaText} numberOfLines={1}>
            {ride.departureTime}
          </Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name="people-outline" size={15} color={colors.textMuted} />
          <Text style={styles.metaText} numberOfLines={1}>
            {ride.pendingRequests.length} pending · {ride.matchedRiders.length} confirmed
          </Text>
        </View>
      </View>

      <View style={styles.actions}>
        <AppButton
          title="Details"
          variant="secondary"
          size="sm"
          onPress={onView}
          style={primaryAction ? styles.detailsButton : styles.flex}
        />
        {primaryAction}
      </View>
    </Card>
  );
}

function StatusPill({ icon, label, color }) {
  return (
    <View style={[styles.statusPill, { backgroundColor: `${color}26` }]}>
      <Ionicons name={icon} size={15} color={color} />
      <Text style={[styles.statusPillText, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nameCol: {
    flex: 1,
    marginLeft: spacing.md,
    marginRight: spacing.sm,
  },
  name: {
    ...typography.title,
    color: colors.text,
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  ratingRow: {
    marginTop: 3,
  },
  subText: {
    ...typography.caption,
    color: colors.textMuted,
    marginLeft: 5,
    flexShrink: 1,
  },
  route: {
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  metaRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    gap: 6,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    ...typography.label,
    color: colors.textMuted,
    marginLeft: 6,
    flexShrink: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  flex: {
    flex: 1,
  },
  detailsButton: {
    paddingHorizontal: spacing.xl,
  },
  statusPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  statusPillText: {
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 6,
  },
});
