import React, { useEffect, useState } from 'react';
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
import { noirTheme } from '../design/theme';
import { COMPONENTS } from '../navigation/componentNames';
import { pushScreen } from '../navigation/root';
import { NavigationComponentProps } from 'react-native-navigation';
import { getNews, resolveImageUrl, type NewsItem } from '../services/api';
import { authStore } from '../context/auth.store';

export function HomeNewsScreen({ componentId }: NavigationComponentProps) {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const user = authStore.getUser();

  useEffect(() => {
    getNews()
      .then((items) => setNews(items.slice(0, 10)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const recent = news.slice(0, 3);
  const community = news.slice(3, 6);

  return (
    <NoirScreen>
      <NoirTopBar />

      <View style={styles.content}>
        <View style={styles.header}>
          <Eyebrow>Bienvenido a casa</Eyebrow>
          <Headline style={styles.greeting}>
            Hola,{'\n'}
            {user ? user.name : '—'}
          </Headline>
        </View>

        <View style={noirStyles.section}>
          <View style={styles.sectionRow}>
            <Eyebrow>Recientes</Eyebrow>
            {recent.length > 0 ? (
              <View style={styles.dots}>
                {recent.map((_, i) => (
                  <View key={i} style={i === 0 ? styles.dotActive : styles.dot} />
                ))}
              </View>
            ) : null}
          </View>

          {loading ? (
            <View style={styles.skeletonRow}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={styles.skeletonCard} />
              ))}
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.recentScroller}>
              {recent.map((item) => {
                const imgUri = resolveImageUrl(item.imageUrl);
                return (
                  <ImageBackground
                    key={item.id}
                    source={imgUri ? { uri: imgUri } : undefined}
                    style={styles.recentCard}
                    imageStyle={styles.cardImage}>
                    <View style={styles.cardOverlay} />
                    <View style={styles.recentCardContent}>
                      <Text style={styles.tag}>{item.category?.name ?? 'General'}</Text>
                      <Text style={styles.recentTitle}>{item.title}</Text>
                    </View>
                  </ImageBackground>
                );
              })}
            </ScrollView>
          )}
        </View>

        <View style={noirStyles.section}>
          <Eyebrow>Comunidad</Eyebrow>
          <View style={styles.line} />
          {community.map((item) => {
            const imgUri = resolveImageUrl(item.imageUrl);
            return (
              <View key={item.id} style={styles.communityCard}>
                {imgUri ? (
                  <ImageBackground
                    source={{ uri: imgUri }}
                    style={styles.communityImage}
                    imageStyle={styles.cardImage}>
                    <View style={styles.communityTagWrap}>
                      <Text style={styles.tag}>{item.category?.name ?? 'General'}</Text>
                    </View>
                  </ImageBackground>
                ) : (
                  <View style={[styles.communityImage, styles.communityImagePlaceholder]}>
                    <View style={styles.communityTagWrap}>
                      <Text style={styles.tag}>{item.category?.name ?? 'General'}</Text>
                    </View>
                  </View>
                )}
                <Text style={styles.communityTitle}>{item.title}</Text>
                <Text style={styles.communityBody} numberOfLines={4}>
                  {item.content}
                </Text>
                <PrimaryButton
                  label="Leer documento"
                  onPress={() =>
                    pushScreen(componentId, COMPONENTS.newsDetail, { newsId: item.id })
                  }
                  style={styles.readButton}
                />
              </View>
            );
          })}
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
  skeletonRow: {
    flexDirection: 'row',
    gap: 18,
  },
  skeletonCard: {
    width: 312,
    height: 204,
    backgroundColor: noirTheme.surfaceHigh,
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
  communityImage: {
    height: 260,
    justifyContent: 'flex-start',
    backgroundColor: noirTheme.surfaceLow,
  },
  communityImagePlaceholder: {
    backgroundColor: noirTheme.surfaceHigh,
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
