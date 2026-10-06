import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, WebViewNavigation } from 'react-native-webview';
import { getRepo, setLastRead } from '../lib/library';
import { renderMarkdownPage } from '../lib/markdown';
import { basename, dirname, listFolder, normalize, prettyName } from '../lib/paths';
import { readIndex, readMarkdown } from '../lib/storage';
import { useTheme } from '../lib/theme';

const FONT_KEY = 'reader:fontSize';
const MIN_FONT = 12;
const MAX_FONT = 26;

const encodePath = (p: string) => p.split('/').map(encodeURIComponent).join('/');

export default function Reader() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { id, path } = useLocalSearchParams<{ id: string; path: string }>();
  const repo = getRepo(id);
  const webview = useRef<WebView>(null);
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fontSize, setFontSize] = useState<number | null>(null);
  // Size baked into the generated page; later changes are applied in place so the scroll position is kept.
  const [pageFont, setPageFont] = useState<number | null>(null);

  const paths = useMemo(() => readIndex(id), [id]);
  const siblings = useMemo(() => listFolder(paths, dirname(path)).files, [paths, path]);
  const index = siblings.indexOf(path);
  const prev = index > 0 ? siblings[index - 1] : undefined;
  const next = index >= 0 && index < siblings.length - 1 ? siblings[index + 1] : undefined;

  useEffect(() => {
    AsyncStorage.getItem(FONT_KEY).then((v) => {
      const size = v ? Number(v) : 16;
      setFontSize(size);
      setPageFont(size);
    });
  }, []);

  useEffect(() => {
    readMarkdown(id, path)
      .then((md) => {
        setMarkdown(md);
        setLastRead(id, path);
      })
      .catch(() => setError('This note could not be opened. Try syncing the repository.'));
  }, [id, path]);

  // Relative links and images resolve against the file's location on GitHub.
  const rawRoot = repo
    ? `https://raw.githubusercontent.com/${repo.owner}/${repo.repo}/${encodePath(repo.branch)}/`
    : 'https://raw.githubusercontent.com/';
  const blobRoot = repo ? `https://github.com/${repo.owner}/${repo.repo}/blob/${encodePath(repo.branch)}/` : null;
  const fileUrl = rawRoot + encodePath(path);

  const html = useMemo(
    () => (markdown !== null && pageFont !== null ? renderMarkdownPage(markdown, t, pageFont) : null),
    [markdown, t, pageFont],
  );

  const applyFont = (size: number) =>
    webview.current?.injectJavaScript(`document.body.style.fontSize='${size}px';true;`);

  function changeFont(delta: number) {
    if (fontSize === null) return;
    const size = Math.min(MAX_FONT, Math.max(MIN_FONT, fontSize + delta));
    setFontSize(size);
    AsyncStorage.setItem(FONT_KEY, String(size));
    applyFont(size);
  }

  function open(target: string) {
    router.replace({ pathname: '/read', params: { id, path: target } });
  }

  function onNavigate(req: WebViewNavigation) {
    const url = req.url;
    if (!/^https?:/i.test(url)) return true;
    const [withoutHash] = url.split('#');
    if (withoutHash === fileUrl) return true; // in-page anchor

    const root = [rawRoot, blobRoot].find((r) => r && withoutHash.startsWith(r));
    if (root) {
      const rel = normalize(decodeURIComponent(withoutHash.split('?')[0].slice(root.length)));
      if (paths.includes(rel)) {
        router.push({ pathname: '/read', params: { id, path: rel } });
        return false;
      }
      if (paths.some((p) => p.startsWith(`${rel}/`))) {
        router.push({ pathname: '/repo/[id]', params: { id, path: rel } });
        return false;
      }
    }
    WebBrowser.openBrowserAsync(url);
    return false;
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Stack.Screen
        options={{
          title: prettyName(basename(path)),
          headerRight: () => (
            <View style={styles.headerActions}>
              <Pressable hitSlop={8} onPress={() => changeFont(-1)} disabled={fontSize === MIN_FONT}>
                <Text style={[styles.fontButton, { color: t.text, fontSize: 14 }]}>A−</Text>
              </Pressable>
              <Pressable hitSlop={8} onPress={() => changeFont(1)} disabled={fontSize === MAX_FONT}>
                <Text style={[styles.fontButton, { color: t.text, fontSize: 18 }]}>A+</Text>
              </Pressable>
            </View>
          ),
        }}
      />
      {error ? (
        <Text style={[styles.message, { color: t.muted }]}>{error}</Text>
      ) : html === null ? (
        <ActivityIndicator style={{ marginTop: 48 }} color={t.accent} />
      ) : (
        <WebView
          ref={webview}
          source={{ html, baseUrl: fileUrl }}
          originWhitelist={['*']}
          onShouldStartLoadWithRequest={onNavigate}
          onLoadEnd={() => fontSize !== null && fontSize !== pageFont && applyFont(fontSize)}
          style={{ backgroundColor: t.bg }}
          setSupportMultipleWindows={false}
          textZoom={100}
        />
      )}
      {(prev || next) && (
        <View
          style={[
            styles.footer,
            { borderColor: t.border, backgroundColor: t.surface, paddingBottom: 8 + insets.bottom },
          ]}
        >
          <Pressable style={styles.navButton} disabled={!prev} onPress={() => prev && open(prev)}>
            {prev && <Ionicons name="chevron-back" size={18} color={t.accent} />}
            <Text style={[styles.navText, { color: t.accent }]} numberOfLines={1}>
              {prev ? prettyName(basename(prev)) : ''}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.navButton, { justifyContent: 'flex-end' }]}
            disabled={!next}
            onPress={() => next && open(next)}
          >
            <Text style={[styles.navText, { color: t.accent, textAlign: 'right' }]} numberOfLines={1}>
              {next ? prettyName(basename(next)) : ''}
            </Text>
            {next && <Ionicons name="chevron-forward" size={18} color={t.accent} />}
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  fontButton: { fontWeight: '700' },
  message: { textAlign: 'center', padding: 32 },
  footer: {
    flexDirection: 'row',
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  navButton: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 40 },
  navText: { fontSize: 14, flexShrink: 1 },
});
