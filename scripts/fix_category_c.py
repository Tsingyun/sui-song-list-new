#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
修复类别C：Vocaloid P主格式统一
统一为"P主名（Vocaloid名）"格式，使用全角括号
"""

import json
import re

def fix_vocaloid_format():
    # 读取数据
    with open('data/song_data.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    songs = data.get('songs', [])
    print(f"📊 开始修复类别C：Vocaloid P主格式统一...\n")
    
    # 定义修复规则
    fix_rules = {
        # 修复半角括号为全角括号
        '初音ミク/kz (livetune)': 'kz（初音ミク）',
        'ryo/supercell（初音ミク）': 'ryo（初音ミク）',
        
        # 修复作品信息格式（使用全角括号）
        'Lia（《AIR》OP）': 'Lia（《AIR》OP)',
        'Various（《Coco》）': 'Various（《Coco》）',
        '传统（《音乐之声》）': '传统（《音乐之声》）',
        '李叔同（传统）': '李叔同（传统）',
        '神前暁（《涼宮ハルヒの憂鬱》）': '神前暁（《涼宮ハルヒの憂鬱》）',
        '郑伊健（《风云》插曲）': '郑伊健（《风云》插曲）',
        '舒伯特（传统摇篮曲）': '舒伯特（传统摇篮曲）',
        
        # 修复声优信息格式（已经是全角括号，保持不变）
        # '平沢唯（豊崎愛生）': '平沢唯（豊崎愛生）',  # 已经是正确格式
        
        # 其他需要统一的格式
        'ハチ（米津玄师）': 'ハチ（米津玄師）',  # 修正繁体字
    }
    
    fixed_count = 0
    fix_log = []
    
    print("🔧 开始修复...")
    print("=" * 70)
    
    for i, song in enumerate(songs):
        original_artist = song.get('artist', '')
        artist = original_artist
        
        if artist in fix_rules:
            new_artist = fix_rules[artist]
            song['artist'] = new_artist
            fixed_count += 1
            fix_log.append(f"  ✅ [{fixed_count}] 行{i+1}: '{artist}' → '{new_artist}'")
    
    # 保存修复后的数据
    if fixed_count > 0:
        print(f"\n📊 共修复 {fixed_count} 处格式问题:\n")
        for log in fix_log:
            print(log)
        
        print("\n💾 保存修复后的数据...")
        with open('data/song_data.json', 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print("  ✅ 数据已保存")
    else:
        print("\n✅ 没有发现需要修复的格式问题")
    
    print(f"\n🎉 类别C修复完成！共修复 {fixed_count} 处")

if __name__ == '__main__':
    fix_vocaloid_format()
