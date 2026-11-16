# -*- coding: utf-8 -*-
"""首页立绘资源处理：透明底源图 → docs 用的 WebP（裁到人物 + 控体积）。

原则：
  · **只用透明底源图**（RGBA/LA 且确实含透明像素）。白底 JPG 不抠图、直接跳过，
    免得边缘发白、裙子误抠；需要它们时请先导出带透明通道的 PNG。
  · 按 alpha 包围盒裁到人物 —— 部分源图是 2560×1361 的超宽画幅（人物只占中间一条），
    而主视觉是 1080×2338 的竖构图，不裁会缩得很小。
  · 限高 1600px（显示尺寸 274×593，2x 屏足够），压成 WebP q=82 控体积。

用法：
    py -3.10 scripts/build_hero_assets.py
输出：scripts/sitegen/assets/hero/hero-01.webp …
源清单与顺序见下方 SOURCES —— 顺序即前端轮换顺序；跳过项会明确打印。
"""
import hashlib
import os
import sys

from PIL import Image, ImageFilter

SRC_DIR = r'C:\Users\Tsing\Pictures\管人立绘\岁己立绘'
OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'sitegen', 'assets', 'hero')

# 轮换顺序 = 本清单顺序（与首页 HERO_ART 一一对应，只在此处维护）
SOURCES = [
    '956657085646372901_02@original.png',
    'IMG_3824.JPG',
    'IMG_3823.JPG',
    'IMG_3822.JPG',
    'IMG_3510.JPG',
    'IMG_3511.JPG',
    'IMG_3512.JPG',
    'IMG_3513.JPG',
    'IMG_3514.JPG',
    'IMG_3515.JPG',
    'a0fb9070-088f-4f5c-a746-fc84b3d4c6e2.JPG',
    'IMG_5249.JPG',
    'IMG_5248.JPG',
    'IMG_6224.JPG',
    '875999188965392388_00@original.png',
    '1163224340925251591_100@repost.png',
    '875999188965392388_03@original.png',
    '956657085646372901_00@original.png',
    '956657085646372901_01@original.png',
    '1096585956236984324_03@original.png',
    '875999188965392388_01@original.png',
    '875999188965392388_04@original.png',
    'a215c9ad09ee4a8d05bdb732058d3c311954091502.png',
    'af00f5f3dfbe9924b94726b9b66fc8671954091502.png',
    '875999188965392388_05@original.png',
    '1096585956236984324_02@original.png',
    '1103630179351134211_00@original.png',
    'IMG_0215.JPG',
    '875999188965392388_02@original.png',
    '23159e4f8895787a3a61f26c650a4c901954091502.png',
    '38d804a32ec2ebc23c2efe03f1e7940b1954091502.png',
    '1204411539697696776_100@repost.png',
    '735789401927319640_04@original.png',
]

MAX_H = 1600          # 输出最大高度（显示 593px @2x，留足余量）
MAX_W = 1200
ALPHA_MIN = 250       # alpha 最小值低于此值才算「确实带透明通道」


def _alpha_bbox(im):
    return im.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()


def _is_transparent(im):
    if im.mode not in ('RGBA', 'LA') and not (im.mode == 'P' and 'transparency' in im.info):
        return False
    return im.convert('RGBA').getchannel('A').getextrema()[0] < ALPHA_MIN


def process(path):
    im = Image.open(path)
    if not _is_transparent(im):
        return None
    im = im.convert('RGBA')

    box = _alpha_bbox(im)
    if not box:
        return None
    pad_x = max(4, int((box[2] - box[0]) * 0.01))
    pad_y = max(4, int((box[3] - box[1]) * 0.01))
    box = (max(0, box[0] - pad_x), max(0, box[1] - pad_y),
           min(im.width, box[2] + pad_x), min(im.height, box[3] + pad_y))
    im = im.crop(box)

    scale = min(MAX_H / im.height, MAX_W / im.width, 1.0)
    if scale < 1.0:
        im = im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))),
                       Image.LANCZOS)
    return im


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    # 清掉旧产物，保证编号与清单严格对应（本目录只放生成品）
    for f in os.listdir(OUT_DIR):
        if f.startswith('hero-') and f.endswith('.webp'):
            os.remove(os.path.join(OUT_DIR, f))

    seen = {}
    written = []
    skipped = []
    idx = 0
    for name in SOURCES:
        path = os.path.join(SRC_DIR, name)
        if not os.path.exists(path):
            skipped.append((name, '文件不存在'))
            continue
        digest = hashlib.md5(open(path, 'rb').read()).hexdigest()
        if digest in seen:
            skipped.append((name, '与 %s 完全相同' % seen[digest]))
            continue
        im = process(path)
        if im is None:
            skipped.append((name, '非透明底（白底图，按要求不使用）'))
            continue
        seen[digest] = name
        idx += 1
        out = os.path.join(OUT_DIR, 'hero-%02d.webp' % idx)
        im.save(out, 'WEBP', quality=82, method=6)
        kb = os.path.getsize(out) // 1024
        written.append((('hero-%02d.webp' % idx), name, im.size, kb))
        print('%-14s <- %-42s %5dx%-5d %4dKB' % (os.path.basename(out), name, im.size[0], im.size[1], kb))

    if skipped:
        print('\n跳过 %d 张：' % len(skipped))
        for n, why in skipped:
            print('  - %-42s %s' % (n, why))
    print('\n共写出 %d 张，合计 %d KB' % (len(written), sum(w[3] for w in written)))
    if written:
        print('最大单张：%s %dKB' % max(((w[0], w[3]) for w in written), key=lambda t: t[1]))


if __name__ == '__main__':
    sys.exit(main())
