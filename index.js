/**
 * @format
 */

import notifee from '@notifee/react-native';
import {
  getMessaging,
  setBackgroundMessageHandler,
} from '@react-native-firebase/messaging';
import { Navigation } from 'react-native-navigation';
import { registerScreens } from './src/navigation/registerScreens';
import { callService } from './src/realtime/calls/callService';
import { errorLogger } from './src/services/errorLogger';
import {
  setDefaultNavigationOptions,
  setSplashRoot,
} from './src/navigation/root';

errorLogger.init();

notifee.onBackgroundEvent(async (event) => {
  await callService.handleNotifeeBackgroundEvent(event);
});

setBackgroundMessageHandler(getMessaging(), async (remoteMessage) => {
  await callService.handleFirebaseRemoteMessage(remoteMessage);
});

callService.bootstrap();
registerScreens();

Navigation.events().registerAppLaunchedListener(() => {
  setDefaultNavigationOptions();
  setSplashRoot();
});
