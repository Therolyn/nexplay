import { cached } from './cache';
import { BROWSER_UA, fetchText, normName } from './utils';

const WIKI_API = process.env.WIKI_API || 'https://pt.wikipedia.org/w/api.php';

function normTitle(s: string): string {
  return normName(s);
}

function wikiTitleOk(mname: string, ptitle: string): boolean {
  const a = normTitle(mname);
  const b = normTitle(ptitle);
  if (!a || !b) return false;
  if (a.includes(b) || b.includes(a)) return true;
  const ta = new Set(a.split(' '));
  const tb = new Set(b.split(' '));
  if (!ta.size || !tb.size) return false;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / ta.size >= 0.5;
}

async function wikiGet(url: string): Promise<Record<string, unknown> | null> {
  for (let i = 0; i < 2; i++) {
    try {
      const text = await fetchText(url, 10000, { 'User-Agent': BROWSER_UA });
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      if (i === 0) await new Promise((r) => setTimeout(r, 1000));
    }
  }
  return null;
}

function wikiIntroInner(title: string, target: string): Promise<string> {
  return (async () => {
    const search = await wikiGet(
      `${WIKI_API}?action=query&list=search&srsearch=${encodeURIComponent(`${title} filme`)}&format=json&formatversion=2&srlimit=5`,
    );
    const query = (search?.query || {}) as { search?: { title?: string }[] };
    const hits = query.search || [];
    for (const h of hits.slice(0, 5)) {
      const ptitle = h.title || '';
      if (!ptitle) continue;
      const ex = await wikiGet(
        `${WIKI_API}?action=query&prop=extracts&exintro&explaintext&format=json&formatversion=2&titles=${encodeURIComponent(ptitle)}`,
      );
      const eq = (ex?.query || {}) as { pages?: { extract?: string }[] };
      const pages = eq.pages || [];
      const text = (pages[0]?.extract || '').trim();
      if (text.length < 60) continue;
      if (wikiTitleOk(title, ptitle) || normName(text).includes(target)) {
        return text.slice(0, 600);
      }
    }
    return '';
  })();
}

export function wikiIntro(title: string): Promise<string> {
  if (!title || !title.trim()) return Promise.resolve('');
  const target = normTitle(title)
    .replace(/\b\d{4}\b/g, ' ')
    .replace(/\b(filme|serie|temporada|filmes|series)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!target) return Promise.resolve('');
  return cached(`wiki|${target}`, 30 * 60 * 1000, () => wikiIntroInner(title, target), { cacheEmpty: false }) as Promise<string>;
}
