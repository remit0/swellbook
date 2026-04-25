import { useState } from 'react';
import {
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { supabase } from '../../config/supabase';

type Mode = 'login' | 'signup';

export default function LoginScreen() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  function switchMode(next: Mode): void {
    setMode(next);
    setError(null);
    setInfo(null);
  }

  async function handleSubmit(): Promise<void> {
    setIsLoading(true);
    setError(null);
    setInfo(null);
    try {
      if (mode === 'login') {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) setError(authError.message);
      } else {
        const { error: authError } = await supabase.auth.signUp({ email, password });
        if (authError) {
          setError(authError.message);
        } else {
          setInfo('Check your email to confirm your account.');
        }
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  }

  const isDisabled = isLoading || !email || !password;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.title}>SwellBook</Text>
      <Text style={styles.subtitle}>
        {mode === 'login' ? 'Log in to continue' : 'Create an account'}
      </Text>

      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
      />
      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        secureTextEntry
        autoComplete={mode === 'login' ? 'password' : 'new-password'}
      />

      {error && <Text style={styles.error}>{error}</Text>}
      {info && <Text style={styles.info}>{info}</Text>}

      <TouchableOpacity
        style={[styles.button, isDisabled && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={isDisabled}
      >
        {isLoading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.buttonText}>{mode === 'login' ? 'Log In' : 'Sign Up'}</Text>}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.switchButton}
        onPress={() => switchMode(mode === 'login' ? 'signup' : 'login')}
      >
        <Text style={styles.switchText}>
          {mode === 'login'
            ? "Don't have an account? Sign up"
            : 'Already have an account? Log in'}
        </Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 32,
    backgroundColor: '#fff',
  },
  title: { fontSize: 32, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 40 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    marginBottom: 16,
  },
  error: { color: '#cc0000', marginBottom: 12, textAlign: 'center' },
  info: { color: '#008800', marginBottom: 12, textAlign: 'center' },
  button: {
    backgroundColor: '#0077cc',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { backgroundColor: '#99c2e8' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  switchButton: { marginTop: 20, alignItems: 'center' },
  switchText: { color: '#0077cc', fontSize: 14 },
});
