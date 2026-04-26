import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Keyboard,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { SessionForecast, SessionSpot } from './session.types';
import { createSpot, deleteSession, getSpots, patchSession, patchSpot } from './sessionApi';

type DetailsNav = NativeStackNavigationProp<RootStackParamList, 'SessionDetails'>;
type DetailsRoute = RouteProp<RootStackParamList, 'SessionDetails'>;

interface EditableFields {
  notes: string;
  overall_rating: string;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-GB', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

const COMPASS_DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

function degreesToCompass(deg: number): string {
  return COMPASS_DIRS[Math.round(deg / 45) % 8];
}

function msToKmh(ms: number | null): number | null {
  return ms !== null ? Math.round(ms * 3.6 * 10) / 10 : null;
}

interface ForecastRowProps {
  label: string;
  value: string | number | null;
  unit?: string;
  isLast?: boolean;
}

function ForecastRow({ label, value, unit = '', isLast }: ForecastRowProps) {
  const display = value !== null
    ? (unit ? `${value} ${unit}` : `${value}`)
    : '—';
  return (
    <View style={[styles.forecastRow, isLast && styles.forecastRowLast]}>
      <Text style={styles.forecastLabel}>{label}</Text>
      <Text style={styles.forecastValue}>{display}</Text>
    </View>
  );
}

function ForecastCard({ forecast }: { forecast: SessionForecast }) {
  const windKmh = msToKmh(forecast.wind_speed);
  const swellCompass = forecast.swell_direction !== null
    ? degreesToCompass(forecast.swell_direction)
    : null;

  return (
    <>
      <Text style={styles.sectionTitle}>Forecast</Text>
      <View style={styles.forecastCard}>
        <ForecastRow label="Wave height" value={forecast.wave_height} unit="m" />
        <ForecastRow label="Wind speed" value={windKmh} unit="km/h" />
        <ForecastRow label="Swell direction" value={swellCompass} />
        <ForecastRow label="Swell period" value={forecast.swell_period} unit="s" isLast />
      </View>
    </>
  );
}

interface SpotAutocompleteProps {
  value: string;
  spotId: string | null;
  onChange: (name: string, id: string | null) => void;
}

function SpotAutocomplete({ value, spotId, onChange }: SpotAutocompleteProps) {
  const [allSpots, setAllSpots] = useState<SessionSpot[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    getSpots().then(setAllSpots).catch(() => {});
  }, []);

  const suggestions = value.trim().length > 0
    ? allSpots.filter((s) =>
        s.name.toLowerCase().includes(value.toLowerCase()) &&
        s.name.toLowerCase() !== value.toLowerCase()
      )
    : [];

  function handleChangeText(text: string): void {
    onChange(text, null);
    setShowSuggestions(true);
  }

  function handleSelect(spot: SessionSpot): void {
    onChange(spot.name, spot.id);
    setShowSuggestions(false);
    Keyboard.dismiss();
  }

  const isNew = value.trim().length > 0 && spotId === null &&
    !allSpots.some((s) => s.name.toLowerCase() === value.toLowerCase());

  return (
    <View style={styles.autocompleteWrapper}>
      <View style={styles.spotInputRow}>
        <TextInput
          ref={inputRef}
          style={styles.spotInput}
          value={value}
          onChangeText={handleChangeText}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          placeholder="Spot name"
          autoCorrect={false}
        />
        {isNew && <Text style={styles.newBadge}>New</Text>}
      </View>
      {showSuggestions && suggestions.length > 0 && (
        <View style={styles.suggestionList}>
          {suggestions.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.suggestionItem}
              onPress={() => handleSelect(item)}
            >
              <Text style={styles.suggestionText}>{item.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

export default function SessionDetailsScreen() {
  const navigation = useNavigation<DetailsNav>();
  const route = useRoute<DetailsRoute>();
  const { result } = route.params;

  const [fields, setFields] = useState<EditableFields>({
    notes: result.session.notes ?? '',
    overall_rating: result.session.overall_rating !== null
      ? String(result.session.overall_rating)
      : '',
  });
  const [spotName, setSpotName] = useState(result.spot?.name ?? '');
  const [spotId, setSpotId] = useState<string | null>(result.spot?.id ?? null);
  const [spotLat, setSpotLat] = useState<string>(result.spot?.lat?.toFixed(5) ?? '');
  const [spotLng, setSpotLng] = useState<string>(result.spot?.lng?.toFixed(5) ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const spotChanged = spotName !== (result.spot?.name ?? '') || spotId !== (result.spot?.id ?? null);
  const spotCoordsChanged =
    spotLat !== (result.spot?.lat?.toFixed(5) ?? '') ||
    spotLng !== (result.spot?.lng?.toFixed(5) ?? '');
  const hasChanges =
    spotChanged ||
    spotCoordsChanged ||
    fields.notes !== (result.session.notes ?? '') ||
    fields.overall_rating !== (result.session.overall_rating !== null
      ? String(result.session.overall_rating)
      : '');

  function handleSpotChange(name: string, id: string | null): void {
    setSpotName(name);
    setSpotId(id);
  }

  async function handleDeleteSession(): Promise<void> {
    setIsDeleting(true);
    setError(null);
    try {
      await deleteSession(result.session.id);
      navigation.reset({ index: 0, routes: [{ name: 'SessionList' }] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
      setIsDeleting(false);
    }
  }

  async function handleSaveChanges(): Promise<void> {
    setIsSaving(true);
    setError(null);
    try {
      let rating: number | null = null;
      if (fields.overall_rating !== '') {
        const parsed = parseInt(fields.overall_rating, 10);
        if (isNaN(parsed) || parsed < 1 || parsed > 5) {
          setError('Rating must be a number between 1 and 5');
          setIsSaving(false);
          return;
        }
        rating = parsed;
      }

      const updates: Parameters<typeof patchSession>[1] = {
        notes: fields.notes || null,
        overall_rating: rating,
      };

      let resolvedSpotId = spotId;

      if (spotChanged) {
        if (resolvedSpotId === null && spotName.trim()) {
          const created = await createSpot(spotName.trim(), result.session.lat, result.session.lng);
          resolvedSpotId = created.id;
          setSpotId(created.id);
          setSpotLat(created.lat?.toFixed(5) ?? '');
          setSpotLng(created.lng?.toFixed(5) ?? '');
        }
        if (resolvedSpotId) updates.spot_id = resolvedSpotId;
      }

      if (spotCoordsChanged && resolvedSpotId) {
        const parsedLat = spotLat.trim() !== '' ? parseFloat(spotLat) : null;
        const parsedLng = spotLng.trim() !== '' ? parseFloat(spotLng) : null;
        if ((parsedLat !== null && isNaN(parsedLat)) || (parsedLng !== null && isNaN(parsedLng))) {
          setError('Coordinates must be valid numbers');
          setIsSaving(false);
          return;
        }
        await patchSpot(resolvedSpotId, parsedLat, parsedLng);
      }

      await patchSession(result.session.id, updates);
      navigation.goBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Text style={styles.backButtonText}>← Sessions</Text>
      </TouchableOpacity>
      <SpotAutocomplete value={spotName} spotId={spotId} onChange={handleSpotChange} />
      <Text style={styles.date}>{formatDate(result.session.date)}</Text>
      {spotId !== null && (
        <View style={styles.coordsRow}>
          <Text style={styles.coordLabel}>Lat</Text>
          <TextInput
            style={styles.coordInput}
            value={spotLat}
            onChangeText={setSpotLat}
            placeholder="—"
            keyboardType="decimal-pad"
            autoCorrect={false}
          />
          <Text style={styles.coordSep}>·</Text>
          <Text style={styles.coordLabel}>Lng</Text>
          <TextInput
            style={styles.coordInput}
            value={spotLng}
            onChangeText={setSpotLng}
            placeholder="—"
            keyboardType="decimal-pad"
            autoCorrect={false}
          />
        </View>
      )}

      {result.forecast && <ForecastCard forecast={result.forecast} />}

      <Text style={styles.sectionTitle}>Notes</Text>
      <TextInput
        style={styles.notesInput}
        value={fields.notes}
        onChangeText={(text) => setFields((prev) => ({ ...prev, notes: text }))}
        placeholder="Add session notes..."
        multiline
        numberOfLines={4}
      />

      <Text style={styles.sectionTitle}>Overall Rating</Text>
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            onPress={() => setFields((prev) => ({ ...prev, overall_rating: String(star) }))}
          >
            <Text style={[styles.star, Number(fields.overall_rating) >= star && styles.starFilled]}>
              ★
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity
        style={[styles.saveButton, (!hasChanges || isSaving) && styles.saveButtonDisabled]}
        onPress={handleSaveChanges}
        disabled={!hasChanges || isSaving}
      >
        {isSaving
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.saveButtonText}>Save Changes</Text>}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.deleteButton, isDeleting && styles.deleteButtonDisabled]}
        onPress={handleDeleteSession}
        disabled={isDeleting}
      >
        {isDeleting
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.deleteButtonText}>Delete Session</Text>}
      </TouchableOpacity>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 64, paddingBottom: 48 },
  backButton: { alignSelf: 'flex-start', marginBottom: 16 },
  backButtonText: { fontSize: 16, color: '#0055ff', fontWeight: '500' },
  date: { fontSize: 14, color: '#666', marginBottom: 4, marginTop: 4 },
  coordsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 6 },
  coordLabel: { fontSize: 11, color: '#aaa', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  coordInput: { fontSize: 12, color: '#888', fontVariant: ['tabular-nums'], flex: 1, paddingVertical: 2 },
  coordSep: { fontSize: 12, color: '#ccc', marginHorizontal: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 8, marginTop: 16 },
  autocompleteWrapper: { zIndex: 10 },
  spotInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  spotInput: {
    flex: 1,
    fontSize: 26,
    fontWeight: '700',
    paddingVertical: 4,
    paddingHorizontal: 0,
    color: '#1a1a1a',
  },
  newBadge: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
    backgroundColor: '#0077cc',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    overflow: 'hidden',
  },
  suggestionList: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginTop: 4,
    maxHeight: 180,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  suggestionItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  suggestionText: { fontSize: 16, color: '#1a1a1a' },
  notesInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    minHeight: 150,
    textAlignVertical: 'top',
  },
  starsRow: { flexDirection: 'row', gap: 8 },
  star: { fontSize: 32, color: '#ccc' },
  starFilled: { color: '#f5a623' },
  forecastCard: {
    backgroundColor: '#eef4ff',
    borderRadius: 14,
    padding: 16,
    marginTop: 0,
    marginBottom: 4,
  },
  forecastRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#c8d8f0',
  },
  forecastRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  forecastLabel: { fontSize: 15, color: '#555' },
  forecastValue: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  error: { color: '#cc0000', marginTop: 16 },
  saveButton: {
    backgroundColor: '#0055ff',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 24,
  },
  saveButtonDisabled: { backgroundColor: '#99c2e8' },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  deleteButton: {
    backgroundColor: '#cc2200',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  deleteButtonDisabled: { backgroundColor: '#e08070' },
  deleteButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
