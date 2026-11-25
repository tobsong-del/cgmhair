// CGM HAIR site build: runs on Cloudflare Pages after every commit (build command: node _build/build.js)
// Reads news/issues.json + _data/site.json and (re)generates:
//   - one page per newspaper issue in ko / en / es (news/<date>.html, en/news/<date>.html, es/news/<date>.html)
//   - the issue list on news.html and the latest-3 cards on index.html (between <!--NEWS-...--> markers)
//   - sitemap.xml, and search-engine verification tags in every page
// Safe to run many times: it only rewrites the marked regions and generated files.
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const BASE = 'https://cgmhair.kr';
const LANGS = { ko: 'ko-KR', en: 'en', es: 'es' };
const PRE = { ko: '/', en: '/en/', es: '/es/' };
const rd = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const wr = (p, s) => { fs.mkdirSync(path.dirname(path.join(ROOT, p)), { recursive: true }); fs.writeFileSync(path.join(ROOT, p), s); };
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const T = {
  ko: { news: '곱슬 신문', home: '홈', page: n => `${n}면`, ad: '광고', sponsored: '협찬·광고 면', read: '기사 보기', by: '발행', src: '근거·출처', related: '다른 기사', all: '신문 전체 보기',
        prev: '이전 페이지', next: '다음 페이지', zoom: '크게 보기', copy: '링크 복사', ig: '인스타그램에서 보기', swipe: '신문 페이지, 좌우로 넘겨보세요', adnote: '광고·협찬 면은 기사와 구분해 표시해요.',
        view: n => `${n}면 보기`, adview: '광고 면 보기', days: ['일', '월', '화', '수', '목', '금', '토'], cat: {} },
  en: { news: 'Curly News', home: 'Home', page: n => `Page ${n}`, ad: 'Ad', sponsored: 'Sponsored page', read: 'Read', by: 'Published by', src: 'Sources', related: 'More issues', all: 'See all issues',
        prev: 'Previous page', next: 'Next page', zoom: 'Zoom in', copy: 'Copy link', ig: 'View on Instagram', swipe: 'newspaper pages, swipe left or right', adnote: 'Sponsored and ad pages are labeled separately from articles. Newspaper pages are in Korean.',
        view: n => `View page ${n}`, adview: 'View ad page',
        cat: { '곱슬머리 모발과학': 'Curly hair science', '탈매직 가이드': 'Straightening-transition guide', '곱슬머리 커트': 'Curly haircuts', 'CGM 홈케어': 'CGM home care', '두피와 모발 건강': 'Scalp & hair health', '곱슬머리 역사와 문화': 'Curly hair history & culture', '컬리 코믹': 'Curly Comic', '고객 사례': 'Client stories', '해외 곱슬머리 트렌드': 'Global curly trends' } },
  es: { news: 'Periódico rizado', home: 'Inicio', page: n => `Página ${n}`, ad: 'Anuncio', sponsored: 'Página patrocinada', read: 'Leer', by: 'Publicado por', src: 'Fuentes', related: 'Otros números', all: 'Ver todos los números',
        prev: 'Página anterior', next: 'Página siguiente', zoom: 'Ampliar', copy: 'Copiar enlace', ig: 'Ver en Instagram', swipe: 'páginas del periódico, desliza a los lados', adnote: 'Las páginas patrocinadas y de anuncios se marcan aparte de los artículos. Las páginas del periódico están en coreano, salvo que haya edición en español.',
        view: n => `Ver página ${n}`, adview: 'Ver página de anuncio',
        cat: { '곱슬머리 모발과학': 'Ciencia del cabello rizado', '탈매직 가이드': 'Guía para dejar el alisado', '곱슬머리 커트': 'Cortes para rizos', 'CGM 홈케어': 'Cuidado en casa CGM', '두피와 모발 건강': 'Salud del cuero cabelludo', '곱슬머리 역사와 문화': 'Historia y cultura del rizo', '컬리 코믹': 'Curly Comic', '고객 사례': 'Casos reales', '해외 곱슬머리 트렌드': 'Tendencias internacionales' } },
};
const AUTHOR = { ko: 'CGM헤어 송수경', en: 'CGM HAIR · Song Sukyung', es: 'CGM HAIR · Song Sukyung' };

function pick(x, k, l) { return (x[`${k}_${l}`] || '').trim() || (x[`${k}_ko`] || '').trim(); }
function pages(x, l) { const p = (l !== 'ko' && Array.isArray(x[`pages_${l}`]) && x[`pages_${l}`].some(q => q && q.image)) ? x[`pages_${l}`] : (x.pages_ko || []); return p.filter(q => q && q.image); }
function img(p) { return /^https?:/.test(p) ? p : '/' + String(p).replace(/^\/+/, ''); }
function cat(c, l) { return (T[l].cat[c]) || c || ''; }
function fdate(iso, l, long) {
  const d = new Date(iso + 'T00:00:00Z'); if (isNaN(d)) return iso;
  if (l === 'ko') { const p = n => String(n).padStart(2, '0'); return `${d.getUTCFullYear()}.${p(d.getUTCMonth() + 1)}.${p(d.getUTCDate())}` + (long ? ` (${T.ko.days[d.getUTCDay()]})` : ''); }
  return d.toLocaleDateString(l === 'es' ? 'es-ES' : 'en-GB', Object.assign({ timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' }, long ? { weekday: 'short' } : {}));
}
function md(s) { // tiny markdown: ## headings, - lists, paragraphs, **bold**, [text](url)
  const inline = t => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+|\/[^)\s]*)\)/g, '<a href="$2">$1</a>');
  const out = []; let list = null;
  for (const raw of String(s || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (/^- /.test(line)) { if (!list) { list = []; } list.push(`<li>${inline(line.slice(2))}</li>`); continue; }
    if (list) { out.push(`<ul>${list.join('')}</ul>`); list = null; }
    if (!line) continue;
    if (/^## /.test(line)) out.push(`<h2>${inline(line.slice(3))}</h2>`);
    else out.push(`<p>${inline(line)}</p>`);
  }
  if (list) out.push(`<ul>${list.join('')}</ul>`);
  return out.join('\n');
}
function plain(s) { return String(s || '').replace(/^## .*$/gm, '').replace(/[*#\[\]]/g, '').replace(/\s+/g, ' ').trim(); }

// ---------- load data ----------
let issues = [];
try { issues = JSON.parse(rd('news/issues.json')).issues || []; } catch (e) { console.warn('issues.json missing or invalid:', e.message); }
issues = issues.filter(x => x && x.publish !== false && x.date && pages(x, 'ko').length).sort((a, b) => (a.date < b.date ? 1 : -1));
const seen = {};
for (const x of issues) { let s = (x.slug || '').trim().replace(/[^a-z0-9-]/gi, '-').toLowerCase() || x.date; if (seen[s]) s = `${s}-${++seen[s]}`; else seen[s] = 1; x._slug = s; }
let site = {}; try { site = JSON.parse(rd('_data/site.json')); } catch (e) {}

const artUrl = (x, l) => `${PRE[l]}news/${x._slug}`;

// ---------- article page ----------
function articleMain(x, l) {
  const t = T[l], P = pages(x, l), title = pick(x, 'title', l), sub = pick(x, 'subtitle', l), summary = pick(x, 'summary', l);
  const slides = P.map((q, i) => `<div class="slide${q.ad ? ' ad' : ''}" data-i="${i}">${q.ad ? `<span class="ad-tag">${t.ad}</span>` : ''}<img src="${esc(img(q.image))}" width="1122" height="1402" alt="SANBON CGM HAIR NEWS ${esc(x.date)} ${q.ad ? t.sponsored : t.page(i + 1)} · ${esc(title)}"${i ? ' loading="lazy"' : ''}></div>`).join('');
  const thumbs = P.map((q, i) => `<button type="button" class="thumb" data-go="${i}" aria-label="${q.ad ? t.adview : t.view(i + 1)}"><img src="${esc(img(q.image))}" alt="" loading="lazy"></button>`).join('');
  const src = pick(x, 'source', l);
  const srcHtml = src ? `<p class="src"><b>${t.src}:</b> ${x.source_url ? `<a href="${esc(x.source_url)}">${esc(src)}</a>` : esc(src)}</p>` : '';
  const rel = issues.filter(y => y !== x).sort((a, b) => ((b.category === x.category) - (a.category === x.category)) || (a.date < b.date ? 1 : -1)).slice(0, 3);
  const relHtml = rel.length ? `<nav class="related" aria-label="${t.related}"><h2>${t.related}</h2><ul>${rel.map(y => `<li><a href="${artUrl(y, l)}">${esc(pick(y, 'title', l))}</a><span>${esc(fdate(y.date, l))}</span></li>`).join('')}</ul></nav>` : '';
  const hasAd = P.some(q => q.ad);
  return `<main id="top">
<div class="wrap">
  <nav class="crumbs" aria-label="breadcrumb"><a href="${PRE[l]}">${t.home}</a> › <a href="${PRE[l]}news/">${t.news}</a> › <span>${esc(title)}</span></nav>
  <header class="article-head">
    <p class="label cat">${esc(cat(x.category, l))}</p>
    <h1>${esc(title)}</h1>
    ${sub ? `<p class="sub">${esc(sub)}</p>` : ''}
    <p class="byline"><time datetime="${esc(x.date)}">${esc(fdate(x.date, l, true))}</time> · ${t.by}: ${esc(x.author && l === 'ko' ? x.author : AUTHOR[l])}</p>
  </header>
</div>
<section class="issues-wrap" style="padding-top:24px">
  <div class="wrap">
    <article class="issue" id="issue" data-date="${esc(x.date)}">
      <div class="viewer">
        <div class="track" tabindex="0" aria-label="${esc(title)}: ${t.swipe}">${slides}</div>
        <div class="v-ctrl"><button type="button" class="v-prev" aria-label="${t.prev}">←</button><span class="v-count"><b>1</b> / ${P.length}</span><button type="button" class="v-next" aria-label="${t.next}">→</button><button type="button" class="v-zoom">${t.zoom}</button></div>
        <div class="thumbs">${thumbs}</div>
        ${hasAd ? `<p class="ad-note">${t.adnote}</p>` : (l !== 'ko' ? `<p class="ad-note">${t.adnote}</p>` : '')}
      </div>
      <div class="issue-meta">
        ${summary ? `<p class="sum">${esc(summary)}</p>` : ''}
        ${srcHtml}
        <div class="i-actions"><button type="button" class="btn btn-line btn-sm share">${t.copy}</button>${x.instagram ? `<a class="btn btn-line btn-sm" href="${esc(x.instagram)}">${t.ig}</a>` : ''}</div>
        <p class="copied" aria-live="polite"></p>
      </div>
    </article>
    <div class="article-body">
${md(pick(x, 'body', l))}
    </div>
    ${relHtml}
    <div class="sec-more" style="justify-content:flex-start"><a class="btn btn-line" href="${PRE[l]}news/">${t.all}</a></div>
  </div>
</section>
</main>`;
}
function articleHead(x, l) {
  const title = pick(x, 'title', l), desc = (pick(x, 'summary', l) || plain(pick(x, 'body', l))).slice(0, 160);
  const u = BASE + artUrl(x, l), P = pages(x, l).filter(q => !q.ad), cover = BASE + img(P.length ? P[0].image : pages(x, l)[0].image);
  const alts = Object.keys(LANGS).map(c => `<link rel="alternate" hreflang="${LANGS[c]}" href="${BASE + artUrl(x, c)}">`).join('\n') + `\n<link rel="alternate" hreflang="x-default" href="${BASE + artUrl(x, 'ko')}">`;
  const ld = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'NewsArticle', '@id': u + '#article', headline: title.slice(0, 110), alternativeHeadline: pick(x, 'subtitle', l) || undefined, description: desc,
      datePublished: x.date, dateModified: x.date, inLanguage: LANGS[l], mainEntityOfPage: u,
      image: P.map(q => BASE + img(q.image)), articleSection: cat(x.category, l),
      author: { '@type': 'Person', name: '송수경', worksFor: { '@id': BASE + '/#salon' } },
      publisher: { '@type': 'Organization', '@id': BASE + '/#salon', name: 'CGM HAIR', logo: { '@type': 'ImageObject', url: BASE + '/images/logo-red.png' } },
      isPartOf: { '@type': 'Periodical', name: 'SANBON CGM HAIR NEWS' } },
    { '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: T[l].home, item: BASE + PRE[l] },
      { '@type': 'ListItem', position: 2, name: T[l].news, item: BASE + PRE[l] + 'news/' },
      { '@type': 'ListItem', position: 3, name: title, item: u }] }] };
  return `<!--SEO-->
<title>${esc(title)} | SANBON CGM HAIR NEWS</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${u}">
${alts}
<meta property="og:type" content="article">
<meta property="og:site_name" content="CGM HAIR">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${u}">
<meta property="og:image" content="${cover}">
<meta property="article:published_time" content="${esc(x.date)}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/images/favicon.png">
<script type="application/ld+json">${JSON.stringify(ld)}</script>
<!--/SEO-->
`;
}
function langSwitch(x, l) {
  return '<nav class="lang" aria-label="Language">' + [['ko', 'KO'], ['en', 'EN'], ['es', 'ES']].map(([c, n]) =>
    `<a href="${artUrl(x, c)}" hreflang="${LANGS[c]}" lang="${c}"${c === l ? ' aria-current="true"' : ''}>${n}</a>`).join('<span aria-hidden="true">·</span>') + '</nav>';
}

// ---------- list cards ----------
function card(x, l, h) {
  const P = pages(x, l), t = T[l], title = pick(x, 'title', l), s = pick(x, 'summary', l) || plain(pick(x, 'body', l));
  const short = s.length > 110 ? s.slice(0, 110) + '…' : s;
  return `<article class="${h === 'h3' ? 'paper' : 'ncard'}" data-date="${esc(x.date)}" data-text="${esc(title + ' ' + s + ' ' + cat(x.category, l))}">
  <a class="cover" href="${artUrl(x, l)}"><img src="${esc(img(P[0].image))}" width="1122" height="1402" alt="SANBON CGM HAIR NEWS ${esc(x.date)} · ${esc(title)}" loading="lazy"></a>
  <p class="label cat">${esc(cat(x.category, l))} · ${esc(fdate(x.date, l))}</p>
  <${h}><a href="${artUrl(x, l)}">${esc(title)}</a></${h}>
  <p class="${h === 'h3' ? 'p-sum' : 'sum'}">${esc(short)}</p>
  <a class="more btn btn-line btn-sm" href="${artUrl(x, l)}">${t.read}</a>
</article>`;
}
const setRegion = (html, name, inner) => html.replace(new RegExp(`<!--${name}-->[\\s\\S]*?<!--/${name}-->`), `<!--${name}-->${inner}<!--/${name}-->`);

// ---------- run ----------
const urls = [];
for (const l of Object.keys(LANGS)) {
  const dir = l === 'ko' ? '' : l + '/';
  // list page
  let list = rd(dir + 'news/index.html');
  list = setRegion(list, 'NEWS-LIST', `\n<div class="ncards">\n${issues.map(x => card(x, l, 'h2')).join('\n')}\n</div>\n`);
  list = setRegion(list, 'NEWS-INDEX', issues.map(x => `<a href="${artUrl(x, l)}"><span>${esc(fdate(x.date, l, true))}</span>${esc(pick(x, 'title', l))}</a>`).join(''));
  wr(dir + 'news/index.html', list);
  // home latest
  let home = rd(dir + 'index.html');
  home = setRegion(home, 'NEWS-LATEST', '\n' + issues.slice(0, 3).map(x => card(x, l, 'h3')).join('\n') + '\n');
  wr(dir + 'index.html', home);
  // articles (shell = list page)
  for (const x of issues) {
    let a = list.replace(/<main id="top">[\s\S]*?<\/main>/, () => articleMain(x, l));
    a = a.replace(/<!--SEO-->[\s\S]*?<!--\/SEO-->\n?/, () => articleHead(x, l));
    a = a.replace(/<nav class="lang"[\s\S]*?<\/nav>/, () => langSwitch(x, l));
    wr(`${dir}news/${x._slug}.html`, a);
  }
}
// remove article files that no longer exist in issues.json
for (const l of Object.keys(LANGS)) {
  const d = path.join(ROOT, l === 'ko' ? '' : l, 'news');
  if (!fs.existsSync(d)) continue;
  const keep = new Set(issues.map(x => x._slug + '.html'));
  for (const f of fs.readdirSync(d)) if (/^\d{4}-\d{2}-\d{2}.*\.html$/.test(f) && !keep.has(f)) fs.unlinkSync(path.join(d, f));
}
// sitemap
const today = new Date().toISOString().slice(0, 10);
const staticPages = ['', 'services', 'about', 'stories', 'news/', 'faq', 'reservation'];
let sm = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n';
const entry = (loc, alts, lastmod) => `  <url><loc>${loc}</loc><lastmod>${lastmod}</lastmod>${alts}</url>\n`;
for (const p of staticPages) {
  const alts = Object.keys(LANGS).map(c => `<xhtml:link rel="alternate" hreflang="${LANGS[c]}" href="${BASE + PRE[c] + p}"/>`).join('');
  for (const l of Object.keys(LANGS)) sm += entry(BASE + PRE[l] + p, alts, today);
}
for (const x of issues) {
  const alts = Object.keys(LANGS).map(c => `<xhtml:link rel="alternate" hreflang="${LANGS[c]}" href="${BASE + artUrl(x, c)}"/>`).join('');
  for (const l of Object.keys(LANGS)) sm += entry(BASE + artUrl(x, l), alts, x.date);
}
sm += '</urlset>\n';
wr('sitemap.xml', sm);
// verification tags in every public page
const ver = [
  site.google_verification && `<meta name="google-site-verification" content="${esc(site.google_verification)}">`,
  site.naver_verification && `<meta name="naver-site-verification" content="${esc(site.naver_verification)}">`,
  site.bing_verification && `<meta name="msvalidate.01" content="${esc(site.bing_verification)}">`,
].filter(Boolean).join('\n');
(function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f), rel = path.relative(ROOT, p);
    if (/^(admin|_build|_data|node_modules|\.git)/.test(rel)) continue;
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (f.endsWith('.html')) { const s = fs.readFileSync(p, 'utf8'); if (s.includes('<!--VERIFY-->')) fs.writeFileSync(p, s.replace(/<!--VERIFY-->[\s\S]*?<!--\/VERIFY-->/, `<!--VERIFY-->${ver}<!--/VERIFY-->`)); }
  }
})(ROOT);
console.log(`CGM HAIR build: ${issues.length} issues × 3 languages, sitemap updated.`);
