import { appendSharedDebugEntry } from './debug-tools.js';
import { listStorageKeys, removeStorageKey } from './browser-storage.js';
import { CryptoDataError, deriveAesKey, decryptEnvelopeText } from './data-decryptor.js';

const KEY_PREFIX = 'visagio_crypto_key_';
const PASSWORD_KEY = 'visagio_crypto_password_session';
const memoryKeys = new Map();
let memoryPassword = null;

// Limpa artefatos de versões anteriores. A sessão atual permanece somente em
// memória: a CryptoKey não é exportável e a senha nunca é gravada.
function clearLegacySessionArtifacts() {
  for (const scope of ['session', 'local']) {
    removeStorageKey(scope, PASSWORD_KEY);
    listStorageKeys(scope, KEY_PREFIX).forEach((key) => removeStorageKey(scope, key));
  }
}

clearLegacySessionArtifacts();

function keyId(entry) {
  const companyId =
    entry.company_id || String(entry.original_path || '').split('/')[1] || 'unknown';
  return `${KEY_PREFIX}${companyId}_${entry.sha256 || entry.original_path}`.replace(
    /[^a-zA-Z0-9_-]/g,
    '_'
  );
}

function logCrypto(level, event, detail = {}, error = null) {
  appendSharedDebugEntry({
    phase: 'crypto',
    module: 'crypto-session',
    level,
    event,
    detail,
    error,
  });
}

function ensureStyles() {
  if (document.getElementById('cryptoSessionStyles')) return;
  const style = document.createElement('style');
  style.id = 'cryptoSessionStyles';
  style.textContent = `
    .crypto-lock-card{position:fixed;inset:auto 24px 24px auto;z-index:10000;max-width:420px;background:#fff;border:1px solid rgba(15,23,42,.18);box-shadow:0 24px 80px rgba(15,23,42,.24);border-radius:18px;padding:18px;color:#14213d}
    .crypto-lock-card h2{margin:0 0 8px;font-size:1.1rem}.crypto-lock-card p{margin:0 0 12px;color:#4b5563}.crypto-lock-card input{width:100%;padding:12px;border:1px solid #cbd5e1;border-radius:12px;margin-bottom:12px}
    .crypto-lock-card .crypto-actions{display:flex;gap:8px;align-items:center}.crypto-lock-card button{cursor:pointer}.crypto-error{color:#b42318;font-weight:700;margin-top:8px}.crypto-lock-button{position:fixed;right:24px;bottom:24px;z-index:9999}
    @media (max-width:560px){
      .crypto-lock-card{left:16px;right:16px;bottom:16px;max-width:none;width:auto;max-height:calc(100vh - 32px);overflow:auto}
      .crypto-lock-card .crypto-actions{flex-direction:column;align-items:stretch}
      .crypto-lock-card button{width:100%}
      .crypto-lock-button{left:16px;right:16px;bottom:16px;width:auto}
    }
  `;
  document.head.appendChild(style);
}

function showPasswordPrompt(entry, errorMessage = '') {
  ensureStyles();
  return new Promise((resolve, reject) => {
    const existing = document.getElementById('cryptoPasswordPrompt');
    if (existing) existing.remove();
    const card = document.createElement('form');
    card.id = 'cryptoPasswordPrompt';
    card.className = 'crypto-lock-card';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    card.setAttribute('aria-labelledby', 'cryptoPromptTitle');
    const previousFocus = document.activeElement;
    window.dispatchEvent(new CustomEvent('visagio:crypto-prompt', { detail: { visible: true } }));
    const closePrompt = () => {
      card.remove();
      window.dispatchEvent(
        new CustomEvent('visagio:crypto-prompt', { detail: { visible: false } })
      );
      previousFocus?.focus();
    };
    card.innerHTML = `
      <h2 id="cryptoPromptTitle">Dados protegidos</h2>
      <p>Digite a frase de acesso para carregar ${entry.company_id === 'empresa1' ? 'Empresa 1' : entry.company_id === 'empresa2' ? 'Empresa 2' : 'os dados'}.</p>
      <input type="password" id="cryptoPasswordInput" autocomplete="current-password" aria-label="Frase de acesso" placeholder="Frase de acesso" required>
      <div class="crypto-actions">
        <button type="submit" class="ni-button primary">Desbloquear</button>
        <button type="button" class="ni-button secondary" id="cryptoCancel">Cancelar</button>
      </div>
      <div class="crypto-error" id="cryptoPromptError" ${errorMessage ? '' : 'hidden'}>${errorMessage}</div>
    `;
    document.body.appendChild(card);
    const input = card.querySelector('#cryptoPasswordInput');
    input.focus();
    card.addEventListener('submit', (event) => {
      event.preventDefault();
      resolve(input.value);
      closePrompt();
    });
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') card.querySelector('#cryptoCancel').click();
      if (event.key !== 'Tab') return;
      const controls = [...card.querySelectorAll('input, button')];
      if (event.shiftKey && document.activeElement === controls[0]) {
        event.preventDefault();
        controls.at(-1).focus();
      } else if (!event.shiftKey && document.activeElement === controls.at(-1)) {
        event.preventDefault();
        controls[0].focus();
      }
    });
    card.querySelector('#cryptoCancel').addEventListener('click', () => {
      closePrompt();
      reject(new CryptoDataError('CRYPTO_003', 'Acesso negado. Senha não informada.'));
    });
  });
}

function storeKey(entry, key) {
  const id = keyId(entry);
  memoryKeys.set(id, key);
}

export function lockCryptoSession() {
  memoryKeys.clear();
  memoryPassword = null;
  clearLegacySessionArtifacts();
  logCrypto('warn', 'CRYPTO_008', { message: 'cache descriptografado limpo' });
  window.dispatchEvent(new CustomEvent('visagio:crypto-lock'));
}

export function installLockButton() {
  if (window.__VISAGIO_NETWORK_UI__ || document.getElementById('cryptoLockButton')) return;
  ensureStyles();
  const button = document.createElement('button');
  button.type = 'button';
  button.id = 'cryptoLockButton';
  button.className = 'ni-button secondary crypto-lock-button';
  button.textContent = 'Bloquear dados';
  button.addEventListener('click', () => {
    lockCryptoSession();
    window.location.reload();
  });
  document.body.appendChild(button);
}

let activePromptPromise = null;

function getCoalescedPassword(entry, errorMessage = '') {
  if (activePromptPromise) {
    return activePromptPromise;
  }
  activePromptPromise = showPasswordPrompt(entry, errorMessage).finally(() => {
    activePromptPromise = null;
  });
  return activePromptPromise;
}

export async function decryptWithSession(entry, envelope) {
  const aad = entry.original_path;
  const storedKey = memoryKeys.get(keyId(entry));
  if (storedKey) {
    try {
      return await decryptEnvelopeText(envelope, storedKey, aad);
    } catch {
      memoryKeys.delete(keyId(entry));
    }
  }

  if (memoryPassword) {
    try {
      const key = await deriveAesKey(memoryPassword, envelope.salt, false);
      const text = await decryptEnvelopeText(envelope, key, aad);
      storeKey(entry, key);
      installLockButton();
      logCrypto('success', 'crypto:unlock:cached-password', {
        company_id: entry.company_id,
        path: entry.original_path,
      });
      return text;
    } catch (error) {
      memoryPassword = null;
      logCrypto(
        'warn',
        'CRYPTO_003',
        { company_id: entry.company_id, path: entry.original_path, cached_password_failed: true },
        error
      );
    }
  }

  let errorMessage = '';
  let unlocked = 0;
  while (unlocked < 1) {
    const password = await getCoalescedPassword(entry, errorMessage);
    try {
      const key = await deriveAesKey(password, envelope.salt, false);
      const text = await decryptEnvelopeText(envelope, key, aad);
      memoryPassword = password;
      storeKey(entry, key);
      installLockButton();
      logCrypto('success', 'crypto:unlock', {
        company_id: entry.company_id,
        path: entry.original_path,
      });
      unlocked = 1;
      return text;
    } catch (error) {
      errorMessage = 'Senha inválida ou dados corrompidos. Tente novamente.';
      logCrypto(
        'warn',
        'CRYPTO_003',
        { company_id: entry.company_id, path: entry.original_path },
        error
      );
    }
  }
}

// Limpa apenas as chaves da empresa que está saindo.
// lockCryptoSession() (botão de bloqueio) continua limpando tudo — uso intencional.
function lockCompanyKeys(companyId) {
  if (!companyId) return;
  const safePrefix = `${KEY_PREFIX}${companyId}_`.replace(/[^a-zA-Z0-9_-]/g, '_');
  for (const key of [...memoryKeys.keys()]) {
    if (key.startsWith(safePrefix)) memoryKeys.delete(key);
  }
  logCrypto('info', 'CRYPTO_009', { company_evicted: companyId });
}

window.addEventListener('visagio:company-change', (event) => {
  // Evita invalidar chaves da empresa destino — só limpa a empresa que saiu.
  lockCompanyKeys(event?.detail?.from);
});
