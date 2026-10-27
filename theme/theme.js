// CarpoolBoard design tokens (Prototype 5).
//
// Every new screen/component reads its colors, spacing, radii, and type sizes
// from here instead of hard-coding values, so the look stays consistent and
// can be tuned in one place.
//
// A few components build a translucent tint by appending a 2-digit hex alpha
// to a color (e.g. `${colors.rider}29`), so keep accent colors as 6-digit hex.

export const colors = {
  // Surfaces, darkest to lightest
  bg: '#0A0F1E', // app background: near-black navy
  surface: '#121A2E', // cards
  surfaceRaised: '#1A2440', // inputs, floating panels, pressed cards
  border: 'rgba(255, 255, 255, 0.08)',
  borderStrong: 'rgba(255, 255, 255, 0.14)',

  // Text
  text: '#F4F6FB',
  textMuted: '#8E9AB5',
  textFaint: '#5D6884',
  textOnAccent: '#FFFFFF',
  textOnAccentMuted: 'rgba(255, 255, 255, 0.8)',
  onAccentSoft: 'rgba(255, 255, 255, 0.18)', // icon chips on filled tiles

  // Brand / actions
  primary: '#4F7CFF',
  primaryPressed: '#3D66E0',
  primarySoft: 'rgba(79, 124, 255, 0.16)',
  accent: '#7C5CFF', // indigo/purple, used sparingly (e.g. gradient end)

  // Role identity
  driver: '#4F7CFF',
  driverSoft: 'rgba(79, 124, 255, 0.16)',
  rider: '#FF8A3D',
  riderSoft: 'rgba(255, 138, 61, 0.16)',
  riderPressed: '#E8742A',
  riderBorder: 'rgba(255, 138, 61, 0.22)',

  // Status
  success: '#22C55E',
  successSoft: 'rgba(34, 197, 94, 0.16)',
  pending: '#F5A524',
  pendingSoft: 'rgba(245, 165, 36, 0.16)',
  danger: '#EF4444',
  dangerSoft: 'rgba(239, 68, 68, 0.16)',
  dangerPressed: 'rgba(239, 68, 68, 0.26)',
  muted: '#3A4560',
  mutedSoft: 'rgba(142, 154, 181, 0.14)',
};

// Two-stop gradient for the occasional highlight (not for every surface).
export const gradients = {
  primary: [colors.primary, colors.accent],
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
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
};

export const typography = {
  caption: { fontSize: 12, fontWeight: '500' },
  label: { fontSize: 13, fontWeight: '600' },
  body: { fontSize: 15, fontWeight: '400' },
  bodyStrong: { fontSize: 15, fontWeight: '600' },
  title: { fontSize: 17, fontWeight: '700' },
  heading: { fontSize: 22, fontWeight: '800' },
  display: { fontSize: 28, fontWeight: '800' },
};

// Soft shadow for raised surfaces. iOS uses the shadow* props; Android uses
// elevation.
export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
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
