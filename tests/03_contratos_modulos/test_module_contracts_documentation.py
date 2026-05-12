import json

from pathlib import Path

def find_project_root() -> Path:
    here = Path(__file__).resolve()
    for candidate in [here.parent, *here.parents]:
        if (candidate / "index.html").exists() and (candidate / "data").exists():
            return candidate
    raise RuntimeError("Project root not found. Run tests from inside the extracted package.")

ROOT = find_project_root()
def find_project_root() -> Path:
    here = Path(__file__).resolve()
    for candidate in [here.parent, *here.parents]:
        if (candidate / "index.html").exists() and (candidate / "data").exists():
            return candidate
    raise RuntimeError("Project root not found. Run tests from inside the extracted package.")

ROOT = find_project_root()

CONTRACT = ROOT / "data" / "contracts" / "module_contracts_all_phases.json"
DOCS = ROOT / "docs" / "03_modulos_contratos_funcoes"

required_module_fields = [
    "id", "phase", "status", "page", "purpose", "inputs", "outputs",
    "internal_functions", "external_calls", "tests"
]
required_test_types = ["unit", "integration", "manual", "acceptance"]

def test_contract_file_exists_and_is_json():
    data = json.loads(CONTRACT.read_text(encoding="utf-8"))
    assert "modules" in data
    assert len(data["modules"]) >= 20

def test_every_module_has_required_fields():
    data = json.loads(CONTRACT.read_text(encoding="utf-8"))
    for module in data["modules"]:
        for field in required_module_fields:
            assert field in module, f"{module.get('id')} missing {field}"
        assert module["phase"] in [1, 2, 3, 4, 5]
        assert isinstance(module["inputs"], dict)
        assert isinstance(module["outputs"], dict)
        assert isinstance(module["internal_functions"], list)
        assert isinstance(module["external_calls"], list)

def test_every_module_has_complete_tests():
    data = json.loads(CONTRACT.read_text(encoding="utf-8"))
    for module in data["modules"]:
        tests = module["tests"]
        for t in required_test_types:
            assert t in tests, f"{module['id']} missing {t} tests"
            assert len(tests[t]) >= 1, f"{module['id']} has no {t} tests"

def test_documentation_files_exist():
    required_docs = [
        "23_MODULOS_TODAS_FASES_CONTRATOS.md",
        "24_FUNCOES_E_DEPENDENCIAS_MODULOS.md",
        "25_TESTES_POR_MODULO_TODAS_FASES.md",
        "26_MAPA_FASES_MODULOS.md",
    ]
    for doc in required_docs:
        path = DOCS / doc
        assert path.exists(), f"missing {doc}"
        assert path.stat().st_size > 1000, f"{doc} too small"

if __name__ == "__main__":
    test_contract_file_exists_and_is_json()
    test_every_module_has_required_fields()
    test_every_module_has_complete_tests()
    test_documentation_files_exist()
    print("MODULE_CONTRACT_DOCUMENTATION_OK")
