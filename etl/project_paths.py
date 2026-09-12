from __future__ import annotations

import os
from pathlib import Path

# Portable project paths. No absolute workspace dependency.
PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = PROJECT_ROOT / 'data'
REFERENCES_DIR = PROJECT_ROOT / 'references'
RAW_SOURCES_DIR = REFERENCES_DIR / 'raw_sources'
VALIDATION_DIR = DATA_DIR / 'validation'
CATALOG_PATH = DATA_DIR / 'catalog.json'
MANIFEST_PATH = DATA_DIR / 'encrypted_manifest.json'
ENV_PATH = PROJECT_ROOT / '.env.local'


def resolve_project_path(path: str | Path, *, field: str = 'path') -> Path:
    """Resolve a repository path and reject traversal or external targets."""
    candidate = Path(path)
    resolved = (candidate if candidate.is_absolute() else PROJECT_ROOT / candidate).resolve(strict=False)
    try:
        resolved.relative_to(PROJECT_ROOT.resolve())
    except ValueError as exc:
        raise ValueError(f'{field} escapes the project root: {path!s}') from exc
    return resolved


def rel(path: Path) -> str:
    return resolve_project_path(path, field='path').relative_to(PROJECT_ROOT.resolve()).as_posix()


def read_env_value(name: str) -> str | None:
    """Read one environment value without exposing or rewriting its contents."""
    value = os.environ.get(name)
    if value:
        return value
    if not ENV_PATH.exists():
        return None
    for raw_line in ENV_PATH.read_text(encoding='utf-8').splitlines():
        line = raw_line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        key, candidate = line.split('=', 1)
        if key.strip() != name:
            continue
        candidate = candidate.strip()
        if len(candidate) >= 2 and candidate[0] == candidate[-1] and candidate[0] in {'"', "'"}:
            candidate = candidate[1:-1]
        return candidate
    return None
