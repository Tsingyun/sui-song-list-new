#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""统一类别2-1歌名大小写（按网易云音乐参考）"""
import json

fix_map = {
    'after 17': 'After 17',
    'City of Stars': 'City Of Stars',
    'Drop Pop Candy': 'drop pop candy',
    'first love': 'First Love',
    'I love you 3000': 'I Love You 3000',
    'lemon': 'Lemon',
    'Letting go': 'Letting Go',
    'Love 2000': 'LOVE 2000',
    'lover': 'Lover',
    'Me Me She': 'me me she',
    'Remember me': 'Remember Me',
    'someone you loved': 'Someone You Loved',
    'stand by me': 'Stand By Me',
    'upupu': 'Upupu',
}

with open('data/song_data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

songs = data['songs']
fixed = 0

for i, s in enumerate(songs):
    name = s.get('name', '')
    if name in fix_map:
        old = name
        s['name'] = fix_map[name]
        fixed += 1
        print(f"  ✅ [{fixed}] '{old}' → '{s['name']}'")

# 合并同名+同艺术家重复
seen = {}
to_del = []
for i, s in enumerate(songs):
    key = (s['name'], s.get('artist', ''))
    if key in seen:
        j = seen[key]
        songs[j]['count'] += s['count']
        songs[j]['first'] = min(songs[j]['first'], s['first'])
        songs[j]['last'] = max(songs[j]['last'], s['last'])
        print(f"  🔀 合并: {s['name']} / {s['artist']} (行{i}→行{j})")
        to_del.append(i)
    else:
        seen[key] = i

for i in sorted(to_del, reverse=True):
    del songs[i]

for s in songs:
    for k in ['stats', 'lang_counts']:
        s.pop(k, None)

with open('data/song_data.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f'\n📊 统一 {fixed} 处，去重 {len(to_del)} 条，剩余 {len(songs)} 首')
