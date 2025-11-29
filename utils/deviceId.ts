import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

const DEVICE_ID_KEY = '@device_id';

let cachedDeviceId: string | null = null;

function generateRandomString(length: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function getDeviceId(): Promise<string> {
  if (cachedDeviceId) {
    return cachedDeviceId;
  }

  try {
    let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
    
    if (!deviceId) {
      const randomString = generateRandomString(32);
      const sessionId = Constants.sessionId || generateRandomString(16);
      
      deviceId = `${Platform.OS}-${randomString}-${sessionId}-${Date.now()}`;
      
      await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
      console.log('[DeviceID] Generated new device ID:', deviceId.substring(0, 20) + '...');
    } else {
      console.log('[DeviceID] Using existing device ID:', deviceId.substring(0, 20) + '...');
    }
    
    cachedDeviceId = deviceId;
    return deviceId;
  } catch (error) {
    console.error('[DeviceID] Error generating device ID:', error);
    return `fallback-${Platform.OS}-${Date.now()}`;
  }
}

export function clearDeviceId() {
  cachedDeviceId = null;
  AsyncStorage.removeItem(DEVICE_ID_KEY);
}
