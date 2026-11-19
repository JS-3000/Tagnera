// Responsive check: opens the important pages at many screen sizes, reports horizontal
// overflow and too-small touch targets, and saves screenshots + an overview page.
//
//   npm run build && npm run check:responsive
//
// Results: test-results/responsive/index.html (open in a browser)
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const PORT = 4179;
const BASE = `http://localhost:${PORT}/`;
const OUT = 'test-results/responsive';
const DEMO_TAG = '96dcfd4b-9757-48db-9309-48aa95d79ef4'; // 1P101

const SIZES = [
  { name: '320', width: 320, height: 640, touch: true },
  { name: '360', width: 360, height: 780, touch: true },
  { name: '390', width: 390, height: 844, touch: true },
  { name: '430', width: 430, height: 932, touch: true },
  { name: '768', width: 768, height: 1024, touch: true },
  { name: '1024', width: 1024, height: 768, touch: true },
  { name: '1280', width: 1280, height: 800, touch: false },
  { name: '1920', width: 1920, height: 1080, touch: false },
  { name: 'quer-844', width: 844, height: 390, touch: true },
  { name: 'quer-740', width: 740, height: 360, touch: true },
];

const PUBLIC_PAGES = [
  ['oeffentlich-bauteil', `#/t/${DEMO_TAG}`],
  ['stoerung-melden', `#/t/${DEMO_TAG}/meldung`],
  ['anmelden', '#/anmelden'],
];

const PAGES = [
  ['uebersicht', '#/'],
  ['scan', '#/scan'],
  ['bauteil', `#/t/${DEMO_TAG}`],
  ['eintrag', `#/t/${DEMO_TAG}/eintrag`],
  ['hinweise', '#/hinweise'],
  ['tags', '#/tags'],
  ['tag-neu', '#/tags/neu'],
  ['katalog', '#/katalog'],
  ['lieferanten', '#/lieferanten'],
  ['etiketten', '#/etiketten?demo=1'],
  ['import', '#/import'],
  ['report', '#/report'],
  ['kalender', '#/kalender'],
  ['meldungen', '#/meldungen'],
  ['einstellungen', '#/einstellungen'],
  ['monitor', '#/monitor'],
  ['viewer', `#/viewer?src=${encodeURIComponent('docs/Kieselmann/5091_DE.pdf')}&name=5091`],
];

// areas that may scroll sideways on purpose (wide tables on PC, label sheets, zoomed PDF)
const ALLOWED_SCROLL = '.table-wrap, .sheets, .pdfv-body, .jump';

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const results = [];
try {
  for (const size of SIZES) {
    const ctx = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      hasTouch: size.touch,
      isMobile: size.touch && size.width < 1000,
      deviceScaleFactor: 1,
    });
    const page = await ctx.newPage();
    await page.goto(BASE + '#/'); // first start loads the demo data
    await page.waitForTimeout(1500);
    // new devices start without account – first the public pages, then log in (admin)
    for (const [name, hash] of PUBLIC_PAGES) await checkPage(page, size, name, hash);
    await page.evaluate(() => {
      const k = 'tagnera.settings.v1';
      const v = JSON.parse(localStorage.getItem(k) || '{}');
      localStorage.setItem(k, JSON.stringify({ ...v, loggedOut: false }));
    });
    for (const [name, hash] of PAGES) await checkPage(page, size, name, hash);
    await ctx.close();
  }
} finally {
  await browser.close();
  server.kill();
}

async function checkPage(page, size, name, hash) {
  {
    await page.goto(BASE + hash);
    await page.waitForTimeout(name === 'viewer' ? 2500 : 900);
    const r = await page.evaluate(
      ({ allowed, touch }) => {
        const vw = document.documentElement.clientWidth;
        const overflow = [];
        const pageScroll = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - vw;
        const scrollBox = document.querySelector('.scroll');
        const boxScroll = scrollBox ? scrollBox.scrollWidth - scrollBox.clientWidth : 0;
        for (const el of document.querySelectorAll('body *')) {
          if (el.closest(allowed)) continue;
          const s = getComputedStyle(el);
          if (s.display === 'none' || s.visibility === 'hidden' || s.position === 'fixed') continue;
          const b = el.getBoundingClientRect();
          if (b.width === 0 || b.height === 0) continue;
          if (b.right > vw + 1 || b.left < -1) {
            overflow.push(
              `${el.tagName.toLowerCase()}.${[...el.classList].join('.')} (${Math.round(b.left)}–${Math.round(b.right)})`,
            );
          }
        }
        const small = [];
        if (touch) {
          for (const el of document.querySelectorAll(
            'button, a.btn, .bottomnav a, input:not([type=hidden]), select, textarea, .icon-btn, summary',
          )) {
            if (el.closest('.sheets, .hidden')) continue;
            const s = getComputedStyle(el);
            if (s.display === 'none' || s.visibility === 'hidden') continue;
            const b = el.getBoundingClientRect();
            if (b.width === 0 || b.height === 0) continue;
            // checkboxes count via their (big) label
            if (el.matches('input[type=checkbox], input[type=radio]') && el.closest('label')) continue;
            if (b.height < 44 || b.width < 44) {
              small.push(
                `${el.tagName.toLowerCase()}${el.className ? '.' + String(el.className).split(' ').join('.') : ''} "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 24)}" ${Math.round(b.width)}×${Math.round(b.height)}`,
              );
            }
          }
        }
        return { pageScroll, boxScroll, overflow: overflow.slice(0, 8), small: [...new Set(small)].slice(0, 8) };
      },
      { allowed: ALLOWED_SCROLL, touch: size.touch },
    );
    const file = `${name}-${size.name}.png`;
    await page.screenshot({ path: `${OUT}/${file}` });
    const ok = r.pageScroll <= 1 && r.boxScroll <= 1 && r.overflow.length === 0;
    results.push({ page: name, size: size.name, ok, touchOk: r.small.length === 0, ...r, file });
    console.log(
      `${ok ? 'OK  ' : 'FEHL'} ${r.small.length ? 'TOUCH' : '     '} ${size.name.padEnd(9)} ${name}` +
        (ok ? '' : `  ${r.overflow.slice(0, 3).join(' | ')} scroll=${r.pageScroll}/${r.boxScroll}`) +
        (r.small.length ? `  klein: ${r.small.slice(0, 3).join(' | ')}` : ''),
    );
  }
}

const bad = results.filter((r) => !r.ok);
const smallT = results.filter((r) => !r.touchOk);
writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
const rows = [...PUBLIC_PAGES, ...PAGES]
  .map(
    ([p]) =>
      `<tr><th>${p}</th>${SIZES.map((s) => {
        const r = results.find((x) => x.page === p && x.size === s.name);
        return `<td class="${r.ok ? (r.touchOk ? 'ok' : 'warn') : 'bad'}"><a href="${r.file}"><img loading="lazy" src="${r.file}"></a><div>${r.ok ? 'kein Überlauf' : 'ÜBERLAUF'}${r.touchOk ? '' : ' · kleine Ziele'}</div></td>`;
      }).join('')}</tr>`,
  )
  .join('\n');
writeFileSync(
  `${OUT}/index.html`,
  `<!doctype html><meta charset="utf-8"><title>Responsive-Check ConnecTag</title>
<style>body{font-family:system-ui;margin:16px;background:#F4F5F7;color:#1F2A36}table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:4px;vertical-align:top;font-size:12px;background:#fff}
img{width:140px;display:block}td.ok div{color:#2e9b5f}td.warn div{color:#a8560b}td.bad div{color:#d64541;font-weight:700}th{position:sticky;left:0;background:#eef1f4}</style>
<h1>Responsive-Check</h1><p>${results.length} Aufrufe · Überlauf: ${bad.length} · zu kleine Touch-Ziele: ${smallT.length}</p>
<div style="overflow:auto"><table><tr><th></th>${SIZES.map((s) => `<th>${s.name}<br>${s.width}×${s.height}</th>`).join('')}</tr>${rows}</table></div>`,
);
console.log(
  `\n${results.length} Aufrufe · Überlauf: ${bad.length} · zu kleine Touch-Ziele: ${smallT.length}\nÜbersicht: ${OUT}/index.html`,
);
process.exit(bad.length ? 1 : 0);
