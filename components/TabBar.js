import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@react-native-vector-icons/ionicons';
import { colors, spacing } from '../theme/theme';

// The four main sections of CarpoolBoard, in tab-bar order.
export const TABS = [
  { key: 'home', label: 'Home', icon: 'home-outline', activeIcon: 'home' },
  { key: 'map', label: 'Map', icon: 'map-outline', activeIcon: 'map' },
  { key: 'requests', label: 'Requests', icon: 'file-tray-full-outline', activeIcon: 'file-tray-full' },
  { key: 'profile', label: 'Profile', icon: 'person-outline', activeIcon: 'person' },
];

// Compact bottom navigation. The active tab gets a filled icon, primary
// color, and a small dot underneath. Bottom padding follows the device's
// safe area so it clears the iPhone home indicator.
export default function TabBar({ activeTab, onTabPress, badges = {} }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
      {TABS.map((tab) => {
        const isActive = tab.key === activeTab;
        const tint = isActive ? colors.primary : colors.textFaint;
        const badgeCount = badges[tab.key] || 0;
        return (
          <Pressable
            key={tab.key}
            style={styles.tab}
            onPress={() => onTabPress(tab.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={tab.label}
            hitSlop={4}
          >
            {({ pressed }) => (
              <View style={[styles.tabInner, pressed && styles.tabPressed]}>
                <View>
                  <Ionicons name={isActive ? tab.activeIcon : tab.icon} size={23} color={tint} />
                  {badgeCount > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{badgeCount > 9 ? '9+' : badgeCount}</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.label, { color: tint }, isActive && styles.labelActive]}>
                  {tab.label}
                </Text>
                <View style={[styles.dot, isActive && styles.dotActive]} />
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  tab: {
    flex: 1,
  },
  tabInner: {
    alignItems: 'center',
  },
  tabPressed: {
    opacity: 0.6,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 3,
  },
  labelActive: {
    fontWeight: '700',
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 3,
    backgroundColor: 'transparent',
  },
  dotActive: {
    backgroundColor: colors.primary,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -10,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    backgroundColor: colors.pending,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.bg,
  },
});
