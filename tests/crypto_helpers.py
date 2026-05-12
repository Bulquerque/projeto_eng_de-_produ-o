import base64
import json
import os
from pathlib import Path

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes


def find_project_root() -> Path:
    here = Path(__file__).resolve()
    for candidate in [here.parent, *here.parents]:
        if (candidate / "index.html").exists() and (candidate / "data").exists():
            return candidate
    raise RuntimeError("Project root not found")


ROOT = find_project_root()


def _password() -> str:
    value = os.environ.get("VISAGIO_DATA_PASSWORD")
    env_path = ROOT / ".env.local"
    if not value and env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            if line.startswith("VISAGIO_DATA_PASSWORD="):
                value = line.split("=", 1)[1].strip().strip('"').strip("'")
                break
    if not value:
        raise RuntimeError("VISAGIO_DATA_PASSWORD missing for encrypted data tests")
    return value


def _manifest() -> dict:
    return json.loads((ROOT / "data" / "encrypted_manifest.json").read_text(encoding="utf-8"))


def decrypt_text(rel_path: str) -> str:
    manifest = _manifest()
    entry = next((item for item in manifest["entries"] if item["original_path"] == rel_path), None)
    if not entry:
        raise FileNotFoundError(rel_path)
    envelope = json.loads((ROOT / entry["encrypted_path"]).read_text(encoding="utf-8"))
    salt = base64.b64decode(envelope["salt"])
    iv = base64.b64decode(envelope["iv"])
    ciphertext = base64.b64decode(envelope["ciphertext"])
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=int(envelope["iterations"]),
    )
    key = kdf.derive(_password().encode("utf-8"))
    plaintext = AESGCM(key).decrypt(iv, ciphertext, rel_path.encode("utf-8"))
    return plaintext.decode("utf-8")


def decrypt_json(rel_path: str):
    return json.loads(decrypt_text(rel_path))


NODE_DECRYPT_HELPER = r"""
import _fs from 'fs';
import crypto from 'crypto';
function readPassword() {
  if (process.env.VISAGIO_DATA_PASSWORD) return process.env.VISAGIO_DATA_PASSWORD;
  const env = _fs.readFileSync('.env.local', 'utf8').split(/\r?\n/);
  for (const line of env) if (line.startsWith('VISAGIO_DATA_PASSWORD=')) return line.split('=').slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
  throw new Error('VISAGIO_DATA_PASSWORD missing');
}
function decryptJson(relPath) {
  const manifest = JSON.parse(_fs.readFileSync('data/encrypted_manifest.json', 'utf8'));
  const entry = manifest.entries.find((item) => item.original_path === relPath);
  if (!entry) throw new Error(`missing encrypted entry ${relPath}`);
  const envelope = JSON.parse(_fs.readFileSync(entry.encrypted_path, 'utf8'));
  const key = crypto.pbkdf2Sync(readPassword(), Buffer.from(envelope.salt, 'base64'), Number(envelope.iterations), 32, 'sha256');
  const payload = Buffer.from(envelope.ciphertext, 'base64');
  const tag = payload.subarray(payload.length - 16);
  const ciphertext = payload.subarray(0, payload.length - 16);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.iv, 'base64'));
  decipher.setAAD(Buffer.from(relPath, 'utf8'));
  decipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8'));
}
"""
