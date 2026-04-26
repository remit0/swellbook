import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Svg, Path } from 'react-native-svg';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Audio, AVPlaybackStatus } from 'expo-av';
import { useAudioRecorder, RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync } from 'expo-audio';
import * as FileSystem from 'expo-file-system';
import * as Location from 'expo-location';
import Slider from '@react-native-community/slider';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { getSessions } from './sessionApi';
import { uploadSession } from './sessionApi';
import { SessionListItem } from './session.types';

type Props = NativeStackScreenProps<RootStackParamList, 'SessionList'>;
type Phase = 'idle' | 'recording' | 'review' | 'uploading';

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function RatingDots({ rating }: { rating: number | null }) {
  return (
    <View style={styles.dots}>
      {[1, 2, 3, 4, 5].map((i) => (
        <View
          key={i}
          style={[styles.dot, rating !== null && i <= rating ? styles.dotFilled : styles.dotEmpty]}
        />
      ))}
    </View>
  );
}

function SessionCard({ item }: { item: SessionListItem }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardLeft}>
        <Text style={styles.cardDate}>{formatDate(item.date)}</Text>
        <Text style={styles.cardSpot}>{item.spot?.name ?? 'Spot inconnu'}</Text>
      </View>
      <RatingDots rating={item.overall_rating} />
    </View>
  );
}

export default function SessionListScreen({ navigation }: Props) {
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [phase, setPhase] = useState<Phase>('idle');
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [durationMs, setDurationMs] = useState(0);
  const [recordError, setRecordError] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);

  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [playbackDurationMs, setPlaybackDurationMs] = useState(0);

  const { width: screenWidth } = useWindowDimensions();
  const [waveOffset, setWaveOffset] = useState(0);

  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const waveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const barWidthAnim = useRef(new Animated.Value(0)).current;
  const pulseRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    Location.requestForegroundPermissionsAsync();
  }, []);

  useEffect(() => {
    getSessions()
      .then(setSessions)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
      if (waveIntervalRef.current) clearInterval(waveIntervalRef.current);
      pulseRef.current?.stop();
      sound?.unloadAsync();
    };
  }, [sound]);

  useEffect(() => {
    const fullWidth = screenWidth - 48;
    if (phase === 'recording') {
      Animated.spring(barWidthAnim, {
        toValue: fullWidth,
        tension: 120,
        friction: 10,
        useNativeDriver: false,
      }).start();
      waveIntervalRef.current = setInterval(() => {
        setWaveOffset((prev) => prev + 0.2);
      }, 50);
    } else {
      Animated.spring(barWidthAnim, {
        toValue: 0,
        tension: 120,
        friction: 10,
        useNativeDriver: false,
      }).start();
      if (waveIntervalRef.current) {
        clearInterval(waveIntervalRef.current);
        waveIntervalRef.current = null;
      }
    }
  }, [phase, screenWidth]);

  function startPulse(): void {
    pulseRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.2, duration: 300, useNativeDriver: true }),
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
    setRecordError(null);
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        setRecordError('Microphone permission required.');
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
      setDurationMs(0);
      setPhase('recording');
      startPulse();
      timerRef.current = setInterval(() => {
        setDurationMs((prev) => prev + 1000);
      }, 1000);
    } catch (err) {
      setRecordError(err instanceof Error ? err.message : 'Failed to start recording');
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
      if (uri) {
        await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
        const { sound: newSound, status } = await Audio.Sound.createAsync({ uri });
        const duration = status.isLoaded && status.durationMillis ? status.durationMillis : 0;
        setSound(newSound);
        setPlaybackDurationMs(duration);
        setPlaybackPosition(0);
        setIsPlaying(false);
        setRecordingUri(uri);
        setPhase('review');
      } else {
        setPhase('idle');
      }
    } catch (err) {
      setRecordError(err instanceof Error ? err.message : 'Failed to stop recording');
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
      setRecordError(err instanceof Error ? err.message : 'Playback error');
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
    if (recordingUri) {
      try {
        await FileSystem.deleteAsync(recordingUri, { idempotent: true });
      } catch {
        // best-effort cleanup
      }
    }
    setRecordingUri(null);
    setIsPlaying(false);
    setPlaybackPosition(0);
    setPlaybackDurationMs(0);
    setRecordError(null);
    setPhase('idle');
  }

  async function handleValidate(): Promise<void> {
    if (!recordingUri) return;
    if (pollRef.current) clearInterval(pollRef.current);
    if (sound) {
      await sound.unloadAsync();
      setSound(null);
    }
    setPhase('uploading');
    setRecordError(null);
    try {
      const result = await uploadSession(recordingUri, location?.lat, location?.lng);
      navigation.navigate('SessionConfirm', { result });
    } catch (err) {
      setRecordError(err instanceof Error ? err.message : 'Upload failed');
      setPhase('review');
    }
  }

  function buildSinePath(contentWidth: number): string {
    const centerY = 20;
    const amplitude = 10;
    const wavelength = 60;
    const points = 40;
    const step = contentWidth / points;
    let d = '';
    for (let i = 0; i <= points; i++) {
      const x = i * step;
      const y = centerY + amplitude * Math.sin((x / wavelength) * 2 * Math.PI + waveOffset);
      d += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
    }
    return d;
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0099cc" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  const showFab = phase === 'idle' || phase === 'recording';

  return (
    <View style={styles.container}>
      <FlatList
        data={sessions}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <SessionCard item={item} />}
        contentContainerStyle={sessions.length === 0 ? styles.centered : styles.list}
        ListEmptyComponent={<Text style={styles.emptyText}>Aucune session enregistrée.</Text>}
      />

      {showFab && (
        <View style={styles.fabContainer}>
          <Animated.View style={[styles.recordingBar, { width: barWidthAnim }, phase !== 'recording' && { opacity: 0 }]}>
            {phase === 'recording' && (
              <>
                <Text style={styles.barTimer}>{formatDuration(durationMs)}</Text>
                <Svg width="100%" height={40} style={styles.barWave}>
                  <Path
                    d={buildSinePath(screenWidth - 48 - 64 - 24 - 16)}
                    stroke="#ffffffaa"
                    strokeWidth={2}
                    fill="none"
                  />
                </Svg>
              </>
            )}
          </Animated.View>
          <Animated.View style={[styles.fab, { transform: [{ scale: scaleAnim }] }]}>
            <Pressable
              style={styles.fabPressable}
              onPressIn={phase === 'idle' ? handlePressIn : undefined}
              onPressOut={phase === 'recording' ? handlePressOut : undefined}
            >
              <Text style={styles.fabIcon}>🎙</Text>
            </Pressable>
          </Animated.View>
        </View>
      )}

      {(phase === 'review' || phase === 'uploading') && (
        <View style={styles.bottomPanel}>
          {phase === 'uploading' ? (
            <View style={styles.uploadingRow}>
              <ActivityIndicator color="#0077cc" />
              <Text style={styles.uploadingText}>Analysing your session…</Text>
            </View>
          ) : (
            <>
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

              {recordError && <Text style={styles.recordErrorText}>{recordError}</Text>}

              <View style={styles.reviewActions}>
                <Pressable style={styles.validateButton} onPress={handleValidate}>
                  <Text style={styles.validateText}>Validate</Text>
                </Pressable>
                <Pressable style={styles.discardButton} onPress={handleDiscard}>
                  <Text style={styles.discardText}>Discard</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
      )}

      {phase === 'idle' && recordError && (
        <Text style={styles.recordErrorText}>{recordError}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    padding: 16,
    paddingBottom: 180,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardLeft: {
    flex: 1,
  },
  cardDate: {
    fontSize: 13,
    color: '#888',
    marginBottom: 4,
  },
  cardSpot: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  dots: {
    flexDirection: 'row',
    gap: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotFilled: {
    backgroundColor: '#0099cc',
  },
  dotEmpty: {
    backgroundColor: '#ddd',
  },
  emptyText: {
    fontSize: 15,
    color: '#aaa',
  },
  errorText: {
    fontSize: 15,
    color: '#cc3300',
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  fabContainer: {
    position: 'absolute',
    bottom: 24,
    left: 24,
    right: 24,
    height: 64,
  },
  recordingBar: {
    position: 'absolute',
    right: 0,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#0099cc',
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 72,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  barTimer: {
    color: '#fff',
    fontSize: 14,
    fontVariant: ['tabular-nums'],
    marginRight: 8,
    minWidth: 42,
  },
  barWave: {
    flex: 1,
  },
  fab: {
    position: 'absolute',
    right: 0,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#0099cc',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  fabPressable: {
    flex: 1,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabIcon: {
    fontSize: 26,
  },
  bottomPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 10,
  },
  playbackBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f2f2f2',
    borderRadius: 32,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  playPauseButton: { marginRight: 6 },
  playPauseText: { fontSize: 20 },
  slider: { flex: 1, marginHorizontal: 6 },
  durationLabel: {
    fontSize: 13,
    color: '#444',
    minWidth: 36,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  reviewActions: {
    flexDirection: 'row',
    gap: 12,
  },
  validateButton: {
    flex: 1,
    backgroundColor: '#0077cc',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  validateText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  discardButton: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#cc0000',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  discardText: { color: '#cc0000', fontSize: 16, fontWeight: '600' },
  uploadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  uploadingText: { fontSize: 15, color: '#444' },
  recordErrorText: {
    color: '#cc0000',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 8,
  },
});
