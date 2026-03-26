import React from 'react';
import { Navigation } from 'react-native-navigation';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { COMPONENTS } from './componentNames';
import { SplashScreen } from '../screens/SplashScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { HomeNewsScreen } from '../screens/HomeNewsScreen';
import { NewsDetailScreen } from '../screens/NewsDetailScreen';
import { ZonesBrowseScreen } from '../screens/ZonesBrowseScreen';
import { ZoneDetailScreen } from '../screens/ZoneDetailScreen';
import { PorteriaLogScreen } from '../screens/PorteriaLogScreen';
import { CreateReservationScreen } from '../screens/CreateReservationScreen';
import { ProfileQrScreen } from '../screens/ProfileQrScreen';

function withSafeArea<P extends object>(Component: React.ComponentType<P>): React.ComponentType<P> {
  return (props: P) => (
    <SafeAreaProvider>
      <Component {...props} />
    </SafeAreaProvider>
  );
}

export function registerScreens() {
  Navigation.registerComponent(COMPONENTS.splash, () => withSafeArea(SplashScreen));
  Navigation.registerComponent(COMPONENTS.login, () => withSafeArea(LoginScreen));
  Navigation.registerComponent(COMPONENTS.homeNews, () => withSafeArea(HomeNewsScreen));
  Navigation.registerComponent(COMPONENTS.newsDetail, () => withSafeArea(NewsDetailScreen));
  Navigation.registerComponent(COMPONENTS.zonesBrowse, () => withSafeArea(ZonesBrowseScreen));
  Navigation.registerComponent(COMPONENTS.zoneDetail, () => withSafeArea(ZoneDetailScreen));
  Navigation.registerComponent(COMPONENTS.porteriaLog, () => withSafeArea(PorteriaLogScreen));
  Navigation.registerComponent(COMPONENTS.createReservation, () => withSafeArea(CreateReservationScreen));
  Navigation.registerComponent(COMPONENTS.profileQr, () => withSafeArea(ProfileQrScreen));
}
