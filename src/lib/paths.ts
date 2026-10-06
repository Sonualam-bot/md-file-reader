export const basename = (path: string) => path.slice(path.lastIndexOf('/') + 1);

export const dirname = (path: string) => {
  const i = path.lastIndexOf('/');
  return i === -1 ? '' : path.slice(0, i);
};

/** "5_Reflow_Repaint.md" -> "5 Reflow Repaint" */
export const prettyName = (name: string) => name.replace(/\.(md|markdown|mdx)$/i, '').replace(/_/g, ' ');

/** Resolves `.` and `..` segments in a repo-relative path. */
export function normalize(path: string) {
  const out: string[] = [];
  for (const seg of path.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') out.pop();
    else out.push(seg);
  }
  return out.join('/');
}

/** Direct sub-folders and files of `folder` (repo-relative, '' for root), given every file path. */
export function listFolder(paths: string[], folder: string) {
  const prefix = folder ? `${folder}/` : '';
  const folders = new Map<string, number>();
  const files: string[] = [];
  for (const p of paths) {
    if (!p.startsWith(prefix)) continue;
    const rest = p.slice(prefix.length);
    const slash = rest.indexOf('/');
    if (slash === -1) files.push(p);
    else {
      const name = rest.slice(0, slash);
      folders.set(name, (folders.get(name) ?? 0) + 1);
    }
  }
  const sorted = [...folders.entries()].sort(([a], [b]) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }),
  );
  return { folders: sorted.map(([name, count]) => ({ name, path: prefix + name, count })), files };
}
