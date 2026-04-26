import { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../config/supabase';
import RecorderScreen from '../features/recorder/RecorderScreen';
import SessionDetailsScreen from '../features/session/SessionDetailsScreen';
import SessionListScreen from '../features/session/SessionListScreen';
import LoginScreen from '../features/auth/LoginScreen';
import { CreateSessionResult } from '../features/session/session.types';

export type RootStackParamList = {
  SessionList: undefined;
  Recorder: undefined;
  SessionDetails: { result: CreateSessionResult };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) return null;

  if (!session) return <LoginScreen />;

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="SessionList">
        <Stack.Screen
          name="SessionList"
          component={SessionListScreen}
          options={{ title: 'SwellBook' }}
        />
        <Stack.Screen
          name="Recorder"
          component={RecorderScreen}
          options={{ title: 'Nouvelle session' }}
        />
        <Stack.Screen
          name="SessionDetails"
          component={SessionDetailsScreen}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
