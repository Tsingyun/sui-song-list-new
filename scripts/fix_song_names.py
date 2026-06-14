#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
修复所有歌名问题（按用户指令）
- 类别1：35首 U+00A0 → 普通空格
- 类别2-2：3组介词大小写合并
- 类别2-3：3组合并（God knows 用省略号版）
- 类别2-4组21：Forever Young
- 类别7：4-10,14 去掉括号翻译
"""

import json
import re

def fix_song_names():
    with open('data/song_data.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    songs = data.get('songs', [])
    total_fixes = 0
    
    # ====== 类别1：U+00A0 → 普通空格 ======
    print("=" * 70)
    print("🔧 类别1：修复U+00A0不间断空格")
    print("=" * 70)
    
    c1_count = 0
    for i, song in enumerate(songs):
        name = song.get('name', '')
        if '\u00A0' in name:
            old = name
            name = name.replace('\u00A0', ' ')
            song['name'] = name
            c1_count += 1
            total_fixes += 1
            print(f"  ✅ [{c1_count}] '{old}' → '{name}'")
    
    print(f"  📊 修复 {c1_count} 首\n")

    # ====== 类别2-2：介词大小写合并 ======
    print("=" * 70)
    print("🔧 类别2-2：介词大小写合并")
    print("=" * 70)
    
    merge_2_2 = {
        "Don't Look Back In Anger": "Don't Look Back in Anger",
        "I Really Want to Stay At Your House": "I Really Want to Stay at Your House",
        "Virtual To LIVE": "Virtual to LIVE",
    }
    
    c22_count = 0
    for i, song in enumerate(songs):
        name = song.get('name', '')
        if name in merge_2_2:
            old = name
            song['name'] = merge_2_2[name]
            c22_count += 1
            total_fixes += 1
            print(f"  ✅ [{c22_count}] '{old}' → '{song['name']}'")
    
    print(f"  📊 修复 {c22_count} 首\n")

    # ====== 类别2-3：大小写+语言不同合并 ======
    print("=" * 70)
    print("🔧 类别2-3：大小写/语言差异合并")
    print("=" * 70)
    
    merge_2_3 = {
        "DAYBREAK FRONTLINE": "Daybreak Frontline",
        "again": "Again",
        "God knows": "God knows...",
    }
    
    c23_count = 0
    for i, song in enumerate(songs):
        name = song.get('name', '')
        if name in merge_2_3:
            old = name
            song['name'] = merge_2_3[name]
            c23_count += 1
            total_fixes += 1
            print(f"  ✅ [{c23_count}] '{old}' → '{song['name']}'")
    
    print(f"  📊 修复 {c23_count} 首\n")

    # ====== 类别2-4组21：Forever Young ======
    print("=" * 70)
    print("🔧 类别2-4组21：Forever Young")
    print("=" * 70)
    
    c24_count = 0
    for i, song in enumerate(songs):
        name = song.get('name', '')
        if name == "Forever  Young":  # 双空格
            old = name
            song['name'] = "Forever Young"
            c24_count += 1
            total_fixes += 1
            print(f"  ✅ [{c24_count}] '{old}' → '{song['name']}'")
    
    print(f"  📊 修复 {c24_count} 首\n")

    # ====== 类别7：去掉括号翻译 ======
    print("=" * 70)
    print("🔧 类别7：去掉括号翻译内容")
    print("=" * 70)
    
    # 精准匹配映射
    remove_paren = {
        "エウテルペ（Euterpe）": "エウテルペ",
        "シュガーソングとビターステップ (Sugar Song and Bitter Step)": "シュガーソングとビターステップ",
        "シリョクケンサ（视力检查）": "シリョクケンサ",
        "シンクロサイクロトロン・スピリチュアライザー。（Synchrocyclotron · Spiritualizer。）": "シンクロサイクロトロン・スピリチュアライザー。",
        "フォニイ（Phony）": "フォニイ",
        "メリーメリー（Merry Merry）": "メリーメリー",
        "メルト（Melt）": "メルト",
        "神的随波逐流（中文）": "神的随波逐流",
    }
    
    c7_count = 0
    for i, song in enumerate(songs):
        name = song.get('name', '')
        if name in remove_paren:
            old = name
            song['name'] = remove_paren[name]
            c7_count += 1
            total_fixes += 1
            print(f"  ✅ [{c7_count}] '{old}' → '{song['name']}'")
    
    print(f"  📊 修复 {c7_count} 首\n")

    # ====== 保存 ======
    print("=" * 70)
    print(f"💾 保存: 共修复 {total_fixes} 处")
    print("=" * 70)
    
    with open('data/song_data.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print("✅ 已保存到 data/song_data.json")
    
    # ====== 统计 ======
    print(f"\n📊 修复汇总:")
    print(f"  类别1 (U+00A0):   {c1_count} 首")
    print(f"  类别2-2 (介词):   {c22_count} 首")
    print(f"  类别2-3 (合并):   {c23_count} 首")
    print(f"  类别2-4 (空格):   {c24_count} 首")
    print(f"  类别7 (去翻译):   {c7_count} 首")
    print(f"  总计:             {total_fixes} 处")
    
    return total_fixes

if __name__ == '__main__':
    fix_song_names()
