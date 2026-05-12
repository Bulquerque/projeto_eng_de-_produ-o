import { appendSharedDebugEntry } from './debug-tools.js';
import { CryptoDataError, deriveAesKey, decryptEnvelopeText, exportAesKey, importAesKey } from './data-decryptor.js';

const KEY_PREFIX = 'visagio_crypto_key_';
const memoryKeys = new Map();
let memoryPassword = null;

function keyId(entry) {
  return `${KEY_PREFIX}${entry.sha256 || entry.original_path}`.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function logCrypto(level, event, detail = {}, error = null) {
  appendSharedDebugEntry({ phase: 'crypto', module: 'crypto-session', level, event, detail, error });
}

function ensureStyles() {
  if (document.getElementById('cryptoSessionStyles')) return;
  const style = document.createElement('style');
  style.id = 'cryptoSessionStyles';
  style.textContent = `
    .crypto-lock-card{position:fixed;inset:auto 24px 24px auto;z-index:10000;max-width:420px;background:#fff;border:1px solid rgba(15,23,42,.18);box-shadow:0 24px 80px rgba(15,23,42,.24);border-radius:18px;padding:18px;color:#14213d}
    .crypto-lock-card h2{margin:0 0 8px;font-size:1.1rem}.crypto-lock-card p{margin:0 0 12px;color:#4b5563}.crypto-lock-card input{width:100%;padding:12px;border:1px solid #cbd5e1;border-radius:12px;margin-bottom:12px}
    .crypto-lock-card .crypto-actions{display:flex;gap:8px;align-items:center}.crypto-lock-card button{cursor:pointer}.crypto-error{color:#b42318;font-weight:700;margin-top:8px}.crypto-lock-button{position:fixed;right:24px;bottom:24px;z-index:9999}
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
    card.innerHTML = `
      <h2>Dados protegidos</h2>
      <p>Digite a frase de acesso para carregar ${entry.company_id || 'os dados'}.</p>
      <input type="password" id="cryptoPasswordInput" autocomplete="current-password" placeholder="Frase de acesso" required>
      <div class="crypto-actions">
        <button type="submit" class="primary-button">Desbloquear simulador</button>
        <button type="button" class="secondary-button" id="cryptoCancel">Cancelar</button>
      </div>
      <div class="crypto-error" id="cryptoPromptError" ${errorMessage ? '' : 'hidden'}>${errorMessage}</div>
    `;
    document.body.appendChild(card);
    const input = card.querySelector('#cryptoPasswordInput');
    input.focus();
    card.addEventListener('submit', (event) => {
      event.preventDefault();
      resolve(input.value);
      card.remove();
    });
    card.querySelector('#cryptoCancel').addEventListener('click', () => {
      card.remove();
      reject(new CryptoDataError('CRYPTO_003', 'Acesso negado. Senha não informada.'));
    });
  });
}

async function keyFromSession(entry) {
  const id = keyId(entry);
  if (memoryKeys.has(id)) return memoryKeys.get(id);
  const raw = sessionStorage.getItem(id);
  if (!raw) return null;
  const key = await importAesKey(raw);
  memoryKeys.set(id, key);
  return key;
}

async function storeKey(entry, key) {
  const id = keyId(entry);
  memoryKeys.set(id, key);
  sessionStorage.setItem(id, await exportAesKey(key));
}

export function lockCryptoSession() {
  memoryKeys.clear();
  memoryPassword = null;
  Object.keys(sessionStorage).filter((key) => key.startsWith(KEY_PREFIX)).forEach((key) => sessionStorage.removeItem(key));
  logCrypto('warn', 'CRYPTO_008', { message: 'cache descriptografado limpo' });
  window.dispatchEvent(new CustomEvent('visagio:crypto-lock'));
}

export function installLockButton() {
  if (document.getElementById('cryptoLockButton')) return;
  ensureStyles();
  const button = document.createElement('button');
  button.type = 'button';
  button.id = 'cryptoLockButton';
  button.className = 'secondary-button crypto-lock-button';
  button.textContent = 'Bloquear dados';
  button.addEventListener('click', () => {
    lockCryptoSession();
    window.location.reload();
  });
  document.body.appendChild(button);
}

export async function decryptWithSession(entry, envelope) {
  const aad = entry.original_path;
  const storedKey = await keyFromSession(entry);
  if (storedKey) {
    try {
      return await decryptEnvelopeText(envelope, storedKey, aad);
    } catch {
      sessionStorage.removeItem(keyId(entry));
      memoryKeys.delete(keyId(entry));
    }
  }

  if (memoryPassword) {
    try {
      const key = await deriveAesKey(memoryPassword, envelope.salt, true);
      const text = await decryptEnvelopeText(envelope, key, aad);
      await storeKey(entry, key);
      installLockButton();
      logCrypto('success', 'crypto:unlock:cached-password', { company_id: entry.company_id, path: entry.original_path });
      return text;
    } catch (error) {
      memoryPassword = null;
      logCrypto('warn', 'CRYPTO_003', { company_id: entry.company_id, path: entry.original_path, cached_password_failed: true }, error);
    }
  }

  let errorMessage = '';
  while (true) {
    const password = await showPasswordPrompt(entry, errorMessage);
    try {
      const key = await deriveAesKey(password, envelope.salt, true);
      const text = await decryptEnvelopeText(envelope, key, aad);
      memoryPassword = password;
      await storeKey(entry, key);
      installLockButton();
      logCrypto('success', 'crypto:unlock', { company_id: entry.company_id, path: entry.original_path });
      return text;
    } catch (error) {
      errorMessage = 'Senha inválida ou dados corrompidos. Tente novamente.';
      logCrypto('warn', 'CRYPTO_003', { company_id: entry.company_id, path: entry.original_path }, error);
    }
  }
}

// Limpa apenas as chaves da empresa que está saindo.
// lockCryptoSession() (botão de bloqueio) continua limpando tudo — uso intencional.
function lockCompanyKeys(companyId) {
  if (!companyId) return;
  // keyId() aplica replace(/[^a-zA-Z0-9_-]/g,'_') em entry.original_path.
  // Paths da empresa seguem o padrão "data/<companyId>/...".
  // Após o replace, o prefixo da chave é: KEY_PREFIX + "data_<companyId>_"
  const rawPrefix = `data/${companyId}/`;
  const safePrefix = `${KEY_PREFIX}${rawPrefix}`.replace(/[^a-zA-Z0-9_-]/g, '_');
  for (const key of [...memoryKeys.keys()]) {
    if (key.startsWith(safePrefix)) memoryKeys.delete(key);
  }
  Object.keys(sessionStorage)
    .filter(k => k.startsWith(safePrefix))
    .forEach(k => sessionStorage.removeItem(k));
  logCrypto('info', 'CRYPTO_009', { company_evicted: companyId });
}

window.addEventListener('visagio:company-change', (event) => {
  // Evita invalidar chaves da empresa destino — só limpa a empresa que saiu.
  lockCompanyKeys(event?.detail?.from);
});
