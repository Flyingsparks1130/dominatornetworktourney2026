#!/usr/bin/env python3
"""Local-only organizer backend; never expose this development service publicly."""
from __future__ import annotations
import argparse
import functools
import http.cookies
import json
import secrets
import threading
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit
from tournament_engine import ARCHIVE, MAX_BYTES, TournamentError, build, mutate, import_race, save_draft

class Handler(SimpleHTTPRequestHandler):
    server_version='DominatorLocal/1.0'
    def __init__(self,*args,root,**kwargs):
        self.root=root
        super().__init__(*args,directory=str(root),**kwargs)
    def log_message(self, fmt, *args):
        # Never log cookies or CSRF values.
        print(fmt % args)
    def host_ok(self):
        return self.headers.get('Host') in self.server.allowed_hosts
    def authenticated(self):
        c=http.cookies.SimpleCookie()
        try:c.load(self.headers.get('Cookie',''))
        except http.cookies.CookieError:return False
        value=c.get('dominator_session')
        return bool(value and secrets.compare_digest(value.value,self.server.session_token))
    def respond(self,code,data,cookie=False):
        encoded=json.dumps(data,ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header('Content-Type','application/json; charset=utf-8')
        self.send_header('Content-Length',str(len(encoded)))
        self.send_header('Cache-Control','no-store')
        self.send_header('X-Content-Type-Options','nosniff')
        if cookie:self.send_header('Set-Cookie',f'dominator_session={self.server.session_token}; Path=/; HttpOnly; SameSite=Strict')
        self.end_headers();self.wfile.write(encoded)
    def state(self,result):
        return {'index':result['index'],'audit':result['control']['audit'][-20:]}
    def do_GET(self):
        if not self.host_ok():return self.respond(403,{'error':'Unexpected Host header.'})
        path=urlsplit(self.path).path
        if path=='/api/session':
            origin=self.headers.get('Origin')
            if origin and origin not in self.server.allowed_origins:return self.respond(403,{'error':'Cross-origin access denied.'})
            return self.respond(200,{'local_backend':True,'csrf':self.server.csrf_token},cookie=True)
        if path=='/api/state':
            if not self.authenticated():return self.respond(401,{'error':'Open the organizer page on this local server first.'})
            try:
                with self.server.lock:result=build(self.root)
                return self.respond(200,self.state(result))
            except (TournamentError,OSError,KeyError,TypeError) as exc:return self.respond(422,{'error':str(exc)})
        rel=Path(unquote(path).lstrip('/'))
        if str(rel)=='.':self.path='/admin.html';rel=Path('admin.html')
        target=(self.root/rel).resolve()
        allowed=(len(rel.parts)==1 and rel.suffix=='.html') or (rel.parts and rel.parts[0] in {'assets','config','data',ARCHIVE})
        if not target.is_relative_to(self.root) or not allowed or not target.is_file():return self.respond(404,{'error':'Not found.'})
        return super().do_GET()
    def do_POST(self):
        if not self.host_ok() or not self.authenticated():return self.respond(403,{'error':'Local organizer session required.'})
        if self.headers.get('Origin') not in self.server.allowed_origins:return self.respond(403,{'error':'Origin check failed.'})
        if not secrets.compare_digest(self.headers.get('X-CSRF-Token',''),self.server.csrf_token):return self.respond(403,{'error':'CSRF check failed.'})
        if self.headers.get('Content-Type','').split(';')[0]!='application/json':return self.respond(415,{'error':'JSON requests only.'})
        try:
            n=int(self.headers.get('Content-Length','0'))
            if n<=0 or n>MAX_BYTES*3:return self.respond(413,{'error':'Request is empty or exceeds upload limit.'})
            data=json.loads(self.rfile.read(n))
            if not isinstance(data,dict):raise TournamentError('Request must be an object.')
            with self.server.lock:
                path=urlsplit(self.path).path
                if path=='/api/control':result=mutate(self.root,data)
                elif path=='/api/import':result=import_race(self.root,data)
                elif path=='/api/draft':result=save_draft(self.root,data)
                elif path=='/api/build':result=build(self.root)
                else:return self.respond(404,{'error':'Unknown endpoint.'})
            return self.respond(200,self.state(result))
        except (TournamentError,ValueError,TypeError,KeyError,OSError) as exc:
            return self.respond(422,{'error':str(exc)})

def serve(root: Path,port=8765):
    root=root.resolve()
    server=ThreadingHTTPServer(('127.0.0.1',port),functools.partial(Handler,root=root))
    port=server.server_port
    server.allowed_hosts={f'127.0.0.1:{port}',f'localhost:{port}'}
    server.allowed_origins={f'http://{h}' for h in server.allowed_hosts}
    server.session_token=secrets.token_urlsafe(32)
    server.csrf_token=secrets.token_urlsafe(32)
    server.lock=threading.RLock()
    return server

if __name__=='__main__':
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[1])
    ap.add_argument('--port',type=int,default=8765)
    ap.add_argument('--no-open',action='store_true')
    args=ap.parse_args()
    s=serve(args.root,args.port)
    address=f'http://127.0.0.1:{s.server_port}/admin.html'
    print(f'Organizer console: {address}\nLocal changes are saved in your repo. Commit and push to publish them.\nCtrl+C stops the server.')
    if not args.no_open:webbrowser.open(address)
    try:s.serve_forever()
    except KeyboardInterrupt:pass
    finally:s.server_close()
