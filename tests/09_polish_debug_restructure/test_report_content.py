import subprocess
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DOCX = ROOT / 'relatorio' / 'R_SPRINT4_Grupo2_Visagio_revisado.docx'
PDF = ROOT / 'relatorio' / 'R_SPRINT4_Grupo2_Visagio_revisado.pdf'

assert DOCX.exists() and DOCX.stat().st_size > 0, 'revised editable report missing'
assert PDF.exists() and PDF.stat().st_size > 0, 'revised PDF missing'

with zipfile.ZipFile(DOCX) as archive:
    xml = archive.read('word/document.xml').decode('utf-8')

required = [
    'Resumo executivo',
    'Monte Carlo',
    'mesmo regime',
    'days_wacc_only',
    'Tabela 4',
    'Tabela 5',
    'Tabela 6',
    'Tabela 7',
    'Tabela 8',
    'benchmark pendente',
    'proxy',
    'MILP',
]
for marker in required:
    assert marker in xml, f'report marker missing: {marker}'

text = subprocess.run(['pdftotext', str(PDF), '-'], capture_output=True, text=True, check=True).stdout
assert 'A antiga Tabela 7' not in text, 'obsolete table wording remains'
assert 'Tabela 8' in text, 'rendered report table 8 missing'
print('REVISED_REPORT_CONTENT_OK')
