# -*- coding: utf-8 -*-
"""Prepare the desktop-pet assets for the site.

把桌宠资源从工作副本整理进 `scripts/sitegen/assets/pet/`：
  · 贴图 PNG → WebP（尺寸上限 2048，肉眼无损档）—— 这是体积的大头，15MB → 约 1.5MB
  · 拷贝 PMX 模型、球面/卡通贴图（原样，BMP 浏览器可解码）
  · 拷贝 three.js r171 的最小依赖闭包（MMDLoader 需要的那几个文件）

一次性脚本，资源更新时才需要重跑：`python -X utf8 scripts/build_pet_assets.py`
产物由 builder.py 的 copy_pet_assets() 发布到 docs/assets/pet/。
"""
import os
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(os.path.dirname(HERE))
PET_OUT = os.path.join(HERE, 'sitegen', 'assets', 'pet')

# 桌宠资源的工作副本（PMX / 贴图 / vendor three.js 都在这里）
PET_SRC = os.environ.get('PET_SRC', r'C:\Users\Tsing\Downloads\Suifel_桌宠方案\demo')

# 单张贴图的尺寸上限（长边）。face/eye 这类细节图保留大一点，其余 1024 足够。
MAX_SIDE = {'Suifel_body_eye.png': 2048, 'Suifel_body_skin.png': 2048,
            'Suifel_clothe.png': 2048, 'Suifel_hair.png': 2048}
MAX_SIDE_DEFAULT = 1024
WEBP_QUALITY = 86

# three.js 里 MMDLoader 的依赖闭包（少一个就 import 失败）
VENDOR = [('vendor/three/build/three.module.js', 'three.module.js'),
          ('vendor/three/build/three.core.js', 'three.core.js')]
# 注意：**必须保留 examples/jsm/ 下的原始子目录结构**。
#   ① importmap 把 'three/addons/' 映射到 assets/pet/jsm/，所以 pet-core.js 里的
#      'three/addons/loaders/MMDLoader.js' 会请求 jsm/loaders/MMDLoader.js；
#   ② MMDLoader 内部还用 '../shaders/MMDToonShader.js'、'../loaders/TGALoader.js'、
#      '../libs/mmdparser.module.js' 这样的相对路径。平铺成 jsm/MMDLoader.js 会双双 404。
VENDOR_JSM = [('vendor/three/examples/jsm/loaders/MMDLoader.js', 'jsm/loaders/MMDLoader.js'),
              ('vendor/three/examples/jsm/loaders/TGALoader.js', 'jsm/loaders/TGALoader.js'),
              ('vendor/three/examples/jsm/libs/mmdparser.module.js', 'jsm/libs/mmdparser.module.js'),
              ('vendor/three/examples/jsm/shaders/MMDToonShader.js', 'jsm/shaders/MMDToonShader.js'),
              ('vendor/three/examples/jsm/utils/BufferGeometryUtils.js', 'jsm/utils/BufferGeometryUtils.js')]
# 这些子目录由 VENDOR_JSM 的 dst 决定，构建前先清掉，避免旧版的平铺文件留着 */
VENDOR_JSM_DIRS = ['loaders', 'libs', 'shaders', 'utils']


def human(n):
    return '%.1f MB' % (n / 1048576.0) if n >= 1048576 else '%.0f KB' % (n / 1024.0)


def dir_size(p):
    t = 0
    for root, _, files in os.walk(p):
        for f in files:
            t += os.path.getsize(os.path.join(root, f))
    return t


def main():
    if not os.path.isdir(PET_SRC):
        print('找不到桌宠工作副本：%s\n（可用环境变量 PET_SRC 指定）' % PET_SRC)
        return 1
    try:
        from PIL import Image
    except ImportError:
        print('需要 Pillow：pip install Pillow')
        return 1

    before = dir_size(PET_OUT) if os.path.isdir(PET_OUT) else 0
    os.makedirs(os.path.join(PET_OUT, 'model', 'textures'), exist_ok=True)
    os.makedirs(os.path.join(PET_OUT, 'jsm'), exist_ok=True)

    # ── 1. 贴图 PNG → WebP ──
    src_tex = os.path.join(PET_SRC, 'models', 'textures')
    total_in = total_out = 0
    for fn in sorted(os.listdir(src_tex)):
        if not fn.lower().endswith('.png'):
            continue
        src = os.path.join(src_tex, fn)
        im = Image.open(src)
        cap = MAX_SIDE.get(fn, MAX_SIDE_DEFAULT)
        if max(im.size) > cap:
            k = cap / float(max(im.size))
            im = im.resize((max(1, int(im.size[0] * k)), max(1, int(im.size[1] * k))), Image.LANCZOS)
        if im.mode not in ('RGBA', 'RGB'):
            im = im.convert('RGBA')
        out = os.path.join(PET_OUT, 'model', 'textures', os.path.splitext(fn)[0] + '.webp')
        im.save(out, 'WEBP', quality=WEBP_QUALITY, method=6)
        a, b = os.path.getsize(src), os.path.getsize(out)
        total_in += a
        total_out += b
        print('  %-26s %-9s %-9s  %dx%d' % (fn, human(a), human(b), im.size[0], im.size[1]))
    print('贴图合计 %s -> %s（%.0f%%）' % (human(total_in), human(total_out),
                                          100.0 * total_out / max(1, total_in)))

    # ── 2. 模型与球面/卡通贴图（原样拷贝）──
    src_model = os.path.join(PET_SRC, 'models')
    shutil.copy(os.path.join(src_model, 'Suifel.pmx'), os.path.join(PET_OUT, 'model', 'Suifel.pmx'))
    for sub in ('Sph', 'Toon'):
        s, d = os.path.join(src_model, sub), os.path.join(PET_OUT, 'model', sub)
        if os.path.isdir(s):
            shutil.rmtree(d, ignore_errors=True)
            shutil.copytree(s, d)

    # ── 3. three.js 依赖闭包 ──
    for rel, dst in VENDOR:
        shutil.copy(os.path.join(PET_SRC, rel), os.path.join(PET_OUT, dst))
    for d in VENDOR_JSM_DIRS:
        shutil.rmtree(os.path.join(PET_OUT, 'jsm', d), ignore_errors=True)
    for rel, dst in VENDOR_JSM:
        out = os.path.join(PET_OUT, dst)
        os.makedirs(os.path.dirname(out), exist_ok=True)
        shutil.copy(os.path.join(PET_SRC, rel), out)
    # 清掉早期版本平铺在 jsm/ 根下的同名文件，否则会与 jsm/loaders/ 下的版本并存（易混淆）
    for rel, dst in VENDOR_JSM:
        flat = os.path.join(PET_OUT, 'jsm', os.path.basename(dst))
        if os.path.isfile(flat):
            os.remove(flat)

    after = dir_size(PET_OUT)
    print('\nassets/pet 合计 %s（整理前 %s）' % (human(after), human(before)))
    biggest = sorted(
        ((os.path.getsize(os.path.join(r, f)), os.path.join(r, f)) for r, _, fs in os.walk(PET_OUT) for f in fs),
        reverse=True)[:6]
    print('最大的几个文件：')
    for sz, p in biggest:
        print('  %-9s %s' % (human(sz), os.path.relpath(p, PET_OUT)))
    return 0


if __name__ == '__main__':
    sys.exit(main())
