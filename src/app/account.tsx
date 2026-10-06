import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Input } from '../components/ui';
import { githubClientId, signIn, signOut, useAuth } from '../lib/auth';
import { DeviceCode, listUserRepos, pollDeviceFlow, startDeviceFlow, UserRepo } from '../lib/github';
import { importRepo, repoId, useLibrary } from '../lib/library';
import { useTheme } from '../lib/theme';

export default function Account() {
  const { token } = useAuth();
  return token ? <SignedIn token={token} /> : <SignedOut />;
}

function SignedOut() {
  const t = useTheme();
  const [pat, setPat] = useState('');
  const [busy, setBusy] = useState(false);
  const [device, setDevice] = useState<DeviceCode | null>(null);
  const cancelled = useRef(false);

  useEffect(() => () => void (cancelled.current = true), []);

  async function deviceSignIn() {
    setBusy(true);
    cancelled.current = false;
    try {
      const code = await startDeviceFlow(githubClientId);
      setDevice(code);
      await Clipboard.setStringAsync(code.userCode);
      await WebBrowser.openBrowserAsync(code.verificationUri);
      const accessToken = await pollDeviceFlow(githubClientId, code, () => cancelled.current);
      if (accessToken) await signIn(accessToken);
    } catch (e) {
      if (!cancelled.current) Alert.alert('Sign-in failed', (e as Error).message);
    } finally {
      if (!cancelled.current) {
        setBusy(false);
        setDevice(null);
      }
    }
  }

  async function tokenSignIn() {
    setBusy(true);
    try {
      await signIn(pat);
    } catch (e) {
      Alert.alert('Sign-in failed', (e as Error).message);
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Text style={[styles.lead, { color: t.muted }]}>
        Signing in lets you import private repositories, pick from your own repos, and raises GitHub’s rate limit.
        Your token is kept in the phone’s secure storage.
      </Text>

      {githubClientId ? (
        <Card>
          <Text style={[styles.title, { color: t.text }]}>Sign in with GitHub</Text>
          {device ? (
            <View style={{ gap: 10 }}>
              <Text style={{ color: t.muted }}>Enter this code on GitHub (it’s copied to your clipboard):</Text>
              <Text selectable style={[styles.code, { color: t.text }]}>
                {device.userCode}
              </Text>
              <Button
                variant="secondary"
                title="Open GitHub again"
                onPress={() => WebBrowser.openBrowserAsync(device.verificationUri)}
              />
              <View style={styles.row}>
                <ActivityIndicator color={t.accent} />
                <Text style={{ color: t.muted }}>Waiting for approval…</Text>
              </View>
            </View>
          ) : (
            <Button title="Continue with GitHub" onPress={deviceSignIn} loading={busy} />
          )}
        </Card>
      ) : null}

      <Card>
        <Text style={[styles.title, { color: t.text }]}>
          {githubClientId ? 'Or use a personal access token' : 'Sign in with a personal access token'}
        </Text>
        <Text style={[styles.help, { color: t.muted }]}>
          Create one at github.com → Settings → Developer settings → Personal access tokens. A fine-grained token
          with read-only “Contents” access is enough (or a classic token with the “repo” scope).
        </Text>
        <Pressable onPress={() => WebBrowser.openBrowserAsync('https://github.com/settings/personal-access-tokens/new')}>
          <Text style={{ color: t.accent, marginBottom: 12 }}>Create a token on GitHub →</Text>
        </Pressable>
        <Input placeholder="github_pat_… or ghp_…" value={pat} onChangeText={setPat} secureTextEntry />
        <View style={{ height: 10 }} />
        <Button title="Save token" onPress={tokenSignIn} disabled={!pat.trim()} loading={busy && !device} />
      </Card>
    </ScrollView>
  );
}

function SignedIn({ token }: { token: string }) {
  const t = useTheme();
  const { user } = useAuth();
  const imported = new Set(useLibrary().repos.map((r) => r.id));
  const [repos, setRepos] = useState<UserRepo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [importing, setImporting] = useState<string | null>(null);
  const [progress, setProgress] = useState('');

  useEffect(() => {
    listUserRepos(token).then(setRepos, (e) => setError((e as Error).message));
  }, [token]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (repos ?? []).filter((r) => !q || `${r.owner}/${r.repo}`.toLowerCase().includes(q));
  }, [repos, query]);

  async function add(r: UserRepo) {
    const id = repoId(r);
    setImporting(id);
    try {
      await importRepo(r, setProgress);
      router.dismissTo({ pathname: '/repo/[id]', params: { id } });
    } catch (e) {
      Alert.alert('Import failed', (e as Error).message);
    } finally {
      setImporting(null);
      setProgress('');
    }
  }

  return (
    <FlatList
      data={filtered}
      keyExtractor={(r) => `${r.owner}/${r.repo}`}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.page}
      ListHeaderComponent={
        <View style={{ gap: 16 }}>
          <Card>
            <View style={styles.row}>
              {user?.avatarUrl ? <Image source={{ uri: user.avatarUrl }} style={styles.avatar} /> : null}
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: t.text, marginBottom: 0 }]}>{user?.name ?? user?.login ?? 'Signed in'}</Text>
                {user ? <Text style={{ color: t.muted }}>@{user.login}</Text> : null}
              </View>
              <Button variant="danger" title="Sign out" onPress={signOut} />
            </View>
          </Card>
          <Text style={[styles.title, { color: t.text, marginBottom: 0 }]}>Your repositories</Text>
          <Input placeholder="Filter repositories" value={query} onChangeText={setQuery} />
        </View>
      }
      ListEmptyComponent={
        error ? (
          <Text style={{ color: t.danger }}>{error}</Text>
        ) : repos === null ? (
          <ActivityIndicator color={t.accent} />
        ) : (
          <Text style={{ color: t.muted }}>No repositories found.</Text>
        )
      }
      renderItem={({ item }) => {
        const id = repoId(item);
        const isImported = imported.has(id);
        return (
          <Pressable
            disabled={importing !== null}
            onPress={() =>
              isImported ? router.dismissTo({ pathname: '/repo/[id]', params: { id } }) : add(item)
            }
            style={({ pressed }) => [
              styles.repo,
              { borderColor: t.border, backgroundColor: t.surface },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Ionicons name={item.private ? 'lock-closed-outline' : 'book-outline'} size={18} color={t.muted} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.text, fontSize: 15, fontWeight: '500' }} numberOfLines={1}>
                {item.owner}/{item.repo}
              </Text>
              {importing === id ? (
                <Text style={{ color: t.muted, fontSize: 12 }}>{progress || 'Importing…'}</Text>
              ) : item.description ? (
                <Text style={{ color: t.muted, fontSize: 12 }} numberOfLines={1}>
                  {item.description}
                </Text>
              ) : null}
            </View>
            {importing === id ? (
              <ActivityIndicator color={t.accent} />
            ) : (
              <Ionicons
                name={isImported ? 'checkmark-circle' : 'download-outline'}
                size={20}
                color={isImported ? t.accent : t.muted}
              />
            )}
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 16 },
  lead: { fontSize: 14, lineHeight: 20 },
  title: { fontSize: 16, fontWeight: '600', marginBottom: 10 },
  help: { fontSize: 13, lineHeight: 18, marginBottom: 8 },
  code: { fontSize: 30, fontWeight: '700', letterSpacing: 4, textAlign: 'center', fontVariant: ['tabular-nums'] },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  repo: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 10, padding: 12 },
});
