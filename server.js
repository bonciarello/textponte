const express = require('express');
const path = require('path');
const crypto = require('crypto');

const app = express();
app.use(express.json({ limit: '500kb' }));

// Static files from "public"
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders(res, filePath) {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

// ── In-memory store ──────────────────────────────────────────────
// entry: { text, expiresAt (timestamp ms) }
const store = new Map();

// Cleanup every 30 seconds
setInterval(() => {
  const now = Date.now();
  for (const [code, entry] of store) {
    if (now >= entry.expiresAt) store.delete(code);
  }
}, 30_000);

// ── Helpers ──────────────────────────────────────────────────────
function generateCode() {
  // 6-digit code, no leading zero
  const buf = crypto.randomBytes(4);
  const num = buf.readUInt32BE(0) % 900_000 + 100_000;
  return String(num);
}

function uniqueCode() {
  let code;
  do {
    code = generateCode();
  } while (store.has(code));
  return code;
}

// ── API ──────────────────────────────────────────────────────────

// POST /api/share  body: { text }
app.post('/api/share', (req, res) => {
  const { text } = req.body;
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return res.status(400).json({ error: 'Il testo non può essere vuoto.' });
  }
  if (text.length > 250_000) {
    return res.status(400).json({ error: 'Testo troppo lungo (max 250.000 caratteri).' });
  }

  const code = uniqueCode();
  const expiresAt = Date.now() + 5 * 60_000; // 5 minuti
  store.set(code, { text, expiresAt });

  return res.json({ code, expiresAt });
});

// GET /api/retrieve/:code
app.get('/api/retrieve/:code', (req, res) => {
  const { code } = req.params;
  if (!/^\d{6}$/.test(code)) {
    return res.status(400).json({ error: 'Il codice deve essere di 6 cifre.' });
  }

  const entry = store.get(code);
  if (!entry) {
    return res.status(404).json({ error: 'Codice non trovato. Potrebbe essere scaduto o già stato usato.' });
  }

  if (Date.now() >= entry.expiresAt) {
    store.delete(code);
    return res.status(410).json({ error: 'Il testo è scaduto (trascorsi 5 minuti).' });
  }

  // One-time access: delete immediately
  const text = entry.text;
  store.delete(code);
  return res.json({ text });
});

// ── Start ────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4599;
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Textponte in ascolto su http://0.0.0.0:${PORT}`);
});

module.exports = { app, server, store };
