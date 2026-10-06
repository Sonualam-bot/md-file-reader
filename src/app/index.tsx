import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, router, Stack } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Input, timeAgo } from '../components/ui';
import { useAuth } from '../lib/auth';
import { importRepo, removeRepo, RepoMeta, useLibrary } from '../lib/library';
import { prettyName, basename } from '../lib/paths';
import { useTheme } from '../lib/theme';

export default function Home() {
  const t = useTheme();
  const { repos, ready } = useLibrary();
  const { user, token } = useAuth();
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState('');

  async function runImport(target: string, label: string) {
    setBusy(label);
    try {
      const meta = await importRepo(target, setProgress);
      setInput('');
      return meta;
    } catch (e) {
      Alert.alert('Import failed', (e as Error).message);
    } finally {
      setBusy(null);
      setProgress('');
    }
  }

  function showActions(repo: RepoMeta) {
    Alert.alert(`${repo.owner}/${repo.repo}`, undefined, [
      { text: 'Sync now', onPress: () => runImport(`${repo.owner}/${repo.repo}`, repo.id) },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () =>
          Alert.alert('Remove repository?', 'Its downloaded notes will be deleted from this phone.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Remove', style: 'destructive', onPress: () => removeRepo(repo.id) },
          ]),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Link href="/account" asChild>
              <Pressable hitSlop={10} style={styles.headerButton}>
                <Ionicons name={token ? 'person-circle' : 'logo-github'} size={22} color={t.text} />
                <Text style={{ color: t.text, fontWeight: '500' }}>{user ? user.login : token ? 'Account' : 'Sign in'}</Text>
              </Pressable>
            </Link>
          ),
        }}
      />
      <FlatList
        data={repos}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <Card>
            <Text style={[styles.cardTitle, { color: t.text }]}>Import a repository</Text>
            <Input
              placeholder="owner/repo or GitHub URL"
              value={input}
              onChangeText={setInput}
              onSubmitEditing={() => input.trim() && runImport(input, 'input')}
              returnKeyType="go"
              keyboardType="url"
            />
            <View style={{ height: 10 }} />
            <Button
              title="Import"
              onPress={() => runImport(input, 'input')}
              disabled={!input.trim() || busy !== null}
              loading={busy === 'input'}
            />
            {busy === 'input' && progress ? <Text style={[styles.muted, { color: t.muted }]}>{progress}</Text> : null}
            {!token && (
              <Text style={[styles.muted, { color: t.muted }]}>
                Public repos work without signing in. Sign in with GitHub to import private repos or pick from
                your own.
              </Text>
            )}
          </Card>
        }
        ListEmptyComponent={
          ready ? (
            <View style={styles.empty}>
              <Ionicons name="library-outline" size={40} color={t.muted} />
              <Text style={[styles.muted, { color: t.muted, textAlign: 'center' }]}>
                No repositories yet. Import one above to read its markdown notes offline.
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push({ pathname: '/repo/[id]', params: { id: item.id } })}
            onLongPress={() => showActions(item)}
            style={({ pressed }) => [
              styles.repo,
              { backgroundColor: t.surface, borderColor: t.border },
              pressed && { opacity: 0.7 },
            ]}
          >
            <View style={styles.repoRow}>
              <Ionicons name={item.private ? 'lock-closed-outline' : 'book-outline'} size={18} color={t.muted} />
              <Text style={[styles.repoName, { color: t.text }]} numberOfLines={1}>
                {item.repo}
              </Text>
              <Pressable hitSlop={12} onPress={() => showActions(item)}>
                <Ionicons name="ellipsis-vertical" size={18} color={t.muted} />
              </Pressable>
            </View>
            <Text style={{ color: t.muted, fontSize: 13 }}>
              {item.owner} · {item.fileCount} notes ·{' '}
              {busy === item.id ? progress || 'Syncing…' : `synced ${timeAgo(item.syncedAt)}`}
            </Text>
            {item.description ? (
              <Text style={{ color: t.muted, fontSize: 13 }} numberOfLines={2}>
                {item.description}
              </Text>
            ) : null}
            {item.lastRead ? (
              <Pressable
                onPress={() =>
                  router.push({ pathname: '/read', params: { id: item.id, path: item.lastRead! } })
                }
                style={styles.repoRow}
                hitSlop={6}
              >
                <Ionicons name="play-circle-outline" size={16} color={t.accent} />
                <Text style={{ color: t.accent, fontSize: 13, flex: 1 }} numberOfLines={1}>
                  Continue: {prettyName(basename(item.lastRead))}
                </Text>
              </Pressable>
            ) : null}
          </Pressable>
        )}
      />
    </>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 12 },
  headerButton: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardTitle: { fontSize: 16, fontWeight: '600', marginBottom: 10 },
  muted: { fontSize: 13, marginTop: 10, lineHeight: 18 },
  empty: { alignItems: 'center', padding: 32, gap: 4 },
  repo: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 6 },
  repoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  repoName: { fontSize: 17, fontWeight: '600', flex: 1 },
});
