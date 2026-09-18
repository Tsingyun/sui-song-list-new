# -*- coding: utf-8 -*-
"""Assemble the final single-file website: skeleton + inlined CSS/JS + JSON payload.

No third-party dependencies (GitHub Actions runs this with plain stdlib).
Output: docs/index.html  (deterministic — no timestamps inside the payload).
"""
import base64
import json
import os
import shutil

from . import datalayer, reqstats

SITEGEN_DIR = os.path.dirname(os.path.abspath(__file__))
ASSETS_DIR = os.path.join(SITEGEN_DIR, 'assets')
PROJECT_ROOT = os.path.dirname(os.path.dirname(SITEGEN_DIR))
DOCS_DIR = os.path.join(PROJECT_ROOT, 'docs')


def read_asset(*parts):
    with open(os.path.join(ASSETS_DIR, *parts), encoding='utf-8') as f:
        return f.read()


def payload_json(payload):
    """JSON safe to inline into a <script> block."""
    text = json.dumps(payload, ensure_ascii=False, separators=(',', ':'))
    # '</' could close the script tag; U+2028/2029 break legacy JS strings
    return (text.replace('</', '<\\/')
                .replace('\u2028', '\\u2028')
                .replace('\u2029', '\\u2029'))


def css_bundle():
    files = ['tokens.css', 'base.css', 'layout.css', 'components.css',
             'views.css', 'responsive.css']
    return '\n'.join(read_asset('css', f) for f in files)


def js_bundle():
    files = ['domain.js', 'core.js', 'components.js', 'view-home.js',
             'view-songs.js', 'view-song.js', 'view-catalogs.js',
             'view-insights.js', 'view-requests.js', 'view-about.js',
             'app.js']
    return '\n'.join(read_asset('js', f) for f in files)


def copy_static_assets():
    """Binary art assets referenced by relative path from docs/index.html."""
    out_dir = os.path.join(DOCS_DIR, 'assets')
    os.makedirs(out_dir, exist_ok=True)
    for fn in ['logo.png', 'sui-avatar.webp', 'sui-chibi.webp',
               'sui-fullbody.webp', 'sui-short.webp', 'sui-bird.png', 'sui-cursor.png']:
        src = os.path.join(ASSETS_DIR, fn)
        if os.path.exists(src):
            shutil.copy(src, os.path.join(out_dir, fn))


def build():
    payload = {'songs': datalayer.build_song_payload(),
               'requests': reqstats.build_request_payload()}

    with open(os.path.join(ASSETS_DIR, 'logo.png'), 'rb') as f:
        logo_uri = 'data:image/png;base64,' + base64.b64encode(f.read()).decode()

    html = read_asset('skeleton.html')
    html = html.replace('__LOGO_DATA_URI__', logo_uri)
    html = html.replace('<!--INLINE_CSS-->', '<style>\n' + css_bundle() + '\n</style>')
    html = html.replace('<!--INLINE_DATA-->',
                        '<script>window.SUI=' + payload_json(payload) + ';</script>')
    html = html.replace('<!--INLINE_JS-->', '<script>\n' + js_bundle() + '\n</script>')

    out = os.path.join(DOCS_DIR, 'index.html')
    with open(out, 'w', encoding='utf-8') as f:
        f.write(html)
    copy_static_assets()
    print('Written: %s (%.1f KB)' % (out, os.path.getsize(out) / 1024))
    return out
