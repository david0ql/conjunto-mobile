import React from 'react';
import {
  Image,
  ImageBackground,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import {
  Eyebrow,
  NoirScreen,
  NoirTopBar,
  PrimaryButton,
} from '../components/NoirUI';
import { noirAssets } from '../design/assets';
import { NavigationComponentProps } from 'react-native-navigation';
import { popScreen, pushScreen } from '../navigation/root';
import { COMPONENTS } from '../navigation/componentNames';
import { noirTheme } from '../design/theme';

const metrics = [
  { icon: 'group', label: 'Capacidad', value: '45 PAX' },
  { icon: 'place', label: 'Ubicación', value: 'PISO 12' },
  { icon: 'schedule', label: 'Horario', value: '08-23H' },
  { icon: 'attach-money', label: 'Costo', value: '$120/H' },
];

const amenities = [
  ['wifi', 'Gigabit wifi', 'Conexión dedicada de alta velocidad.'],
  ['restaurant-menu', 'Cocina gourmet', 'Equipada con Sub-Zero & Wolf.'],
  ['speaker', 'Sonido sonos', 'Audio multi-zona integrado.'],
] as const;

const rules = [
  ['info-outline', 'Reserva mínima de 2 horas requerida.'],
  ['smoking-rooms', 'Espacio 100% libre de humo.'],
  ['build', 'Costo de limpieza incluido en la tarifa de reserva.'],
  ['announcement', 'Nivel de ruido moderado después de las 22:00.'],
] as const;

export function ZoneDetailScreen({ componentId }: NavigationComponentProps) {
  return (
    <NoirScreen>
      <NoirTopBar
        leftIcon="arrow-back"
        onLeftPress={() => {
          popScreen(componentId);
        }}
      />

      <ImageBackground
        source={{ uri: noirAssets.zones.detailHero }}
        style={styles.hero}
        imageStyle={styles.heroImage}>
        <View style={styles.heroOverlay} />
        <View style={styles.heroContent}>
          <Text style={styles.badge}>Reservable</Text>
          <Text style={styles.heroTitle}>Salón{'\n'}social</Text>
        </View>
      </ImageBackground>

      <View style={styles.metricsGrid}>
        {metrics.map(item => (
          <View key={item.label} style={styles.metricCard}>
            <MaterialIcons color={noirTheme.secondary} name={item.icon} size={22} />
            <View style={styles.metricCopy}>
              <Eyebrow>{item.label}</Eyebrow>
              <Text style={styles.metricValue}>{item.value}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.content}>
        <View style={styles.column}>
          <Eyebrow>Sobre el espacio</Eyebrow>
          <Text style={styles.body}>
            Diseñado por el estudio Architectural Monolith, el Salón Social
            ofrece una experiencia de hospitalidad inmersiva. Con acabados en
            piedra volcánica y carpintería de ébano, es el entorno definitivo
            para eventos privados y networking corporativo.
          </Text>

          <View style={styles.block}>
            <Eyebrow>Amenidades incluidas</Eyebrow>
            {amenities.map(item => (
              <View key={item[1]} style={styles.amenityRow}>
                <View style={styles.amenityIconWrap}>
                  <MaterialIcons color={noirTheme.secondary} name={item[0]} size={20} />
                </View>
                <View style={styles.amenityCopy}>
                  <Text style={styles.amenityTitle}>{item[1]}</Text>
                  <Text style={styles.amenityBody}>{item[2]}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.sideCard}>
          <Eyebrow>Reglamento interno</Eyebrow>
          {rules.map(item => (
            <View key={item[1]} style={styles.ruleRow}>
              <MaterialIcons color={noirTheme.secondary} name={item[0]} size={18} />
              <Text style={styles.ruleText}>{item[1]}</Text>
            </View>
          ))}

          <View style={styles.mapBlock}>
            <Eyebrow>Localización exacta</Eyebrow>
            <Image source={{ uri: noirAssets.zones.map }} style={styles.map} />
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <View>
          <Eyebrow>Tarifa seleccionada</Eyebrow>
          <Text style={styles.price}>
            $240.00 <Text style={styles.priceSub}>/ 2 HORAS</Text>
          </Text>
        </View>
        <PrimaryButton
          label="Reservar zona"
          onPress={() => {
            pushScreen(componentId, COMPONENTS.createReservation);
          }}
          style={styles.reserveButton}
        />
      </View>
    </NoirScreen>
  );
}

const styles = StyleSheet.create({
  hero: {
    height: 430,
    justifyContent: 'flex-end',
    backgroundColor: noirTheme.surfaceLow,
  },
  heroImage: {
    resizeMode: 'cover',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  heroContent: {
    padding: 24,
    gap: 14,
  },
  badge: {
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
  heroTitle: {
    color: noirTheme.primary,
    fontSize: 50,
    lineHeight: 48,
    fontWeight: '900',
    letterSpacing: -1.8,
    textTransform: 'uppercase',
  },
  metricsGrid: {
    marginTop: -28,
    paddingHorizontal: 24,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metricCard: {
    width: '47%',
    minHeight: 122,
    backgroundColor: noirTheme.surfaceHigh,
    padding: 18,
    justifyContent: 'space-between',
  },
  metricCopy: {
    gap: 6,
  },
  metricValue: {
    color: noirTheme.primary,
    fontSize: 26,
    fontWeight: '800',
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 28,
    gap: 24,
  },
  column: {
    gap: 24,
  },
  body: {
    color: noirTheme.ink,
    fontSize: 17,
    lineHeight: 28,
  },
  block: {
    gap: 16,
  },
  amenityRow: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
  },
  amenityIconWrap: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: noirTheme.surfaceLow,
  },
  amenityCopy: {
    flex: 1,
    gap: 4,
  },
  amenityTitle: {
    color: noirTheme.primary,
    fontSize: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  amenityBody: {
    color: noirTheme.secondary,
    fontSize: 12,
    lineHeight: 18,
  },
  sideCard: {
    backgroundColor: noirTheme.surfaceLow,
    padding: 20,
    gap: 18,
  },
  ruleRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  ruleText: {
    flex: 1,
    color: noirTheme.secondary,
    fontSize: 13,
    lineHeight: 20,
  },
  mapBlock: {
    marginTop: 10,
    gap: 14,
  },
  map: {
    width: '100%',
    height: 172,
    opacity: 0.55,
  },
  footer: {
    marginTop: 28,
    marginBottom: 110,
    paddingHorizontal: 24,
    gap: 18,
  },
  price: {
    color: noirTheme.primary,
    fontSize: 24,
    fontWeight: '800',
  },
  priceSub: {
    color: noirTheme.secondary,
    fontSize: 12,
    fontWeight: '500',
  },
  reserveButton: {
    minHeight: 62,
  },
});
