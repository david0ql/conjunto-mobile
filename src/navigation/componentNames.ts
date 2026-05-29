export const COMPONENTS = {
  splash: 'app.splash',
  login: 'app.login',
  homeNews: 'app.homeNews',
  newsDetail: 'app.newsDetail',
  zonesBrowse: 'app.zonesBrowse',
  porteriaLog: 'app.porteriaLog',
  createReservation: 'app.createReservation',
  profileQr: 'app.profileQr',
  assemblyVoting: 'app.assemblyVoting',
  poolControl: 'app.poolControl',
  poolEntries: 'app.poolEntries',
  employeeProfile: 'app.employeeProfile',
  porteroPackages: 'app.porteroPackages',
  porteroLines: 'app.porteroLines',
  porteroCall: 'app.porteroCall',
  callOverlay: 'app.callOverlay',
} as const;

export type ComponentName = (typeof COMPONENTS)[keyof typeof COMPONENTS];
