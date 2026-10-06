const API = 'https://api.github.com';

export type RepoRef = { owner: string; repo: string };

export type RepoInfo = RepoRef & {
  defaultBranch: string;
  private: boolean;
  description: string | null;
};

export type GitHubUser = { login: string; name: string | null; avatarUrl: string };

export class GitHubError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/** Accepts `owner/repo`, `https://github.com/owner/repo[/...]` or `git@github.com:owner/repo.git`. */
export function parseRepoInput(input: string): RepoRef | null {
  const s = input.trim();
  const patterns = [
    /^(?:https?:\/\/)?(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+)/i,
    /^git@github\.com:([\w.-]+)\/([\w.-]+)/i,
    /^([\w.-]+)\/([\w.-]+)$/,
  ];
  for (const re of patterns) {
    const m = s.match(re);
    if (m) return { owner: m[1], repo: m[2].replace(/\.git$/i, '') };
  }
  return null;
}

function headers(token?: string | null): Record<string, string> {
  const h: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function request(path: string, token?: string | null): Promise<Response> {
  const res = await fetch(`${API}${path}`, { headers: headers(token) });
  if (res.ok) return res;
  if (res.status === 404) {
    throw new GitHubError(
      token ? 'Repository not found.' : 'Repository not found. Private repos need you to sign in.',
      404,
    );
  }
  if (res.status === 401) throw new GitHubError('GitHub rejected the token. Sign in again.', 401);
  if ((res.status === 403 || res.status === 429) && res.headers.get('x-ratelimit-remaining') === '0') {
    throw new GitHubError('GitHub rate limit reached. Sign in to raise the limit, or try later.', res.status);
  }
  throw new GitHubError(`GitHub request failed (${res.status}).`, res.status);
}

export async function getRepoInfo(ref: RepoRef, token?: string | null): Promise<RepoInfo> {
  const json = await (await request(`/repos/${ref.owner}/${ref.repo}`, token)).json();
  return {
    owner: json.owner.login,
    repo: json.name,
    defaultBranch: json.default_branch,
    private: json.private,
    description: json.description,
  };
}

/** Downloads the whole branch as a single zip archive (one API call). */
export async function downloadZipball(info: RepoInfo, token?: string | null): Promise<ArrayBuffer> {
  const branch = encodeURIComponent(info.defaultBranch);
  const res = await request(`/repos/${info.owner}/${info.repo}/zipball/${branch}`, token);
  return res.arrayBuffer();
}

export async function getUser(token: string): Promise<GitHubUser> {
  const json = await (await request('/user', token)).json();
  return { login: json.login, name: json.name, avatarUrl: json.avatar_url };
}

export type UserRepo = { owner: string; repo: string; private: boolean; description: string | null };

export async function listUserRepos(token: string): Promise<UserRepo[]> {
  const out: UserRepo[] = [];
  for (let page = 1; page <= 5; page++) {
    const json = await (
      await request(`/user/repos?per_page=100&sort=updated&page=${page}`, token)
    ).json();
    for (const r of json) {
      out.push({ owner: r.owner.login, repo: r.name, private: r.private, description: r.description });
    }
    if (json.length < 100) break;
  }
  return out;
}

// --- OAuth device flow (https://docs.github.com/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#device-flow)

export type DeviceCode = {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  interval: number;
  expiresIn: number;
};

async function postForm(url: string, body: Record<string, string>) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
  });
  if (!res.ok) throw new GitHubError(`GitHub sign-in failed (${res.status}).`, res.status);
  return res.json();
}

export async function startDeviceFlow(clientId: string): Promise<DeviceCode> {
  const json = await postForm('https://github.com/login/device/code', {
    client_id: clientId,
    scope: 'repo read:user',
  });
  if (json.error) throw new GitHubError(json.error_description ?? json.error, 400);
  return {
    deviceCode: json.device_code,
    userCode: json.user_code,
    verificationUri: json.verification_uri,
    interval: json.interval,
    expiresIn: json.expires_in,
  };
}

/** Polls until the user approves the code. Resolves with an access token. */
export async function pollDeviceFlow(
  clientId: string,
  code: DeviceCode,
  isCancelled: () => boolean,
): Promise<string | null> {
  let interval = code.interval;
  const deadline = Date.now() + code.expiresIn * 1000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, interval * 1000));
    if (isCancelled()) return null;
    const json = await postForm('https://github.com/login/oauth/access_token', {
      client_id: clientId,
      device_code: code.deviceCode,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    });
    if (json.access_token) return json.access_token;
    if (json.error === 'authorization_pending') continue;
    if (json.error === 'slow_down') {
      interval = json.interval ?? interval + 5;
      continue;
    }
    throw new GitHubError(json.error_description ?? json.error, 400);
  }
  throw new GitHubError('The sign-in code expired. Try again.', 400);
}
