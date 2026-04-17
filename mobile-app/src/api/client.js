import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// UPDATE THIS TO YOUR COMPUTER'S LOCAL IP ADDRESS (e.g., 192.168.1.100)
const BASE_URL = 'http://10.21.31.90:5001/api'; 

const client = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

client.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (token) config.headers.Authorization = `Bearer ${token}`;
    } catch (error) {
      console.error('Error fetching token:', error);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default client;