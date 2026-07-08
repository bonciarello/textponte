/* ── Test suite per Textponte ──────────────────────────────────── */
const http = require('http');

const BASE = 'http://localhost:4599';
let failures = 0;
let passes = 0;

function assert(condition, label) {
  if (condition) { passes++; console.log(`  ✓ ${label}`); }
  else { failures++; console.error(`  ✗ ${label}`); }
}

function jsonReq(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const opts = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      headers: { 'Content-Type': 'application/json' }
    };
    const req = http.request(opts, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function getReq(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    http.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    }).on('error', reject);
  });
}

async function run() {
  console.log('\n📋 Test suite Textponte\n');

  // Load server module (starts listening)
  console.log('Avvio server…');
  const { server, store, app } = require('./server.js');
  await new Promise(r => setTimeout(r, 300)); // wait for listen

  // ── Share endpoint ──────────────────────────────────────────
  console.log('\n── POST /api/share ──');
  let shareRes = await jsonReq('POST', '/api/share', { text: 'Ciao mondo!' });
  assert(shareRes.status === 200, 'Condivisione testo valido → 200');
  assert(typeof shareRes.body.code === 'string', 'Restituisce un codice');
  assert(shareRes.body.code.length === 6, 'Il codice ha 6 caratteri');
  assert(/^\d{6}$/.test(shareRes.body.code), 'Il codice è composto da 6 cifre');
  assert(typeof shareRes.body.expiresAt === 'number', 'Restituisce expiresAt');
  assert(shareRes.body.expiresAt > Date.now(), 'expiresAt è nel futuro');
  const code1 = shareRes.body.code;

  // Share empty text
  let resEmpty = await jsonReq('POST', '/api/share', { text: '   ' });
  assert(resEmpty.status === 400, 'Testo vuoto → 400');

  // Share no text
  let resNoText = await jsonReq('POST', '/api/share', {});
  assert(resNoText.status === 400, 'Nessun testo → 400');

  // Share too long
  let resLong = await jsonReq('POST', '/api/share', { text: 'x'.repeat(250001) });
  assert(resLong.status === 400, 'Testo troppo lungo → 400');

  // ── Retrieve endpoint ───────────────────────────────────────
  console.log('\n── GET /api/retrieve/:code ──');
  let getRes = await getReq(`/api/retrieve/${code1}`);
  assert(getRes.status === 200, 'Recupero con codice valido → 200');
  assert(getRes.body.text === 'Ciao mondo!', 'Il testo recuperato corrisponde');

  // Retrieve again (should be gone)
  let getAgain = await getReq(`/api/retrieve/${code1}`);
  assert(getAgain.status === 404, 'Secondo recupero stesso codice → 404 (già usato)');
  assert(getAgain.body.error, 'Messaggio di errore presente');

  // Retrieve invalid code
  let resBadCode = await getReq('/api/retrieve/abc123');
  assert(resBadCode.status === 400, 'Codice non numerico → 400');

  let resShortCode = await getReq('/api/retrieve/123');
  assert(resShortCode.status === 400, 'Codice di 3 cifre → 400');

  let resNotFound = await getReq('/api/retrieve/999999');
  assert(resNotFound.status === 404, 'Codice inesistente → 404');

  // ── Expiration ──────────────────────────────────────────────
  console.log('\n── Scadenza ──');
  let resExp = await jsonReq('POST', '/api/share', { text: 'Scade subito' });
  const codeExp = resExp.body.code;

  // Manually expire the entry
  const entry = store.get(codeExp);
  if (entry) {
    entry.expiresAt = Date.now() - 1000; // expired 1 second ago
    let resExpired = await getReq(`/api/retrieve/${codeExp}`);
    assert(resExpired.status === 410, 'Testo scaduto → 410 Gone');
  } else {
    assert(false, 'Entry should exist in store');
  }

  // ── Unique codes ────────────────────────────────────────────
  console.log('\n── Univocità codici ──');
  let codes = new Set();
  for (let i = 0; i < 10; i++) {
    let r = await jsonReq('POST', '/api/share', { text: `Test ${i}` });
    codes.add(r.body.code);
  }
  assert(codes.size === 10, '10 condivisioni generano 10 codici diversi');

  // ── Static files ────────────────────────────────────────────
  console.log('\n── File statici ──');
  let htmlRes = await getReq('/');
  assert(typeof htmlRes.body === 'string' && htmlRes.body.includes('<!DOCTYPE html>'), 'index.html viene servito');
  let robotsRes = await getReq('/robots.txt');
  assert(typeof robotsRes.body === 'string' && robotsRes.body.includes('User-agent'), 'robots.txt viene servito');
  let sitemapRes = await getReq('/sitemap.xml');
  assert(typeof sitemapRes.body === 'string' && sitemapRes.body.includes('urlset'), 'sitemap.xml viene servito');

  // ── Results ─────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(40)}`);
  console.log(`  Passati: ${passes}  |  Falliti: ${failures}`);
  console.log(`${'─'.repeat(40)}\n`);

  // Cleanup
  server.close();
  process.exit(failures > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
