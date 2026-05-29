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
  COMPONENTS.assemblyVoting,
  COMPONENTS.profileQr,
] as const;

const MAIN_TAB_STACK_IDS = {
  [COMPONENTS.homeNews]: 'tab.news.stack',
  [COMPONENTS.zonesBrowse]: 'tab.spaces.stack',
  [COMPONENTS.porteriaLog]: 'tab.services.stack',
  [COMPONENTS.assemblyVoting]: 'tab.assembly.stack',
  [COMPONENTS.profileQr]: 'tab.profile.stack',
} as const;

const TAB_ICONS = {
  [COMPONENTS.homeNews]: (MaterialIcons as any).getImageSourceSync('home', 20, noirTheme.primary),
  [COMPONENTS.zonesBrowse]: (MaterialIcons as any).getImageSourceSync('apps', 20, noirTheme.primary),
  [COMPONENTS.porteriaLog]: (MaterialIcons as any).getImageSourceSync('local-shipping', 20, noirTheme.primary),
  [COMPONENTS.assemblyVoting]: (MaterialIcons as any).getImageSourceSync('how-to-vote', 20, noirTheme.primary),
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
              id: MAIN_TAB_STACK_IDS[COMPONENTS.assemblyVoting],
              children: [stackComponent(COMPONENTS.assemblyVoting)],
              options: {
                bottomTab: {
                  text: 'Asamblea',
                  icon: TAB_ICONS[COMPONENTS.assemblyVoting],
                  selectedIcon: TAB_ICONS[COMPONENTS.assemblyVoting],
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

function buildPorteroTabsRoot() {
  const packagesIcon = (MaterialIcons as any).getImageSourceSync('inventory-2', 20, noirTheme.primary);
  const linesIcon = (MaterialIcons as any).getImageSourceSync('phone-in-talk', 20, noirTheme.primary);
  const callIcon = (MaterialIcons as any).getImageSourceSync('apartment', 20, noirTheme.primary);
  return {
    root: {
      bottomTabs: {
        id: 'porteroMainTabs',
        options: {
          bottomTabs: {
            animate: false,
            backgroundColor: 'rgba(19,19,19,0.94)',
            borderTopWidth: 0.5,
            borderColor: 'rgba(255,255,255,0.08)',
            currentTabIndex: 0,
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
              id: 'tab.portero.packages.stack',
              children: [stackComponent(COMPONENTS.porteroPackages)],
              options: {
                bottomTab: {
                  text: 'Paquetes',
                  icon: packagesIcon,
                  selectedIcon: packagesIcon,
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
              id: 'tab.portero.lines.stack',
              children: [stackComponent(COMPONENTS.porteroLines)],
              options: {
                bottomTab: {
                  text: 'Portería',
                  icon: linesIcon,
                  selectedIcon: linesIcon,
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
              id: 'tab.portero.call.stack',
              children: [stackComponent(COMPONENTS.porteroCall)],
              options: {
                bottomTab: {
                  text: 'Llamar',
                  icon: callIcon,
                  selectedIcon: callIcon,
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

export function setPorteroRoot() {
  return Navigation.setRoot(buildPorteroTabsRoot() as any);
}

function buildPoolTabsRoot() {
  const poolIcon = (MaterialIcons as any).getImageSourceSync('pool', 20, noirTheme.primary);
  const entriesIcon = (MaterialIcons as any).getImageSourceSync('list-alt', 20, noirTheme.primary);
  const profileIcon = (MaterialIcons as any).getImageSourceSync('person', 20, noirTheme.primary);
  return {
    root: {
      bottomTabs: {
        id: 'poolMainTabs',
        options: {
          bottomTabs: {
            animate: false,
            backgroundColor: 'rgba(19,19,19,0.94)',
            borderTopWidth: 0.5,
            borderColor: 'rgba(255,255,255,0.08)',
            currentTabIndex: 0,
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
              id: 'tab.pool.control.stack',
              children: [stackComponent(COMPONENTS.poolControl)],
              options: {
                bottomTab: {
                  text: 'Registrar',
                  icon: poolIcon,
                  selectedIcon: poolIcon,
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
              id: 'tab.pool.entries.stack',
              children: [stackComponent(COMPONENTS.poolEntries)],
              options: {
                bottomTab: {
                  text: 'Ingresos',
                  icon: entriesIcon,
                  selectedIcon: entriesIcon,
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
              id: 'tab.pool.profile.stack',
              children: [stackComponent(COMPONENTS.employeeProfile)],
              options: {
                bottomTab: {
                  text: 'Perfil',
                  icon: profileIcon,
                  selectedIcon: profileIcon,
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

export function setPoolRoot() {
  return Navigation.setRoot(buildPoolTabsRoot() as any);
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
