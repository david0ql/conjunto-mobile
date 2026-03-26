import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { NavigationComponentProps } from 'react-native-navigation';
import { Eyebrow, Headline, NoirScreen, NoirTopBar } from '../components/NoirUI';
import { noirTheme } from '../design/theme';
import { getNewsItem, resolveImageUrl, type NewsItem } from '../services/api';
import { popScreen } from '../navigation/root';

interface Props extends NavigationComponentProps {
  newsId: string;
}

export function NewsDetailScreen({ componentId, newsId }: Props) {
  const [news, setNews] = useState<NewsItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  function fetchNews(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    getNewsItem(newsId)
      .then(setNews)
      .catch(() => {})
      .finally(() => { setLoading(false); setRefreshing(false); });
  }

  useEffect(() => { fetchNews(); }, [newsId]);

  const imageUrl = resolveImageUrl(news?.imageUrl);

  return (
    <NoirScreen onRefresh={() => fetchNews(true)} refreshing={refreshing}>
      <NoirTopBar
        leftIcon="arrow-back"
        onLeftPress={() => popScreen(componentId)}
      />

      <View style={styles.content}>
        {loading ? (
          <View style={styles.loadingBlock}>
            <View style={[styles.skeleton, { width: '60%', height: 14 }]} />
            <View style={[styles.skeleton, { width: '90%', height: 40, marginTop: 12 }]} />
          </View>
        ) : news ? (
          <>
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} style={styles.heroImage} resizeMode="cover" />
            ) : null}

            <View style={styles.meta}>
              <Eyebrow>{news.category?.name ?? 'General'}</Eyebrow>
              <Text style={styles.date}>
                {new Date(news.publishedAt).toLocaleDateString('es-CO', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </Text>
            </View>

            <Headline style={styles.title}>{news.title}</Headline>

            <View style={styles.divider} />

            <Text style={styles.body}>{news.content}</Text>

            {news.createdByEmployee ? (
              <Text style={styles.author}>
                Publicado por {news.createdByEmployee.name} {news.createdByEmployee.lastName}
              </Text>
            ) : null}
          </>
        ) : (
          <Text style={styles.error}>No se pudo cargar la noticia.</Text>
        )}
      </View>
    </NoirScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 24,
    paddingTop: 20,
    gap: 20,
    paddingBottom: 40,
  },
  heroImage: {
    height: 240,
    backgroundColor: noirTheme.surfaceLow,
    marginHorizontal: -24,
    alignSelf: 'stretch',
  },
  meta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  date: {
    color: noirTheme.secondary,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 38,
    lineHeight: 40,
  },
  divider: {
    width: 64,
    height: 4,
    backgroundColor: noirTheme.primary,
    marginTop: -8,
  },
  body: {
    color: noirTheme.ink,
    fontSize: 16,
    lineHeight: 28,
  },
  author: {
    color: noirTheme.secondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginTop: 8,
    paddingTop: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  loadingBlock: {
    gap: 8,
    marginTop: 12,
  },
  skeleton: {
    backgroundColor: noirTheme.surfaceHigh,
    borderRadius: 4,
  },
  error: {
    color: noirTheme.secondary,
    textAlign: 'center',
    marginTop: 40,
  },
});
