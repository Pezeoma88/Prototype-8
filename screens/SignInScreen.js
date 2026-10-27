import { StatusBar } from 'expo-status-bar';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@react-native-vector-icons/ionicons';
import AppButton from '../components/AppButton';
import Card from '../components/Card';
import Notice from '../components/Notice';
import TextField from '../components/TextField';
import { colors, gutter, radius, roleColor, roleSoftColor, spacing, typography } from '../theme/theme';

const ROLE_OPTIONS = [
  { key: 'driver', title: 'Driver', description: 'Offer seats in your car', icon: 'car-sport' },
  { key: 'rider', title: 'Rider', description: 'Find a seat or ask for one', icon: 'walk' },
];

// Sign-in screen: accounts are `profiles` rows in Supabase (no passwords).
// Email is the account identifier and the name only applies the first time
// an email is used. Driver/Rider is picked on every sign-in: it's the mode
// for this session, not a permanent account type. All state and the sign-in
// logic stay in App.js; this screen only renders them.
export default function SignInScreen({
  authEmailInput,
  setAuthEmailInput,
  matchingAuthAccount,
  authNameInput,
  setAuthNameInput,
  authRole,
  setAuthRole,
  authError,
  isSigningIn,
  handleSignIn,
}) {
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.brand}>
              <View style={styles.logo}>
                <Ionicons name="car-sport" size={30} color={colors.textOnAccent} />
              </View>
              <Text style={styles.title}>CarpoolBoard</Text>
              <Text style={styles.subtitle}>
                Drivers share open seats. Riders find a ride or ask for one.
              </Text>
            </View>

            <Card style={styles.card}>
              <TextField
                label="Email"
                icon="mail-outline"
                placeholder="e.g. jordan@example.edu"
                value={authEmailInput}
                onChangeText={setAuthEmailInput}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
              />

              {matchingAuthAccount ? (
                <Notice message={`Welcome back, ${matchingAuthAccount.name}!`} />
              ) : (
                <TextField
                  label="Your name"
                  icon="person-outline"
                  placeholder="e.g. Jordan Smith"
                  value={authNameInput}
                  onChangeText={setAuthNameInput}
                  returnKeyType="done"
                  onSubmitEditing={Keyboard.dismiss}
                />
              )}

              {/* Driver/Rider is how you're using CarpoolBoard right now, not
                  a permanent account type, so it's offered to new AND
                  returning users. */}
              <Text style={styles.label}>
                {matchingAuthAccount ? 'Continue as…' : 'Start as…'}
              </Text>
              <View style={styles.roleRow}>
                {ROLE_OPTIONS.map((option) => {
                  const isActive = authRole === option.key;
                  const tint = roleColor(option.key);
                  return (
                    <Pressable
                      key={option.key}
                      onPress={() => setAuthRole(option.key)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isActive }}
                      style={({ pressed }) => [
                        styles.roleTile,
                        isActive && { borderColor: tint, backgroundColor: roleSoftColor(option.key) },
                        pressed && styles.pressed,
                      ]}
                    >
                      <View style={styles.roleTop}>
                        <Ionicons name={option.icon} size={22} color={isActive ? tint : colors.textMuted} />
                        <Ionicons
                          name={isActive ? 'checkmark-circle' : 'ellipse-outline'}
                          size={18}
                          color={isActive ? tint : colors.textFaint}
                        />
                      </View>
                      <Text style={styles.roleTitle}>{option.title}</Text>
                      <Text style={styles.roleDescription}>{option.description}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.hint}>
                New here? Enter your name and pick how you&apos;ll start. Already signed up? Just
                enter the same email. One account works as both a Driver and a Rider, and you can
                switch anytime from Profile.
              </Text>

              {authError !== '' && <Notice message={authError} tone="danger" />}

              <AppButton
                title={isSigningIn ? 'Signing in…' : 'Continue'}
                icon={isSigningIn ? undefined : 'arrow-forward'}
                onPress={handleSignIn}
                loading={isSigningIn}
              />
            </Card>

            <View style={styles.disclaimer}>
              <Ionicons name="shield-outline" size={15} color={colors.textFaint} style={styles.disclaimerIcon} />
              <Text style={styles.disclaimerText}>
                This is a class-project prototype login: your name and email are saved to
                CarpoolBoard&apos;s shared database, with no password and no real security. Anyone who
                enters your email can sign in as you. Don&apos;t use a real/sensitive password anywhere
                here.
              </Text>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: gutter,
    paddingVertical: spacing.xxxl,
  },
  brand: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.display,
    color: colors.text,
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 21,
    marginTop: spacing.sm,
    maxWidth: 300,
  },
  card: {
    padding: spacing.xl,
  },
  label: {
    ...typography.label,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  roleRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  roleTile: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    padding: spacing.md,
  },
  pressed: {
    opacity: 0.8,
  },
  roleTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  roleTitle: {
    ...typography.bodyStrong,
    fontWeight: '700',
    color: colors.text,
  },
  roleDescription: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
    lineHeight: 16,
  },
  hint: {
    ...typography.caption,
    color: colors.textFaint,
    lineHeight: 17,
    marginBottom: spacing.lg,
  },
  disclaimer: {
    flexDirection: 'row',
    marginTop: spacing.xl,
    paddingHorizontal: spacing.xs,
  },
  disclaimerIcon: {
    marginRight: spacing.sm,
    marginTop: 1,
  },
  disclaimerText: {
    ...typography.caption,
    color: colors.textFaint,
    lineHeight: 17,
    flex: 1,
  },
});
