import hljs from 'highlight.js/lib/common';
import { Marked } from 'marked';
import type { Theme } from './theme';

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** GitHub-style heading anchors so in-page `#links` work. */
function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z#0-9]+;/g, '')
    .replace(/[!-,./:-@[-^`{-~\u2000-\u206F]/g, '') // punctuation except - and _
    .trim()
    .replace(/\s/g, '-');
}

function createMarked() {
  const seen = new Map<string, number>();
  return new Marked({
    gfm: true,
    renderer: {
      code({ text, lang }) {
        const language = (lang ?? '').split(/\s/)[0];
        const html =
          language && hljs.getLanguage(language)
            ? hljs.highlight(text, { language, ignoreIllegals: true }).value
            : escapeHtml(text);
        return `<pre><code class="hljs">${html}</code></pre>\n`;
      },
      heading({ tokens, depth }) {
        const inner = this.parser.parseInline(tokens);
        let slug = slugify(inner);
        const n = seen.get(slug) ?? 0;
        seen.set(slug, n + 1);
        if (n) slug += `-${n}`;
        return `<h${depth} id="${slug}">${inner}</h${depth}>\n`;
      },
    },
  });
}

function css(t: Theme, fontSize: number) {
  const syntax = t.dark
    ? { kw: '#FF7B72', str: '#A5D6FF', fn: '#D2A8FF', num: '#79C0FF', com: '#8B949E', type: '#FFA657', tag: '#7EE787' }
    : { kw: '#CF222E', str: '#0A3069', fn: '#8250DF', num: '#0550AE', com: '#6E7781', type: '#953800', tag: '#116329' };
  return `
  :root { color-scheme: ${t.dark ? 'dark' : 'light'}; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 16px 16px 48px; background: ${t.bg}; color: ${t.text};
    font: ${fontSize}px/1.65 -apple-system, Roboto, "Segoe UI", sans-serif; word-wrap: break-word; }
  h1, h2, h3, h4, h5, h6 { line-height: 1.3; margin: 1.4em 0 0.6em; font-weight: 600; }
  h1 { font-size: 1.75em; padding-bottom: .3em; border-bottom: 1px solid ${t.border}; }
  h2 { font-size: 1.4em; padding-bottom: .3em; border-bottom: 1px solid ${t.border}; }
  h3 { font-size: 1.2em; } h4 { font-size: 1.05em; }
  body > :first-child { margin-top: 0; }
  p, ul, ol, blockquote, table, pre { margin: 0 0 1em; }
  ul, ol { padding-left: 1.5em; } li + li { margin-top: .25em; }
  a { color: ${t.accent}; text-decoration: none; }
  img { max-width: 100%; height: auto; }
  hr { border: 0; height: 1px; background: ${t.border}; margin: 1.5em 0; }
  blockquote { margin-left: 0; padding: 0 1em; color: ${t.muted}; border-left: .25em solid ${t.border}; }
  code { font-family: "JetBrains Mono", Menlo, monospace; font-size: .86em;
    background: ${t.surface}; border: 1px solid ${t.border}; border-radius: 6px; padding: .1em .35em; }
  pre { background: ${t.surface}; border: 1px solid ${t.border}; border-radius: 8px; padding: 12px 14px;
    overflow-x: auto; line-height: 1.5; }
  pre code { background: none; border: 0; padding: 0; font-size: .82em; white-space: pre; }
  table { border-collapse: collapse; display: block; overflow-x: auto; max-width: 100%; }
  th, td { border: 1px solid ${t.border}; padding: 6px 12px; }
  th { background: ${t.surface}; font-weight: 600; }
  input[type=checkbox] { margin-right: .4em; }
  .hljs-keyword, .hljs-selector-tag, .hljs-literal, .hljs-built_in { color: ${syntax.kw}; }
  .hljs-string, .hljs-regexp, .hljs-attr, .hljs-template-variable { color: ${syntax.str}; }
  .hljs-title, .hljs-title.function_, .hljs-section { color: ${syntax.fn}; }
  .hljs-number, .hljs-variable, .hljs-attribute, .hljs-meta { color: ${syntax.num}; }
  .hljs-comment, .hljs-quote { color: ${syntax.com}; font-style: italic; }
  .hljs-type, .hljs-title.class_, .hljs-params { color: ${syntax.type}; }
  .hljs-name, .hljs-selector-class, .hljs-selector-id { color: ${syntax.tag}; }
  `;
}

export function renderMarkdownPage(markdown: string, theme: Theme, fontSize: number) {
  const body = createMarked().parse(markdown, { async: false });
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>${css(theme, fontSize)}</style></head><body>${body}</body></html>`;
}
