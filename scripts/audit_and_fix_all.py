#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
完整审计并修复艺术家/歌手名称
生成4类别报告，然后自动修复所有问题
"""

import json
import re
import unicodedata
from collections import defaultdict

def audit_and_fix_all():
    # 读取数据
    with open('data/song_data.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    songs = data.get('songs', [])
    print(f"📊 开始完整审计 {len(songs)} 首歌曲的艺术家名称...\n")
    
    # 收集所有艺术家及其歌曲
    artist_songs = defaultdict(list)
    for i, song in enumerate(songs):
        artist = song.get('artist', '')
        if artist:
            artist_songs[artist].append((i, song.get('name', '')))
    
    print(f"📊 发现 {len(artist_songs)} 个不同的艺术家\n")
    
    # ========== 类别A：Unicode不间断空格 ==========
    print("=" * 70)
    print("📋 类别A：Unicode不间断空格（U+00A0）")
    print("=" * 70)
    
    category_a = {}
    for artist, song_list in artist_songs.items():
        if '\u00A0' in artist:
            category_a[artist] = song_list
    
    if category_a:
        print(f"⚠️  发现 {len(category_a)} 个艺术家包含Unicode不间断空格:\n")
        for artist, song_list in sorted(category_a.items()):
            print(f"  • '{artist}' ({len(song_list)} 首歌)")
        print()
    else:
        print("✅ 未发现Unicode不间断空格问题\n")
    
    # ========== 类别B：同名艺术家不同拼写 ==========
    print("=" * 70)
    print("📋 类别B：同名艺术家不同拼写（可能的重复）")
    print("=" * 70)
    
    # 标准化函数
    def normalize_name(name):
        # 转小写
        norm = name.lower()
        # 移除所有空格和特殊字符（保留字母数字）
        norm = re.sub(r'[\s\*\-\_\.\(\)（）【】]+', '', norm)
        return norm
    
    normalized_map = defaultdict(list)
    for artist in artist_songs:
        norm = normalize_name(artist)
        normalized_map[norm].append(artist)
    
    category_b = {}
    for norm, artist_list in normalized_map.items():
        if len(artist_list) > 1:
            # 按原始名称排序
            artist_list_sorted = sorted(artist_list)
            category_b[norm] = artist_list_sorted
    
    if category_b:
        print(f"⚠️  发现 {len(category_b)} 组可能的重复艺术家:\n")
        for norm, artist_list in sorted(category_b.items()):
            print(f"  组: {artist_list}")
            for artist in artist_list:
                print(f"      - '{artist}' ({len(artist_songs[artist])} 首歌)")
            print()
    else:
        print("✅ 未发现可能的重复艺术家\n")
    
    # ========== 类别C：Vocaloid P主格式 ==========
    print("=" * 70)
    print("📋 类别C：Vocaloid P主格式不一致")
    print("=" * 70)
    
    category_c = []
    for artist in artist_songs:
        # 查找包含括号的艺术家（可能是P主 + Vocaloid格式）
        if '(' in artist or '（' in artist:
            category_c.append(artist)
    
    if category_c:
        print(f"⚠️  发现 {len(category_c)} 个包含括号的艺术家（可能格式不一致）:\n")
        for artist in sorted(category_c)[:20]:  # 只显示前20个
            print(f"  • {artist}")
        if len(category_c) > 20:
            print(f"  ... 还有 {len(category_c) - 20} 个")
        print()
    else:
        print("✅ 未发现Vocaloid P主格式问题\n")
    
    # ========== 类别D：个别案例 ==========
    print("=" * 70)
    print("📋 类别D：个别需要检查的案例")
    print("=" * 70)
    
    category_d = {
        'mirror_chars': [],  # 镜像字符
        'traditional': [],    # 繁体字
        'special_format': [], # 特殊格式
    }
    
    # 检查镜像字符（如镜音リン/镜音レン）
    for artist in artist_songs:
        # 检查是否包含可能的镜像字符或特殊分隔符
        if '/' in artist and artist.count('/') > 1:
            category_d['special_format'].append(artist)
    
    # 检查繁体字
    traditional_chars = set('體會時國際風雲區動處業點縣萬億隊')
    for artist in artist_songs:
        if any(c in artist for c in traditional_chars):
            category_d['traditional'].append(artist)
    
    total_d = sum(len(v) for v in category_d.values())
    if total_d > 0:
        print(f"⚠️  发现 {total_d} 个个别案例:\n")
        if category_d['special_format']:
            print(f"  特殊格式（多个斜杠）: {len(category_d['special_format'])} 个")
            for artist in category_d['special_format'][:10]:
                print(f"    • {artist}")
        if category_d['traditional']:
            print(f"  可能包含繁体字: {len(category_d['traditional'])} 个")
            for artist in category_d['traditional'][:10]:
                print(f"    • {artist}")
        print()
    else:
        print("✅ 未发现个别案例\n")
    
    # ========== 开始修复 ==========
    print("=" * 70)
    print("🔧 开始自动修复...")
    print("=" * 70)
    
    fixed_count = 0
    fix_log = []
    
    # 修复类别A：Unicode不间断空格
    if category_a:
        print("\n🔧 修复类别A：Unicode不间断空格")
        for i, song in enumerate(songs):
            artist = song.get('artist', '')
            if '\u00A0' in artist:
                new_artist = artist.replace('\u00A0', ' ')
                song['artist'] = new_artist
                fixed_count += 1
                fix_log.append(f"  ✅ [{fixed_count}] '{artist}' → '{new_artist}'")
        
        for log in fix_log[-fixed_count:]:
            print(log)
        print(f"  📊 共修复 {fixed_count} 处Unicode空格问题\n")
    
    # 修复类别B：统一艺术家拼写（需要定义规则）
    # 这里我们先不自动修复，因为需要用户确认
    if category_b:
        print("🔧 类别B：需要手动定义统一规则")
        print("  💡 建议创建 mapping 字典")
        print("  ⚠️  跳过自动修复，需要人工确认\n")
    
    # 保存修复后的数据
    if fixed_count > 0:
        print("💾 保存修复后的数据...")
        with open('data/song_data.json', 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"  ✅ 已保存 {fixed_count} 处修复\n")
    else:
        print("✅ 没有需要自动修复的问题\n")
    
    # 生成修复建议
    print("=" * 70)
    print("📝 修复建议")
    print("=" * 70)
    
    if category_b:
        print("\n对于类别B的同名艺术家，建议统一规则:")
        print("  例如:")
        print("    - 'DECO27', 'DECO*27', 'DECO 27' → 统一为 'DECO*27'")
        print("    - 'ChiliChill', 'Chili Chill' → 统一为 'ChiliChill'")
        print("  请在脚本中定义 mapping 字典，然后重新运行\n")
    
    if category_c:
        print("对于类别C的Vocaloid P主格式，建议统一为:")
        print("  格式: 'P主名 (Vocaloid名)' 或 'Vocaloid名 (P主名)'")
        print("  请选择一种格式并统一所有条目\n")
    
    print("🎉 审计完成！")
    print(f"📊 总结: 发现 {len(category_a)} 个类别A问题，{len(category_b)} 个类别B问题")
    print(f"         {len(category_c)} 个类别C问题，{total_d} 个类别D问题")
    print(f"🔧 已自动修复: {fixed_count} 处")

if __name__ == '__main__':
    audit_and_fix_all()
