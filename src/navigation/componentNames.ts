export const COMPONENTS = {
  splash: 'app.splash',
  login: 'app.login',
  homeNews: 'app.homeNews',
  newsDetail: 'app.newsDetail',
  zonesBrowse: 'app.zonesBrowse',
  zoneDetail: 'app.zoneDetail',
  porteriaLog: 'app.porteriaLog',
  createReservation: 'app.createReservation',
  profileQr: 'app.profileQr',
} as const;

export type ComponentName = (typeof COMPONENTS)[keyof typeof COMPONENTS];
