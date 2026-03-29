/**
 * @format
 */

import messaging from '@react-native-firebase/messaging';
import { Navigation } from 'react-native-navigation';
import { registerScreens } from './src/navigation/registerScreens';
import { callService } from './src/realtime/calls/callService';
import {
  setDefaultNavigationOptions,
  setSplashRoot,
} from './src/navigation/root';

messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  await callService.handleFirebaseRemoteMessage(remoteMessage);
});

callService.bootstrap();
registerScreens();

Navigation.events().registerAppLaunchedListener(() => {
  setDefaultNavigationOptions();
  setSplashRoot();
});
