/**
 * @format
 */

import { Navigation } from 'react-native-navigation';
import { registerScreens } from './src/navigation/registerScreens';
import { callService } from './src/realtime/calls/callService';
import {
  setDefaultNavigationOptions,
  setSplashRoot,
} from './src/navigation/root';

callService.bootstrap();
registerScreens();

Navigation.events().registerAppLaunchedListener(() => {
  setDefaultNavigationOptions();
  setSplashRoot();
});
