import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useAudioRecorder, RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync } from 'expo-audio';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { RecordingState } from './recorder.types';
import { uploadSession } from '../session/sessionApi';

type RecorderNav = NativeStackNavigationProp<RootStackParamList, 'Recorder'>;

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export default function RecorderScreen() {
  const navigation = useNavigation<RecorderNav>();
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [recordingState, setRecordingState] = useState<RecordingState>({
    isRecording: false,
    uri: null,
    durationMs: 0,
  });
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  async function startRecording(): Promise<void> {
    setError(null);
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        setError('Microphone permission is required to record a session.');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await audioRecorder.prepareToRecordAsync();
      await audioRecorder.record();
      setRecordingState({ isRecording: true, uri: null, durationMs: 0 });
      timerRef.current = setInterval(() => {
        setRecordingState((prev) => ({
          ...prev,
          durationMs: prev.durationMs + 1000,
        }));
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start recording');
    }
  }

  async function stopRecording(): Promise<void> {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    try {
      await audioRecorder.stop();
      const uri = audioRecorder.uri;
      setRecordingState((prev) => ({ ...prev, isRecording: false, uri }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop recording');
      setRecordingState((prev) => ({ ...prev, isRecording: false }));
    }
  }

  async function handleUpload(): Promise<void> {
    if (!recordingState.uri) return;
    setIsUploading(true);
    setError(null);
    try {
      const result = await uploadSession(recordingState.uri);
      navigation.navigate('SessionConfirm', { result });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  }

  const { isRecording, uri, durationMs } = recordingState;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Record Session</Text>

      <TouchableOpacity
        style={[styles.recordButton, isRecording && styles.recordButtonActive]}
        onPress={isRecording ? stopRecording : startRecording}
        disabled={isUploading}
      >
        <Text style={styles.recordButtonText}>{isRecording ? 'Stop' : 'Record'}</Text>
      </TouchableOpacity>

      <Text style={styles.duration}>{formatDuration(durationMs)}</Text>

      {uri && !isRecording && !isUploading && (
        <TouchableOpacity style={styles.uploadButton} onPress={handleUpload}>
          <Text style={styles.uploadButtonText}>Upload & Save</Text>
        </TouchableOpacity>
      )}

      {isUploading && <ActivityIndicator size="large" color="#0077cc" style={styles.loader} />}

      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 24, fontWeight: '600', marginBottom: 48 },
  recordButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#cc0000',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  recordButtonActive: { backgroundColor: '#880000' },
  recordButtonText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  duration: { fontSize: 32, fontVariant: ['tabular-nums'], marginBottom: 32 },
  uploadButton: {
    backgroundColor: '#0077cc',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
    marginBottom: 16,
  },
  uploadButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  loader: { marginTop: 16 },
  error: { color: '#cc0000', marginTop: 16, textAlign: 'center' },
});
