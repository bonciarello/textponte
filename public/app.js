/* ── DOM refs ──────────────────────────────────────────────────── */
const $ = (sel) => document.querySelector(sel);

// Tabs
const tabShare    = $('#tab-share');
const tabRetrieve = $('#tab-retrieve');
const panelShare  = $('#panel-share');
const panelRetrieve = $('#panel-retrieve');

// Share
const shareText     = $('#share-text');
const shareCharCount = $('#share-char-count');
const shareTextErr  = $('#share-text-error');
const btnShare      = $('#btn-share');
const shareResult   = $('#share-result');
const codeDisplay   = $('#code-display');
const shareTimer    = $('#share-timer');
const btnCopyCode   = $('#btn-copy-code');
const btnNewShare   = $('#btn-new-share');

// Retrieve
const retrieveCode   = $('#retrieve-code');
const retrieveCodeErr = $('#retrieve-code-error');
const btnRetrieve    = $('#btn-retrieve');
const retrieveResult = $('#retrieve-result');
const retrievedText  = $('#retrieved-text');
const btnNewRetrieve = $('#btn-new-retrieve');
const retrieveErrorDisplay = $('#retrieve-error-display');
const retrieveErrorMsg = $('#retrieve-error-msg');
const btnRetry       = $('#btn-retry');

// Toast
const toast = $('#toast');

// State
let currentMode = 'share';
let shareTimerInterval = null;
let shareExpiresAt = null;

/* ── Tab switching ────────────────────────────────────────────── */
function switchMode(mode) {
  currentMode = mode;
  if (mode === 'share') {
    tabShare.classList.add('active');
    tabShare.setAttribute('aria-selected', 'true');
    tabRetrieve.classList.remove('active');
    tabRetrieve.setAttribute('aria-selected', 'false');
    panelShare.classList.add('active');
    panelRetrieve.classList.remove('active');
  } else {
    tabRetrieve.classList.add('active');
    tabRetrieve.setAttribute('aria-selected', 'true');
    tabShare.classList.remove('active');
    tabShare.setAttribute('aria-selected', 'false');
    panelRetrieve.classList.add('active');
    panelShare.classList.remove('active');
  }
}

tabShare.addEventListener('click', () => switchMode('share'));
tabRetrieve.addEventListener('click', () => switchMode('retrieve'));

/* ── Toast ───────────────────────────────────────────────────── */
let toastTimeout;
function showToast(message, type = '') {
  clearTimeout(toastTimeout);
  toast.textContent = message;
  toast.className = 'toast ' + type;
  toast.hidden = false;
  // Force reflow for animation
  void toast.offsetWidth;
  toast.style.animation = 'none';
  void toast.offsetWidth;
  toast.style.animation = '';
  toastTimeout = setTimeout(() => { toast.hidden = true; }, 3000);
}

/* ── Character count ─────────────────────────────────────────── */
shareText.addEventListener('input', () => {
  const len = shareText.value.length;
  shareCharCount.textContent = `${len.toLocaleString('it-IT')} / 250.000`;
  if (shareTextErr.hidden === false) {
    shareTextErr.hidden = true;
    shareText.classList.remove('input-error');
  }
});

/* ── Share flow ──────────────────────────────────────────────── */
function setShareLoading(loading) {
  btnShare.disabled = loading;
  if (loading) {
    btnShare.dataset.originalText = btnShare.innerHTML;
    btnShare.innerHTML = '<span class="spinner" aria-hidden="true"></span> Generazione…';
  } else if (btnShare.dataset.originalText) {
    btnShare.innerHTML = btnShare.dataset.originalText;
    delete btnShare.dataset.originalText;
  }
}

btnShare.addEventListener('click', async () => {
  const text = shareText.value.trim();
  if (!text) {
    shareTextErr.textContent = 'Inserisci del testo prima di generare il codice.';
    shareTextErr.hidden = false;
    shareText.classList.add('input-error');
    shareText.focus();
    return;
  }
  if (text.length > 250000) {
    shareTextErr.textContent = 'Il testo supera il limite di 250.000 caratteri.';
    shareTextErr.hidden = false;
    shareText.classList.add('input-error');
    shareText.focus();
    return;
  }

  setShareLoading(true);
  try {
    const res = await fetch('api/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    const data = await res.json();

    if (!res.ok) {
      shareTextErr.textContent = data.error || 'Errore del server.';
      shareTextErr.hidden = false;
      shareText.classList.add('input-error');
      setShareLoading(false);
      return;
    }

    // Success: show code
    displayCode(data.code, data.expiresAt);
    showToast('Codice generato! Scade tra 5 minuti.', 'success');

  } catch (err) {
    shareTextErr.textContent = 'Errore di rete. Verifica la connessione.';
    shareTextErr.hidden = false;
    shareText.classList.add('input-error');
    setShareLoading(false);
  }
});

function displayCode(code, expiresAt) {
  shareExpiresAt = expiresAt;
  // Populate digits
  const digits = codeDisplay.querySelectorAll('.code-digit');
  const codeStr = String(code);
  digits.forEach((el, i) => {
    el.textContent = codeStr[i];
    el.setAttribute('aria-label', `Cifra ${i + 1}: ${codeStr[i]}`);
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
  });

  // Set aria-label for full code
  codeDisplay.setAttribute('aria-label', `Codice: ${codeStr.split('').join(' ')}`);

  shareResult.hidden = false;
  setShareLoading(false);
  btnShare.hidden = true;

  // Start countdown
  startShareTimer(expiresAt);
}

function startShareTimer(expiresAt) {
  clearInterval(shareTimerInterval);
  updateShareTimer(expiresAt);
  shareTimerInterval = setInterval(() => updateShareTimer(expiresAt), 1000);
}

function updateShareTimer(expiresAt) {
  const remaining = Math.max(0, expiresAt - Date.now());
  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);
  shareTimer.textContent = `${mins}:${String(secs).padStart(2, '0')}`;

  if (remaining <= 0) {
    clearInterval(shareTimerInterval);
    shareTimer.textContent = 'Scaduto';
    shareTimer.style.color = 'var(--color-error)';
  } else if (remaining < 60000) {
    shareTimer.style.color = 'var(--color-warning)';
  }
}

function resetShare() {
  shareResult.hidden = true;
  btnShare.hidden = false;
  setShareLoading(false);
  clearInterval(shareTimerInterval);
  shareTimer.style.color = '';
  shareText.value = '';
  shareText.focus();
  shareCharCount.textContent = '0 / 250.000';
}

btnNewShare.addEventListener('click', resetShare);

/* ── Copy code ───────────────────────────────────────────────── */
btnCopyCode.addEventListener('click', async () => {
  const digits = codeDisplay.querySelectorAll('.code-digit');
  const code = Array.from(digits).map(d => d.textContent).join('');

  try {
    await navigator.clipboard.writeText(code);
    showToast('Codice copiato negli appunti!', 'success');
    btnCopyCode.textContent = '✓ Copiato!';
    setTimeout(() => {
      btnCopyCode.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copia codice`;
    }, 2000);
  } catch {
    // Fallback
    showToast('Seleziona e copia il codice manualmente.', '');
  }
});

/* ── Retrieve flow ───────────────────────────────────────────── */
function setRetrieveLoading(loading) {
  btnRetrieve.disabled = loading;
  if (loading) {
    btnRetrieve.dataset.originalText = btnRetrieve.innerHTML;
    btnRetrieve.innerHTML = '<span class="spinner" aria-hidden="true"></span> Ricerca…';
  } else if (btnRetrieve.dataset.originalText) {
    btnRetrieve.innerHTML = btnRetrieve.dataset.originalText;
    delete btnRetrieve.dataset.originalText;
  }
}

function hideRetrieveResults() {
  retrieveResult.hidden = true;
  retrieveErrorDisplay.hidden = true;
}

function showRetrieveError(msg) {
  retrieveResult.hidden = true;
  retrieveErrorMsg.textContent = msg;
  retrieveErrorDisplay.hidden = false;
  setRetrieveLoading(false);
}

retrieveCode.addEventListener('input', () => {
  // Only allow digits
  retrieveCode.value = retrieveCode.value.replace(/\D/g, '').slice(0, 6);
  if (retrieveCodeErr.hidden === false) {
    retrieveCodeErr.hidden = true;
    retrieveCode.classList.remove('input-error');
  }
});

btnRetrieve.addEventListener('click', async () => {
  const code = retrieveCode.value.trim();
  hideRetrieveResults();

  if (!/^\d{6}$/.test(code)) {
    retrieveCodeErr.textContent = 'Inserisci un codice di esattamente 6 cifre.';
    retrieveCodeErr.hidden = false;
    retrieveCode.classList.add('input-error');
    retrieveCode.focus();
    return;
  }

  setRetrieveLoading(true);
  try {
    const res = await fetch(`api/retrieve/${code}`);
    const data = await res.json();

    if (!res.ok) {
      showRetrieveError(data.error || 'Codice non valido.');
      return;
    }

    // Success
    retrievedText.textContent = data.text;
    retrieveResult.hidden = false;
    retrieveErrorDisplay.hidden = true;
    setRetrieveLoading(false);
    retrieveCode.value = '';
    showToast('Testo recuperato e cancellato dal server.', 'success');

  } catch (err) {
    showRetrieveError('Errore di rete. Verifica la connessione.');
  }
});

// Allow Enter key on code input
retrieveCode.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    btnRetrieve.click();
  }
});

function resetRetrieve() {
  hideRetrieveResults();
  retrieveCode.value = '';
  retrieveCode.classList.remove('input-error');
  retrieveCodeErr.hidden = true;
  setRetrieveLoading(false);
  retrieveCode.focus();
}

btnNewRetrieve.addEventListener('click', resetRetrieve);
btnRetry.addEventListener('click', resetRetrieve);

/* ── Keyboard shortcut: Ctrl+1 / Ctrl+2 for tabs ─────────────── */
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === '1') {
    e.preventDefault();
    switchMode('share');
  }
  if ((e.ctrlKey || e.metaKey) && e.key === '2') {
    e.preventDefault();
    switchMode('retrieve');
  }
});

/* ── Init ─────────────────────────────────────────────────────── */
shareText.focus();
