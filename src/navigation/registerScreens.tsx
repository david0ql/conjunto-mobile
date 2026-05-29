import React from 'react';
import { Navigation } from 'react-native-navigation';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { COMPONENTS } from './componentNames';
import { SplashScreen } from '../screens/SplashScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { HomeNewsScreen } from '../screens/HomeNewsScreen';
import { NewsDetailScreen } from '../screens/NewsDetailScreen';
import { ZonesBrowseScreen } from '../screens/ZonesBrowseScreen';
import { PorteriaLogScreen } from '../screens/PorteriaLogScreen';
import { CreateReservationScreen } from '../screens/CreateReservationScreen';
import { ProfileQrScreen } from '../screens/ProfileQrScreen';
import { AssemblyVotingScreen } from '../screens/AssemblyVotingScreen';
import { PoolControlScreen } from '../screens/PoolControlScreen';
import { PoolEntriesScreen } from '../screens/PoolEntriesScreen';
import { EmployeeProfileScreen } from '../screens/EmployeeProfileScreen';
import { PorteroPackagesScreen } from '../screens/PorteroPackagesScreen';
import { PorteroLinesScreen } from '../screens/PorteroLinesScreen';
import { PorteroCallScreen } from '../screens/PorteroCallScreen';
import { CallOverlayScreen } from '../screens/CallOverlayScreen';

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
  Navigation.registerComponent(COMPONENTS.porteriaLog, () => withSafeArea(PorteriaLogScreen));
  Navigation.registerComponent(COMPONENTS.createReservation, () => withSafeArea(CreateReservationScreen));
  Navigation.registerComponent(COMPONENTS.profileQr, () => withSafeArea(ProfileQrScreen));
  Navigation.registerComponent(COMPONENTS.assemblyVoting, () => withSafeArea(AssemblyVotingScreen));
  Navigation.registerComponent(COMPONENTS.poolControl, () => withSafeArea(PoolControlScreen));
  Navigation.registerComponent(COMPONENTS.poolEntries, () => withSafeArea(PoolEntriesScreen));
  Navigation.registerComponent(COMPONENTS.employeeProfile, () => withSafeArea(EmployeeProfileScreen));
  Navigation.registerComponent(COMPONENTS.porteroPackages, () => withSafeArea(PorteroPackagesScreen));
  Navigation.registerComponent(COMPONENTS.porteroLines, () => withSafeArea(PorteroLinesScreen));
  Navigation.registerComponent(COMPONENTS.porteroCall, () => withSafeArea(PorteroCallScreen));
  Navigation.registerComponent(COMPONENTS.callOverlay, () => CallOverlayScreen);
}
