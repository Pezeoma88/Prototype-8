import { useRef } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@react-native-vector-icons/ionicons';
import Avatar from '../components/Avatar';
import Badge from '../components/Badge';
import Card from '../components/Card';
import AppButton from '../components/AppButton';
import EmptyState from '../components/EmptyState';
import ModeToggle from '../components/ModeToggle';
import SectionHeader from '../components/SectionHeader';
import SegmentedControl from '../components/SegmentedControl';
import Notice from '../components/Notice';
import RideCard from '../components/RideCard';
import RiderCard from '../components/RiderCard';
import RideFilterPanel from '../components/RideFilterPanel';
import { RIDE_SORT_OPTIONS } from '../lib/format';
import { DEFAULT_RIDE_FILTERS } from '../lib/rideFilters';
import { colors, gutter, radius, spacing, typography } from '../theme/theme';

// "Good morning" / "Good afternoon" / "Good evening" from the device clock.
function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

// Home tab: the shared CarpoolBoard. Shows a greeting, the Driver/Rider
// mode toggle, what CarpoolBoard is for, the role's main actions, then Available Rides (Driver offers, blue)
// and Riders Looking for a Ride (Rider requests, orange).
//
// Ride Details and the Offer a Ride / Need a Ride forms open in place of the
// board (App passes them in as ready-made elements). State and Supabase
// logic stay in App.js.
//
// This screen applies its own top safe-area inset (instead of App doing it)
// so the KeyboardAvoidingView measures its position from the top of the
// screen and lifts forms the right amount above the keyboard.
export default function HomeScreen({
  currentUser,
  activeMode,
  handleSetMode,
  drivers,
  sortedDrivers,
  riders,
  myRequestStatusByRideId,
  isBoardLoading,
  isRefreshing,
  boardError,
  handleRefresh,
  rideSortOrder,
  setRideSortOrder,
  filteredRiderRides,
  rideFilters,
  setRideFilters,
  handleViewRideDetails,
  handleQuickRequest,
  handleLeaveWaitlist,
  isAddingDriver,
  isAddingRider,
  handleAddDriver,
  handleNeedRide,
  isCurrentUserWaiting,
  handleOpenProfile,
  matchConfirmation,
  handleDismissMatchConfirmation,
  scrollViewRef,
  detailsView,
  rideForm,
  riderForm,
}) {
  // Y positions of the two board sections, so "Find a Ride" / "Find Riders"
  // can scroll straight to them.
  const ridesSectionY = useRef(0);
  const ridersSectionY = useRef(0);

  // Driver/Rider UI follows the session's activeMode, not profiles.role.
  const isDriver = activeMode === 'driver';
  const showRideForm = isDriver && isAddingDriver;
  const showRiderForm = !isDriver && isAddingRider;

  // Which view fills the screen. Used as the ScrollView key so switching
  // views (board ↔ details ↔ form) always starts at the top.
  let viewKey = 'board';
  if (matchConfirmation) viewKey = 'match';
  else if (detailsView) viewKey = 'details';
  else if (showRideForm) viewKey = 'rideForm';
  else if (showRiderForm) viewKey = 'riderForm';

  function scrollToY(y) {
    scrollViewRef.current?.scrollTo({ y: Math.max(0, y - spacing.md), animated: true });
  }

  const firstName = currentUser.name.trim().split(/\s+/)[0];

  // Rider mode searches/filters Available Rides; Driver mode keeps the plain
  // sort control.
  const visibleRides = isDriver ? sortedDrivers : filteredRiderRides;

  function handleChangeRideFilters(changes) {
    setRideFilters((current) => ({ ...current, ...changes }));
  }

  function handleClearRideFilters() {
    Keyboard.dismiss();
    setRideFilters(DEFAULT_RIDE_FILTERS);
  }

  function renderBoard() {
    return (
      <>
        {/* Greeting + avatar (tap → Profile tab) */}
        <View style={styles.greetingRow}>
          <View style={styles.greetingText}>
            <Text style={styles.greeting}>{getGreeting()},</Text>
            <Text style={styles.greetingName} numberOfLines={1}>
              {firstName}
            </Text>
          </View>
          <Pressable
            onPress={handleOpenProfile}
            accessibilityRole="button"
            accessibilityLabel="Open your profile"
            hitSlop={6}
          >
            <Avatar name={currentUser.name} role={activeMode} uri={currentUser.avatarUrl} size={46} ring />
          </Pressable>
        </View>

        {/* Which mode you're in, and the one-tap switch */}
        <ModeToggle activeMode={activeMode} onChange={handleSetMode} style={styles.modeToggle} />

        {/* What CarpoolBoard is for */}
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Where are you headed?</Text>
          <Text style={styles.heroText}>
            {isDriver
              ? 'Post where you’re going, when you’re leaving, and how many seats you have. Riders can request a seat.'
              : 'Browse rides drivers are offering, or let drivers know you’re looking for one.'}
          </Text>
        </View>

        {/* Main actions for this role */}
        <View style={styles.actionsRow}>
          {isDriver ? (
            <>
              <ActionTile
                icon="add-circle"
                title="Offer a Ride"
                subtitle="Share your open seats"
                filled
                onPress={handleAddDriver}
              />
              <ActionTile
                icon="people"
                title="Find Riders"
                subtitle={`${riders.length} looking now`}
                tint={colors.rider}
                onPress={() => scrollToY(ridersSectionY.current)}
              />
            </>
          ) : (
            <>
              <ActionTile
                icon="search"
                title="Find a Ride"
                subtitle={`${drivers.length} ride${drivers.length === 1 ? '' : 's'} posted`}
                filled
                onPress={() => scrollToY(ridesSectionY.current)}
              />
              <ActionTile
                icon="hand-left"
                title="Need a Ride?"
                subtitle={isCurrentUserWaiting ? 'You’re on the list' : 'Tell drivers'}
                tint={colors.rider}
                onPress={handleNeedRide}
              />
            </>
          )}
        </View>

        {/* Available Rides: Driver offers */}
        <View onLayout={(event) => (ridesSectionY.current = event.nativeEvent.layout.y)}>
          <SectionHeader
            title="Available Rides"
            role="driver"
            right={<Badge label={String(drivers.length)} tone="driver" />}
          />

          {!isDriver && drivers.length > 0 && (
            <RideFilterPanel
              filters={rideFilters}
              onChange={handleChangeRideFilters}
              onClear={handleClearRideFilters}
              resultCount={visibleRides.length}
              totalCount={drivers.length}
              style={styles.filters}
            />
          )}

          {isDriver && drivers.length > 1 && (
            <SegmentedControl
              options={RIDE_SORT_OPTIONS}
              value={rideSortOrder}
              onChange={setRideSortOrder}
              style={styles.sort}
            />
          )}

          {/* A failed load keeps any rides already shown; this just explains
              why they may be out of date. */}
          {boardError !== '' && <Notice message={boardError} tone="danger" />}

          {drivers.length === 0 && isBoardLoading ? (
            <Card style={styles.loadingCard}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.loadingText}>Loading rides…</Text>
            </Card>
          ) : drivers.length === 0 && boardError !== '' ? (
            <EmptyState
              icon="cloud-offline-outline"
              title="Rides couldn’t be loaded"
              message="Check your connection, then try again."
              actionLabel="Refresh"
              onAction={handleRefresh}
              style={styles.sectionGap}
            />
          ) : drivers.length === 0 ? (
            <EmptyState
              icon="car-outline"
              title="No rides available right now"
              message={
                isDriver
                  ? 'Be the first to offer one, or pull down to refresh.'
                  : 'Pull down to refresh, or tap Need a Ride? so drivers know you’re looking.'
              }
              actionLabel="Refresh"
              onAction={handleRefresh}
              style={styles.sectionGap}
            />
          ) : visibleRides.length === 0 ? (
            <EmptyState
              icon="search-outline"
              title="No rides match your search."
              message="Try another destination, date, or seat count."
              actionLabel="Clear Filters"
              onAction={handleClearRideFilters}
              style={styles.sectionGap}
            />
          ) : (
            <View style={styles.sectionGap}>
              {visibleRides.map((driver) => (
                <RideCard
                  key={driver.id}
                  ride={driver}
                  currentUser={currentUser}
                  activeMode={activeMode}
                  myRequestStatus={myRequestStatusByRideId[driver.id] || null}
                  onView={() => handleViewRideDetails(driver.id)}
                  onRequest={() => handleQuickRequest(driver.id)}
                />
              ))}
            </View>
          )}
        </View>

        {/* Riders Looking for a Ride: Rider requests */}
        <View onLayout={(event) => (ridersSectionY.current = event.nativeEvent.layout.y)}>
          <SectionHeader
            title="Riders Looking for a Ride"
            role="rider"
            right={<Badge label={String(riders.length)} tone="rider" />}
          />

          {riders.length === 0 ? (
            <EmptyState
              icon="walk-outline"
              title="No riders are looking right now"
              message={
                isDriver
                  ? 'When riders need transportation, they’ll show up here. Pull down to refresh.'
                  : 'Tap Need a Ride? to let drivers know you’re looking.'
              }
            />
          ) : (
            riders.map((rider) => (
              <RiderCard
                key={rider.id}
                rider={rider}
                // Your own waitlist entry stays yours in either mode, so you
                // can always take yourself off the list.
                isSelf={rider.id === currentUser.id}
                onRemove={() => handleLeaveWaitlist(rider.id)}
              />
            ))
          )}
        </View>
      </>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            key={viewKey}
            ref={scrollViewRef}
            style={styles.flex}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                tintColor={colors.primary}
                colors={[colors.primary]}
                progressBackgroundColor={colors.surface}
              />
            }
          >
            {matchConfirmation ? (
              /* Match Confirmed screen: shown after a rider is matched to a driver */
              <Card style={styles.matchCard}>
                <View style={styles.matchIcon}>
                  <Ionicons name="checkmark" size={30} color={colors.textOnAccent} />
                </View>
                <Text style={styles.matchTitle}>Ride Matched!</Text>
                <Text style={styles.matchText}>
                  {matchConfirmation.riderName} has been matched with {matchConfirmation.driverName}
                  ’s ride to {matchConfirmation.destination}, departing {matchConfirmation.departureTime}.
                </Text>
                <AppButton title="Back to Rides" onPress={handleDismissMatchConfirmation} style={styles.matchButton} />
              </Card>
            ) : detailsView ? (
              detailsView
            ) : showRideForm ? (
              rideForm
            ) : showRiderForm ? (
              riderForm
            ) : (
              renderBoard()
            )}
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// Large tappable action on the Home screen. `filled` = the role's primary
// action (solid blue); otherwise a dark tile with a colored icon.
function ActionTile({ icon, title, subtitle, tint = colors.primary, filled = false, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.tile,
        filled ? styles.tileFilled : styles.tileOutline,
        pressed && styles.tilePressed,
      ]}
    >
      <View style={[styles.tileIcon, { backgroundColor: filled ? colors.onAccentSoft : `${tint}29` }]}>
        <Ionicons name={icon} size={20} color={filled ? colors.textOnAccent : tint} />
      </View>
      <Text style={styles.tileTitle} numberOfLines={1}>
        {title}
      </Text>
      <Text style={[styles.tileSubtitle, filled && styles.tileSubtitleFilled]} numberOfLines={1}>
        {subtitle}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: gutter,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxxl,
  },

  // Greeting
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  greetingText: {
    flex: 1,
    marginRight: spacing.md,
  },
  greeting: {
    ...typography.body,
    color: colors.textMuted,
  },
  greetingName: {
    ...typography.heading,
    color: colors.text,
    marginTop: 2,
  },

  // Hero
  hero: {
    marginBottom: spacing.xl,
  },
  modeToggle: {
    marginBottom: spacing.xl,
  },
  heroTitle: {
    ...typography.display,
    color: colors.text,
    letterSpacing: -0.3,
  },
  heroText: {
    ...typography.body,
    color: colors.textMuted,
    lineHeight: 21,
    marginTop: spacing.sm,
  },

  // Action tiles
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xxl + spacing.xs,
  },
  tile: {
    flex: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  tileFilled: {
    backgroundColor: colors.primary,
  },
  tileOutline: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tilePressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  tileIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  tileTitle: {
    ...typography.bodyStrong,
    fontWeight: '700',
    color: colors.text,
  },
  tileSubtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  tileSubtitleFilled: {
    color: colors.textOnAccentMuted,
  },

  // Board sections
  sort: {
    marginBottom: spacing.md,
  },
  filters: {
    marginBottom: spacing.lg,
  },
  sectionGap: {
    marginBottom: spacing.xxl,
  },
  loadingCard: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    marginBottom: spacing.xxl,
  },
  loadingText: {
    ...typography.label,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },

  // Match confirmation
  matchCard: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  matchIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  matchTitle: {
    ...typography.heading,
    color: colors.text,
  },
  matchText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 21,
    marginTop: spacing.sm,
  },
  matchButton: {
    alignSelf: 'stretch',
    marginTop: spacing.xl,
  },
});
