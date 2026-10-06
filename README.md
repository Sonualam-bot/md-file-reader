# MD File Reader

An Android app for reading markdown notes stored in GitHub repositories, on your phone and offline.

I keep my JavaScript and React interview notes as `.md` files in a GitHub repo. Reading them in VS Code
works on a laptop but not on a phone, so this app imports a repo, keeps its markdown files on the device,
and renders them as a clean, GitHub-style reading view.

## Features

- **Library** of every imported repository, with note count, last sync time and a *Continue reading* shortcut.
- **Import by URL**: paste `owner/repo`, `https://github.com/owner/repo/...` or `git@github.com:owner/repo.git`.
  Public repos need no account.
- **GitHub sign-in** with the OAuth device flow (*Continue with GitHub*) or a personal access token, to import
  private repositories and pick from a list of your own repos.
- **Offline reading**: a repo's markdown files are downloaded once and stored on the phone. *Sync now* pulls the
  latest version.
- **Folder browser** with natural sorting (`2_…` before `10_…`) and search across all notes in a repo or folder.
- **Reader**
  - GitHub-flavoured markdown: tables, task lists, block quotes, headings with anchor links
  - Syntax-highlighted code blocks
  - Light and dark themes that follow the system setting
  - Adjustable font size, remembered between sessions
  - Previous / next note in the same folder
  - Relative links to other `.md` files open inside the app; other links open in the browser

## Technology

| Area | Technology |
| --- | --- |
| Framework | [React Native](https://reactnative.dev) 0.86 with [Expo](https://expo.dev) SDK 57 |
| Language | TypeScript, React 19 |
| Navigation | [Expo Router](https://docs.expo.dev/router/introduction/) (file-based routes) |
| GitHub access | GitHub REST API (`fetch`), OAuth device flow |
| Archive extraction | [JSZip](https://stuk.github.io/jszip/) |
| On-device storage | `expo-file-system` (note files), AsyncStorage (library metadata), `expo-secure-store` (GitHub token) |
| Markdown rendering | [marked](https://marked.js.org) (GFM) + [highlight.js](https://highlightjs.org), shown in `react-native-webview` |
| JS engine | Hermes, New Architecture enabled |
| Icons | `@expo/vector-icons` (Ionicons) |
| Tooling | ESLint (`eslint-config-expo`), TypeScript, Gradle / Android SDK for native builds |

## How it works

1. **Import.** The app looks up the repo (`GET /repos/{owner}/{repo}`) and downloads the default branch as one
   zip archive (`GET /repos/{owner}/{repo}/zipball/{branch}`). A single request keeps well under GitHub's
   60-requests-per-hour limit for anonymous users, even for repos with hundreds of notes.
2. **Extract.** JSZip unpacks the archive in JavaScript. Only `.md`, `.markdown` and `.mdx` files are kept, and
   `node_modules`/`.git` are skipped. Files are written to a temporary folder and swapped in only when complete,
   so a failed sync never destroys the copy you already have.
3. **Store.** Notes live in the app's document directory (`repos/<owner>__<repo>/…`) next to a sorted file
   index. Repo metadata is in AsyncStorage and the GitHub token is in the Android Keystore through
   `expo-secure-store`.
4. **Render.** On open, `marked` converts the note to HTML on the device and `highlight.js` colours its code.
   The result becomes a themed page in a WebView. The page's base URL is the file's
   `raw.githubusercontent.com` address, so relative images load when you're online and relative note links
   can be caught and opened inside the app.

## Project structure

```
src/
  app/                    Screens (Expo Router)
    _layout.tsx           Root stack, theme, startup loading
    index.tsx             Library: import box + imported repos
    account.tsx           GitHub sign-in and "your repositories"
    repo/[id].tsx         Folder browser and search (?path=sub/folder)
    read.tsx              Markdown reader (?id=…&path=…)
  components/ui.tsx       Button, Input, Card
  lib/
    github.ts             REST calls, repo URL parsing, device flow
    library.ts            Import / sync / remove, library store
    storage.ts            Zip extraction and on-device files
    markdown.ts           Markdown → themed HTML
    auth.ts               Token storage and signed-in user
    paths.ts              Path helpers and folder listing
    theme.ts              Light / dark palettes
    createStore.ts        Tiny global store on useSyncExternalStore
```

## Getting started

Requirements: Node.js 20+, JDK 17 and the Android SDK (`ANDROID_HOME` set). Android Studio is not required.

```bash
git clone git@github.com:Sonualam-bot/md-file-reader.git
cd md-file-reader
npm install
```

Run on a phone connected over USB (with USB debugging on) or on an emulator, with live reload:

```bash
npx expo run:android
```

### Build an installable APK

```bash
npx expo prebuild --platform android --clean
cd android
./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a --max-workers=2
# → android/app/build/outputs/apk/release/app-release.apk
```

- `-PreactNativeArchitectures=arm64-v8a` targets modern 64-bit phones and builds faster. Remove it to build a
  universal APK.
- `--max-workers=2` keeps memory use reasonable on 8 GB machines. Remove it on bigger machines.
- The release build is signed with the debug keystore. That's fine for installing on your own phone; create a
  real upload key before publishing to the Play Store.
- Cloud alternative with no local Android SDK: `npx eas-cli build -p android --profile preview`.

Copy the APK to the phone and open it. Android will ask you to allow installing apps from that source.

### Enabling "Continue with GitHub"

Token sign-in works out of the box. The device-flow button appears once an OAuth App client ID is configured:

1. On GitHub, open **Settings → Developer settings → OAuth Apps → New OAuth App**. Any homepage and callback
   URL works (for example `https://github.com`).
2. In the new app's settings, tick **Enable Device Flow**.
3. Copy the **Client ID** into `app.json` under `expo.extra.githubClientId`. A client ID is not a secret.
4. Rebuild the app.

To use a token instead, create a fine-grained token with read-only **Contents** access, or a classic token with
the `repo` scope, and paste it on the account screen.

## Scripts

| Command | What it does |
| --- | --- |
| `npm start` | Start the Metro dev server |
| `npm run android` | Build and run a debug build on a device or emulator |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Type-check |

## Roadmap

- Full-text search inside note contents
- Bookmarks and remembered scroll position per note
- Background auto-sync and choosing a branch per repo
- Mermaid diagrams and caching images for offline reading
