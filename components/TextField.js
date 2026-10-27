import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import { colors, radius, spacing, typography } from '../theme/theme';

// Labeled, rounded dark input with an optional leading icon, hint, and
// error. Any other TextInput props (keyboardType, returnKeyType, multiline…)
// pass straight through to the underlying TextInput.
export default function TextField({ label, icon, hint, error, multiline, style, onFocus, onBlur, ...inputProps }) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={[styles.wrap, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View
        style={[
          styles.box,
          multiline && styles.boxMultiline,
          isFocused && styles.boxFocused,
          error ? styles.boxError : null,
        ]}
      >
        {icon ? (
          <Ionicons
            name={icon}
            size={18}
            color={isFocused ? colors.primary : colors.textMuted}
            style={[styles.icon, multiline && styles.iconMultiline]}
          />
        ) : null}
        <TextInput
          {...inputProps}
          multiline={multiline}
          style={[styles.input, multiline && styles.inputMultiline]}
          placeholderTextColor={colors.textFaint}
          selectionColor={colors.primary}
          keyboardAppearance="dark"
          onFocus={(event) => {
            setIsFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setIsFocused(false);
            onBlur?.(event);
          }}
        />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.lg,
  },
  label: {
    ...typography.label,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    minHeight: 50,
  },
  boxMultiline: {
    alignItems: 'flex-start',
    paddingVertical: spacing.md,
  },
  boxFocused: {
    borderColor: colors.primary,
  },
  boxError: {
    borderColor: colors.danger,
  },
  icon: {
    marginRight: 10,
  },
  iconMultiline: {
    marginTop: 1,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    paddingVertical: 12,
  },
  inputMultiline: {
    minHeight: 64,
    paddingVertical: 0,
    textAlignVertical: 'top',
  },
  hint: {
    ...typography.caption,
    color: colors.textFaint,
    marginTop: 6,
    lineHeight: 17,
  },
  error: {
    ...typography.caption,
    color: colors.danger,
    marginTop: 6,
  },
});
