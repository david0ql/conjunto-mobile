import React, { useEffect, useRef, useState } from 'react';
import { Animated, Modal, PanResponder, Pressable, StyleSheet, Text, View, Image } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { NavigationComponentProps } from 'react-native-navigation';
import { Eyebrow, Headline, NoirScreen, NoirTopBar } from '../components/NoirUI';
import { noirTheme } from '../design/theme';
import { getNewsItem, resolveImageUrl, type NewsItem } from '../services/api';
import { popScreen } from '../navigation/root';

interface Props extends NavigationComponentProps {
  newsId: string;
}

const MAX_ZOOM = 4;

function touchDistance(touches: Array<{ pageX: number; pageY: number }>): number {
  const [a, b] = touches;
  const dx = a.pageX - b.pageX;
  const dy = a.pageY - b.pageY;
  return Math.sqrt(dx * dx + dy * dy);
}

// Pinch-to-zoom + pan + double-tap, built on PanResponder/Animated only —
// no gesture/zoom library is installed in this project, and adding one
// would require a native rebuild.
function ZoomableImage({ uri }: { uri: string }) {
  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  const scaleValue = useRef(1);
  const translateValue = useRef({ x: 0, y: 0 });
  const pinchStartDistance = useRef<number | null>(null);
  const pinchStartScale = useRef(1);
  const lastTapAt = useRef(0);

  function animateTo(nextScale: number, nextX: number, nextY: number) {
    scaleValue.current = nextScale;
    translateValue.current = { x: nextX, y: nextY };
    Animated.parallel([
      Animated.spring(scale, { toValue: nextScale, useNativeDriver: false, friction: 7 }),
      Animated.spring(translateX, { toValue: nextX, useNativeDriver: false, friction: 7 }),
      Animated.spring(translateY, { toValue: nextY, useNativeDriver: false, friction: 7 }),
    ]).start();
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_evt, gestureState) =>
        Math.abs(gestureState.dx) > 2 || Math.abs(gestureState.dy) > 2 || gestureState.numberActiveTouches === 2,
      onPanResponderGrant: (evt) => {
        if (evt.nativeEvent.touches.length === 2) {
          pinchStartDistance.current = touchDistance(evt.nativeEvent.touches);
          pinchStartScale.current = scaleValue.current;
        }
      },
      onPanResponderMove: (evt, gestureState) => {
        const touches = evt.nativeEvent.touches;
        if (touches.length === 2) {
          if (pinchStartDistance.current == null) {
            pinchStartDistance.current = touchDistance(touches);
            pinchStartScale.current = scaleValue.current;
            return;
          }
          const ratio = touchDistance(touches) / pinchStartDistance.current;
          const nextScale = Math.min(MAX_ZOOM, Math.max(1, pinchStartScale.current * ratio));
          scale.setValue(nextScale);
          scaleValue.current = nextScale;
        } else if (touches.length === 1 && scaleValue.current > 1) {
          const nextX = translateValue.current.x + gestureState.dx;
          const nextY = translateValue.current.y + gestureState.dy;
          translateX.setValue(nextX);
          translateY.setValue(nextY);
        }
      },
      onPanResponderRelease: (_evt, gestureState) => {
        const wasPinching = pinchStartDistance.current != null;
        pinchStartDistance.current = null;

        if (wasPinching) {
          if (scaleValue.current <= 1) {
            animateTo(1, 0, 0);
          } else {
            translateValue.current = { x: translateValue.current.x, y: translateValue.current.y };
          }
          return;
        }

        if (scaleValue.current > 1) {
          translateValue.current = {
            x: translateValue.current.x + gestureState.dx,
            y: translateValue.current.y + gestureState.dy,
          };
          return;
        }

        const isTap = Math.abs(gestureState.dx) < 6 && Math.abs(gestureState.dy) < 6;
        if (!isTap) return;

        const now = Date.now();
        if (now - lastTapAt.current < 280) {
          animateTo(scaleValue.current > 1 ? 1 : 2.5, 0, 0);
        }
        lastTapAt.current = now;
      },
    }),
  ).current;

  return (
    <View style={StyleSheet.absoluteFill} {...panResponder.panHandlers}>
      <Animated.Image
        source={{ uri }}
        style={[
          StyleSheet.absoluteFill,
          { transform: [{ translateX }, { translateY }, { scale }] },
        ]}
        resizeMode="contain"
      />
    </View>
  );
}

function NewsImageModal({ uri, onClose }: { uri: string | null; onClose: () => void }) {
  if (!uri) return null;

  return (
    <Modal visible={!!uri} animationType="fade" transparent onRequestClose={onClose}>
      <View style={modalStyles.overlay}>
        <ZoomableImage uri={uri} />
        <Pressable onPress={onClose} style={modalStyles.closeBtn} hitSlop={12}>
          <MaterialIcons color={noirTheme.primary} name="close" size={26} />
        </Pressable>
      </View>
    </Modal>
  );
}

export function NewsDetailScreen({ componentId, newsId }: Props) {
  const [news, setNews] = useState<NewsItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

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

      <NewsImageModal uri={previewOpen ? imageUrl : null} onClose={() => setPreviewOpen(false)} />

      <View style={styles.content}>
        {loading ? (
          <View style={styles.loadingBlock}>
            <View style={[styles.skeleton, { width: '60%', height: 14 }]} />
            <View style={[styles.skeleton, { width: '90%', height: 40, marginTop: 12 }]} />
          </View>
        ) : news ? (
          <>
            {imageUrl ? (
              <Pressable onPress={() => setPreviewOpen(true)}>
                <Image source={{ uri: imageUrl }} style={styles.heroImage} resizeMode="cover" />
              </Pressable>
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

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#000000',
  },
  closeBtn: {
    position: 'absolute',
    top: 56,
    right: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
});
