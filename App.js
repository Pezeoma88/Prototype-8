import { useCallback, useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Alert, Keyboard, Linking, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from './lib/supabase';
import {
  BIO_MAX_LENGTH,
  EMAIL_PATTERN,
  MAX_SEATS,
  MIN_SEATS,
  NAME_MAX_LENGTH,
  VEHICLE_MAX_LENGTH,
  getDefaultDeparture,
  normalizeEmail,
} from './lib/format';
import {
  ACCOUNT_COLUMNS,
  BOARD_PROFILE_COLUMNS,
  buildDriversFromRows,
  getBoardAvatarUrl,
  profileToAccount,
} from './lib/board';
import { AvatarError, pickAvatarImage, uploadAvatar } from './lib/avatar';
import { isValidCoordinate } from './lib/pickupLocations';
import {
  getReviewEligibility,
  loadReviewData,
  submitDriverReview,
  toReviewDisplay,
} from './lib/reviews';
import {
  CONFIRM_CHECK_DELAYS_MS,
  confirmRideRequestOutcome,
  lookupRideRequest,
  submitRideRequest,
  withdrawRideRequest,
} from './lib/rideRequests';
import { DEFAULT_RIDE_FILTERS, filterAndSortRides } from './lib/rideFilters';
import { colors } from './theme/theme';
import TabBar from './components/TabBar';
import Toast from './components/Toast';
import { DemoNetworkBanner } from './components/DemoNetworkPanel';
import SignInScreen from './screens/SignInScreen';
import HomeScreen from './screens/HomeScreen';
import RideDetailsScreen from './screens/RideDetailsScreen';
import RideForm from './screens/RideForm';
import RiderWaitlistForm from './screens/RiderWaitlistForm';
import MapScreen from './screens/MapScreen';
import RequestsScreen from './screens/RequestsScreen';
import ProfileScreen from './screens/ProfileScreen';
import EditProfileScreen from './screens/EditProfileScreen';
import OnboardingScreen from './screens/OnboardingScreen';

// Phase 1A layout: constants/helpers live in lib/format.js and lib/board.js,
// screens live in screens/, shared UI in components/, and design tokens in
// theme/theme.js. All app state and Supabase logic stay here in App.js and
// are passed down to the screens as props.

// This is the home screen for CarpoolBoard.
// Drivers can be added (with a name and seat count), riders can ask for a ride,
// and a waiting rider can be matched to a driver's open seat.
//
// Prototype 4: the board is persisted in Supabase. `profiles` holds accounts,
// `rides` holds posted rides, and `ride_requests` holds each rider's request
// (pending / accepted / denied / cancelled). The app reloads the whole board
// from Supabase on launch, on pull-to-refresh, and after every change, then
// rebuilds the same `drivers` / `riders` shapes the UI rendered before.
export default function App() {
  // The list of drivers (posted rides), rebuilt from Supabase on every load.
  // Each driver is an object like
  // { id, driverAccountId, name, destination, pickup, departureAt,
  //   departureTime, totalSeats, seats, matchedRiders, pendingRequests }.
  // pickup is { latitude, longitude, label } or null when the ride has none.
  // destinationPoint has the same shape: the optional mapped destination,
  // separate from the typed `destination` text.
  // id is the ride's Supabase UUID; departureAt is a Date and departureTime
  // its display string. seats is the number of AVAILABLE seats
  // (totalSeats - accepted requests), so it only goes down on Accept.
  // matchedRiders collects { id, requestId, name } for every confirmed passenger on this ride.
  // pendingRequests collects { id, riderId, name, reason } for requests the driver hasn't answered yet.
  const [drivers, setDrivers] = useState([]);

  // True until the first Supabase load finishes, so the empty state isn't
  // shown before we actually know the board is empty.
  const [isBoardLoading, setIsBoardLoading] = useState(true);
  // True while a pull-to-refresh reload is running.
  const [isRefreshing, setIsRefreshing] = useState(false);
  // The last load error, if any. Already-loaded rides stay on screen.
  const [boardError, setBoardError] = useState('');

  // The signed-in account (the PERSON): { id, name, email, legacyRole, bio,
  // vehicleMakeModel, avatarPath }, or null when signed out. id is the profile's stable Supabase UUID and never
  // changes, whichever mode the person is using. This is a prototype, NOT
  // secure production authentication — there's no password and no Supabase
  // Auth. The email is the account's identifier (case-insensitive): "signing
  // up" creates a `profiles` row with a name + email + starting role, and
  // "logging in" again with the same email restores that same profile.
  const [currentUser, setCurrentUser] = useState(null);

  // How the signed-in person is using CarpoolBoard right now: 'driver' or
  // 'rider' (null when signed out). Chosen on the sign-in screen and switched
  // from Profile. It lives only in this app session and is never written to
  // Supabase: profiles.role is kept as legacy data (the role picked at
  // sign-up) and doesn't decide what the person can do.
  const [activeMode, setActiveMode] = useState(null);

  // True while a Continue press is talking to Supabase.
  const [isSigningIn, setIsSigningIn] = useState(false);

  // The existing profile matching the email typed on the sign-in screen (or
  // null), looked up in Supabase shortly after the user stops typing.
  const [matchingAuthAccount, setMatchingAuthAccount] = useState(null);

  // The current text typed into the sign-in form, and the Driver/Rider
  // toggle. The name is only used when the email doesn't match an existing
  // account; the toggle always picks the mode to sign in with (and, for a
  // new account, is also saved as its starting profiles.role).
  const [authNameInput, setAuthNameInput] = useState('');
  const [authEmailInput, setAuthEmailInput] = useState('');
  const [authRole, setAuthRole] = useState('driver');
  const [authError, setAuthError] = useState('');

  // Edit Profile: whether the form is open on the Profile tab, the text in
  // its inputs (pre-filled from currentUser when it opens), and the last
  // validation/save error. Saving updates the SAME profiles row, so the
  // profile id, its rides/requests, and activeMode never change.
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  // Whether the full-screen onboarding is showing (see startOnboarding).
  // Session-only like activeMode: it opens automatically only right after a
  // sign-in that created a new profile, so returning users never see it
  // unless they choose "App intro" in Profile.
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [profileNameInput, setProfileNameInput] = useState('');
  const [profileEmailInput, setProfileEmailInput] = useState('');
  const [profileBioInput, setProfileBioInput] = useState('');
  const [profileVehicleInput, setProfileVehicleInput] = useState('');
  const [profileFormError, setProfileFormError] = useState('');
  // True while a Save press is talking to Supabase (blocks double-taps).
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  // A new profile photo picked in Edit Profile but not saved yet:
  // { uri, mimeType } of the local cropped image, or null to keep the
  // current photo. It's only uploaded when Save Changes is pressed.
  const [profilePhotoDraft, setProfilePhotoDraft] = useState(null);
  // True while the photo library is open (blocks opening it twice).
  const [isPickingPhoto, setIsPickingPhoto] = useState(false);
  // A problem with the picked photo (wrong format, too big), shown under it.
  const [profilePhotoError, setProfilePhotoError] = useState('');

  // The floating confirmation currently showing (e.g. "Profile saved"):
  // { id, title, message, tone }, or null. Each one gets a new id so the
  // same message shown twice in a row still appears again.
  const [toast, setToast] = useState(null);
  const toastIdRef = useRef(0);

  // Spike: a short message about the last request action (or why one was blocked).
  const [requestNotice, setRequestNotice] = useState('');

  // Whether the "Add Driver" form is currently showing.
  const [isAddingDriver, setIsAddingDriver] = useState(false);

  // The id of the ride being edited in the Post Ride form, or null when the
  // form is posting a new ride.
  const [editingRideId, setEditingRideId] = useState(null);

  // The current text typed into the form's inputs. The driver's name isn't
  // one of them: it comes from the signed-in account when the ride is posted.
  const [destinationInput, setDestinationInput] = useState('');
  // New rides start at the minimum seat count; the form's stepper adjusts it.
  const [seatsInput, setSeatsInput] = useState(String(MIN_SEATS));
  // The pickup spot chosen in the form: { latitude, longitude, label } from
  // the preset list (lib/pickupLocations.js), or null for no pickup spot.
  // Required to post or save a ride (checked in handleSaveDriver).
  const [pickupInput, setPickupInput] = useState(null);
  // The mapped destination chosen in the form, in the same shape, from the
  // preset list (lib/destinationLocations.js), or null for none. Optional:
  // without one (or without a pickup spot) the Map tab has no route to draw.
  const [destinationPointInput, setDestinationPointInput] = useState(null);

  // The departure picked on the date/time wheels (a Date), or null until the
  // driver picks one. Saved to Supabase as rides.departure_at.
  const [departureAtInput, setDepartureAtInput] = useState(null);
  // When editing, the ride's original departure, so an unchanged (possibly
  // already-past) departure doesn't block saving other edits.
  const [originalDepartureAt, setOriginalDepartureAt] = useState(null);
  // Which wheel is open: 'date', 'time', or null when neither is showing.
  const [departurePickerMode, setDeparturePickerMode] = useState(null);

  // A validation message to show under the form, if something is wrong.
  const [formError, setFormError] = useState('');

  // How Available Rides is ordered: 'default' (posting order) or 'destination'.
  const [rideSortOrder, setRideSortOrder] = useState('default');

  // Rider mode's search, date, seat, and sort choices for Available Rides
  // (lib/rideFilters.js). Kept here so they survive switching tabs.
  const [rideFilters, setRideFilters] = useState(DEFAULT_RIDE_FILTERS);

  // True while a Post Ride press is being handled, so a fast double-tap
  // can't post the same ride twice before the form has a chance to close.
  const [isSubmittingDriver, setIsSubmittingDriver] = useState(false);

  // The ride Supabase just confirmed saving, shown on the "Ride posted"
  // screen in place of the form: { destination, departureAt, seats,
  // wasEdit, canEdit }, or null while the form itself is showing. canEdit is
  // false if Supabase didn't return the new ride's id, which hides "Edit ride
  // details". The form's values are kept underneath so that button reopens
  // them.
  const [rideConfirmation, setRideConfirmation] = useState(null);

  // Lets us scroll back to the top (Available Rides) after saving a ride.
  const scrollViewRef = useRef(null);

  // Riders who joined Looking for a Ride on this device without sending a
  // request yet: { id, name }. There's no Supabase table for the waiting
  // list itself, so these entries last only for this app session. Riders
  // with a pending request are rebuilt from Supabase instead (see `riders`).
  const [localWaitingRiders, setLocalWaitingRiders] = useState([]);

  // Every request row with status pending/accepted, from the last load. Used
  // to rebuild Looking for a Ride.
  const [activeRequestRows, setActiveRequestRows] = useState([]);
  // Profiles referenced by the loaded rides/requests, keyed by id.
  const [profilesById, setProfilesById] = useState({});

  // The signed-in person's own request rows in EVERY status, from the last
  // load. The board only loads pending/accepted, but a denied or cancelled
  // request is final for that ride, so the app has to know about those too.
  const [myRequestRows, setMyRequestRows] = useState([]);
  // The signed-in profile id, readable from loadBoard (which is created once
  // and so can't see the latest currentUser). Set on sign-in and sign-out.
  const currentUserIdRef = useRef(null);
  // My request status per ride id: 'pending', 'accepted', 'denied', or
  // 'cancelled' (missing when I've never requested that ride).
  const myRequestStatusByRideId = Object.fromEntries(
    myRequestRows.map((row) => [row.ride_id, row.status])
  );

  // Driver reviews from the last load (lib/reviews.js): every review of the
  // drivers on the board and of the signed-in person, plus every review the
  // signed-in person wrote. null when they couldn't be loaded, so screens
  // can say so instead of showing "No reviews yet".
  const [reviewRows, setReviewRows] = useState(null);
  // Review count and average per driver id ({ average, count }), or null
  // when they couldn't be loaded. A driver with no reviews isn't in it.
  const [ratingSummaries, setRatingSummaries] = useState(null);
  // The signed-in person's own review per ride id, from reviewRows.
  const myReviewByRideId = {};
  if (reviewRows && currentUser) {
    for (const row of reviewRows) {
      if (row.rider_id === currentUser.id && row.ride_id) {
        myReviewByRideId[row.ride_id] = row;
      }
    }
  }

  // Guards against a fast double-tap firing the same Supabase change twice.
  const isBoardActionRunningRef = useRef(false);

  // Looking for a Ride, rebuilt as { id, name, avatarUrl }: everyone with a
  // pending request in Supabase, plus anyone who joined on this device, minus
  // anyone who already has a confirmed (accepted) seat. The signed-in
  // person's photo comes from currentUser, so a new photo shows right away.
  const confirmedRiderIds = new Set(
    activeRequestRows.filter((req) => req.status === 'accepted').map((req) => req.rider_id)
  );
  const getRiderAvatarUrl = (riderId) =>
    currentUser && currentUser.id === riderId
      ? currentUser.avatarUrl
      : getBoardAvatarUrl(profilesById, riderId);
  const riders = [];
  for (const req of activeRequestRows) {
    if (req.status === 'pending' && !riders.some((r) => r.id === req.rider_id)) {
      riders.push({
        id: req.rider_id,
        name: profilesById[req.rider_id]?.name || 'Unknown rider',
        avatarUrl: getRiderAvatarUrl(req.rider_id),
      });
    }
  }
  for (const rider of localWaitingRiders) {
    if (!riders.some((r) => r.id === rider.id)) {
      riders.push({ ...rider, avatarUrl: getRiderAvatarUrl(rider.id) });
    }
  }
  for (let i = riders.length - 1; i >= 0; i -= 1) {
    if (confirmedRiderIds.has(riders[i].id)) {
      riders.splice(i, 1);
    }
  }

  // Whether the "Request a Ride" panel is currently showing. The rider's
  // name comes from their signed-in account, so the panel has no inputs.
  const [isAddingRider, setIsAddingRider] = useState(false);

  // The id of the ride whose request-confirm panel is open, or null if none.
  const [reservingDriverId, setReservingDriverId] = useState(null);

  // The optional message a rider types to explain why they need a ride,
  // shown to the driver alongside their Pending request.
  const [requestReasonInput, setRequestReasonInput] = useState('');

  // Submit Ride Request, the operation that completes later. null when
  // nothing is in progress or waiting to be read; otherwise
  // { rideId, riderId, reason, phase, ... } where phase is one of
  // submitting / checking / success / arrived / existing / refused /
  // not_found / unknown / withdrawing (described in RequestSubmissionPanel).
  // It lives here rather than in Ride Details so the outcome survives
  // leaving that screen and is still there when the rider comes back.
  const [requestSubmission, setRequestSubmission] = useState(null);
  // Counts submission "attempts". Every piece of async work remembers the
  // number it started with and drops its result if the number has moved on
  // (the rider abandoned, retried, left, switched mode, or signed out), so
  // a late answer can never show a stale message.
  const submissionAttemptRef = useRef(0);
  // The AbortController of the submission currently waiting on the server,
  // or null. Also the guard against a double-tap sending twice.
  const submissionAbortRef = useRef(null);

  // Which bottom tab is showing: 'home', 'map', 'requests', or 'profile'.
  // The Profile tab replaces Prototype 4's Profile overlay.
  const [activeTab, setActiveTab] = useState('home');

  // Details of the most recently confirmed match, or null when no confirmation is showing.
  // Shape: { riderName, driverName, destination, departureTime }.
  const [matchConfirmation, setMatchConfirmation] = useState(null);

  // The id of the driver whose Ride Details screen is currently open, or null if none.
  const [selectedRideDriverId, setSelectedRideDriverId] = useState(null);

  // Loads the whole board from Supabase: rides, their pending/accepted
  // requests, and the profiles those rows point at. On failure the rides
  // already on screen are kept and an error message is shown instead.
  const loadBoard = useCallback(async () => {
    try {
      const { data: rideRows, error: ridesError } = await supabase
        .from('rides')
        .select(
          'id, driver_id, destination, departure_at, seat_count, created_at, pickup_lat, pickup_lng, pickup_label, destination_lat, destination_lng, destination_label'
        )
        .order('created_at', { ascending: true })
        .order('id', { ascending: true });
      if (ridesError) throw ridesError;

      const { data: requestRows, error: requestsError } = await supabase
        .from('ride_requests')
        .select('id, ride_id, rider_id, reason, status, created_at')
        .in('status', ['pending', 'accepted'])
        .order('created_at', { ascending: true });
      if (requestsError) throw requestsError;

      // Reviews are an add-on: if they can't be loaded, the board still
      // loads and screens show that reviews are unavailable.
      const myProfileId = currentUserIdRef.current;
      let reviewData = null;
      try {
        reviewData = await loadReviewData({
          driverIds: rideRows.map((ride) => ride.driver_id),
          myProfileId,
        });
      } catch (error) {
        console.warn('CarpoolBoard: failed to load driver reviews', error);
      }

      const profileIds = [
        ...new Set([
          ...rideRows.map((ride) => ride.driver_id),
          ...requestRows.map((req) => req.rider_id),
          // Review authors, so reviews can show who wrote them.
          ...(reviewData ? reviewData.reviewRows.map((row) => row.rider_id) : []),
        ]),
      ];
      let profileMap = {};
      if (profileIds.length > 0) {
        // Only what the board shows (name + photo): other people's emails
        // aren't needed.
        const { data: profileRows, error: profilesError } = await supabase
          .from('profiles')
          .select(BOARD_PROFILE_COLUMNS)
          .in('id', profileIds);
        if (profilesError) throw profilesError;
        profileMap = Object.fromEntries(profileRows.map((row) => [row.id, row]));
      }

      // The signed-in person's own requests, including denied/cancelled.
      let myRows = [];
      if (myProfileId) {
        const { data: myRequestData, error: myRequestsError } = await supabase
          .from('ride_requests')
          .select('id, ride_id, rider_id, reason, status, created_at')
          .eq('rider_id', myProfileId)
          .order('created_at', { ascending: false });
        if (myRequestsError) throw myRequestsError;
        myRows = myRequestData;
      }
      // Skip if someone else signed in (or out) while this was loading.
      if (currentUserIdRef.current === myProfileId) {
        setMyRequestRows(myRows);
      }

      setProfilesById(profileMap);
      setActiveRequestRows(requestRows);
      setReviewRows(reviewData ? reviewData.reviewRows : null);
      setRatingSummaries(reviewData ? reviewData.ratingSummaries : null);
      setDrivers(
        buildDriversFromRows(
          rideRows,
          requestRows,
          profileMap,
          reviewData ? reviewData.ratingSummaries : null
        )
      );
      setBoardError('');
      return true;
    } catch (error) {
      console.warn('CarpoolBoard: failed to load board from Supabase', error);
      setBoardError("Couldn't load rides from the server. Pull down to try again.");
      return false;
    } finally {
      setIsBoardLoading(false);
    }
  }, []);

  // Restore the board from Supabase as soon as CarpoolBoard launches.
  useEffect(() => {
    loadBoard();
  }, [loadBoard]);

  // Pull-to-refresh: fetch the latest board without restarting the app.
  async function handleRefresh() {
    setIsRefreshing(true);
    await loadBoard();
    setIsRefreshing(false);
  }

  // Runs one Supabase change at a time (ignoring double-taps), then reloads
  // the board so the UI always reflects what's actually stored.
  async function runBoardAction(action) {
    if (isBoardActionRunningRef.current) {
      return;
    }
    isBoardActionRunningRef.current = true;
    try {
      await action();
    } finally {
      isBoardActionRunningRef.current = false;
      await loadBoard();
    }
  }

  // Looks up a profile by email (case-insensitive, via normalizeEmail).
  // Returns the account or null; throws on a network/database error.
  async function findProfileByEmail(email) {
    const { data, error } = await supabase
      .from('profiles')
      .select(ACCOUNT_COLUMNS)
      .eq('email', normalizeEmail(email))
      .limit(1);
    if (error) throw error;
    return data.length > 0 ? profileToAccount(data[0]) : null;
  }

  // Live-matches the sign-in email field against existing profiles in
  // Supabase, so the form can show a "welcome back" notice and skip the
  // name field before the user even presses Continue. The lookup waits
  // until typing pauses, and ignores results for an email that's since changed.
  const trimmedAuthEmail = normalizeEmail(authEmailInput);
  useEffect(() => {
    setMatchingAuthAccount(null);
    if (currentUser !== null || !EMAIL_PATTERN.test(trimmedAuthEmail)) {
      return undefined;
    }
    let isStale = false;
    const timer = setTimeout(() => {
      findProfileByEmail(trimmedAuthEmail)
        .then((account) => {
          if (!isStale) setMatchingAuthAccount(account);
        })
        .catch(() => {
          // Continue will retry the lookup and report any real error.
        });
    }, 400);
    return () => {
      isStale = true;
      clearTimeout(timer);
    };
  }, [trimmedAuthEmail, currentUser]);

  // Runs when the user presses "Continue" on the sign-in screen. An email
  // that matches an existing profile logs back into that same profile; a new
  // email requires a name to create a new profile in Supabase. Either way,
  // the Driver/Rider choice becomes activeMode. Email (not name) is the
  // account identifier, so one person has one profile in both modes.
  async function handleSignIn() {
    if (isSigningIn) {
      return;
    }
    const trimmedName = authNameInput.trim();
    // Normalized so lookup and insert both use the lowercase form Supabase
    // requires. The text field itself still shows what the user typed.
    const trimmedEmail = normalizeEmail(authEmailInput);

    if (trimmedEmail === '') {
      setAuthError('Please enter your email address.');
      return;
    }
    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setAuthError('Please enter a valid email address.');
      return;
    }

    setIsSigningIn(true);
    try {
      let account = await findProfileByEmail(trimmedEmail);
      // True only when this sign-in inserted the profile, which is what
      // makes someone a first-time user and shows them onboarding.
      let isNewProfile = false;

      if (!account) {
        if (trimmedName === '') {
          setAuthError('Please enter your name.');
          return;
        }
        const { data, error } = await supabase
          .from('profiles')
          .insert({ name: trimmedName, email: trimmedEmail, role: authRole })
          .select(ACCOUNT_COLUMNS)
          .single();
        if (error) {
          // 23505 = unique violation: the email was registered in the
          // meantime (e.g. from another phone), so just log into that one.
          if (error.code === '23505') {
            account = await findProfileByEmail(trimmedEmail);
          }
          if (!account) throw error;
        } else {
          account = profileToAccount(data);
          isNewProfile = true;
        }
      }

      currentUserIdRef.current = account.id;
      setCurrentUser(account);
      setActiveMode(authRole);
      if (isNewProfile) {
        startOnboarding(account);
      }
      setAuthNameInput('');
      setAuthEmailInput('');
      setAuthError('');
      loadBoard();
    } catch (error) {
      console.warn('CarpoolBoard: sign-in failed', error);
      setAuthError("Couldn't reach CarpoolBoard's server. Check your connection and try again.");
    } finally {
      setIsSigningIn(false);
    }
  }

  // Signs the current account out. The shared board (drivers/riders) is left
  // untouched so the next person to sign in still sees the same board.
  function handleSignOut() {
    // Stop and forget any ride request in flight: there's no one left to
    // show its outcome to. If it reached the server, the next sign-in shows
    // it as Pending straight from Supabase.
    resetRequestSubmission();
    currentUserIdRef.current = null;
    setMyRequestRows([]);
    setCurrentUser(null);
    setActiveMode(null);
    setIsOnboarding(false);
    resetProfileForm();
    resetForm();
    setIsAddingRider(false);
    setSelectedRideDriverId(null);
    setReservingDriverId(null);
    setRequestNotice('');
    setRideFilters(DEFAULT_RIDE_FILTERS);
    setToast(null);
    setActiveTab('home');
  }

  // Shows a short floating confirmation (see components/Toast.js).
  function showToast(title, message = '', tone = 'success') {
    toastIdRef.current += 1;
    setToast({ id: toastIdRef.current, title, message, tone });
  }

  // Puts the signed-in person in Driver or Rider mode ('driver' / 'rider')
  // without signing out, then confirms it with a toast. Picking the mode
  // that's already active does nothing. Only the session's activeMode
  // changes: the profile, its id, and every ride/request stay exactly as
  // they are in Supabase. Any half-finished mode-specific panel (Offer a
  // Ride form, Need a Ride panel, request-confirm panel) is closed so the
  // new mode starts clean. An open Ride Details screen stays open, so
  // "Switch to Driver to manage" lands right on the ride's driver controls.
  function handleSetMode(mode) {
    if (!currentUser || (mode !== 'driver' && mode !== 'rider') || mode === activeMode) {
      return;
    }
    Keyboard.dismiss();
    resetForm();
    setIsAddingRider(false);
    setReservingDriverId(null);
    setRequestReasonInput('');
    setRequestNotice('');
    // A ride request still in flight is dropped along with its messages, so
    // nothing from Rider mode can pop up in Driver mode. The reload shows
    // whatever actually reached the server.
    if (requestSubmission !== null) {
      resetRequestSubmission();
      loadBoard();
    }
    setActiveMode(mode);
    showToast(
      mode === 'driver' ? 'Driver mode on' : 'Rider mode on',
      mode === 'driver'
        ? 'Offer rides and manage requests for your rides.'
        : 'Browse rides and request a seat.',
      mode
    );
  }

  // Flips to the other mode. Takes no arguments, so it can be passed
  // straight to a button's onPress (as Ride Details does).
  function handleSwitchMode() {
    handleSetMode(activeMode === 'driver' ? 'rider' : 'driver');
  }

  // Opens the 3-step onboarding with its optional profile step filled in
  // from `account`'s saved values (Edit Profile's form state is reused, so
  // nothing starts blank). Called after a sign-in that created a new
  // profile, and from Profile's "App intro" row.
  function startOnboarding(account) {
    Keyboard.dismiss();
    resetProfileForm();
    setProfileNameInput(account.name);
    setProfileEmailInput(account.email);
    setProfileBioInput(account.bio);
    setProfileVehicleInput(account.vehicleMakeModel);
    setIsOnboarding(true);
  }

  function handleOpenOnboarding() {
    if (currentUser) {
      startOnboarding(currentUser);
    }
  }

  // Ends onboarding. With `saveProfile`, the profile step is saved through
  // handleSaveProfile first, and onboarding stays open (showing its error)
  // if that fails. Then the chosen mode is applied with the same logic as
  // the Driver/Rider toggle, and Home opens.
  async function handleFinishOnboarding(mode, saveProfile) {
    if (isSavingProfile) {
      return;
    }
    if (saveProfile) {
      const saved = await handleSaveProfile();
      if (!saved) {
        return;
      }
    } else {
      resetProfileForm();
    }
    setIsOnboarding(false);
    handleLeaveRequestSubmission();
    setActiveTab('home');
    handleSetMode(mode);
  }

  // Opens Edit Profile with the current saved values filled in.
  function handleStartEditProfile() {
    if (!currentUser) {
      return;
    }
    setProfileNameInput(currentUser.name);
    setProfileEmailInput(currentUser.email);
    setProfileBioInput(currentUser.bio);
    setProfileVehicleInput(currentUser.vehicleMakeModel);
    setProfileFormError('');
    setIsEditingProfile(true);
  }

  // Closes Edit Profile and throws away anything typed but not saved.
  function resetProfileForm() {
    setIsEditingProfile(false);
    setProfileNameInput('');
    setProfileEmailInput('');
    setProfileBioInput('');
    setProfileVehicleInput('');
    setProfileFormError('');
    setIsSavingProfile(false);
    setProfilePhotoDraft(null);
    setProfilePhotoError('');
  }

  // Edit Profile's photo button: asks for photo-library access, opens the
  // library with a square crop, and keeps the picked photo as an unsaved
  // preview. Cancelling the library leaves the current photo as it is.
  async function handlePickProfilePhoto() {
    if (isPickingPhoto || isSavingProfile) {
      return;
    }
    Keyboard.dismiss();
    setIsPickingPhoto(true);
    setProfilePhotoError('');
    try {
      const result = await pickAvatarImage();
      if (result.denied) {
        Alert.alert(
          'Photo access is off',
          result.canAskAgain
            ? 'CarpoolBoard needs access to your photos to choose a profile picture.'
            : 'To choose a profile picture, allow photo access for this app in Settings.',
          result.canAskAgain
            ? [{ text: 'OK' }]
            : [
                { text: 'Not Now', style: 'cancel' },
                { text: 'Open Settings', onPress: () => Linking.openSettings() },
              ]
        );
        return;
      }
      if (result.image) {
        setProfilePhotoDraft(result.image);
      }
    } catch (error) {
      if (error instanceof AvatarError) {
        setProfilePhotoError(error.message);
      } else {
        console.warn('CarpoolBoard: picking a photo failed', error);
        setProfilePhotoError("Couldn't open that photo. Please try another one.");
      }
    } finally {
      setIsPickingPhoto(false);
    }
  }

  // Throws away a picked-but-unsaved photo, going back to the current one.
  function handleDiscardProfilePhoto() {
    setProfilePhotoDraft(null);
    setProfilePhotoError('');
  }

  // Saves Edit Profile by updating the signed-in person's existing profiles
  // row (matched by id) — never by inserting a new one, so the profile id
  // and every ride/request pointing at it stay the same. A changed email is
  // normalized and checked for duplicates first; once saved, the new email
  // is what signs this profile in, and the old one no longer matches it.
  // A newly picked photo is uploaded to Storage and its path saved in
  // avatar_path. activeMode is not touched. An empty bio/vehicle is saved
  // as NULL. Resolves to true once Supabase confirms the save (onboarding
  // waits on this before opening Home), false otherwise.
  async function handleSaveProfile() {
    if (isSavingProfile || !currentUser) {
      return false;
    }

    const trimmedName = profileNameInput.trim();
    const newEmail = normalizeEmail(profileEmailInput);
    const trimmedBio = profileBioInput.trim();
    const trimmedVehicle = profileVehicleInput.trim();

    if (trimmedName === '') {
      setProfileFormError('Please enter your name.');
      return false;
    }
    if (trimmedName.length > NAME_MAX_LENGTH) {
      setProfileFormError(`Your name can be at most ${NAME_MAX_LENGTH} characters.`);
      return false;
    }
    if (newEmail === '') {
      setProfileFormError('Please enter your email address.');
      return false;
    }
    if (!EMAIL_PATTERN.test(newEmail)) {
      setProfileFormError('Please enter a valid email address.');
      return false;
    }
    if (trimmedBio.length > BIO_MAX_LENGTH) {
      setProfileFormError(`Your bio can be at most ${BIO_MAX_LENGTH} characters.`);
      return false;
    }
    if (trimmedVehicle.length > VEHICLE_MAX_LENGTH) {
      setProfileFormError(`Vehicle make/model can be at most ${VEHICLE_MAX_LENGTH} characters.`);
      return false;
    }

    const duplicateEmailMessage = 'That email is already used by another CarpoolBoard account.';

    setIsSavingProfile(true);
    setProfileFormError('');
    try {
      if (newEmail !== currentUser.email) {
        const existing = await findProfileByEmail(newEmail);
        if (existing && existing.id !== currentUser.id) {
          setProfileFormError(duplicateEmailMessage);
          return false;
        }
      }

      const updates = {
        name: trimmedName,
        email: newEmail,
        bio: trimmedBio || null,
        vehicle_make_model: trimmedVehicle || null,
      };

      // A newly picked photo is uploaded first. avatar_path is only changed
      // once the upload has succeeded, so a failed upload never leaves the
      // profile pointing at a missing file. With no new photo, avatar_path
      // isn't sent at all and the current photo stays.
      if (profilePhotoDraft) {
        try {
          updates.avatar_path = await uploadAvatar(currentUser.id, profilePhotoDraft);
        } catch (uploadError) {
          console.warn('CarpoolBoard: uploading profile photo failed', uploadError);
          setProfileFormError(
            uploadError instanceof AvatarError
              ? uploadError.message
              : "Couldn't upload your photo, so nothing was saved. Check your connection and try again."
          );
          return false;
        }
      }

      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', currentUser.id)
        .select(ACCOUNT_COLUMNS);
      if (error) {
        // 23505 = unique violation: the email was taken in the meantime
        // (e.g. from another phone). The unique constraint is the backstop.
        if (error.code === '23505') {
          setProfileFormError(duplicateEmailMessage);
          return false;
        }
        throw error;
      }
      if (!data || data.length === 0) {
        throw new Error('No profile was updated.');
      }

      const updatedAccount = profileToAccount(data[0]);
      const emailChanged = updatedAccount.email !== currentUser.email;
      setCurrentUser(updatedAccount);
      // Waitlist entries added on this device keep their own copy of the name.
      setLocalWaitingRiders((current) =>
        current.map((rider) =>
          rider.id === updatedAccount.id ? { ...rider, name: updatedAccount.name } : rider
        )
      );
      Keyboard.dismiss();
      resetProfileForm();
      // Only shown once Supabase has confirmed the update. A changed email
      // is called out, because it's now the one that signs this profile in.
      showToast(
        'Profile saved',
        emailChanged
          ? `Next time, sign in with ${updatedAccount.email}.`
          : 'Your changes are live on your profile.'
      );
      // Rides and requests show names and photos from profiles, so reload
      // the board to show a changed name/photo everywhere.
      loadBoard();
      return true;
    } catch (error) {
      console.warn('CarpoolBoard: saving profile failed', error);
      setProfileFormError("Couldn't save your profile. Check your connection and try again.");
      return false;
    } finally {
      setIsSavingProfile(false);
    }
  }

  // Opens the Offer a Ride form.
  function handleAddDriver() {
    setIsAddingDriver(true);
  }

  // Opens the same Post Ride form pre-filled with one of the signed-in
  // driver's rides, so they can change its destination, departure, or seats.
  function handleStartEditRide(driverId) {
    const driver = drivers.find((d) => d.id === driverId);
    if (
      !driver ||
      !currentUser ||
      activeMode !== 'driver' ||
      driver.driverAccountId !== currentUser.id
    ) {
      return;
    }
    setEditingRideId(driver.id);
    setDestinationInput(driver.destination);
    setPickupInput(driver.pickup);
    setDestinationPointInput(driver.destinationPoint);
    setDepartureAtInput(driver.departureAt);
    setOriginalDepartureAt(driver.departureAt);
    setSeatsInput(String(driver.totalSeats));
    setDeparturePickerMode(null);
    setFormError('');
    setRideConfirmation(null);
    setSelectedRideDriverId(null);
    setReservingDriverId(null);
    setRequestNotice('');
    setIsAddingDriver(true);
    // The form replaces the board on the Home screen and opens scrolled to
    // the top (HomeScreen remounts its ScrollView per view), so no extra
    // scrolling is needed here.
  }

  // Closes the form and clears out anything the user typed.
  function resetForm() {
    setIsAddingDriver(false);
    setEditingRideId(null);
    setDestinationInput('');
    setPickupInput(null);
    setDestinationPointInput(null);
    setDepartureAtInput(null);
    setOriginalDepartureAt(null);
    setDeparturePickerMode(null);
    setSeatsInput(String(MIN_SEATS));
    setFormError('');
    setIsSubmittingDriver(false);
    setRideConfirmation(null);
  }

  // "Edit ride details" on the Ride posted screen: back to the form with
  // everything still filled in. The form is already pointed at the saved
  // ride, so saving again updates it instead of posting a duplicate.
  function handleEditPostedRide() {
    setRideConfirmation(null);
    setFormError('');
    scrollViewRef.current?.scrollTo({ y: 0, animated: false });
  }

  // "Back to Home" on the Ride posted screen.
  function handleFinishPostedRide() {
    resetForm();
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
  }

  // Shows (or hides, if it's already showing) the date or time wheel.
  // The first time a wheel opens, it starts from a near-future default.
  function handleToggleDeparturePicker(mode) {
    Keyboard.dismiss();
    if (departureAtInput === null) {
      setDepartureAtInput(getDefaultDeparture());
    }
    setDeparturePickerMode((current) => (current === mode ? null : mode));
  }

  // Called as the driver scrolls a wheel. The date wheel only changes the
  // day and the time wheel only changes the hour/minute, so the two picks
  // combine into one departure Date.
  function handleDeparturePicked(pickedDate) {
    if (!(pickedDate instanceof Date) || Number.isNaN(pickedDate.getTime())) {
      return;
    }
    const mode = departurePickerMode;
    setDepartureAtInput((current) => {
      const combined = new Date(current || getDefaultDeparture());
      if (mode === 'date') {
        combined.setFullYear(pickedDate.getFullYear(), pickedDate.getMonth(), pickedDate.getDate());
      } else {
        combined.setHours(pickedDate.getHours(), pickedDate.getMinutes(), 0, 0);
      }
      return combined;
    });
    // Android shows the picker as a one-shot dialog, so close it after a pick.
    if (Platform.OS !== 'ios') {
      setDeparturePickerMode(null);
    }
  }

  // Runs when the user presses "Post Ride" (or "Save Changes" when editing).
  // The ride is posted under the signed-in account's name, so the driver
  // never has to type it. The ride is written to Supabase, then the board
  // is reloaded from Supabase.
  async function handleSaveDriver() {
    // Guards against a fast double-tap posting the same ride twice.
    if (isSubmittingDriver || !currentUser || activeMode !== 'driver') {
      return;
    }

    const trimmedDestination = destinationInput.trim();
    const seatsNumber = Number(seatsInput.trim());
    const editingDriver =
      editingRideId !== null ? drivers.find((d) => d.id === editingRideId) || null : null;
    const departureUnchanged =
      editingDriver !== null &&
      departureAtInput !== null &&
      originalDepartureAt !== null &&
      departureAtInput.getTime() === originalDepartureAt.getTime();

    // Validation: destination can't be empty, a pickup spot is required, a
    // departure must be picked and be in the future, and seats must be a
    // whole number from MIN_SEATS to MAX_SEATS. When editing, an unchanged
    // departure is allowed as-is. Returning early keeps everything entered.
    if (trimmedDestination === '') {
      setFormError('Please enter a destination.');
      return;
    }
    if (pickupInput === null || !isValidCoordinate(pickupInput.latitude, pickupInput.longitude)) {
      setFormError('Select a pickup spot.');
      return;
    }
    if (departureAtInput === null || Number.isNaN(departureAtInput.getTime())) {
      setFormError('Please choose a departure date and time.');
      return;
    }
    if (!departureUnchanged && departureAtInput.getTime() <= Date.now()) {
      setFormError('Departure must be in the future. Please pick a later date or time.');
      return;
    }
    if (
      seatsInput.trim() === '' ||
      !Number.isInteger(seatsNumber) ||
      seatsNumber < MIN_SEATS ||
      seatsNumber > MAX_SEATS
    ) {
      setFormError(`Seats must be between ${MIN_SEATS} and ${MAX_SEATS}.`);
      return;
    }
    if (editingRideId !== null && !editingDriver) {
      setFormError('This ride no longer exists. It may have been removed.');
      return;
    }

    setIsSubmittingDriver(true);
    setFormError('');

    // The id of the ride that was saved, so the form can keep editing that
    // same row afterwards.
    let savedRideId = editingDriver ? editingDriver.id : null;

    // The pickup spot is required (validated above). All three columns are
    // saved together, which is what the database's pickup checks require.
    const pickupFields = {
      pickup_lat: pickupInput ? pickupInput.latitude : null,
      pickup_lng: pickupInput ? pickupInput.longitude : null,
      pickup_label: pickupInput ? pickupInput.label : null,
    };
    // The mapped destination is optional too, and follows the same rule:
    // coordinates and label are saved together or all cleared.
    const destinationPointFields = {
      destination_lat: destinationPointInput ? destinationPointInput.latitude : null,
      destination_lng: destinationPointInput ? destinationPointInput.longitude : null,
      destination_label: destinationPointInput ? destinationPointInput.label : null,
    };

    try {
      if (editingDriver) {
        // Re-check confirmed riders against the server right before saving,
        // so total seats can't drop below who's already been accepted.
        const { count: acceptedCount, error: countError } = await supabase
          .from('ride_requests')
          .select('id', { count: 'exact', head: true })
          .eq('ride_id', editingDriver.id)
          .eq('status', 'accepted');
        if (countError) throw countError;
        if (seatsNumber < (acceptedCount ?? 0)) {
          setFormError(
            `This ride already has ${acceptedCount} confirmed rider${acceptedCount === 1 ? '' : 's'}, ` +
              `so it needs at least ${acceptedCount} seat${acceptedCount === 1 ? '' : 's'}.`
          );
          setIsSubmittingDriver(false);
          return;
        }

        const { data, error } = await supabase
          .from('rides')
          .update({
            destination: trimmedDestination,
            departure_at: departureAtInput.toISOString(),
            seat_count: seatsNumber,
            ...pickupFields,
            ...destinationPointFields,
          })
          .eq('id', editingDriver.id)
          .eq('driver_id', currentUser.id)
          .select('id');
        if (error) throw error;
        if (!data || data.length === 0) {
          throw new Error('No ride was updated.');
        }
      } else {
        const { data, error } = await supabase
          .from('rides')
          .insert({
            driver_id: currentUser.id,
            destination: trimmedDestination,
            departure_at: departureAtInput.toISOString(),
            seat_count: seatsNumber,
            ...pickupFields,
            ...destinationPointFields,
          })
          .select('id');
        if (error) throw error;
        // Not using .single(): the insert has already succeeded here, so a
        // missing id must not turn into an error that invites a re-post.
        savedRideId = data && data.length > 0 ? data[0].id : null;
      }
    } catch (error) {
      console.warn('CarpoolBoard: saving ride failed', error);
      setFormError(
        editingDriver
          ? "Couldn't save your changes. Check your connection and try again."
          : "Couldn't post your ride. Check your connection and try again."
      );
      setIsSubmittingDriver(false);
      return;
    }

    // Success: Supabase has confirmed the save, so show the Ride posted
    // screen. The form keeps its values and now edits the saved ride, so
    // "Edit ride details" followed by another save updates that row rather
    // than inserting a second one.
    Keyboard.dismiss();
    setDeparturePickerMode(null);
    setDestinationInput(trimmedDestination);
    setSeatsInput(String(seatsNumber));
    if (savedRideId !== null) {
      setEditingRideId(savedRideId);
      setOriginalDepartureAt(departureAtInput);
    }
    setRideConfirmation({
      destination: trimmedDestination,
      departureAt: departureAtInput,
      seats: seatsNumber,
      wasEdit: editingDriver !== null,
      canEdit: savedRideId !== null,
    });
    setIsSubmittingDriver(false);
    scrollViewRef.current?.scrollTo({ y: 0, animated: false });
    await loadBoard();
  }

  // Opens the Ride Details screen for a driver. This is the Available Rides -> Ride Details step.
  function handleViewRideDetails(driverId) {
    setSelectedRideDriverId(driverId);
    setRequestNotice('');
  }

  // Closes the Ride Details screen (and any in-progress matching) and returns to Available Rides.
  function handleBackToAvailableRides() {
    handleLeaveRequestSubmission();
    setSelectedRideDriverId(null);
    setReservingDriverId(null);
    setRequestNotice('');
  }

  // Cancels/rescinds an offered ride: removes it from Available Rides and
  // clears any Ride Details / Rider Matching state pointing at it. Other
  // drivers and riders are untouched. Only the driver who posted the ride
  // can rescind it, and we confirm first since this can't be undone.
  function handleCancelRide(driverId) {
    const driver = drivers.find((d) => d.id === driverId);
    if (
      !driver ||
      !currentUser ||
      activeMode !== 'driver' ||
      driver.driverAccountId !== currentUser.id
    ) {
      return;
    }

    Alert.alert(
      'Cancel this ride?',
      `This removes your ride to ${driver.destination} and can't be undone.`,
      [
        { text: 'Keep Ride', style: 'cancel' },
        {
          text: 'Cancel Ride',
          style: 'destructive',
          onPress: () =>
            runBoardAction(async () => {
              // Deleting the ride also removes its ride_requests through the
              // database's ON DELETE CASCADE relationship.
              const { data, error } = await supabase
                .from('rides')
                .delete()
                .eq('id', driverId)
                .eq('driver_id', currentUser.id)
                .select('id');
              if (error || !data || data.length === 0) {
                console.warn('CarpoolBoard: cancelling ride failed', error);
                setRequestNotice("Couldn't cancel this ride. Check your connection and try again.");
                return;
              }
              setSelectedRideDriverId(null);
              setReservingDriverId(null);
              setRequestNotice('');
            }),
        },
      ],
      { cancelable: true }
    );
  }

  // Opens (or closes, if already open) the request-confirm panel for a
  // driver, clearing any reason text left over from a different ride.
  function handleStartReserve(driverId) {
    setReservingDriverId((currentId) => (currentId === driverId ? null : driverId));
    setRequestReasonInput('');
  }

  // Closes the request-confirm panel without sending a request.
  function handleCancelReserve() {
    setReservingDriverId(null);
    setRequestReasonInput('');
  }

  // A waiting rider requests this specific ride, optionally with a short
  // reason so the driver has context when deciding. Seats do NOT change
  // yet, and the rider stays in the waiting list.
  //
  // The request goes through the submit_ride_request database function,
  // which creates a Pending row only when this rider has no row for the
  // ride and otherwise returns the existing one untouched. A denied or
  // cancelled request is final: it is never reopened.
  async function handleRequestRide(driverId, riderId, reason) {
    const driver = drivers.find((d) => d.id === driverId);
    const rider = currentUser && currentUser.id === riderId ? currentUser : null;
    if (!driver || !rider || activeMode !== 'rider') {
      return;
    }

    // Nobody can request their own ride. The UI already hides the button for
    // this case; this is the backstop in case it's ever reached another way.
    if (driver.driverAccountId === riderId) {
      return;
    }

    // Quick answers from what's already on screen. The server re-checks all
    // of these, since the screen can be out of date.
    if (driver.seats < 1) {
      setRequestNotice('This ride is full, so it is not accepting requests.');
      return;
    }
    if (driver.matchedRiders.some((r) => r.id === riderId)) {
      setRequestNotice(`${rider.name} is already a confirmed passenger on this ride.`);
      return;
    }
    if (driver.pendingRequests.some((req) => req.riderId === riderId)) {
      setRequestNotice(`${rider.name} already has a pending request for this ride.`);
      return;
    }
    const myStatus = myRequestStatusByRideId[driverId];
    if (myStatus === 'denied' || myStatus === 'cancelled') {
      setRequestNotice(
        `Your request for this ride was ${myStatus}, so it can't be sent again.`
      );
      return;
    }

    Keyboard.dismiss();
    setRequestNotice('');
    await runRequestSubmission(driverId, reason ? reason.trim() : '');
  }

  // Moves on to a new submission attempt, which makes every earlier
  // attempt's unfinished work stale. Returns the new attempt number.
  function nextSubmissionAttempt() {
    submissionAttemptRef.current += 1;
    return submissionAttemptRef.current;
  }

  // The parts of a submission that stay the same through every phase.
  function submissionBase(submission) {
    return {
      rideId: submission.rideId,
      riderId: submission.riderId,
      reason: submission.reason,
    };
  }

  // Drops the current submission completely: stops waiting on the server,
  // makes any unfinished work stale, and clears what's on screen. Used when
  // the outcome no longer has an audience (sign-out, mode switch).
  function resetRequestSubmission() {
    nextSubmissionAttempt();
    if (submissionAbortRef.current) {
      submissionAbortRef.current.abort();
      submissionAbortRef.current = null;
    }
    setRequestSubmission(null);
  }

  // Shows the rider's request row exactly as the server reported it. Only a
  // Pending row counts as a sent request; accepted/denied/cancelled rows
  // were already there and were left unchanged.
  function showServerRow(base, row, cause) {
    // The request-confirm form for this ride has done its job.
    setReservingDriverId((current) => (current === base.rideId ? null : current));
    if (row.status === 'pending') {
      // After abandoning, a Pending row means it arrived anyway, and the
      // rider gets to decide whether to keep it.
      setRequestSubmission({
        ...base,
        phase: cause === 'abandoned' ? 'arrived' : 'success',
        cause,
        row,
      });
    } else {
      setRequestSubmission({ ...base, phase: 'existing', cause, row });
    }
  }

  // WAITING -> SUCCESS / FAILURE. Sends the request and waits for the
  // server. Also used by Try Again: repeating it is safe because the
  // database function never creates a second row or changes a status.
  async function runRequestSubmission(rideId, reason) {
    // One submission at a time; ignores a double-tap on Confirm Request.
    if (submissionAbortRef.current || !currentUser || activeMode !== 'rider') {
      return;
    }
    const base = { rideId, riderId: currentUser.id, reason };
    const attempt = nextSubmissionAttempt();
    const controller = new AbortController();
    submissionAbortRef.current = controller;
    setRequestSubmission({ ...base, phase: 'submitting' });

    const result = await submitRideRequest({ ...base, signal: controller.signal });

    if (submissionAbortRef.current === controller) {
      submissionAbortRef.current = null;
    }
    // Abandoned, superseded, or signed out while waiting: this answer is
    // stale. Whoever moved on is responsible for checking with the server.
    if (attempt !== submissionAttemptRef.current) {
      return;
    }

    if (result.kind === 'row') {
      showServerRow(base, result.row, 'submitted');
      loadBoard();
      return;
    }
    if (result.kind === 'refused') {
      setRequestSubmission({
        ...base,
        phase: 'refused',
        message: result.message,
        retryable: result.retryable,
      });
      loadBoard();
      return;
    }
    // Timed out or the network failed: the request may still have been
    // saved, so ask the server instead of calling it a failure.
    await confirmSubmissionOutcome(base, result.cause, attempt);
  }

  // Asks the server what it actually holds after a submission whose answer
  // never arrived (abandoned, timed out, or network error). It checks
  // several times, because a request already on its way can still land
  // after the first check, and only then reports "none found".
  async function confirmSubmissionOutcome(base, cause, attempt) {
    const checking = { ...base, phase: 'checking', cause };
    setRequestSubmission({
      ...checking,
      checkNumber: 1,
      checkTotal: CONFIRM_CHECK_DELAYS_MS.length,
    });

    const outcome = await confirmRideRequestOutcome({
      rideId: base.rideId,
      riderId: base.riderId,
      isCurrent: () => attempt === submissionAttemptRef.current,
      onCheck: (checkNumber, checkTotal) =>
        setRequestSubmission({ ...checking, checkNumber, checkTotal }),
    });
    if (outcome.kind === 'stale' || attempt !== submissionAttemptRef.current) {
      return;
    }

    if (outcome.kind === 'found') {
      showServerRow(base, outcome.row, cause);
    } else if (outcome.kind === 'not_found') {
      setRequestSubmission({ ...base, phase: 'not_found', cause, checks: outcome.checks });
    } else {
      setRequestSubmission({ ...base, phase: 'unknown', cause });
    }
    loadBoard();
  }

  // ABANDONMENT. The rider stops waiting. This only stops the phone from
  // waiting: it can't take back a request the server already received, so
  // the next step is always to check what the server holds.
  function handleAbandonSubmission() {
    const submission = requestSubmission;
    if (!submission || submission.phase !== 'submitting') {
      return;
    }
    const attempt = nextSubmissionAttempt();
    if (submissionAbortRef.current) {
      submissionAbortRef.current.abort();
      submissionAbortRef.current = null;
    }
    confirmSubmissionOutcome(submissionBase(submission), 'abandoned', attempt);
  }

  // RETRY. Sends the same request again after a failure.
  function handleRetrySubmission() {
    const submission = requestSubmission;
    if (!submission || !['not_found', 'unknown', 'refused'].includes(submission.phase)) {
      return;
    }
    runRequestSubmission(submission.rideId, submission.reason);
  }

  // Runs the server checks again (e.g. once the connection is back).
  function handleCheckSubmissionAgain() {
    const submission = requestSubmission;
    if (!submission || !['not_found', 'unknown'].includes(submission.phase)) {
      return;
    }
    confirmSubmissionOutcome(
      submissionBase(submission),
      submission.cause,
      nextSubmissionAttempt()
    );
  }

  // Closes the outcome panel. A request that arrived stays Pending.
  function handleDismissSubmission() {
    nextSubmissionAttempt();
    setRequestSubmission(null);
  }

  // Leaving Ride Details (Back, or another tab). Leaving while a request is
  // still being sent counts as abandoning it: the check with the server
  // carries on in the background and its outcome is waiting when the rider
  // comes back to that ride. A finished outcome that needs no decision is
  // cleared so it can't reappear later as an old message.
  function handleLeaveRequestSubmission() {
    if (!requestSubmission) {
      return;
    }
    if (requestSubmission.phase === 'submitting') {
      handleAbandonSubmission();
    } else if (['success', 'existing', 'refused'].includes(requestSubmission.phase)) {
      handleDismissSubmission();
    }
  }

  // The rider withdraws a request that had already reached the server when
  // they stopped waiting. It's only reported as withdrawn once the server
  // confirms; until then it is still Pending.
  function handleWithdrawArrivedRequest() {
    const submission = requestSubmission;
    if (!submission || submission.phase !== 'arrived' || !submission.row) {
      return;
    }
    const promptedAttempt = submissionAttemptRef.current;

    Alert.alert(
      'Withdraw this request?',
      "This cancels your request for this ride. It's permanent: you won't be able to request this same ride again.",
      [
        { text: 'Keep Request', style: 'cancel' },
        {
          text: 'Withdraw',
          style: 'destructive',
          onPress: async () => {
            // Something else happened while the prompt was open.
            if (submissionAttemptRef.current !== promptedAttempt) {
              return;
            }
            const attempt = nextSubmissionAttempt();
            const base = submissionBase(submission);
            const { row, cause } = submission;
            setRequestSubmission({ ...base, phase: 'withdrawing', cause, row });

            const result = await withdrawRideRequest(row.id);
            if (attempt !== submissionAttemptRef.current) {
              return;
            }
            if (result.ok) {
              setRequestSubmission({
                ...base,
                phase: 'existing',
                cause,
                row: result.row,
                withdrawn: true,
              });
              loadBoard();
              return;
            }

            // Not withdrawn. Either the driver answered first (the row is
            // no longer pending) or the server couldn't be reached.
            const check = await lookupRideRequest(base);
            if (attempt !== submissionAttemptRef.current) {
              return;
            }
            if (check.ok && check.row && check.row.status !== 'pending') {
              showServerRow(base, check.row, cause);
            } else {
              setRequestSubmission({
                ...base,
                phase: 'arrived',
                cause,
                row,
                message:
                  "Couldn't withdraw your request, so it is still Pending. Check your connection and try again.",
              });
            }
            loadBoard();
          },
        },
      ],
      { cancelable: true }
    );
  }

  // A request that wasn't on the server when the app checked can still
  // arrive afterwards. Every board reload brings the rider's rows, so if
  // one has appeared for the ride in question, show it instead of leaving
  // "none found" on screen.
  useEffect(() => {
    if (!requestSubmission || !['not_found', 'unknown'].includes(requestSubmission.phase)) {
      return;
    }
    const row = myRequestRows.find(
      (r) => r.ride_id === requestSubmission.rideId && r.rider_id === requestSubmission.riderId
    );
    if (!row) {
      return;
    }
    nextSubmissionAttempt();
    showServerRow(submissionBase(requestSubmission), row, requestSubmission.cause);
    // Only a fresh load of the rider's rows should trigger this.
  }, [myRequestRows]);

  // SPIKE, step 2a: the driver accepts a pending request.
  // The rider becomes a confirmed passenger, available seats go down by 1,
  // and the rider leaves the waiting list (their requests to other rides are
  // cancelled). The accept itself runs in the database's accept_ride_request
  // function, which is what prevents overbooking.
  async function handleAcceptRequest(driverId, requestId) {
    const driver = drivers.find((d) => d.id === driverId);
    const request = driver && driver.pendingRequests.find((req) => req.id === requestId);
    // Only the ride's own driver, in Driver mode, can answer its requests.
    if (
      !driver ||
      !request ||
      !currentUser ||
      activeMode !== 'driver' ||
      driver.driverAccountId !== currentUser.id
    ) {
      return;
    }

    // A driver can never accept themselves as a passenger on their own ride.
    if (request.riderId === driver.driverAccountId) {
      return;
    }

    // Edge case: the ride filled up while this request was waiting.
    if (driver.seats < 1) {
      setRequestNotice('This ride is full. Deny the request or free up a seat first.');
      return;
    }

    await runBoardAction(async () => {
      const { error } = await supabase.rpc('accept_ride_request', { p_request_id: requestId });
      if (error) {
        // P0001 = a rule enforced by accept_ride_request (e.g. the ride is
        // full, or the request is no longer pending); its message is for users.
        console.warn('CarpoolBoard: accepting request failed', error);
        setRequestNotice(
          error.code === 'P0001' && error.message
            ? error.message
            : "Couldn't accept this request. Check your connection and try again."
        );
        return;
      }

      // The rider has a seat now, so withdraw their other pending requests
      // and take them off Looking for a Ride.
      const { error: cleanupError } = await supabase
        .from('ride_requests')
        .update({ status: 'cancelled' })
        .eq('rider_id', request.riderId)
        .eq('status', 'pending');
      if (cleanupError) {
        console.warn("CarpoolBoard: cancelling rider's other requests failed", cleanupError);
      }
      setLocalWaitingRiders((current) => current.filter((r) => r.id !== request.riderId));
      setRequestNotice(`${request.name} accepted: now a confirmed passenger.`);
    });
  }

  // SPIKE, step 2b: the driver denies a pending request.
  // The request is marked denied; seats and confirmed passengers are unchanged.
  async function handleDenyRequest(driverId, requestId) {
    const driver = drivers.find((d) => d.id === driverId);
    const request = driver && driver.pendingRequests.find((req) => req.id === requestId);
    // Only the ride's own driver, in Driver mode, can answer its requests.
    if (
      !driver ||
      !request ||
      !currentUser ||
      activeMode !== 'driver' ||
      driver.driverAccountId !== currentUser.id
    ) {
      return;
    }

    await runBoardAction(async () => {
      const { data, error } = await supabase
        .from('ride_requests')
        .update({ status: 'denied' })
        .eq('id', requestId)
        .eq('status', 'pending')
        .select('id');
      if (error || !data || data.length === 0) {
        console.warn('CarpoolBoard: denying request failed', error);
        setRequestNotice("Couldn't deny this request. It may have already changed. Pull down to refresh.");
        return;
      }
      setRequestNotice(`${request.name}'s request was denied. Seats unchanged.`);
    });
  }

  // A confirmed rider gives up their seat: the seat re-opens on the ride
  // (so a "Full" ride stops showing as Full), and they go back to Looking
  // for a Ride so they can find another one. Only the rider themselves can
  // cancel their own seat.
  function handleCancelConfirmedSeat(driverId, riderId) {
    const driver = drivers.find((d) => d.id === driverId);
    const rider = driver && driver.matchedRiders.find((r) => r.id === riderId);
    if (!driver || !rider || !currentUser || currentUser.id !== riderId) {
      return;
    }

    Alert.alert(
      'Cancel your seat?',
      `You'll give up your confirmed seat on ${driver.name}'s ride to ${driver.destination}. ` +
        "This is permanent: you won't be able to request this same ride again.",
      [
        { text: 'Keep My Seat', style: 'cancel' },
        {
          text: 'Cancel Seat',
          style: 'destructive',
          onPress: () =>
            runBoardAction(async () => {
              // Marking the accepted request cancelled frees the seat, since
              // available seats are always seat_count - accepted requests.
              const { data, error } = await supabase
                .from('ride_requests')
                .update({ status: 'cancelled' })
                .eq('id', rider.requestId)
                .eq('status', 'accepted')
                .select('id');
              if (error || !data || data.length === 0) {
                console.warn('CarpoolBoard: cancelling seat failed', error);
                setRequestNotice("Couldn't cancel your seat. Check your connection and try again.");
                return;
              }
              setLocalWaitingRiders((current) =>
                current.some((r) => r.id === riderId)
                  ? current
                  : [...current, { id: riderId, name: rider.name }]
              );
              setRequestNotice(`${rider.name} canceled their seat. A seat is now open.`);
            }),
        },
      ],
      { cancelable: true }
    );
  }

  // A rider withdraws one of their own Pending requests from the Requests
  // tab. It's marked cancelled only if it is still pending on the server, so
  // this can't overwrite a driver's Accept or Deny. Cancelled is final for
  // that ride, so we confirm first.
  function handleWithdrawRequest(requestId) {
    const row = myRequestRows.find((r) => r.id === requestId);
    if (!row || row.status !== 'pending' || !currentUser || row.rider_id !== currentUser.id) {
      return;
    }
    const driver = drivers.find((d) => d.id === row.ride_id);

    Alert.alert(
      'Withdraw this request?',
      `This cancels your request${driver ? ` for ${driver.name}'s ride to ${driver.destination}` : ''}. ` +
        "It's permanent: you won't be able to request this same ride again.",
      [
        { text: 'Keep Request', style: 'cancel' },
        {
          text: 'Withdraw',
          style: 'destructive',
          onPress: () =>
            runBoardAction(async () => {
              const result = await withdrawRideRequest(requestId);
              if (!result.ok) {
                setRequestNotice(
                  "Couldn't withdraw this request. It may have already been answered. Pull down to refresh."
                );
                return;
              }
              // An outcome panel still open for this ride would now be out
              // of date.
              if (requestSubmission !== null && requestSubmission.rideId === row.ride_id) {
                handleDismissSubmission();
              }
              setRequestNotice('Request withdrawn.');
            }),
        },
      ],
      { cancelable: true }
    );
  }

  // Sends the signed-in rider's review of a ride's driver, then reloads the
  // board so the review, the driver's average and every Rate Driver button
  // reflect what the server now holds. Resolves with submitDriverReview's
  // result for the review form to show. The form prevents a second send
  // while one is in flight, and sending the same review again is safe.
  async function handleSubmitReview(rideId, rating, comment) {
    if (!currentUser) {
      return { kind: 'refused', message: 'Please sign in again.' };
    }
    const result = await submitDriverReview({
      rideId,
      riderId: currentUser.id,
      rating,
      comment,
    });
    await loadBoard();
    return result;
  }

  // Opens a ride's details from the Map or Requests tab. Ride Details lives
  // on the Home tab, so this switches there first.
  function handleOpenRideFromTab(driverId) {
    setActiveTab('home');
    handleViewRideDetails(driverId);
  }

  // Dismisses the Match Confirmed screen and returns to the normal home view.
  function handleDismissMatchConfirmation() {
    setMatchConfirmation(null);
  }

  // Opens the Request a Ride panel.
  function handleNeedRide() {
    setIsAddingRider(true);
  }

  // Closes the Request a Ride panel.
  function resetRiderForm() {
    setIsAddingRider(false);
  }

  // Runs when the rider presses "Add Me to Looking for a Ride". They're
  // listed under their account name, so there's nothing to type.
  function handleSaveRider() {
    if (!currentUser) {
      return;
    }

    // Riders are tied to their account id, so re-saving (e.g. after already
    // joining) just closes the form instead of adding a duplicate entry.
    if (riders.some((rider) => rider.id === currentUser.id)) {
      resetRiderForm();
      return;
    }

    // Add the new rider to the list, keeping all the existing riders.
    const newRider = {
      id: currentUser.id,
      name: currentUser.name,
    };
    setLocalWaitingRiders((current) => [...current, newRider]);

    resetRiderForm();
  }

  // A waiting rider stops looking for a ride: they leave the waiting list,
  // and any pending requests they had out to drivers are withdrawn too.
  function handleLeaveWaitlist(riderId) {
    const rider = riders.find((r) => r.id === riderId);
    if (!rider || !currentUser || currentUser.id !== riderId) {
      return;
    }

    Alert.alert(
      'Stop looking for a ride?',
      "This also cancels any pending requests you have sent. That's permanent: you won't be able to request those same rides again.",
      [
        { text: 'Stay on the List', style: 'cancel' },
        {
          text: 'Remove Me',
          style: 'destructive',
          onPress: () =>
            runBoardAction(async () => {
              const { error } = await supabase
                .from('ride_requests')
                .update({ status: 'cancelled' })
                .eq('rider_id', riderId)
                .eq('status', 'pending');
              if (error) {
                console.warn('CarpoolBoard: withdrawing requests failed', error);
                Alert.alert(
                  "Couldn't remove you",
                  'Your pending requests could not be cancelled. Check your connection and try again.'
                );
                return;
              }
              setLocalWaitingRiders((current) => current.filter((r) => r.id !== riderId));
            }),
        },
      ],
      { cancelable: true }
    );
  }

  const detailsDriver = drivers.find((driver) => driver.id === selectedRideDriverId) || null;
  // Only the driver who posted a ride can manage it (accept/deny, edit,
  // cancel), and only while they're in Driver mode. In Rider mode their own
  // ride shows a "Switch to Driver to manage" shortcut instead.
  const isOwnerDriver =
    currentUser !== null &&
    activeMode === 'driver' &&
    detailsDriver !== null &&
    detailsDriver.driverAccountId === currentUser.id;
  // True when the open ride belongs to the signed-in account, whatever the
  // current mode. Used to hide any action that would let someone interact
  // with their own listing (e.g. requesting a seat on their own ride).
  const isOwnDetailsRide =
    currentUser !== null &&
    detailsDriver !== null &&
    detailsDriver.driverAccountId === currentUser.id;
  const isCurrentUserWaiting =
    currentUser !== null && riders.some((rider) => rider.id === currentUser.id);

  // Driver reviews for the open ride's driver, newest first (null when
  // reviews couldn't be loaded), and whether the signed-in person can
  // review this ride.
  const detailsDriverReviews =
    detailsDriver === null || reviewRows === null
      ? null
      : reviewRows
          .filter((row) => row.driver_id === detailsDriver.driverAccountId)
          .map((row) => toReviewDisplay(row, profilesById));
  const detailsReviewEligibility =
    detailsDriver === null || currentUser === null || reviewRows === null
      ? { status: 'not_eligible' }
      : getReviewEligibility({
          ride: detailsDriver,
          requestRow: myRequestRows.find((row) => row.ride_id === detailsDriver.id) || null,
          myReview: myReviewByRideId[detailsDriver.id] || null,
          currentUserId: currentUser.id,
        });
  // The signed-in person's own rating as a driver, for Profile: undefined
  // when unknown, null with no reviews yet.
  const myDriverRating =
    currentUser === null || ratingSummaries === null
      ? undefined
      : ratingSummaries[currentUser.id] || null;
  const myDriverReviews =
    currentUser === null || reviewRows === null
      ? null
      : reviewRows
          .filter((row) => row.driver_id === currentUser.id)
          .map((row) => toReviewDisplay(row, profilesById));
  // The Submit Ride Request state to show on the open ride: only the
  // signed-in rider's own submission for exactly this ride, in Rider mode.
  const detailsSubmission =
    requestSubmission !== null &&
    currentUser !== null &&
    activeMode === 'rider' &&
    detailsDriver !== null &&
    requestSubmission.rideId === detailsDriver.id &&
    requestSubmission.riderId === currentUser.id
      ? requestSubmission
      : null;

  // Available Rides in the chosen order. Sorting a copy keeps `drivers`
  // itself in posting order, which is what "Default" shows. Departure Time
  // puts upcoming rides first (soonest at the front), then rides whose
  // departure has already passed, each group in chronological order.
  const nowMs = Date.now();
  let sortedDrivers = drivers;
  if (rideSortOrder === 'destination') {
    sortedDrivers = [...drivers].sort((a, b) =>
      a.destination.localeCompare(b.destination, undefined, { sensitivity: 'base' })
    );
  } else if (rideSortOrder === 'departure') {
    sortedDrivers = [...drivers].sort((a, b) => {
      const aTime = a.departureAt.getTime();
      const bTime = b.departureAt.getTime();
      const aPast = aTime < nowMs;
      const bPast = bTime < nowMs;
      if (aPast !== bPast) {
        return aPast ? 1 : -1;
      }
      return aTime - bTime;
    });
  }

  // What Rider mode's Available Rides shows: the same rides narrowed and
  // ordered by rideFilters. Driver mode keeps using sortedDrivers.
  const filteredRiderRides = filterAndSortRides(drivers, rideFilters);

  // The ride open in the form's Edit mode, if any.
  const editingDriver =
    editingRideId !== null ? drivers.find((driver) => driver.id === editingRideId) || null : null;

  // Past days can't be picked on the date wheel. On the time wheel, earlier
  // times are blocked only when the chosen day is today. No limit is set when
  // editing a ride whose saved departure already passed, so the wheels still
  // show its real value (saving a changed departure still requires a future time).
  const departurePickerMinimumDate = (() => {
    const now = new Date();
    let minimum;
    if (departurePickerMode === 'date') {
      minimum = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (
      departureAtInput !== null &&
      departureAtInput.toDateString() === now.toDateString()
    ) {
      minimum = now;
    }
    if (minimum && departureAtInput !== null && departureAtInput < minimum) {
      return undefined;
    }
    return minimum;
  })();

  // A rider taps "Request This Ride" on Ride Details: they join the shared
  // waiting list automatically (using their own account) the first time they
  // request a ride, and the request-confirm panel opens.
  function handleBeginRequest(driverId) {
    if (!currentUser) {
      return;
    }
    // A denied or cancelled request is final for that ride.
    const myStatus = myRequestStatusByRideId[driverId];
    if (myStatus === 'denied' || myStatus === 'cancelled') {
      return;
    }
    setLocalWaitingRiders((current) =>
      current.some((r) => r.id === currentUser.id)
        ? current
        : [...current, { id: currentUser.id, name: currentUser.name }]
    );
    handleStartReserve(driverId);
  }

  // A rider taps "Request Ride" on a Home ride card: opens that ride's
  // details with the request-confirm panel already open. It's the same flow
  // as opening the ride and tapping Request This Ride, just one tap shorter.
  function handleQuickRequest(driverId) {
    handleViewRideDetails(driverId);
    handleBeginRequest(driverId);
  }

  // Tapping your avatar on Home opens the Profile tab.
  function handleOpenProfile() {
    handleLeaveRequestSubmission();
    setActiveTab('profile');
  }

  // Switches bottom tabs. Tapping Home while already on Home closes Ride
  // Details and returns to the board, like most mobile apps.
  function handleTabPress(tabKey) {
    Keyboard.dismiss();
    if (tabKey === 'home' && activeTab === 'home') {
      handleBackToAvailableRides();
    } else if (tabKey !== activeTab) {
      // Switching tabs hides Ride Details, which counts as leaving it.
      handleLeaveRequestSubmission();
      // A message about the last action belongs to the screen it happened on.
      setRequestNotice('');
    }
    setActiveTab(tabKey);
  }

  function handleGoHome() {
    setActiveTab('home');
  }

  if (currentUser === null) {
    return (
      <SafeAreaProvider>
        <SignInScreen
          authEmailInput={authEmailInput}
          setAuthEmailInput={setAuthEmailInput}
          matchingAuthAccount={matchingAuthAccount}
          authNameInput={authNameInput}
          setAuthNameInput={setAuthNameInput}
          authRole={authRole}
          setAuthRole={setAuthRole}
          authError={authError}
          isSigningIn={isSigningIn}
          handleSignIn={handleSignIn}
        />
      </SafeAreaProvider>
    );
  }

  if (isOnboarding) {
    return (
      <SafeAreaProvider>
        <OnboardingScreen
          currentUser={currentUser}
          initialMode={activeMode}
          profileNameInput={profileNameInput}
          setProfileNameInput={setProfileNameInput}
          profileBioInput={profileBioInput}
          setProfileBioInput={setProfileBioInput}
          profileVehicleInput={profileVehicleInput}
          setProfileVehicleInput={setProfileVehicleInput}
          profilePhotoDraft={profilePhotoDraft}
          profilePhotoError={profilePhotoError}
          isPickingPhoto={isPickingPhoto}
          handlePickProfilePhoto={handlePickProfilePhoto}
          handleDiscardProfilePhoto={handleDiscardProfilePhoto}
          profileFormError={profileFormError}
          isSavingProfile={isSavingProfile}
          onFinish={handleFinishOnboarding}
        />
      </SafeAreaProvider>
    );
  }

  const detailsView =
    detailsDriver !== null ? (
      <RideDetailsScreen
        detailsDriver={detailsDriver}
        currentUser={currentUser}
        activeMode={activeMode}
        handleSwitchMode={handleSwitchMode}
        requestNotice={requestNotice}
        requestSubmission={detailsSubmission}
        myRequestStatus={myRequestStatusByRideId[detailsDriver.id] || null}
        handleAbandonSubmission={handleAbandonSubmission}
        handleRetrySubmission={handleRetrySubmission}
        handleCheckSubmissionAgain={handleCheckSubmissionAgain}
        handleDismissSubmission={handleDismissSubmission}
        handleWithdrawArrivedRequest={handleWithdrawArrivedRequest}
        isOwnerDriver={isOwnerDriver}
        isOwnDetailsRide={isOwnDetailsRide}
        reservingDriverId={reservingDriverId}
        requestReasonInput={requestReasonInput}
        setRequestReasonInput={setRequestReasonInput}
        handleBackToAvailableRides={handleBackToAvailableRides}
        handleAcceptRequest={handleAcceptRequest}
        handleDenyRequest={handleDenyRequest}
        handleCancelConfirmedSeat={handleCancelConfirmedSeat}
        handleBeginRequest={handleBeginRequest}
        handleRequestRide={handleRequestRide}
        handleCancelReserve={handleCancelReserve}
        handleStartEditRide={handleStartEditRide}
        handleCancelRide={handleCancelRide}
        driverReviews={detailsDriverReviews}
        reviewEligibility={detailsReviewEligibility}
        handleSubmitReview={handleSubmitReview}
      />
    ) : null;

  // Pending requests waiting on the signed-in driver, shown as a count on
  // the Requests tab while they're in Driver mode.
  const incomingRequestCount =
    activeMode === 'driver'
      ? drivers
          .filter((driver) => driver.driverAccountId === currentUser.id)
          .reduce((total, driver) => total + driver.pendingRequests.length, 0)
      : 0;

  const rideForm = (
    <RideForm
      currentUser={currentUser}
      editingRideId={editingRideId}
      editingDriver={editingDriver}
      destinationInput={destinationInput}
      setDestinationInput={setDestinationInput}
      pickupInput={pickupInput}
      setPickupInput={setPickupInput}
      destinationPointInput={destinationPointInput}
      setDestinationPointInput={setDestinationPointInput}
      departureAtInput={departureAtInput}
      departurePickerMode={departurePickerMode}
      setDeparturePickerMode={setDeparturePickerMode}
      departurePickerMinimumDate={departurePickerMinimumDate}
      handleToggleDeparturePicker={handleToggleDeparturePicker}
      handleDeparturePicked={handleDeparturePicked}
      seatsInput={seatsInput}
      setSeatsInput={setSeatsInput}
      formError={formError}
      isSubmittingDriver={isSubmittingDriver}
      handleSaveDriver={handleSaveDriver}
      resetForm={resetForm}
      rideConfirmation={rideConfirmation}
      handleEditPostedRide={handleEditPostedRide}
      handleFinishPostedRide={handleFinishPostedRide}
    />
  );

  const riderForm = (
    <RiderWaitlistForm
      currentUser={currentUser}
      isCurrentUserWaiting={isCurrentUserWaiting}
      handleSaveRider={handleSaveRider}
      resetRiderForm={resetRiderForm}
    />
  );

  return (
    <SafeAreaProvider>
      <View style={appStyles.shell}>
        <StatusBar style="light" />

        <View style={appStyles.screen}>
          {activeTab === 'home' ? (
            <HomeScreen
              currentUser={currentUser}
              activeMode={activeMode}
              handleSetMode={handleSetMode}
              drivers={drivers}
              sortedDrivers={sortedDrivers}
              riders={riders}
              myRequestStatusByRideId={myRequestStatusByRideId}
              isBoardLoading={isBoardLoading}
              isRefreshing={isRefreshing}
              boardError={boardError}
              handleRefresh={handleRefresh}
              rideSortOrder={rideSortOrder}
              setRideSortOrder={setRideSortOrder}
              filteredRiderRides={filteredRiderRides}
              rideFilters={rideFilters}
              setRideFilters={setRideFilters}
              handleViewRideDetails={handleViewRideDetails}
              handleQuickRequest={handleQuickRequest}
              handleLeaveWaitlist={handleLeaveWaitlist}
              isAddingDriver={isAddingDriver}
              isAddingRider={isAddingRider}
              handleAddDriver={handleAddDriver}
              handleNeedRide={handleNeedRide}
              isCurrentUserWaiting={isCurrentUserWaiting}
              handleOpenProfile={handleOpenProfile}
              matchConfirmation={matchConfirmation}
              handleDismissMatchConfirmation={handleDismissMatchConfirmation}
              scrollViewRef={scrollViewRef}
              detailsView={detailsView}
              rideForm={rideForm}
              riderForm={riderForm}
            />
          ) : (
            <SafeAreaView style={appStyles.tabScreen} edges={['top']}>
              {activeTab === 'map' && (
                <MapScreen
                  drivers={drivers}
                  isBoardLoading={isBoardLoading}
                  isRefreshing={isRefreshing}
                  boardError={boardError}
                  handleRefresh={handleRefresh}
                  onOpenRide={handleOpenRideFromTab}
                  onGoHome={handleGoHome}
                />
              )}
              {activeTab === 'requests' && (
                <RequestsScreen
                  currentUser={currentUser}
                  activeMode={activeMode}
                  handleSetMode={handleSetMode}
                  drivers={drivers}
                  myRequestRows={myRequestRows}
                  isBoardLoading={isBoardLoading}
                  isRefreshing={isRefreshing}
                  boardError={boardError}
                  requestNotice={requestNotice}
                  handleRefresh={handleRefresh}
                  handleAcceptRequest={handleAcceptRequest}
                  handleDenyRequest={handleDenyRequest}
                  handleWithdrawRequest={handleWithdrawRequest}
                  handleCancelConfirmedSeat={handleCancelConfirmedSeat}
                  myReviewByRideId={myReviewByRideId}
                  reviewsLoaded={reviewRows !== null}
                  onOpenRide={handleOpenRideFromTab}
                  onGoHome={handleGoHome}
                />
              )}
              {activeTab === 'profile' &&
                (isEditingProfile ? (
                  <EditProfileScreen
                    activeMode={activeMode}
                    currentPhotoUri={currentUser.avatarUrl}
                    profilePhotoDraft={profilePhotoDraft}
                    profilePhotoError={profilePhotoError}
                    isPickingPhoto={isPickingPhoto}
                    handlePickProfilePhoto={handlePickProfilePhoto}
                    handleDiscardProfilePhoto={handleDiscardProfilePhoto}
                    profileNameInput={profileNameInput}
                    setProfileNameInput={setProfileNameInput}
                    profileEmailInput={profileEmailInput}
                    setProfileEmailInput={setProfileEmailInput}
                    profileBioInput={profileBioInput}
                    setProfileBioInput={setProfileBioInput}
                    profileVehicleInput={profileVehicleInput}
                    setProfileVehicleInput={setProfileVehicleInput}
                    profileFormError={profileFormError}
                    isSavingProfile={isSavingProfile}
                    handleSaveProfile={handleSaveProfile}
                    resetProfileForm={resetProfileForm}
                  />
                ) : (
                  <ProfileScreen
                    currentUser={currentUser}
                    activeMode={activeMode}
                    handleSetMode={handleSetMode}
                    handleStartEditProfile={handleStartEditProfile}
                    handleOpenOnboarding={handleOpenOnboarding}
                    handleSignOut={handleSignOut}
                    myDriverRating={myDriverRating}
                    myDriverReviews={myDriverReviews}
                  />
                ))}
            </SafeAreaView>
          )}
          <Toast toast={toast} onHide={() => setToast(null)} />
        </View>

        <DemoNetworkBanner />
        <TabBar
          activeTab={activeTab}
          onTabPress={handleTabPress}
          badges={{ requests: incomingRequestCount }}
        />
      </View>
    </SafeAreaProvider>
  );
}

const appStyles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  screen: {
    flex: 1,
  },
  tabScreen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
});
