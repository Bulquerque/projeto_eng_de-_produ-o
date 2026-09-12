from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CRYPTO_SESSION = ROOT / 'assets/js/core/crypto-session.js'


def test_crypto_session_does_not_persist_password_or_keys():
    source = CRYPTO_SESSION.read_text(encoding='utf-8')

    assert 'visagio_crypto_password_session' in source
    assert 'clearLegacySessionArtifacts' in source
    assert 'readStorageValue' not in source
    assert 'writeStorageValue' not in source
    assert 'exportAesKey' not in source
    assert 'importAesKey' not in source
    assert 'sessionStorage' not in source
    assert "removeStorageKey('local', PASSWORD_KEY)" in source
    assert 'deriveAesKey(memoryPassword, envelope.salt, false)' in source
    assert 'memoryPassword = password' in source


def test_crypto_session_clears_memory_on_lock():
    source = CRYPTO_SESSION.read_text(encoding='utf-8')

    assert 'memoryKeys.clear();' in source
    assert 'memoryPassword = null;' in source
    assert 'clearLegacySessionArtifacts();' in source
