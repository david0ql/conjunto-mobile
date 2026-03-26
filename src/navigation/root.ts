import { Navigation, Options } from 'react-native-navigation';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { noirTheme } from '../design/theme';
import { ComponentName, COMPONENTS } from './componentNames';

const defaultComponentOptions = {
  topBar: {
    visible: false,
    drawBehind: true,
  },
  layout: {
    backgroundColor: noirTheme.background,
    componentBackgroundColor: noirTheme.background,
    orientation: ['portrait'],
  },
  statusBar: {
    style: 'light',
    backgroundColor: noirTheme.background,
    drawBehind: true,
  },
  animations: {
    setRoot: {
      enabled: true,
      alpha: {
        from: 0,
        to: 1,
        duration: 220,
      },
    },
    push: {
      waitForRender: true,
    },
    pop: {
      waitForRender: true,
    },
  },
} satisfies Options;

const stackComponent = (name: ComponentName) => ({
  component: {
    name,
    options: defaultComponentOptions,
  },
});

const MAIN_TABS = [
  COMPONENTS.homeNews,
  COMPONENTS.zonesBrowse,
  COMPONENTS.porteriaLog,
  COMPONENTS.profileQr,
] as const;

const MAIN_TAB_STACK_IDS = {
  [COMPONENTS.homeNews]: 'tab.news.stack',
  [COMPONENTS.zonesBrowse]: 'tab.spaces.stack',
  [COMPONENTS.porteriaLog]: 'tab.services.stack',
  [COMPONENTS.profileQr]: 'tab.profile.stack',
} as const;

const TAB_ICONS = {
  [COMPONENTS.homeNews]: (MaterialIcons as any).getImageSourceSync('home', 20, noirTheme.primary),
  [COMPONENTS.zonesBrowse]: (MaterialIcons as any).getImageSourceSync('apps', 20, noirTheme.primary),
  [COMPONENTS.porteriaLog]: (MaterialIcons as any).getImageSourceSync('local-shipping', 20, noirTheme.primary),
  [COMPONENTS.profileQr]: (MaterialIcons as any).getImageSourceSync('person', 20, noirTheme.primary),
} as const;

function buildMainTabsRoot(selectedTab: (typeof MAIN_TABS)[number]) {
  return {
    root: {
      bottomTabs: {
        id: 'appMainTabs',
        options: {
          bottomTabs: {
            animate: false,
            backgroundColor: 'rgba(19,19,19,0.94)',
            borderTopWidth: 0.5,
            borderColor: 'rgba(255,255,255,0.08)',
            currentTabIndex: MAIN_TABS.indexOf(selectedTab),
            drawBehind: false,
            elevation: 0,
            preferLargeIcons: false,
            titleDisplayMode: 'alwaysShow',
            translucent: false,
          },
        },
        children: [
          {
            stack: {
              id: MAIN_TAB_STACK_IDS[COMPONENTS.homeNews],
              children: [stackComponent(COMPONENTS.homeNews)],
              options: {
                bottomTab: {
                  text: 'Noticias',
                  icon: TAB_ICONS[COMPONENTS.homeNews],
                  selectedIcon: TAB_ICONS[COMPONENTS.homeNews],
                  fontSize: 9,
                  selectedFontSize: 9,
                  iconColor: noirTheme.secondary,
                  selectedIconColor: noirTheme.primary,
                  textColor: noirTheme.secondary,
                  selectedTextColor: noirTheme.primary,
                },
              },
            },
          },
          {
            stack: {
              id: MAIN_TAB_STACK_IDS[COMPONENTS.zonesBrowse],
              children: [stackComponent(COMPONENTS.zonesBrowse)],
              options: {
                bottomTab: {
                  text: 'Espacios',
                  icon: TAB_ICONS[COMPONENTS.zonesBrowse],
                  selectedIcon: TAB_ICONS[COMPONENTS.zonesBrowse],
                  fontSize: 9,
                  selectedFontSize: 9,
                  iconColor: noirTheme.secondary,
                  selectedIconColor: noirTheme.primary,
                  textColor: noirTheme.secondary,
                  selectedTextColor: noirTheme.primary,
                },
              },
            },
          },
          {
            stack: {
              id: MAIN_TAB_STACK_IDS[COMPONENTS.porteriaLog],
              children: [stackComponent(COMPONENTS.porteriaLog)],
              options: {
                bottomTab: {
                  text: 'Servicios',
                  icon: TAB_ICONS[COMPONENTS.porteriaLog],
                  selectedIcon: TAB_ICONS[COMPONENTS.porteriaLog],
                  fontSize: 9,
                  selectedFontSize: 9,
                  iconColor: noirTheme.secondary,
                  selectedIconColor: noirTheme.primary,
                  textColor: noirTheme.secondary,
                  selectedTextColor: noirTheme.primary,
                },
              },
            },
          },
          {
            stack: {
              id: MAIN_TAB_STACK_IDS[COMPONENTS.profileQr],
              children: [stackComponent(COMPONENTS.profileQr)],
              options: {
                bottomTab: {
                  text: 'Perfil',
                  icon: TAB_ICONS[COMPONENTS.profileQr],
                  selectedIcon: TAB_ICONS[COMPONENTS.profileQr],
                  fontSize: 9,
                  selectedFontSize: 9,
                  iconColor: noirTheme.secondary,
                  selectedIconColor: noirTheme.primary,
                  textColor: noirTheme.secondary,
                  selectedTextColor: noirTheme.primary,
                },
              },
            },
          },
        ],
      },
    },
  };
}

export function setDefaultNavigationOptions() {
  Navigation.setDefaultOptions(defaultComponentOptions);
}

export function setSplashRoot() {
  return Navigation.setRoot({
    root: {
      stack: {
        id: 'appRootStack',
        children: [stackComponent(COMPONENTS.splash)],
      },
    },
  });
}

export function setShellRoot(name: ComponentName) {
  if (name === COMPONENTS.login) {
    return Navigation.setRoot({
      root: {
        stack: {
          id: 'appAuthStack',
          children: [stackComponent(COMPONENTS.login)],
        },
      },
    });
  }

  const selectedTab = MAIN_TABS.includes(name as (typeof MAIN_TABS)[number])
    ? (name as (typeof MAIN_TABS)[number])
    : COMPONENTS.homeNews;

  return Navigation.setRoot(buildMainTabsRoot(selectedTab) as any);
}

export function pushScreen(
  componentId: string,
  name: ComponentName,
  passProps?: Record<string, unknown>,
  hideBottomTabs = false,
) {
  return Navigation.push(componentId, {
    component: {
      name,
      passProps,
      options: {
        ...defaultComponentOptions,
        ...(hideBottomTabs ? { bottomTabs: { visible: false } } : {}),
      },
    },
  });
}

export function popScreen(componentId: string) {
  return Navigation.pop(componentId);
}
