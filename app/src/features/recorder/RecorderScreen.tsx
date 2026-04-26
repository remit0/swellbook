import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Animated,
} from 'react-native';
import { useAudioRecorder, RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync } from 'expo-audio';
import { Audio, AVPlaybackStatus } from 'expo-av';
import * as Location from 'expo-location';
import Slider from '@react-native-community/slider';
import * as FileSystem from 'expo-file-system';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { RecordingState } from './recorder.types';
import { uploadSession } from '../session/sessionApi';

type RecorderNav = NativeStackNavigationProp<RootStackParamList, 'Recorder'>;
type Phase = 'idle' | 'recording' | 'review' | 'uploading';

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export default function RecorderScreen() {
  const navigation = useNavigation<RecorderNav>();
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const [phase, setPhase] = useState<Phase>('idle');
  const [recordingState, setRecordingState] = useState<RecordingState>({
    isRecording: false,
    uri: null,
    durationMs: 0,
  });
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [playbackDurationMs, setPlaybackDurationMs] = useState(0);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
      pulseRef.current?.stop();
      sound?.unloadAsync();
    };
  }, [sound]);

  function startPulse(): void {
    pulseRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.15, duration: 300, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      ])
    );
    pulseRef.current.start();
  }

  function stopPulse(): void {
    pulseRef.current?.stop();
    scaleAnim.setValue(1);
  }

  async function handlePressIn(): Promise<void> {
    setError(null);
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        setError('Microphone permission is required to record a session.');
        return;
      }

      const { status: locStatus } = await Location.requestForegroundPermissionsAsync();
      if (locStatus === 'granted') {
        try {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        } catch {
          setLocation(null);
        }
      } else {
        setLocation(null);
      }

      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await audioRecorder.prepareToRecordAsync();
      await audioRecorder.record();
      setRecordingState({ isRecording: true, uri: null, durationMs: 0 });
      setPhase('recording');
      startPulse();
      timerRef.current = setInterval(() => {
        setRecordingState((prev) => ({ ...prev, durationMs: prev.durationMs + 1000 }));
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start recording');
    }
  }

  async function handlePressOut(): Promise<void> {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    stopPulse();
    try {
      await audioRecorder.stop();
      const uri = audioRecorder.uri;
      setRecordingState((prev) => ({ ...prev, isRecording: false, uri }));

      if (uri) {
        await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
        const { sound: newSound, status } = await Audio.Sound.createAsync({ uri });
        const durationMs =
          status.isLoaded && status.durationMillis ? status.durationMillis : 0;
        setSound(newSound);
        setPlaybackDurationMs(durationMs);
        setPlaybackPosition(0);
        setIsPlaying(false);
        setPhase('review');
      } else {
        setPhase('idle');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop recording');
      setPhase('idle');
    }
  }

  function startPlaybackPoll(activeSound: Audio.Sound): void {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const status: AVPlaybackStatus = await activeSound.getStatusAsync();
      if (!status.isLoaded) return;
      const duration = status.durationMillis ?? 1;
      setPlaybackPosition(status.positionMillis / duration);
      if (status.didJustFinish) {
        setIsPlaying(false);
        setPlaybackPosition(0);
        if (pollRef.current) clearInterval(pollRef.current);
      }
    }, 200);
  }

  async function togglePlayback(): Promise<void> {
    if (!sound) return;
    try {
      const status: AVPlaybackStatus = await sound.getStatusAsync();
      if (!status.isLoaded) return;
      if (isPlaying) {
        await sound.pauseAsync();
        setIsPlaying(false);
        if (pollRef.current) clearInterval(pollRef.current);
      } else {
        if (status.didJustFinish || status.positionMillis >= (status.durationMillis ?? 0)) {
          await sound.setPositionAsync(0);
        }
        await sound.playAsync();
        setIsPlaying(true);
        startPlaybackPoll(sound);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Playback error');
    }
  }

  async function handleSliderChange(value: number): Promise<void> {
    if (!sound) return;
    const status: AVPlaybackStatus = await sound.getStatusAsync();
    if (!status.isLoaded || !status.durationMillis) return;
    await sound.setPositionAsync(Math.floor(value * status.durationMillis));
    setPlaybackPosition(value);
  }

  async function handleDiscard(): Promise<void> {
    if (pollRef.current) clearInterval(pollRef.current);
    if (sound) {
      await sound.unloadAsync();
      setSound(null);
    }
    const uri = recordingState.uri;
    if (uri) {
      try {
        await FileSystem.deleteAsync(uri, { idempotent: true });
      } catch {
        // file cleanup is best-effort
      }
    }
    setRecordingState({ isRecording: false, uri: null, durationMs: 0 });
    setIsPlaying(false);
    setPlaybackPosition(0);
    setPlaybackDurationMs(0);
    setError(null);
    setPhase('idle');
  }

  async function handleUpload(): Promise<void> {
    if (!recordingState.uri) return;
    if (pollRef.current) clearInterval(pollRef.current);
    if (sound) {
      await sound.unloadAsync();
      setSound(null);
    }
    setPhase('uploading');
    setError(null);
    try {
      const result = await uploadSession(recordingState.uri, location?.lat, location?.lng);
      navigation.navigate('SessionConfirm', { result });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setPhase('review');
    }
  }

  if (phase === 'uploading') {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0077cc" />
        <Text style={styles.analysingText}>Analysing your session…</Text>
      </View>
    );
  }

  if (phase === 'review') {
    return (
      <View style={styles.container}>
        <View style={styles.playbackBar}>
          <Pressable onPress={togglePlayback} style={styles.playPauseButton}>
            <Text style={styles.playPauseText}>{isPlaying ? '⏸' : '▶'}</Text>
          </Pressable>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={1}
            value={playbackPosition}
            onSlidingComplete={handleSliderChange}
            minimumTrackTintColor="#0077cc"
            maximumTrackTintColor="#ccc"
            thumbTintColor="#0077cc"
          />
          <Text style={styles.durationLabel}>{formatDuration(playbackDurationMs)}</Text>
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        <View style={styles.reviewActions}>
          <Pressable style={styles.validateButton} onPress={handleUpload}>
            <Text style={styles.validateText}>Validate</Text>
          </Pressable>
          <Pressable style={styles.discardButton} onPress={handleDiscard}>
            <Text style={styles.discardText}>Discard</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <Pressable
          style={styles.recordButton}
          onPressIn={phase === 'idle' ? handlePressIn : undefined}
          onPressOut={phase === 'recording' ? handlePressOut : undefined}
        >
          <Text style={styles.micIcon}>🎙</Text>
        </Pressable>
      </Animated.View>

      {phase === 'recording' ? (
        <Text style={styles.duration}>{formatDuration(recordingState.durationMs)}</Text>
      ) : (
        <Text style={styles.holdLabel}>Hold to record</Text>
      )}

      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  recordButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#cc0000',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  micIcon: { fontSize: 40 },
  holdLabel: { fontSize: 16, color: '#666', marginTop: 8 },
  duration: { fontSize: 32, fontVariant: ['tabular-nums'], marginTop: 8 },
  analysingText: { marginTop: 16, fontSize: 16, color: '#444' },
  playbackBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f2f2f2',
    borderRadius: 32,
    paddingVertical: 12,
    paddingHorizontal: 16,
    width: '100%',
    marginBottom: 32,
  },
  playPauseButton: { marginRight: 8 },
  playPauseText: { fontSize: 22 },
  slider: { flex: 1, marginHorizontal: 8 },
  durationLabel: { fontSize: 14, color: '#444', minWidth: 36, textAlign: 'right' },
  reviewActions: { flexDirection: 'row', gap: 16 },
  validateButton: {
    flex: 1,
    backgroundColor: '#0077cc',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  validateText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  discardButton: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#cc0000',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  discardText: { color: '#cc0000', fontSize: 16, fontWeight: '600' },
  error: { color: '#cc0000', marginTop: 16, textAlign: 'center' },
});
