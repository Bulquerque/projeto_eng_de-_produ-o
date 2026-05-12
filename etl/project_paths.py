from pathlib import Path

# Portable project paths. No absolute workspace dependency.
PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = PROJECT_ROOT / "data"
REFERENCES_DIR = PROJECT_ROOT / "references"
RAW_SOURCES_DIR = REFERENCES_DIR / "raw_sources"
VALIDATION_DIR = DATA_DIR / "validation"
CATALOG_PATH = DATA_DIR / "catalog.json"

def rel(path: Path) -> str:
    return path.resolve().relative_to(PROJECT_ROOT.resolve()).as_posix()
