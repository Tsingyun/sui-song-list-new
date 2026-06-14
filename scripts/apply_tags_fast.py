# -*- coding: utf-8 -*-
"""Fast offline tag matching - standalone, no imports from match_tags."""
import json, os, re

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
DATA_DIR = os.path.join(PROJECT_ROOT, 'data')
DATA_FILE = os.path.join(DATA_DIR, 'song_data.json')

# Extract dictionaries from match_tags.py without executing its main code
mt_path = os.path.join(SCRIPT_DIR, 'match_tags.py')
with open(mt_path, 'r', encoding='utf-8') as f:
    src = f.read()

# Extract just the dictionary variable definitions
ns = {}
for varname in ['GENRE_MAP', 'SONG_TAGS', 'ARTIST_TAGS', 'LANG_DEFAULTS']:
    # Find the dict definition
    pattern = rf'^{varname}\s*=\s*\{{'
    m = re.search(pattern, src, re.MULTILINE)
    if m:
        start = m.start()
        # Find matching closing brace
        depth = 0
        i = m.end() - 1
        while i < len(src):
            if src[i] == '{': depth += 1
            elif src[i] == '}':
                depth -= 1
                if depth == 0:
                    code = src[start:i+1]
                    exec(code, ns)
                    break
            i += 1

SONG_TAGS = ns.get('SONG_TAGS', {})
ARTIST_TAGS = ns.get('ARTIST_TAGS', {})
LANG_DEFAULTS = ns.get('LANG_DEFAULTS', {'中文': ['流行'], '日语': ['流行'], '英文': ['流行'], '韩语': ['K-Pop', '流行']})

print(f'Loaded: {len(SONG_TAGS)} song entries, {len(ARTIST_TAGS)} artist entries')

# Anime/Vocaloid artist sets
anime_artists = {'supercell', 'EGOIST', 'LiSA', 'Aimer', 'Linked Horizon', 'Kalafina',
                 'UNISON SQUARE GARDEN', '神前暁', "May'n", 'ヒグチアイ',
                 'いとうかなこ', '坂本真綾', '平野綾', 'にじさんじ', 'HoneyWorks',
                 'のんのんびより', '渡辺麻友', '岡崎律子'}
vocaloid_artists = {'40mP', '蝶々P', 'バルーン', 'DECO*27', 'syudou', 'じん', '164',
                    'Giga', 'Mitchie M', 'Orangestar', '*Luna', 'ilem', 'Doriko',
                    'ryo', 'ハチ', 'カンザキイオリ', 'まふまふ', '初音ミク', '初音未来',
                    '洛天依'}

EXTRA_ARTIST = {
    '郭顶': ['抒情', '流行'], '毛不易': ['抒情', '民谣'], '薛之谦': ['抒情', '流行'],
    '李荣浩': ['流行', '摇滚'], '华晨宇': ['摇滚', '流行'], '张杰': ['流行', '抒情'],
    '许嵩': ['流行', '古风'], '汪苏泷': ['流行', '抒情'], '刘宇宁': ['抒情', '流行'],
    '任然': ['抒情', '流行'], '颜人中': ['抒情', '流行'], '隔壁老樊': ['民谣', '流行'],
    '花粥': ['民谣', '独立'], '陈雪凝': ['抒情', '流行'], '于果': ['抒情', '流行'],
    'IVE': ['K-Pop', '流行'], 'NewJeans': ['K-Pop', '流行'],
    'aespa': ['K-Pop', '流行'], 'TWICE': ['K-Pop', '流行'],
    'BLACKPINK': ['K-Pop', '流行'], 'IU': ['K-Pop', '抒情'],
    'YOASOBI': ['流行', '摇滚'], 'Ado': ['摇滚', '流行'],
    'King Gnu': ['摇滚', '流行'], 'Official髭男dism': ['摇滚', '流行'],
    'RADWIMPS': ['摇滚', '流行'], 'ONE OK ROCK': ['摇滚', '流行'],
    'SEKAI NO OWARI': ['摇滚', '流行'], 'Perfume': ['电子', '流行'],
    '星野源': ['流行', '摇滚'], '藤井風': ['R&B', '流行'],
    'あいみょん': ['摇滚', '流行'], '緑黄色社会': ['摇滚', '流行'],
}
all_artist = {**ARTIST_TAGS, **EXTRA_ARTIST}

with open(DATA_FILE, 'r', encoding='utf-8') as f:
    data = json.load(f)
songs = data['songs']
print(f'Total songs: {len(songs)}')

tagged = 0
for song in songs:
    name = song['name']
    artist = song.get('artist', '')
    tags = []

    if name in SONG_TAGS:
        tags = SONG_TAGS[name][:]
    if not tags and artist in all_artist:
        tags = all_artist[artist][:]
    if not tags and artist:
        for key, val in all_artist.items():
            if key in artist or artist in key:
                tags = val[:]
                break
    if artist in anime_artists and '动画' not in tags:
        tags.insert(0, '动画')
    if artist in vocaloid_artists and 'Vocaloid' not in tags:
        tags.insert(0, 'Vocaloid')
    if not tags:
        lang = song.get('lang', '中文')
        tags = LANG_DEFAULTS.get(lang, ['流行'])[:]

    song['tags'] = tags[:3]
    tagged += 1

tag_counts = {}
for s in songs:
    for t in s.get('tags', []):
        tag_counts[t] = tag_counts.get(t, 0) + 1

print(f'Tagged: {tagged}/{len(songs)}')
print(f'Tag distribution:')
for tag, count in sorted(tag_counts.items(), key=lambda x: -x[1]):
    print(f'  {tag}: {count} ({count*100//len(songs)}%)')

with open(DATA_FILE, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
print(f'Saved: {DATA_FILE}')
