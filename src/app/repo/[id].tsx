import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Input } from '../../components/ui';
import { useLibrary } from '../../lib/library';
import { basename, listFolder, prettyName } from '../../lib/paths';
import { readIndex } from '../../lib/storage';
import { useTheme } from '../../lib/theme';

type Row =
  | { kind: 'folder'; name: string; path: string; count: number }
  | { kind: 'file'; path: string; subtitle?: string };

export default function RepoScreen() {
  const t = useTheme();
  const { id, path = '' } = useLocalSearchParams<{ id: string; path?: string }>();
  const repo = useLibrary().repos.find((r) => r.id === id);
  const [query, setQuery] = useState('');

  // Re-read the index whenever the repo is re-synced.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const paths = useMemo(() => readIndex(id), [id, repo?.syncedAt]);

  const rows: Row[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q) {
      const scope = path ? paths.filter((p) => p.startsWith(`${path}/`)) : paths;
      return scope
        .filter((p) => p.toLowerCase().includes(q))
        .map((p) => ({ kind: 'file', path: p, subtitle: p.slice(0, p.lastIndexOf('/') + 1) || undefined }));
    }
    const { folders, files } = listFolder(paths, path);
    return [
      ...folders.map((f): Row => ({ kind: 'folder', ...f })),
      ...files.map((p): Row => ({ kind: 'file', path: p })),
    ];
  }, [paths, path, query]);

  const title = path ? basename(path) : (repo?.repo ?? 'Repository');

  return (
    <>
      <Stack.Screen options={{ title }} />
      <FlatList
        data={rows}
        keyExtractor={(r) => `${r.kind}:${r.path}`}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={styles.header}>
            <Input
              placeholder={path ? `Search in ${basename(path)}` : 'Search notes'}
              value={query}
              onChangeText={setQuery}
              clearButtonMode="while-editing"
            />
          </View>
        }
        ListEmptyComponent={
          <Text style={[styles.empty, { color: t.muted }]}>
            {query ? 'No matching notes.' : 'This folder has no markdown files.'}
          </Text>
        }
        ItemSeparatorComponent={() => <View style={[styles.sep, { backgroundColor: t.border }]} />}
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.row, pressed && { backgroundColor: t.surface }]}
            onPress={() =>
              item.kind === 'folder'
                ? router.push({ pathname: '/repo/[id]', params: { id, path: item.path } })
                : router.push({ pathname: '/read', params: { id, path: item.path } })
            }
          >
            <Ionicons
              name={item.kind === 'folder' ? 'folder' : 'document-text-outline'}
              size={22}
              color={item.kind === 'folder' ? t.accent : t.muted}
            />
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, { color: t.text }]} numberOfLines={2}>
                {item.kind === 'folder' ? item.name : prettyName(basename(item.path))}
              </Text>
              {item.kind === 'folder' ? (
                <Text style={[styles.sub, { color: t.muted }]}>{item.count} notes</Text>
              ) : item.subtitle ? (
                <Text style={[styles.sub, { color: t.muted }]} numberOfLines={1}>
                  {item.subtitle}
                </Text>
              ) : null}
            </View>
            {item.kind === 'folder' && <Ionicons name="chevron-forward" size={18} color={t.muted} />}
            {item.kind === 'file' && repo?.lastRead === item.path && (
              <View style={[styles.dot, { backgroundColor: t.accent }]} />
            )}
          </Pressable>
        )}
      />
    </>
  );
}

const styles = StyleSheet.create({
  header: { padding: 16, paddingBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14 },
  name: { fontSize: 16 },
  sub: { fontSize: 12, marginTop: 2 },
  sep: { height: StyleSheet.hairlineWidth, marginLeft: 52 },
  empty: { textAlign: 'center', padding: 32 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
