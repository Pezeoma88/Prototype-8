// CarpoolBoard design tokens (Prototype 8: light redesign).
//
// Every screen/component reads its colors, spacing, radii, and type sizes
// from here instead of hard-coding values, so the look stays consistent and
// can be tuned in one place.
//
// Prototype 8 moves from the dark navy look to a clean white interface:
// white screens, white cards with thin gray borders, one blue accent, and
// quiet gray secondary text. Driver stays blue (the primary accent); Rider
// uses a muted teal so the two modes are still easy to tell apart.
//
// A few components build a translucent tint by appending a 2-digit hex alpha
// to a color (e.g. `${colors.rider}29`), so keep accent colors as 6-digit hex.

export const colors = {
  // Surfaces
  bg: '#FFFFFF', // app background
  surface: '#FFFFFF', // cards (separated from the background by a border)
  surfaceRaised: '#F8FAFC', // inputs, chips, inset boxes, pressed cards
  surfaceSunken: '#F1F5F9', // tracks behind segmented controls
  border: '#E5E7EB',
  borderStrong: '#D1D5DB',

  // Text
  text: '#111827',
  textMuted: '#64748B',
  textFaint: '#94A3B8', // placeholders, hints, disabled labels
  textOnAccent: '#FFFFFF',
  textOnAccentMuted: 'rgba(255, 255, 255, 0.85)',
  onAccentSoft: 'rgba(255, 255, 255, 0.2)', // icon chips on filled tiles

  // Brand / actions
  primary: '#2563EB',
  primaryPressed: '#1D4ED8',
  primarySoft: '#EFF6FF',
  accent: '#2563EB',

  // Role identity
  driver: '#2563EB',
  driverSoft: '#EFF6FF',
  rider: '#0D9488',
  riderSoft: '#F0FDFA',
  riderPressed: '#0F766E',
  riderBorder: '#99F6E4',

  // Status (text-safe shades for use on white and on their soft fills)
  success: '#16A34A',
  successSoft: '#F0FDF4',
  pending: '#B45309',
  pendingSoft: '#FFFBEB',
  danger: '#DC2626',
  dangerSoft: '#FEF2F2',
  dangerPressed: '#FEE2E2',
  muted: '#E5E7EB', // disabled button fill
  star: '#F59E0B', // rating stars
  mutedSoft: '#F1F5F9',
};

// Two-stop gradient for the occasional highlight (not for every surface).
export const gradients = {
  primary: [colors.primary, colors.primaryPressed],
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

// Standard horizontal page gutter.
export const gutter = spacing.xl;

export const radius = {
  sm: 10,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
};

export const typography = {
  caption: { fontSize: 12, fontWeight: '500' },
  label: { fontSize: 13, fontWeight: '600' },
  body: { fontSize: 15, fontWeight: '400' },
  bodyStrong: { fontSize: 15, fontWeight: '600' },
  title: { fontSize: 17, fontWeight: '600' },
  heading: { fontSize: 22, fontWeight: '700', letterSpacing: -0.2 },
  display: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
};

// Very soft shadow for cards on white. iOS uses the shadow* props; Android
// uses elevation. The border does most of the separation work.
export const shadow = {
  card: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  raised: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
};

// Accent color for a Driver/Rider role.
export function roleColor(role) {
  return role === 'rider' ? colors.rider : colors.driver;
}

export function roleSoftColor(role) {
  return role === 'rider' ? colors.riderSoft : colors.driverSoft;
}
