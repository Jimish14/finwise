import React, { useContext } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack'; // NEW IMPORT
import { AuthContext } from '../context/AuthContext';
import { ActivityIndicator, View } from 'react-native';
import InvestmentsScreen from '../screens/InvestmentsScreen';
import AuthStack from './AuthStack';
import MainTabs from './MainTabs';
import TransactionsScreen from '../screens/TransactionsScreen';
import GoalDetailsScreen from '../screens/GoalDetailsScreen'; // NEW IMPORT

const Stack = createNativeStackNavigator(); // NEW STACK

// We create a new Stack just for logged-in users
const AuthenticatedStack = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen name="GoalDetails" component={GoalDetailsScreen} />
      <Stack.Screen name="Transactions" component={TransactionsScreen} />
    </Stack.Navigator>

  );
};

const AppNavigator = () => {
  const { user, isLoading } = useContext(AuthContext);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#1d4ed8" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {/* Instead of going straight to MainTabs, we go to the AuthenticatedStack */}
      {user ? <AuthenticatedStack /> : <AuthStack />}
    </NavigationContainer>
  );
};

export default AppNavigator;