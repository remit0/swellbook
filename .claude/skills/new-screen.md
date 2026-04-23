---
name: new-screen
description: Create a new React Native screen with proper structure and states
---

When creating a new screen {ScreenName} for feature {feature_name}:

1. Create file: app/src/features/{feature_name}/{ScreenName}Screen.tsx

2. Follow this structure:

   ```typescript
   import { useState, useEffect } from 'react';
   import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';

   interface {ScreenName}ScreenProps {
     // navigation props if needed
   }

   export default function {ScreenName}Screen({}: {ScreenName}ScreenProps) {
     const [loading, setLoading] = useState(true);
     const [error, setError] = useState<string | null>(null);
     const [data, setData] = useState<{Type} | null>(null);

     useEffect(() => {
       // fetch data
     }, []);

     if (loading) {
       return (
         <View style={styles.centered}>
           <ActivityIndicator />
         </View>
       );
     }

     if (error) {
       return (
         <View style={styles.centered}>
           <Text style={styles.error}>{error}</Text>
         </View>
       );
     }

     return (
       <View style={styles.container}>
         {/* main content */}
       </View>
     );
   }

   const styles = StyleSheet.create({
     container: { flex: 1, padding: 16 },
     centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
     error: { color: 'red' },
   });
   ```

3. Keep the component under 150 lines — extract sub-components if needed

4. Add to navigation in app/src/navigation/AppNavigator.tsx

5. Verify TypeScript compiles: npx tsc --noEmit