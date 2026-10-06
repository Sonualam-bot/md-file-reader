import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { createStore } from './createStore';
import { getUser, GitHubUser } from './github';

const TOKEN_KEY = 'github-token';

/** OAuth App client ID for "Sign in with GitHub" (device flow). Set `expo.extra.githubClientId` in app.json. */
export const githubClientId: string = Constants.expoConfig?.extra?.githubClientId ?? '';

type AuthState = { ready: boolean; token: string | null; user: GitHubUser | null };

export const authStore = createStore<AuthState>({ ready: false, token: null, user: null });
export const useAuth = authStore.use;

export async function loadAuth() {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  authStore.set({ ready: true, token, user: null });
  if (token) {
    try {
      authStore.set({ ...authStore.get(), user: await getUser(token) });
    } catch {
      // Offline or revoked; the token is re-validated on the next GitHub call.
    }
  }
}

/** Validates the token against GitHub before saving it. */
export async function signIn(token: string) {
  const user = await getUser(token.trim());
  await SecureStore.setItemAsync(TOKEN_KEY, token.trim());
  authStore.set({ ready: true, token: token.trim(), user });
}

export async function signOut() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  authStore.set({ ready: true, token: null, user: null });
}
