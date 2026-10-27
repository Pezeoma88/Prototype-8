import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import Avatar from '../components/Avatar';
import AppButton from '../components/AppButton';
import Badge from '../components/Badge';
import FormSection from '../components/FormSection';
import InfoRow from '../components/InfoRow';
import ModeToggle from '../components/ModeToggle';
import RatingSummary from '../components/RatingSummary';
import ReviewList from '../components/ReviewList';
import DemoNetworkPanel from '../components/DemoNetworkPanel';
import { colors, gutter, radius, roleColor, spacing, typography } from '../theme/theme';

// Profile tab, laid out for the full Prototype 5 profile (photo, bio,
// vehicle, ratings, reviews). Photo, name, email, bio, and vehicle
// make/model are real, saved in Supabase and changed from Edit Profile.
// Ratings and reviews are the real ones riders left (driver_reviews):
// `myDriverRating` is { average, count }, null with none yet, or undefined
// when they couldn't be loaded; `myDriverReviews` is the list, or null.
//
// One profile works in both modes. The Mode card switches between Driver
// and Rider (App's activeMode) without signing out; the sections below
// follow the current mode: Vehicle, license, and reviews in Driver mode, a
// "Looking for a Ride" card in Rider mode. The vehicle stays saved either way.
export default function ProfileScreen({
  currentUser,
  activeMode,
  handleSetMode,
  handleStartEditProfile,
  handleOpenOnboarding,
  handleSignOut,
  myDriverRating,
  myDriverReviews,
}) {
  const isDriver = activeMode === 'driver';
  const tint = roleColor(activeMode);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {/* Hero */}
      <View style={styles.hero}>
        <View style={[styles.glow, { backgroundColor: `${tint}1F` }]} />
        <Avatar name={currentUser.name} role={activeMode} uri={currentUser.avatarUrl} size={96} ring />
        <Text style={styles.name} numberOfLines={2}>
          {currentUser.name}
        </Text>
        <Badge
          label={isDriver ? 'Driver' : 'Rider'}
          tone={isDriver ? 'driver' : 'rider'}
          style={styles.roleBadge}
        />
        {isDriver && <RatingSummary rating={myDriverRating} stars style={styles.ratingRow} />}
        <AppButton
          title="Edit Profile"
          icon="create-outline"
          variant="secondary"
          size="sm"
          onPress={handleStartEditProfile}
          style={styles.editButton}
        />
        <Text style={styles.editHint}>Change your photo, name, email, bio, and vehicle.</Text>
      </View>

      {/* Mode: switch Driver ↔ Rider without signing out */}
      <FormSection title="Mode" icon="swap-horizontal" tint={tint}>
        <Text style={styles.modeText}>
          You&apos;re using CarpoolBoard as a{' '}
          <Text style={[styles.modeStrong, { color: tint }]}>{isDriver ? 'Driver' : 'Rider'}</Text>.
          Your profile, rides, and requests stay the same in both modes.
        </Text>
        <ModeToggle activeMode={activeMode} onChange={handleSetMode} />
      </FormSection>

      {/* About */}
      <FormSection title="About" icon="person-circle-outline" tint={tint}>
        {currentUser.bio !== '' ? (
          <Text style={styles.bio}>{currentUser.bio}</Text>
        ) : (
          <PlaceholderText
            icon="add-circle-outline"
            text="Add a bio"
            detail="Tell riders and drivers a little about yourself."
            onPress={handleStartEditProfile}
          />
        )}
      </FormSection>

      {isDriver ? (
        <>
          {/* Vehicle (shown in Driver mode; saved on the profile in both modes) */}
          <FormSection title="Vehicle" icon="car-sport-outline" tint={tint}>
            {currentUser.vehicleMakeModel !== '' ? (
              <InfoRow icon="car-outline" label="Make/model" value={currentUser.vehicleMakeModel} />
            ) : (
              <PlaceholderText
                icon="add-circle-outline"
                text="Add your vehicle"
                detail="Your car’s make and model, so riders know what to look for."
                onPress={handleStartEditProfile}
              />
            )}
            <View style={styles.privacyRow}>
              <Ionicons name="lock-closed-outline" size={16} color={colors.textMuted} />
              <View style={styles.privacyText}>
                <Text style={styles.privacyTitle}>License plate</Text>
                <Text style={styles.privacyDetail}>
                  Not collected yet. Plates will only be shared with confirmed riders once
                  CarpoolBoard has secure sign-in.
                </Text>
              </View>
            </View>
          </FormSection>

          {/* Reviews (Driver only) */}
          <FormSection
            title="Reviews"
            icon="star-outline"
            tint={tint}
            right={<RatingSummary rating={myDriverRating} />}
          >
            {myDriverReviews !== null && myDriverReviews.length === 0 ? (
              <PlaceholderText
                icon="chatbubbles-outline"
                text="No reviews yet"
                detail="Riders with a confirmed seat can rate your ride once it departs."
              />
            ) : (
              <ReviewList reviews={myDriverReviews} currentUserId={currentUser.id} />
            )}
          </FormSection>
        </>
      ) : (
        /* Looking for a Ride (Rider only) */
        <FormSection title="Looking for a Ride" icon="walk" tint={tint}>
          <PlaceholderText
            icon="navigate-circle-outline"
            text="No ride posts yet"
            detail="Soon you’ll be able to post where you need to go and when."
          />
        </FormSection>
      )}

      {/* Account */}
      <FormSection title="Account" icon="settings-outline" tint={colors.textMuted}>
        <InfoRow icon="person-outline" label="Name" value={currentUser.name} />
        <InfoRow icon="mail-outline" label="Email" value={currentUser.email} divider />
        <InfoRow
          icon={isDriver ? 'car-sport-outline' : 'walk-outline'}
          label="Current mode"
          divider
          right={
            <View style={styles.rightAlign}>
              <Badge label={isDriver ? 'Driver' : 'Rider'} tone={isDriver ? 'driver' : 'rider'} />
            </View>
          }
        />
        {/* Reopens the first-time walkthrough (welcome, modes, profile). */}
        <Pressable
          onPress={handleOpenOnboarding}
          accessibilityRole="button"
          accessibilityLabel="App intro"
          accessibilityHint="Shows the CarpoolBoard walkthrough again"
          style={({ pressed }) => pressed && styles.introPressed}
        >
          <InfoRow
            icon="sparkles-outline"
            label="App intro"
            divider
            right={
              <View style={styles.rightAlign}>
                <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
              </View>
            }
          />
        </Pressable>
      </FormSection>

      <Text style={styles.disclaimer}>
        This account is a class-project prototype: it&apos;s saved in CarpoolBoard&apos;s shared
        database, with no password or real authentication yet.
      </Text>

      <AppButton title="Log Out" icon="log-out-outline" variant="destructive" onPress={handleSignOut} />

      {/* Development only: renders nothing in production builds. */}
      <View style={styles.devTools}>
        <DemoNetworkPanel />
      </View>
    </ScrollView>
  );
}

// Muted "nothing here yet" line used inside profile cards. With `onPress`
// it's tappable (e.g. "Add a bio" opens Edit Profile).
function PlaceholderText({ icon, text, detail, onPress }) {
  const body = (
    <>
      <View style={styles.placeholderIcon}>
        <Ionicons name={icon} size={18} color={colors.textMuted} />
      </View>
      <View style={styles.placeholderBody}>
        <Text style={styles.placeholderText}>{text}</Text>
        {detail ? <Text style={styles.placeholderDetail}>{detail}</Text> : null}
      </View>
    </>
  );
  if (!onPress) {
    return <View style={styles.placeholder}>{body}</View>;
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.placeholder, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  devTools: {
    marginTop: spacing.xxl,
  },
  content: {
    paddingHorizontal: gutter,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  hero: {
    alignItems: 'center',
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  glow: {
    position: 'absolute',
    top: 0,
    width: 180,
    height: 180,
    borderRadius: 90,
  },
  name: {
    ...typography.heading,
    color: colors.text,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  roleBadge: {
    alignSelf: 'center',
    marginTop: spacing.sm,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  editButton: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.xxl,
  },
  editHint: {
    ...typography.caption,
    color: colors.textFaint,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  placeholder: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  pressed: {
    opacity: 0.7,
  },
  bio: {
    ...typography.body,
    color: colors.text,
    lineHeight: 21,
  },
  placeholderIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  placeholderBody: {
    flex: 1,
  },
  placeholderText: {
    ...typography.bodyStrong,
    color: colors.textMuted,
  },
  placeholderDetail: {
    ...typography.caption,
    color: colors.textFaint,
    marginTop: 2,
    lineHeight: 17,
  },
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  privacyText: {
    flex: 1,
    marginLeft: 10,
  },
  privacyTitle: {
    ...typography.label,
    color: colors.text,
  },
  privacyDetail: {
    ...typography.caption,
    color: colors.textFaint,
    marginTop: 2,
  },
  modeText: {
    ...typography.body,
    color: colors.textMuted,
    lineHeight: 21,
    marginBottom: spacing.lg,
  },
  modeStrong: {
    fontWeight: '700',
  },
  rightAlign: {
    flex: 1,
    alignItems: 'flex-end',
  },
  introPressed: {
    opacity: 0.6,
  },
  disclaimer: {
    ...typography.caption,
    color: colors.textFaint,
    lineHeight: 17,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
});
