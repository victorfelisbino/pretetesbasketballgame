import { View, Text, StyleSheet, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from '../../components/Button';
import { colors, spacing, font, radius } from '../../theme';

export default function LoginScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <View style={styles.header}>
          <Text style={styles.emoji}>🏀</Text>
          <Text style={styles.title}>Quadra Legacy</Text>
          <Text style={styles.subtitle}>Sign in to continue</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="your@email.com"
              placeholderTextColor={colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
            />
          </View>

          <Button
            title="Sign In"
            onPress={() => router.replace('/(tabs)')}
            style={styles.signInBtn}
          />

          <Button
            title="Continue as Guest"
            onPress={() => router.replace('/(tabs)')}
            variant="outline"
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgDark,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  emoji: {
    fontSize: 56,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: font.xxl,
    fontWeight: '800',
    color: colors.primary,
  },
  subtitle: {
    fontSize: font.md,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  form: {
    gap: spacing.lg,
  },
  inputGroup: {
    gap: spacing.xs,
  },
  label: {
    fontSize: font.sm,
    color: colors.textMuted,
    fontWeight: '500',
  },
  input: {
    backgroundColor: colors.bgInput,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.textLight,
    fontSize: font.md,
    borderWidth: 2,
    borderColor: colors.bgInput,
  },
  signInBtn: {
    marginTop: spacing.sm,
  },
});
