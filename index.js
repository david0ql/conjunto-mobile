/**
 * @format
 */

import { Navigation } from 'react-native-navigation';
import { registerScreens } from './src/navigation/registerScreens';
import {
  setDefaultNavigationOptions,
  setSplashRoot,
} from './src/navigation/root';

registerScreens();

Navigation.events().registerAppLaunchedListener(() => {
  setDefaultNavigationOptions();
  setSplashRoot();
});
