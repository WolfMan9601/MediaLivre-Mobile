#!/usr/bin/env python3
"""stdin JSON; stdout JSON events. Public-network downloads only, Linux worker."""
import ipaddress
import json
from pathlib import Path
import resource
import socket
import subprocess
import sys
import urllib.request
from urllib.parse import urlsplit
from yt_dlp import YoutubeDL
from yt_dlp.networking._urllib import UrllibRH

MAX_BYTES = 250 * 1024 * 1024
_original_connect = socket.socket.connect
_original_connect_ex = socket.socket.connect_ex

def public_sockaddr(sock, address):
    if sock.family not in (socket.AF_INET, socket.AF_INET6):
        return address
    host, port = address[:2]
    if port != 443:
        raise OSError('Apenas transporte HTTPS na porta 443 é permitido.')
    try:
        ip = ipaddress.ip_address(host)
    except ValueError:
        entries = socket.getaddrinfo(host, port, sock.family, sock.type)
        if not entries or any(not ipaddress.ip_address(x[4][0]).is_global for x in entries):
            raise OSError('Destino privado/reservado bloqueado.')
        return entries[0][4]
    if not ip.is_global:
        raise OSError('Destino privado/reservado bloqueado.')
    return address

def guarded_connect(sock, address):
    return _original_connect(sock, public_sockaddr(sock, address))

def guarded_connect_ex(sock, address):
    return _original_connect_ex(sock, public_sockaddr(sock, address))

socket.socket.connect = guarded_connect
socket.socket.connect_ex = guarded_connect_ex

def emit(**event):
    print(json.dumps(event, ensure_ascii=False), flush=True)

def validate_destination(url):
    parsed = urlsplit(url)
    if parsed.scheme != 'https' or parsed.username or parsed.password:
        raise ValueError('Destino de rede não permitido.')
    host = parsed.hostname
    if not host or (parsed.port and parsed.port != 443):
        raise ValueError('Destino de rede não permitido.')
    addresses = socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM)
    if not addresses or any(not ipaddress.ip_address(x[4][0]).is_global for x in addresses):
        raise ValueError('Destino privado/reservado não permitido.')

_original_open = urllib.request.OpenerDirector.open
def guarded_open(opener, request, *args, **kwargs):
    validate_destination(request if isinstance(request, str) else request.full_url)
    return _original_open(opener, request, *args, **kwargs)
urllib.request.OpenerDirector.open = guarded_open

class PublicYoutubeDL(YoutubeDL):
    def build_request_director(self, handlers, preferences=None):
        return super().build_request_director([UrllibRH], preferences)

    def urlopen(self, req):
        url = req if isinstance(req, str) else getattr(req, 'url', None) or getattr(req, 'full_url', '')
        validate_destination(url)
        return super().urlopen(req)

    def process_info(self, info):
        for item in info.get('requested_formats') or [info]:
            protocol = item.get('protocol') or urlsplit(item.get('url', '')).scheme
            if protocol not in ('https', 'm3u8_native', 'http_dash_segments', 'dash_frag_urls'):
                raise ValueError('Protocolo de media não permitido.')
            validate_destination(item.get('url', ''))
        return super().process_info(info)

class QuietLogger:
    def debug(self, _): pass
    def warning(self, _): pass
    def error(self, _): pass

def convert_mp4(directory, cap):
    media = [p for p in directory.iterdir() if p.suffix.lower() in ('.mp4', '.mkv', '.webm', '.mov')]
    if len(media) != 1:
        raise ValueError('O conteúdo não contém um vídeo individual.')
    source = media[0]
    target = directory / '_converted.tmp.mp4'
    filters = [] if cap == 'best' else ['-vf', f'scale=-2:trunc(min(ih\\,{int(cap)})/2)*2']
    subprocess.run(['ffmpeg', '-nostdin', '-hide_banner', '-loglevel', 'error', '-y',
                    '-protocol_whitelist', 'file,pipe,crypto', '-i', str(source),
                    '-map', '0:v:0', '-map', '0:a:0?', *filters, '-c:v', 'libx264',
                    '-preset', 'fast', '-crf', '20', '-pix_fmt', 'yuv420p', '-c:a', 'aac',
                    '-b:a', '192k', '-movflags', '+faststart', str(target)],
                   check=True, timeout=540, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    final = source.with_suffix('.mp4')
    source.unlink()
    target.rename(final)

def run(payload):
    destination = Path(payload['directory']).resolve()
    destination.mkdir(parents=True, exist_ok=True)
    options = payload['options']
    fmt = options['format']
    cap = options['quality']
    height = '' if cap == 'best' else f'[height<={"?" if fmt == "mp4" else ""}{int(cap)}]'
    selection = 'bestaudio/best' if fmt == 'mp3' else f'bestvideo{height}+bestaudio/best{height}'
    resource.setrlimit(resource.RLIMIT_FSIZE, (MAX_BYTES, MAX_BYTES))
    resource.setrlimit(resource.RLIMIT_CPU, (600, 600))
    last = -1
    def progress(data):
        nonlocal last
        if data.get('downloaded_bytes', 0) > MAX_BYTES:
            raise ValueError('O ficheiro ultrapassa o limite de 250 MB.')
        total = data.get('total_bytes') or data.get('total_bytes_estimate') or 0
        if total > MAX_BYTES:
            raise ValueError('O ficheiro ultrapassa o limite de 250 MB.')
        pct = min(90, int(data.get('downloaded_bytes', 0) / total * 90)) if total else 0
        if pct != last or data.get('status') == 'finished':
            emit(progress=pct, title=str((data.get('info_dict') or {}).get('title') or 'A processar…'))
            last = pct
    post = []
    if fmt == 'mp3':
        post.append({'key': 'FFmpegExtractAudio', 'preferredcodec': 'mp3', 'preferredquality': '192'})
        if options['cover']:
            post.insert(0, {'key': 'FFmpegThumbnailsConvertor', 'format': 'jpg'})
            post.append({'key': 'EmbedThumbnail', 'already_have_thumbnail': False})
    ydl_options = {
        'format': selection, 'outtmpl': str(destination / '%(title).100B [%(id)s].%(ext)s'),
        'noplaylist': True, 'max_filesize': MAX_BYTES, 'playlistend': 1,
        'windowsfilenames': True, 'quiet': True, 'no_warnings': True,
        'logger': QuietLogger(), 'socket_timeout': 15, 'retries': 1, 'fragment_retries': 1,
        'progress_hooks': [progress], 'postprocessors': post,
        'postprocessor_args': {'ffmpeg_i': ['-protocol_whitelist', 'file,pipe,crypto']},
        'writethumbnail': fmt == 'mp3' and options['cover'], 'hls_prefer_native': True,
        'cachedir': False, 'overwrites': False, 'merge_output_format': 'mkv',
    }
    validate_destination(payload['url'])
    with PublicYoutubeDL(ydl_options) as ydl:
        ydl.download([payload['url']])
    if fmt == 'mp4':
        emit(progress=95, title='A converter para MP4 compatível…')
        convert_mp4(destination, cap)
    emit(progress=100)

if __name__ == '__main__':
    try:
        run(json.load(sys.stdin))
    except Exception:
        emit(error='Não foi possível processar este conteúdo. Pode estar indisponível, protegido, exigir uma conta ou exceder os limites do servidor.')
        sys.exit(1)
