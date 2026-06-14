#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""全面勘误审计 - 扫描所有维度"""
import json, re
from collections import defaultdict

with open('data/song_data.json','r',encoding='utf-8') as f:
    data = json.load(f)

songs = data['songs']
print(f'📊 总歌曲: {len(songs)} 首\n')

issues = defaultdict(list)

# ====== 1. 异常字符残留 ======
for i,s in enumerate(songs):
    name = s['name']; artist = s.get('artist','')
    for ch in '\u00A0\u200B\u200C\u200D\uFEFF\u3000':
        if ch in name:
            issues['1-异常字符-歌名'].append((f'U+{ord(ch):04X}', name, i))
        if ch in artist:
            issues['1-异常字符-艺术家'].append((f'U+{ord(ch):04X}', artist, i))

print(f'🔍 1. 异常字符残留: 歌名 {len(issues["1-异常字符-歌名"])} / 艺术家 {len(issues["1-异常字符-艺术家"])}')

# ====== 2. 歌名/艺术家首尾空格 ======
for i,s in enumerate(songs):
    name = s['name']; artist = s.get('artist','')
    if name != name.strip():
        issues['2-首尾空格-歌名'].append((name, i))
    if artist != artist.strip():
        issues['2-首尾空格-艺术家'].append((artist, i))

print(f'🔍 2. 首尾空格: 歌名 {len(issues["2-首尾空格-歌名"])} / 艺术家 {len(issues["2-首尾空格-艺术家"])}')

# ====== 3. 语言标注异常 ======
valid_langs = {'中文','日语','英文','韩语','其他'}
for i,s in enumerate(songs):
    lang = s.get('lang','')
    if lang not in valid_langs:
        issues['3-语言标注异常'].append((lang, s['name'], i))

print(f'🔍 3. 语言标注异常: {len(issues["3-语言标注异常"])}')

# ====== 4. 歌名长度异常 ======
for i,s in enumerate(songs):
    name = s['name']
    if len(name) < 2:
        issues['4-歌名过短'].append((name, i))
    if len(name) > 80:
        issues['4-歌名过长'].append((name, i))

print(f'🔍 4. 歌名过短: {len(issues["4-歌名过短"])} / 过长: {len(issues["4-歌名过长"])}')

# ====== 5. 艺术家为空 ======
for i,s in enumerate(songs):
    if not s.get('artist','').strip():
        issues['5-艺术家为空'].append((s['name'], i))

print(f'🔍 5. 艺术家为空: {len(issues["5-艺术家为空"])}')

# ====== 6. count=0 的异常条目 ======
for i,s in enumerate(songs):
    if s.get('count',0) == 0:
        issues['6-count为零'].append((s['name'], s.get('artist',''), i))

print(f'🔍 6. count为零: {len(issues["6-count为零"])}')

# ====== 7. 日期异常 ======
for i,s in enumerate(songs):
    first = s.get('first',''); last = s.get('last','')
    if first > last:
        issues['7-日期倒错'].append((s['name'], first, last, i))
    if not first or not last:
        issues['7-日期缺失'].append((s['name'], i))

print(f'🔍 7. 日期倒错: {len(issues["7-日期倒错"])} / 缺失: {len(issues["7-日期缺失"])}')

# ====== 8. 艺术家可能写反(Vocaloid格式) ======
vocaloid_pattern = re.compile(r'^(.+?ボーカル|.+?ミク|.+?リン|.+?レン|.+?ルカ|.+?GUMI|.+?IA|.+?洛天依|.+?言和)/(.+)$')
for i,s in enumerate(songs):
    artist = s.get('artist','')
    if '/' in artist and not '(' in artist:
        # Vocaloid名在前（异常格式）
        if re.match(vocaloid_pattern, artist):
            issues['8-艺术家格式疑倒置'].append((artist, s['name'], i))

# 检查初音ミク在前的情况
for i,s in enumerate(songs):
    artist = s.get('artist','')
    if artist.startswith('初音ミク/') and ('初音ミク（' not in s['name']):
        issues['8-艺术家格式疑倒置'].append((artist, s['name'], i))

print(f'🔍 8. 艺术家格式疑倒置: {len(issues["8-艺术家格式疑倒置"])}')

# ====== 9. 全角/半角混用残留 ======
for i,s in enumerate(songs):
    name = s['name']
    # 英文歌名中包含全角符号
    ascii_chars = sum(1 for c in name if c.isascii() and c.isalpha())
    total = len(name.replace(' ',''))
    if total > 0 and ascii_chars/total > 0.5:
        full_punct = [c for c in name if c in '！＂＃＄％＆＇（）＊＋，－．／：；＜＝＞？＠［＼］＾＿｀｛｜｝～']
        if full_punct:
            issues['9-英文歌名全角符号'].append((name, full_punct, i))

print(f'🔍 9. 英文歌名全角符号: {len(issues["9-英文歌名全角符号"])}')

# ====== 10. Bilibili映射缺失的歌 ======
with open('data/song_bilibili_map.json','r',encoding='utf-8') as f:
    bili = json.load(f)
unmatched = set(bili.get('unmatched',[]))
mapped = set(bili.get('matches',{}).keys())

for i,s in enumerate(songs):
    if s['name'] not in mapped:
        # 查找是否在unmatched中
        if s['name'] in unmatched:
            issues['10-B站未匹配'].append((s['name'], '已尝试未找到', i))

print(f'🔍 10. B站未匹配: {len(issues["10-B站未匹配"])}')

# ====== 11. 可能漏掉的大小写差异 ======
norm_map = defaultdict(list)
for i,s in enumerate(songs):
    norm = re.sub(r'[^a-zA-Z0-9]','', s['name'].lower())
    norm_map[norm].append((s['name'], i))
remaining = {n: names for n, names in norm_map.items() if len(set(a for a,_ in names)) > 1}
issues['11-仍存在大小写差异'] = [(names, n) for n, names in remaining.items()]

print(f'🔍 11. 仍存在大小写差异: {len(issues["11-仍存在大小写差异"])}')

# ====== 12. tier与count不匹配 ======
for i,s in enumerate(songs):
    count = s.get('count',0); tier = s.get('tier','')
    expected = '常唱' if count>=8 else ('偶尔' if count>=3 else '稀有')
    # tier由build_site.py自动计算，这里只检查明显不对的
    # tier字段可能已被清理，跳过

print(f'🔍 12. tier字段: 由build_site自动计算，跳过')

# ====== 输出报告 ======
print('\n' + '='*70)
print('📋 勘误报告')
print('='*70)

total = 0
for cat, items in sorted(issues.items()):
    if not items: continue
    cat_name = cat.split('-',1)[1]
    print(f'\n### {cat_name} ({len(items)}条)')
    total += len(items)
    for item in items[:10]:  # 每类最多10条
        if len(item) == 3:
            a, b, c = item
            print(f'  • [{c}] {b}  →  {a}')
        else:
            print(f'  • {item}')
    if len(items) > 10:
        print(f'  ... 还有 {len(items)-10} 条')

print(f'\n{"="*70}')
print(f'📊 总计 {total} 个潜在问题，涉及 {len([k for k,v in issues.items() if v])} 个类别')
