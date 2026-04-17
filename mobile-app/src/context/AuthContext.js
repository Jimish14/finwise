import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import client from '../api/client';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const token = await AsyncStorage.getItem('userToken');
        const userInfo = await AsyncStorage.getItem('userInfo');
        if (token && userInfo) {
          setUser(JSON.parse(userInfo));
        }
      } catch (error) {
        console.error("Failed to load user data", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadUser();
  }, []);

  const login = async (email, password) => {
    try {
      const response = await client.post('/auth/login', { email, password });
      
      // FIXED: We must look inside response.data.data to get your backend payload!
      const { token, ...userData } = response.data.data;
      
      // AsyncStorage requires strings. This was crashing before because token was undefined!
      await AsyncStorage.setItem('userToken', String(token));
      await AsyncStorage.setItem('userInfo', JSON.stringify(userData));
      
      setUser(userData);
      return { success: true };
    } catch (error) {
      console.error("Login Error Details:", error.response?.data || error.message);
      
      // FIXED: Your backend sends the error message under the "error" key, not "message"
      const backendError = error.response?.data?.error;
      
      return { 
        success: false, 
        message: backendError || 'Network error. Make sure your local IP is correct and the server is running.' 
      };
    }
  };

  const logout = async () => {
    await AsyncStorage.removeItem('userToken');
    await AsyncStorage.removeItem('userInfo');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};