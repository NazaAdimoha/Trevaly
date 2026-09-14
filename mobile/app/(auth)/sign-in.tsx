import { useSignIn } from '@clerk/expo';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { color, font, radius, space, text } from '@/theme';
import { Button } from '@/ui';

/**
 * Sign in — adaptive, because the instance decides how.
 *
 * The first version assumed email + password and hard-failed on anything else.
 * This instance verifies the email attribute with a one-time `email_code` and
 * does not accept password as a first factor at all, so every attempt came back
 * `needs_first_factor` and the merchant was told to go and use the web.
 *
 * Rather than hard-code the other strategy and break again the next time the
 * Clerk dashboard is touched, this asks Clerk what it supports:
 * `signIn.supportedFirstFactors` is populated by `create({ identifier })`, and
 * the screen renders whichever of password / email code is offered. That is
 * what Clerk's own hosted component does, which is why the web has always
 * worked.
 *
 * CORE 3 NOTE — `@clerk/expo` replaced the throwing, result-returning SignIn
 * resource with a "future" resource that is a state machine you read rather
 * than a value you receive:
 *
 *   create/password/verifyCode  resolve to `{ error }` — they do NOT throw, so
 *                               an unchecked call fails silently and the UI
 *                               just sits there.
 *   signIn.status               the status lives on the resource, not on the
 *                               call's return value. Read it AFTER the await.
 *   finalize()                  replaces `setActive({ session })`.
 *
 * The mutation-then-read shape is deliberate on Clerk's side: every method
 * updates the same shared resource, so `route()` below can be the one place
 * that decides what happens next regardless of which step we came from.
 */

type Stage =
  | { name: 'identifier' }
  | { name: 'password' }
  | { name: 'code'; sentTo: string }
  | { name: 'second-factor' };

/**
 * Clerk returns errors rather than throwing them now, but the shape is not part
 * of the public types. Read the useful fields defensively and keep a sentence
 * the merchant can act on as the floor — never surface an empty string.
 */
function messageFor(err: unknown): string {
  const fallback = 'Something went wrong. Try again.';
  if (!err || typeof err !== 'object') return fallback;

  const bag = err as {
    errors?: Array<{ longMessage?: string; message?: string }>;
    longMessage?: string;
    message?: string;
  };
  const first = bag.errors?.[0];

  return (
    first?.longMessage ??
    first?.message ??
    bag.longMessage ??
    bag.message ??
    fallback
  );
}

export default function SignInScreen() {
  const { signIn } = useSignIn();

  const [stage, setStage] = useState<Stage>({ name: 'identifier' });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /** The email-code factor, when the instance offers one, for its display name. */
  const emailFactor = () =>
    signIn?.supportedFirstFactors?.find(
      (f): f is typeof f & { safeIdentifier?: string } => f.strategy === 'email_code',
    );

  /**
   * Read the resource and decide what the merchant sees next.
   *
   * Every call site funnels through here, so a status Clerk adds later surfaces
   * as a named dead-end rather than a screen that quietly does nothing.
   */
  const route = async () => {
    if (!signIn) return;

    if (signIn.status === 'complete') {
      // Sets the active session; the AuthGate in app/_layout.tsx sees the
      // signed-in state and swaps the stack over to (app).
      const { error: finalizeError } = await signIn.finalize();
      if (finalizeError) setError(messageFor(finalizeError));
      return;
    }

    if (signIn.status === 'needs_second_factor') {
      setCode('');
      setStage({ name: 'second-factor' });
      return;
    }

    if (signIn.status === 'needs_new_password') {
      setError(
        'Your password must be reset. Do that on the web dashboard, then sign in here.',
      );
      return;
    }

    if (signIn.status === 'needs_first_factor') {
      const factors = signIn.supportedFirstFactors ?? [];

      if (factors.some((f) => f.strategy === 'password')) {
        setStage({ name: 'password' });
        return;
      }

      const factor = emailFactor();
      if (factor) {
        const { error: sendError } = await signIn.emailCode.sendCode();
        if (sendError) {
          setError(messageFor(sendError));
          return;
        }
        setCode('');
        setStage({ name: 'code', sentTo: factor.safeIdentifier ?? email.trim() });
        return;
      }

      // Surface the strategies rather than a shrug — this is what made the
      // original failure so hard to diagnose.
      setError(
        `This account signs in with ${
          factors.map((f) => f.strategy).join(', ') ||
          'a method the app does not support yet'
        }. Use the web dashboard for now.`,
      );
      return;
    }

    setError(`Sign-in stopped at "${signIn.status}". Use the web dashboard for now.`);
  };

  /**
   * One wrapper for every step: guard, clear, run, route, unbusy. Without it
   * each handler repeats the try/finally and one of them eventually forgets to
   * reset `busy`, leaving the button dead.
   */
  const run = async (action: () => Promise<{ error: unknown }>) => {
    if (!signIn || busy) return;

    setBusy(true);
    setError(null);
    try {
      const { error: actionError } = await action();
      if (actionError) {
        setError(messageFor(actionError));
        return;
      }
      await route();
    } catch (err) {
      // Network failures still throw even though Clerk errors do not.
      setError(messageFor(err));
    } finally {
      setBusy(false);
    }
  };

  const startWithEmail = () => {
    if (!email.trim()) return setError('Enter your email address.');
    return run(() => signIn!.create({ identifier: email.trim() }));
  };

  const submitPassword = () =>
    run(() => signIn!.password({ identifier: email.trim(), password }));

  const submitCode = () => {
    if (code.trim().length < 6) return setError('Enter the 6-digit code.');
    return run(() => signIn!.emailCode.verifyCode({ code: code.trim() }));
  };

  const submitSecondFactor = () => {
    if (code.trim().length < 6) return setError('Enter the 6-digit code.');
    return run(() => signIn!.mfa.verifyTOTP({ code: code.trim() }));
  };

  const resend = () => {
    if (!emailFactor()) return;
    return run(async () => {
      const result = await signIn!.emailCode.sendCode();
      if (!result.error) setCode('');
      return result;
    });
  };

  const startOver = () => {
    setStage({ name: 'identifier' });
    setPassword('');
    setCode('');
    setError(null);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.brand}>Merchant</Text>
            <Text style={styles.title}>
              {stage.name === 'identifier'
                ? 'Your orders are waiting.'
                : stage.name === 'code'
                  ? 'Check your email.'
                  : stage.name === 'second-factor'
                    ? 'One more step.'
                    : 'Welcome back.'}
            </Text>
            <Text style={styles.subtitle}>
              {stage.name === 'identifier'
                ? 'Sign in with the same email you use on the dashboard.'
                : stage.name === 'code'
                  ? `We sent a 6-digit code to ${stage.sentTo}.`
                  : stage.name === 'second-factor'
                    ? 'Enter the code from your authenticator app.'
                    : 'Enter your password to continue.'}
            </Text>
          </View>

          <View style={styles.form}>
            {stage.name === 'identifier' ? (
              <>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  keyboardType="email-address"
                  placeholder="you@yourbusiness.com"
                  placeholderTextColor={color.muted}
                  style={styles.input}
                  returnKeyType="go"
                  onSubmitEditing={() => void startWithEmail()}
                />
                {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
                <Button label="Continue" onPress={() => void startWithEmail()} busy={busy} />
              </>
            ) : null}

            {stage.name === 'password' ? (
              <>
                <Text style={styles.label}>Password</Text>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoComplete="current-password"
                  placeholder="••••••••"
                  placeholderTextColor={color.muted}
                  style={styles.input}
                  returnKeyType="go"
                  autoFocus
                  onSubmitEditing={() => void submitPassword()}
                />
                {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
                <Button label="Sign in" onPress={() => void submitPassword()} busy={busy} />
                <Pressable onPress={startOver} style={styles.linkWrap}>
                  <Text style={styles.link}>Use a different email</Text>
                </Pressable>
              </>
            ) : null}

            {stage.name === 'code' || stage.name === 'second-factor' ? (
              <>
                <Text style={styles.label}>
                  {stage.name === 'code' ? 'Code from your email' : 'Authenticator code'}
                </Text>
                <TextInput
                  value={code}
                  onChangeText={setCode}
                  keyboardType="number-pad"
                  autoComplete="one-time-code"
                  textContentType="oneTimeCode"
                  placeholder="123456"
                  placeholderTextColor={color.muted}
                  style={[styles.input, styles.codeInput]}
                  maxLength={6}
                  autoFocus
                  returnKeyType="go"
                  onSubmitEditing={() =>
                    void (stage.name === 'code' ? submitCode() : submitSecondFactor())
                  }
                />
                {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
                <Button
                  label="Sign in"
                  onPress={() => void (stage.name === 'code' ? submitCode() : submitSecondFactor())}
                  busy={busy}
                />
                {stage.name === 'code' ? (
                  <Pressable onPress={() => void resend()} style={styles.linkWrap}>
                    <Text style={styles.link}>Send another code</Text>
                  </Pressable>
                ) : null}
                <Pressable onPress={startOver} style={styles.linkWrap}>
                  <Text style={styles.link}>Use a different email</Text>
                </Pressable>
              </>
            ) : null}
          </View>

          <Text style={styles.footnote}>
            Shoppers never sign in. This is for store owners and their staff.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.ground },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: space.xl, gap: space.xxl },
  header: { gap: space.sm },
  brand: { ...text.label, color: color.primary700, textTransform: 'uppercase' },
  title: { ...text.display, color: color.ink },
  subtitle: { ...text.body, color: color.body },
  form: { gap: space.sm },
  label: { ...text.small, color: color.ink, fontFamily: font.medium, marginTop: space.sm },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.sm,
    backgroundColor: color.surface,
    paddingHorizontal: space.lg,
    fontSize: 16,
    color: color.ink,
  },
  codeInput: { fontSize: 22, letterSpacing: 8, textAlign: 'center' },
  error: { ...text.small, color: color.danger, marginTop: space.xs },
  linkWrap: { minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  link: { ...text.small, color: color.primary700, fontFamily: font.medium },
  footnote: { ...text.small, color: color.muted, textAlign: 'center' },
});
