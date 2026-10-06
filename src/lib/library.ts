import AsyncStorage from '@react-native-async-storage/async-storage';
import { authStore } from './auth';
import { createStore } from './createStore';
import { downloadZipball, getRepoInfo, parseRepoInput, RepoRef } from './github';
import { deleteRepoFiles, saveMarkdownFromZip } from './storage';

const KEY = 'library:v1';

export type RepoMeta = {
  id: string;
  owner: string;
  repo: string;
  branch: string;
  description: string | null;
  private: boolean;
  fileCount: number;
  syncedAt: number;
  lastRead?: string;
};

export const libraryStore = createStore<{ ready: boolean; repos: RepoMeta[] }>({ ready: false, repos: [] });
export const useLibrary = libraryStore.use;

export const repoId = (ref: RepoRef) => `${ref.owner}__${ref.repo}`.toLowerCase();

export function getRepo(id: string) {
  return libraryStore.get().repos.find((r) => r.id === id);
}

async function save(repos: RepoMeta[]) {
  libraryStore.set({ ready: true, repos });
  await AsyncStorage.setItem(KEY, JSON.stringify(repos));
}

export async function loadLibrary() {
  const raw = await AsyncStorage.getItem(KEY);
  libraryStore.set({ ready: true, repos: raw ? JSON.parse(raw) : [] });
}

/** Downloads (or re-downloads) a repo's markdown files. Accepts anything `parseRepoInput` understands. */
export async function importRepo(input: string | RepoRef, onProgress?: (message: string) => void) {
  const ref = typeof input === 'string' ? parseRepoInput(input) : input;
  if (!ref) throw new Error('Enter a repo as owner/repo or paste its GitHub URL.');
  const { token } = authStore.get();

  onProgress?.('Looking up repository…');
  const info = await getRepoInfo(ref, token);
  onProgress?.('Downloading…');
  const zip = await downloadZipball(info, token);
  const id = repoId(info);
  const paths = await saveMarkdownFromZip(id, zip, (done, total) =>
    onProgress?.(`Saving files ${done}/${total}…`),
  );
  if (paths.length === 0) {
    deleteRepoFiles(id);
    throw new Error('No markdown files found in this repository.');
  }

  const existing = getRepo(id);
  const meta: RepoMeta = {
    id,
    owner: info.owner,
    repo: info.repo,
    branch: info.defaultBranch,
    description: info.description,
    private: info.private,
    fileCount: paths.length,
    syncedAt: Date.now(),
    lastRead: existing?.lastRead && paths.includes(existing.lastRead) ? existing.lastRead : undefined,
  };
  const others = libraryStore.get().repos.filter((r) => r.id !== id);
  await save(existing ? libraryStore.get().repos.map((r) => (r.id === id ? meta : r)) : [meta, ...others]);
  return meta;
}

export async function removeRepo(id: string) {
  deleteRepoFiles(id);
  await save(libraryStore.get().repos.filter((r) => r.id !== id));
}

export async function setLastRead(id: string, path: string) {
  await save(libraryStore.get().repos.map((r) => (r.id === id ? { ...r, lastRead: path } : r)));
}
