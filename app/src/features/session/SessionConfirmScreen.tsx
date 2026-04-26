import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  FlatList,
  Keyboard,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { SessionForecast, SessionSpot } from './session.types';
import { createSpot, deleteSession, getSpots, patchSession } from './sessionApi';

type ConfirmNav = NativeStackNavigationProp<RootStackParamList, 'SessionConfirm'>;
type ConfirmRoute = RouteProp<RootStackParamList, 'SessionConfirm'>;

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

interface ForecastRowProps {
  label: string;
  value: number | null;
  unit: string;
}

function ForecastRow({ label, value, unit }: ForecastRowProps) {
  return (
    <View style={styles.forecastRow}>
      <Text style={styles.forecastLabel}>{label}</Text>
      <Text style={styles.forecastValue}>
        {value !== null ? `${value} ${unit}` : '—'}
      </Text>
    </View>
  );
}

function ForecastCard({ forecast }: { forecast: SessionForecast }) {
  return (
    <View style={styles.forecastCard}>
      <Text style={styles.sectionTitle}>Forecast</Text>
      <ForecastRow label="Wave height" value={forecast.wave_height} unit="m" />
      <ForecastRow label="Wind speed" value={forecast.wind_speed} unit="kn" />
      <ForecastRow label="Swell direction" value={forecast.swell_direction} unit="°" />
      <ForecastRow label="Swell height" value={forecast.swell_height} unit="m" />
      <ForecastRow label="Water temp" value={forecast.water_temperature} unit="°C" />
    </View>
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
        <FlatList
          style={styles.suggestionList}
          data={suggestions}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="always"
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.suggestionItem}
              onPress={() => handleSelect(item)}
            >
              <Text style={styles.suggestionText}>{item.name}</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

export default function SessionConfirmScreen() {
  const navigation = useNavigation<ConfirmNav>();
  const route = useRoute<ConfirmRoute>();
  const { result } = route.params;

  const [fields, setFields] = useState<EditableFields>({
    notes: result.session.notes ?? '',
    overall_rating: result.session.overall_rating !== null
      ? String(result.session.overall_rating)
      : '',
  });
  const [spotName, setSpotName] = useState(result.spot?.name ?? '');
  const [spotId, setSpotId] = useState<string | null>(result.spot?.id ?? null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const spotChanged = spotName !== (result.spot?.name ?? '') || spotId !== (result.spot?.id ?? null);
  const hasChanges =
    spotChanged ||
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

      if (spotChanged) {
        let resolvedSpotId = spotId;
        if (resolvedSpotId === null && spotName.trim()) {
          const created = await createSpot(spotName.trim());
          resolvedSpotId = created.id;
        }
        if (resolvedSpotId) updates.spot_id = resolvedSpotId;
      }

      await patchSession(result.session.id, updates);
      navigation.reset({ index: 0, routes: [{ name: 'SessionList' }] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <SpotAutocomplete value={spotName} spotId={spotId} onChange={handleSpotChange} />
      <Text style={styles.date}>{formatDate(result.session.date)}</Text>
      {result.session.lat !== null && result.session.lng !== null && (
        <Text style={styles.coords}>
          {result.session.lat?.toFixed(5)}, {result.session.lng?.toFixed(5)}
        </Text>
      )}

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

      {result.forecast && <ForecastCard forecast={result.forecast} />}

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
  date: { fontSize: 14, color: '#666', marginBottom: 4, marginTop: 4 },
  coords: { fontSize: 12, color: '#999', marginBottom: 20, fontVariant: ['tabular-nums'] },
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
    fontSize: 11,
    fontWeight: '600',
    color: '#0077cc',
    backgroundColor: '#e8f2fb',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
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
    minHeight: 100,
    textAlignVertical: 'top',
  },
  starsRow: { flexDirection: 'row', gap: 8 },
  star: { fontSize: 32, color: '#ccc' },
  starFilled: { color: '#f5a623' },
  forecastCard: {
    backgroundColor: '#f0f6ff',
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
  },
  forecastRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccd8ee',
  },
  forecastLabel: { fontSize: 14, color: '#444' },
  forecastValue: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  error: { color: '#cc0000', marginTop: 16 },
  saveButton: {
    backgroundColor: '#0077cc',
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
