import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { SessionForecast } from './session.types';
import { patchSession } from './sessionApi';

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
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasChanges =
    fields.notes !== (result.session.notes ?? '') ||
    fields.overall_rating !== (result.session.overall_rating !== null
      ? String(result.session.overall_rating)
      : '');

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
      await patchSession(result.session.id, {
        notes: fields.notes || null,
        overall_rating: rating,
      });
      navigation.reset({ index: 0, routes: [{ name: 'SessionList' }] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.spotName}>{result.spot?.name ?? 'Unknown spot'}</Text>
      <Text style={styles.date}>{formatDate(result.session.date)}</Text>

      <Text style={styles.sectionTitle}>Notes</Text>
      <TextInput
        style={styles.notesInput}
        value={fields.notes}
        onChangeText={(text) => setFields((prev) => ({ ...prev, notes: text }))}
        placeholder="Add session notes..."
        multiline
        numberOfLines={4}
      />

      <Text style={styles.sectionTitle}>Overall Rating (1–5)</Text>
      <TextInput
        style={styles.ratingInput}
        value={fields.overall_rating}
        onChangeText={(text) => setFields((prev) => ({ ...prev, overall_rating: text }))}
        placeholder="e.g. 4"
        keyboardType="numeric"
        maxLength={1}
      />

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

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingBottom: 48 },
  spotName: { fontSize: 26, fontWeight: '700', marginBottom: 4 },
  date: { fontSize: 14, color: '#666', marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 8, marginTop: 16 },
  notesInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  ratingInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    width: 80,
  },
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
});
