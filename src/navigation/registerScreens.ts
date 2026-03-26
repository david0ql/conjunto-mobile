import { Navigation } from 'react-native-navigation';
import { COMPONENTS } from './componentNames';
import { SplashScreen } from '../screens/SplashScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { HomeNewsScreen } from '../screens/HomeNewsScreen';
import { ZonesBrowseScreen } from '../screens/ZonesBrowseScreen';
import { ZoneDetailScreen } from '../screens/ZoneDetailScreen';
import { PorteriaLogScreen } from '../screens/PorteriaLogScreen';
import { CreateReservationScreen } from '../screens/CreateReservationScreen';
import { ProfileQrScreen } from '../screens/ProfileQrScreen';

export function registerScreens() {
  Navigation.registerComponent(COMPONENTS.splash, () => SplashScreen);
  Navigation.registerComponent(COMPONENTS.login, () => LoginScreen);
  Navigation.registerComponent(COMPONENTS.homeNews, () => HomeNewsScreen);
  Navigation.registerComponent(COMPONENTS.zonesBrowse, () => ZonesBrowseScreen);
  Navigation.registerComponent(COMPONENTS.zoneDetail, () => ZoneDetailScreen);
  Navigation.registerComponent(COMPONENTS.porteriaLog, () => PorteriaLogScreen);
  Navigation.registerComponent(
    COMPONENTS.createReservation,
    () => CreateReservationScreen,
  );
  Navigation.registerComponent(COMPONENTS.profileQr, () => ProfileQrScreen);
}
