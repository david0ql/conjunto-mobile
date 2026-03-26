import React from 'react';
import {
  ImageBackground,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { noirTheme } from '../design/theme';

type ScreenProps = {
  children: React.ReactNode;
  scroll?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
};

type TopBarProps = {
  title?: string;
  leftIcon?: string;
  onLeftPress?: () => void;
};

type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'ghost';
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

export function NoirScreen({
  children,
  scroll = true,
  contentContainerStyle,
}: ScreenProps) {
  const content = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
      showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, contentContainerStyle]}>{children}</View>
  );

  return <SafeAreaView style={styles.safe}>{content}</SafeAreaView>;
}

export function NoirTopBar({
  title = 'MONOLITH',
  leftIcon,
  onLeftPress,
}: TopBarProps) {
  return (
    <View style={styles.topBar}>
      {leftIcon ? (
        <Pressable onPress={onLeftPress} style={styles.iconButton}>
          <MaterialIcons color={noirTheme.primary} name={leftIcon} size={22} />
        </Pressable>
      ) : (
        <View style={styles.topBarSide} />
      )}
      <Text style={styles.brand}>{title}</Text>
      <View style={styles.topBarSide} />
    </View>
  );
}

export function Eyebrow({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.eyebrow, style]}>{children}</Text>;
}

export function Headline({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
}) {
  return <Text style={[styles.headline, style]}>{children}</Text>;
}

export function PrimaryButton({
  label,
  onPress,
  variant = 'primary',
  style,
  textStyle,
}: ButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.primaryButton,
        variant === 'ghost' && styles.ghostButton,
        style,
      ]}>
      <Text
        style={[
          styles.primaryButtonLabel,
          variant === 'ghost' && styles.ghostButtonLabel,
          textStyle,
        ]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Divider() {
  return <View style={styles.divider} />;
}

export function HeroCard({
  image,
  label,
  title,
  subtitle,
  onPrimaryPress,
  onSecondaryPress,
}: {
  image: string;
  label: string;
  title: string;
  subtitle: string;
  onPrimaryPress?: () => void;
  onSecondaryPress?: () => void;
}) {
  return (
    <ImageBackground source={{ uri: image }} imageStyle={styles.heroImage} style={styles.heroCard}>
      <View style={styles.heroOverlay} />
      <View style={styles.heroCardContent}>
        <Text style={styles.heroMeta}>{label}</Text>
        <Text style={styles.heroTitle}>{title}</Text>
        <Text style={styles.heroSubtitle}>{subtitle}</Text>
        <View style={styles.heroActions}>
          <PrimaryButton label="Reservar" onPress={onPrimaryPress} style={styles.smallButton} />
          <Pressable onPress={onSecondaryPress} style={styles.infoPill}>
            <MaterialIcons color={noirTheme.primary} name="info-outline" size={18} />
          </Pressable>
        </View>
      </View>
    </ImageBackground>
  );
}

export const noirStyles = StyleSheet.create({
  section: {
    gap: 16,
    marginBottom: 28,
  },
  sectionTitle: {
    color: noirTheme.primary,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -1,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: noirTheme.surfaceLow,
    padding: 20,
  },
  cardMuted: {
    color: noirTheme.secondary,
    fontSize: 13,
    lineHeight: 20,
  },
});

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: noirTheme.background,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  topBar: {
    height: 80,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: noirTheme.surfaceLow,
  },
  topBarSide: {
    width: 40,
    height: 40,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: {
    color: noirTheme.primary,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -1.4,
    textTransform: 'uppercase',
  },
  eyebrow: {
    color: noirTheme.secondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2.4,
    textTransform: 'uppercase',
  },
  headline: {
    color: noirTheme.primary,
    fontSize: 54,
    fontWeight: '900',
    letterSpacing: -2,
    textTransform: 'uppercase',
    lineHeight: 56,
  },
  primaryButton: {
    backgroundColor: noirTheme.primary,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 14,
  },
  primaryButtonLabel: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2.8,
    textTransform: 'uppercase',
  },
  ghostButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  ghostButtonLabel: {
    color: noirTheme.ink,
  },
  divider: {
    width: 64,
    height: 4,
    backgroundColor: noirTheme.primary,
  },
  heroCard: {
    height: 356,
    backgroundColor: noirTheme.surfaceLow,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  heroImage: {
    resizeMode: 'cover',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.44)',
  },
  heroCardContent: {
    padding: 24,
    gap: 8,
  },
  heroMeta: {
    color: noirTheme.secondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: noirTheme.primary,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -1.2,
    textTransform: 'uppercase',
  },
  heroSubtitle: {
    color: noirTheme.secondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  heroActions: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  smallButton: {
    minHeight: 46,
    paddingHorizontal: 22,
  },
  infoPill: {
    width: 42,
    height: 42,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
});
