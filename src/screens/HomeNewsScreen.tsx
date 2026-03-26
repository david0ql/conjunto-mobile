import React from 'react';
import {
  ImageBackground,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  Eyebrow,
  Headline,
  NoirScreen,
  NoirTopBar,
  PrimaryButton,
  noirStyles,
} from '../components/NoirUI';
import { noirAssets } from '../design/assets';
import { noirTheme } from '../design/theme';
import { COMPONENTS } from '../navigation/componentNames';
import { setShellRoot } from '../navigation/root';

const recent = [
  {
    image: noirAssets.news.recent1,
    tag: 'Actualización',
    title: 'Mantenimiento de ascensores torre A',
  },
  {
    image: noirAssets.news.recent2,
    tag: 'Evento',
    title: 'Cata de vinos en el rooftop',
  },
  {
    image: noirAssets.news.recent3,
    tag: 'Aviso',
    title: 'Nuevos protocolos de acceso',
  },
];

const community = [
  {
    image: noirAssets.news.community1,
    tag: 'Seguridad',
    title: 'Implementación de reconocimiento biométrico',
    body:
      'A partir del próximo mes, el acceso principal y áreas comunes contarán con tecnología de última generación para garantizar la exclusividad y calma de su residencia.',
  },
  {
    image: noirAssets.news.community2,
    tag: 'Servicios',
    title: 'Expansión de concierge personalizado',
    body:
      'Hemos ampliado nuestro equipo de asistencia 24/7 para cubrir necesidades de logística privada, reservas internacionales y gestión de espacios gourmet.',
  },
  {
    image: noirAssets.news.community3,
    tag: 'Espacios',
    title: 'Renovación del centro de negocios',
    body:
      'Nuevas estaciones de trabajo con aislamiento acústico y sistemas de videoconferencia premium están listas para su uso exclusivo en el piso 12.',
  },
];

export function HomeNewsScreen() {
  return (
    <NoirScreen>
      <NoirTopBar />

      <View style={styles.content}>
        <View style={styles.header}>
          <Eyebrow>Bienvenido a casa</Eyebrow>
          <Headline style={styles.greeting}>Hola,{'\n'}Alexander</Headline>
        </View>

        <View style={noirStyles.section}>
          <View style={styles.sectionRow}>
            <Eyebrow>Recientes</Eyebrow>
            <View style={styles.dots}>
              <View style={styles.dotActive} />
              <View style={styles.dot} />
              <View style={styles.dot} />
            </View>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.recentScroller}>
            {recent.map(item => (
              <ImageBackground
                key={item.title}
                source={{ uri: item.image }}
                style={styles.recentCard}
                imageStyle={styles.cardImage}>
                <View style={styles.cardOverlay} />
                <View style={styles.recentCardContent}>
                  <Text style={styles.tag}>{item.tag}</Text>
                  <Text style={styles.recentTitle}>{item.title}</Text>
                </View>
              </ImageBackground>
            ))}
          </ScrollView>
        </View>

        <View style={noirStyles.section}>
          <Eyebrow>Comunidad</Eyebrow>
          <View style={styles.line} />
          {community.map((item, index) => (
            <View
              key={item.title}
              style={[styles.communityCard, index === 1 && styles.communityOffset]}>
              <ImageBackground
                source={{ uri: item.image }}
                style={styles.communityImage}
                imageStyle={styles.cardImage}>
                <View style={styles.communityTagWrap}>
                  <Text style={styles.tag}>{item.tag}</Text>
                </View>
              </ImageBackground>
              <Text style={styles.communityTitle}>{item.title}</Text>
              <Text style={styles.communityBody}>{item.body}</Text>
              <PrimaryButton
                label="Leer documento"
                onPress={() => {
                  setShellRoot(
                    item.tag === 'Espacios'
                      ? COMPONENTS.zonesBrowse
                      : COMPONENTS.porteriaLog,
                  );
                }}
                style={styles.readButton}
              />
            </View>
          ))}
        </View>
      </View>

    </NoirScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 24,
    paddingTop: 12,
    gap: 36,
  },
  header: {
    gap: 8,
  },
  greeting: {
    fontSize: 52,
    lineHeight: 52,
  },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: noirTheme.surfaceHighest,
  },
  dotActive: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: noirTheme.primary,
  },
  recentScroller: {
    gap: 18,
    paddingRight: 24,
  },
  recentCard: {
    width: 312,
    height: 204,
    justifyContent: 'flex-end',
    backgroundColor: noirTheme.surfaceHighest,
    overflow: 'hidden',
  },
  cardImage: {
    resizeMode: 'cover',
  },
  cardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  recentCardContent: {
    padding: 18,
    gap: 8,
  },
  tag: {
    alignSelf: 'flex-start',
    backgroundColor: noirTheme.primary,
    color: '#000000',
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  recentTitle: {
    color: noirTheme.primary,
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 22,
    textTransform: 'uppercase',
  },
  line: {
    width: 48,
    height: 1,
    backgroundColor: noirTheme.primary,
    marginTop: -4,
  },
  communityCard: {
    gap: 18,
  },
  communityOffset: {
    marginTop: 22,
  },
  communityImage: {
    height: 360,
    justifyContent: 'flex-start',
    backgroundColor: noirTheme.surfaceLow,
  },
  communityTagWrap: {
    padding: 18,
  },
  communityTitle: {
    color: noirTheme.primary,
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 30,
    textTransform: 'uppercase',
  },
  communityBody: {
    color: noirTheme.secondary,
    fontSize: 14,
    lineHeight: 22,
  },
  readButton: {
    alignSelf: 'flex-start',
  },
});
