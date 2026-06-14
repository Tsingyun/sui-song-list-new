#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
全面审计歌名错误
扫描所有歌名，找出可能的错误、重复、格式不一致等问题
"""

import json
import re
from collections import defaultdict

def normalize_name(name):
    """标准化歌名用于比对"""
    norm = name.lower()
    # 移除所有空格和特殊符号，只保留字母数字和中文
    norm = re.sub(r'[\s!"#\$%&\'()\*\+,\-\./:;<=>?@\[\\\]\^_`{|}～〜〜～]', '', norm)
    # 统一全角符号转半角
    norm = norm.replace('！', '').replace('？', '').replace('：', '')
    norm = norm.replace('（', '').replace('）', '').replace('【', '').replace('】', '')
    norm = norm.replace('「', '').replace('」', '').replace('『', '').replace('』', '')
    norm = norm.replace('・', '').replace('·', '')
    norm = norm.replace('\u00A0', '')  # non-breaking space
    norm = norm.replace('\u3000', '')  # 全角空格
    return norm.strip()

def audit_song_names():
    with open('data/song_data.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    songs = data.get('songs', [])
    print(f"📊 开始审计 {len(songs)} 首歌名...\n")
    
    # 收集歌名
    name_songs = defaultdict(list)
    for i, song in enumerate(songs):
        name = song.get('name', '')
        if name:
            name_songs[name].append(i)
    
    print(f"📊 共 {len(name_songs)} 个不同歌名\n")
    
    # ====== 类别1：Unicode不可见字符 ======
    print("=" * 70)
    print("📋 类别1：Unicode不可见/异常字符")
    print("=" * 70)
    
    cat1 = []
    for name in name_songs:
        issues = []
        if '\u00A0' in name:
            issues.append('U+00A0 不间断空格')
        if '\u200B' in name:
            issues.append('U+200B 零宽空格')
        if '\u200C' in name:
            issues.append('U+200C 零宽不连字')
        if '\u200D' in name:
            issues.append('U+200D 零宽连字')
        if '\uFEFF' in name:
            issues.append('U+FEFF BOM')
        if '\u3000' in name:
            issues.append('U+3000 全角空格')
        if issues:
            cat1.append((name, issues, name_songs[name]))
    
    if cat1:
        print(f"⚠️  发现 {len(cat1)} 首歌名包含异常字符:\n")
        for name, issues, idxs in sorted(cat1):
            print(f"  • '{name}' - 包含: {', '.join(issues)} ({len(idxs)} 次)")
    else:
        print("✅ 未发现异常字符\n")
    
    # ====== 类别2：可能的重复歌名 ======
    print("\n" + "=" * 70)
    print("📋 类别2：可能重复的歌名（标准化后相同）")
    print("=" * 70)
    
    normalized_map = defaultdict(list)
    for name in name_songs:
        norm = normalize_name(name)
        normalized_map[norm].append(name)
    
    cat2 = {}
    for norm, name_list in normalized_map.items():
        if len(name_list) > 1:
            cat2[norm] = sorted(name_list)
    
    if cat2:
        print(f"⚠️  发现 {len(cat2)} 组可能重复的歌名:\n")
        for norm, name_list in sorted(cat2.items()):
            # 排除大小写差异的情况
            total = sum(len(name_songs[n]) for n in name_list)
            print(f"  📌 (共 {total} 次)")
            for n in name_list:
                idxs = name_songs[n]
                lang = songs[idxs[0]].get('lang', '?')
                print(f"     • '{n}' ({lang}, {len(idxs)} 次)")
            print()
    else:
        print("✅ 未发现可能重复的歌名\n")
    
    # ====== 类别3：全角/半角符号混用 ======
    print("=" * 70)
    print("📋 类别3：全角/半角标点符号混用")
    print("=" * 70)
    
    # 检查包含英文歌曲名中使用全角符号的情况
    cat3_mixed = []
    for name in name_songs:
        has_full = any(c in name for c in '！＂＃＄％＆＇（）＊＋，－．／：；＜＝＞？＠［＼］＾＿｀｛｜｝～')
        has_half = any(c in name for c in '!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~')
        # 如果歌名以英文为主，但使用了全角符号
        english_chars = sum(1 for c in name if c.isascii() and c.isalpha())
        total_chars = len(name.replace(' ', ''))
        if total_chars > 0 and english_chars / total_chars > 0.5:
            # 英文为主，检查是否有全角符号
            full_punct = [c for c in name if c in '！＂＃＄％＆＇（）＊＋，－．／：；＜＝＞？＠［＼］＾＿｀｛｜｝～']
            if full_punct:
                cat3_mixed.append((name, full_punct, name_songs[name]))
    
    if cat3_mixed:
        print(f"⚠️  发现 {len(cat3_mixed)} 首英文歌名使用了全角符号:\n")
        for name, punct, idxs in sorted(cat3_mixed)[:20]:
            print(f"  • '{name}' - 全角符号: {punct}")
        if len(cat3_mixed) > 20:
            print(f"  ... 还有 {len(cat3_mixed) - 20} 首")
    else:
        print("✅ 未发现全角/半角符号混用\n")
    
    # ====== 类别4：歌名末尾异常 ======
    print("\n" + "=" * 70)
    print("📋 类别4：歌名首尾空格/异常")
    print("=" * 70)
    
    cat4 = []
    for name in name_songs:
        issues = []
        if name != name.strip():
            issues.append('首尾有空格')
        if name.startswith(' ') or name.endswith(' '):
            issues.append('首部/尾部空格')
        if any(c in name for c in '\r\n\t'):
            issues.append('包含换行/制表符')
        if name.strip().endswith('.'):
            issues.append('以句号结尾')
        if issues:
            cat4.append((name, issues, name_songs[name]))
    
    if cat4:
        print(f"⚠️  发现 {len(cat4)} 首歌名有首尾问题:\n")
        for name, issues, idxs in sorted(cat4)[:20]:
            print(f"  • '{name}' - {', '.join(issues)}")
    else:
        print("✅ 未发现首尾异常\n")
    
    # ====== 类别5：常见拼写错误模式 ======
    print("\n" + "=" * 70)
    print("📋 类别5：疑似拼写错误")
    print("=" * 70)
    
    # 检查常见拼写错误模式
    common_errors = {
        'revel': 'rebel',    # revel → rebel
        'angels': 'angles',  # 常见混淆
        'then': 'than',
        'your': "you're",
        'its': "it's",
        'there': 'their',
        'effect': 'affect',
        'loose': 'lose',
        'alot': 'a lot',
        'seperate': 'separate',
        'definately': 'definitely',
        'occured': 'occurred',
        'untill': 'until',
        'tommorrow': 'tomorrow',
        'begining': 'beginning',
    }
    
    cat5 = []
    for name in name_songs:
        words = name.lower().split()
        for word in words:
            if word in common_errors:
                cat5.append((name, word, common_errors[word], name_songs[name]))
                break
    
    if cat5:
        print(f"⚠️  发现 {len(cat5)} 首疑似拼写错误:\n")
        for name, wrong, suggestion, idxs in sorted(cat5):
            print(f"  • '{name}' - '{wrong}' → 可能是 '{suggestion}'?")
    else:
        print("✅ 未发现常见拼写错误（英文单词层面）\n")
    
    # ====== 类别6：日文/中文歌曲名中的异常 ======
    print("\n" + "=" * 70)
    print("📋 类别6：日文歌曲名特殊问题")
    print("=" * 70)
    
    cat6_kana = []
    cat6_kanji = []
    for name in name_songs:
        if re.search(r'[\u3040-\u309F]', name):  # 有平假名
            cat6_kana.append(name)
        if re.search(r'[\u30A0-\u30FF]', name):  # 有片假名
            pass  # 这是正常的
    
    # 检查"々"符号（重复前一个汉字的符号）
    cat6_noma = [(n, name_songs[n]) for n in name_songs if '々' in n]
    if cat6_noma:
        print(f"  ⚠️  包含'々'符号: {len(cat6_noma)} 首 (一般没问题，仅列出)")
        for name, idxs in sorted(cat6_noma)[:10]:
            print(f"     • '{name}'")
    
    print(f"\n  ℹ️  含平假名的歌名: {len(cat6_kana)} 首")
    print(f"  ℹ️  日文歌名总体上格式正常\n")
    
    # ====== 类别7：歌名中包含额外信息/来源标注 ======
    print("=" * 70)
    print("📋 类别7：歌名中包含作品来源/额外信息")
    print("=" * 70)
    
    cat7 = []
    for name in name_songs:
        if re.search(r'[（(].*?[)）]', name):
            cat7.append((name, name_songs[name]))
    
    if cat7:
        print(f"⚠️  发现 {len(cat7)} 首歌名包含括号（可能含作品来源信息）:\n")
        for name, idxs in sorted(cat7)[:30]:
            lang = songs[idxs[0]].get('lang', '?') if idxs else '?'
            print(f"  • '{name}' ({lang}, {len(idxs)} 次)")
        if len(cat7) > 30:
            print(f"  ... 还有 {len(cat7) - 30} 首")
    else:
        print("✅ 未发现\n")
    
    # ====== 汇总 ======
    print("\n" + "=" * 70)
    print("📊 审计汇总")
    print("=" * 70)
    print(f"  类别1 (异常字符):   {len(cat1)} 首")
    print(f"  类别2 (可能重复):   {len(cat2)} 组")
    print(f"  类别3 (符号混用):   {len(cat3_mixed)} 首")
    print(f"  类别4 (首尾异常):   {len(cat4)} 首")
    print(f"  类别5 (拼写错误):   {len(cat5)} 首")
    print(f"  类别7 (包含括号):   {len(cat7)} 首")
    
    print("\n🎉 审计完成！请根据以上清单决定如何修复。")

if __name__ == '__main__':
    audit_song_names()
