import { Directory, File, Paths } from 'expo-file-system';
import JSZip from 'jszip';

const MARKDOWN = /\.(md|markdown|mdx)$/i;
const SKIPPED_DIRS = new Set(['node_modules', '.git']);

function reposRoot() {
  const dir = new Directory(Paths.document, 'repos');
  dir.create({ intermediates: true, idempotent: true });
  return dir;
}

function repoDir(id: string) {
  return new Directory(reposRoot(), id);
}

function indexFile(id: string) {
  return new File(reposRoot(), `${id}.index.json`);
}

/**
 * Extracts every markdown file from a GitHub zipball into the repo's folder and returns
 * their repo-relative paths. Files are written to a temp folder first so a failed import
 * leaves the previous copy intact.
 */
export async function saveMarkdownFromZip(
  id: string,
  zipData: ArrayBuffer,
  onProgress?: (done: number, total: number) => void,
): Promise<string[]> {
  const zip = await JSZip.loadAsync(zipData);
  const entries = Object.values(zip.files).filter((entry) => {
    if (entry.dir) return false;
    // Zipballs wrap everything in a single "<owner>-<repo>-<sha>/" folder.
    const segments = entry.name.split('/').slice(1);
    return MARKDOWN.test(entry.name) && !segments.some((s) => SKIPPED_DIRS.has(s));
  });

  const tmp = new Directory(reposRoot(), `${id}.tmp`);
  if (tmp.exists) tmp.delete();
  tmp.create();

  const paths: string[] = [];
  for (const [i, entry] of entries.entries()) {
    const rel = entry.name.split('/').slice(1).join('/');
    const slash = rel.lastIndexOf('/');
    if (slash > 0) new Directory(tmp, rel.slice(0, slash)).create({ intermediates: true, idempotent: true });
    new File(tmp, rel).write(await entry.async('string'));
    paths.push(rel);
    onProgress?.(i + 1, entries.length);
  }

  const dest = repoDir(id);
  if (dest.exists) dest.delete();
  tmp.rename(id);

  paths.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  indexFile(id).write(JSON.stringify(paths));
  return paths;
}

export function readIndex(id: string): string[] {
  const file = indexFile(id);
  return file.exists ? JSON.parse(file.textSync()) : [];
}

export function readMarkdown(id: string, path: string): Promise<string> {
  return new File(repoDir(id), path).text();
}

export function deleteRepoFiles(id: string) {
  const dir = repoDir(id);
  if (dir.exists) dir.delete();
  const index = indexFile(id);
  if (index.exists) index.delete();
}
