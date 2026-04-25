import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { getSessions } from './sessionApi';
import { SessionListItem } from './session.types';

type Props = NativeStackScreenProps<RootStackParamList, 'SessionList'>;

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
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

  useEffect(() => {
    getSessions()
      .then(setSessions)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

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

  return (
    <View style={styles.container}>
      <FlatList
        data={sessions}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <SessionCard item={item} />}
        contentContainerStyle={sessions.length === 0 ? styles.centered : styles.list}
        ListEmptyComponent={<Text style={styles.emptyText}>Aucune session enregistrée.</Text>}
      />
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('Recorder')}
        activeOpacity={0.8}
      >
        <Text style={styles.fabIcon}>🎙</Text>
      </TouchableOpacity>
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
    paddingBottom: 96,
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
  fab: {
    position: 'absolute',
    bottom: 32,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#0099cc',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  fabIcon: {
    fontSize: 26,
  },
});
