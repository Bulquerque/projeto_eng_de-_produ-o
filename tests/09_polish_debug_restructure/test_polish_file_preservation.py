import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
def test_no_original_files_lost():
    r=json.loads((ROOT/'data/validation/file_preservation_report.json').read_text(encoding='utf-8'))
    assert r['status']=='OK_NO_ORIGINAL_FILE_LOST'
    assert r['missing_count']==0
    assert r['new_file_count']>=r['original_file_count']
if __name__=='__main__': test_no_original_files_lost(); print('POLISH_FILE_PRESERVATION_OK')
