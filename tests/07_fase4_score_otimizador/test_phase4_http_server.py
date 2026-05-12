import http.server,socketserver,threading,time,urllib.request,os,traceback
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
PATHS=[('/fase-4-score-otimizador/', 'Fase 4'), ('/assets/js/phase4/main.js', 'Phase4'), ('/data/empresa1/phase2/phase2_bundle.json.enc.json', 'ciphertext'), ('/data/empresa2/phase2/phase2_bundle.json.enc.json', 'ciphertext'), ('/debug/', 'Debug Center')]
OK_MESSAGE='PHASE4_HTTP_SERVER_OK'
class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*args): pass
def main():
    old=Path.cwd(); server=None; ok=False
    try:
        os.chdir(ROOT); socketserver.TCPServer.allow_reuse_address=True; server=socketserver.TCPServer(('127.0.0.1',0),Handler); port=server.server_address[1]; thread=threading.Thread(target=server.serve_forever,daemon=True); thread.start(); time.sleep(.2)
        for path,expected in PATHS:
            with urllib.request.urlopen(f'http://127.0.0.1:{port}{path}',timeout=10) as resp:
                assert resp.status==200,path; body=resp.read(2000);
                if expected: assert expected.encode('utf-8') in body,path
        print(OK_MESSAGE,flush=True); ok=True
    except Exception:
        traceback.print_exc(); ok=False
    finally:
        try:
            if server: server.server_close()
        except Exception: pass
        os.chdir(old); os._exit(0 if ok else 1)
if __name__=='__main__': main()
