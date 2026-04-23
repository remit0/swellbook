import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export default function App() {
  const [status, setStatus] = useState('checking...');
  console.log('API URL:', process.env.EXPO_PUBLIC_API_URL);
  useEffect(() => {
    fetch(`${API_URL}/health`)
      .then(res => res.json())
      .then(data => setStatus(data.status))
      .catch(err => setStatus(`error: ${err.message}`));
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>SwellBook</Text>
      <Text>Backend: {status}</Text>
    </View>
  );
}
