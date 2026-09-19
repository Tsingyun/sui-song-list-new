# -*- coding: utf-8 -*-
"""隐私预检：提交前扫描待提交变更中的可疑内容（固定流程第 3 步）。

用法：
    python -X utf8 scripts/privacy_check.py            # 扫描 git 暂存区（staged）
    python -X utf8 scripts/privacy_check.py --all      # 扫描工作区全部改动（含未暂存）

检查模式（只做提示，不自动修改；命中即 exit 1）：
  1. 本机绝对路径（C:\\Users\\<用户名> / /c/Users/... / /Users/<名>）
  2. 常见密钥/凭据样式（GitHub PAT、OpenAI sk-、AWS AKIA、私钥块、token=、api_key=）
  3. 长十六进制/随机串（疑似 token 泄漏）

注意：观众昵称、B站 UID 等本身在站点公开展示，不属于隐私命中；
      若命中是「数据正文」（如观众昵称里恰好含 token 字样），人工判断后可放行。
"""
import os
import re
import subprocess
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)

PATTERNS = [
    (r'C:[\\/]+Users[\\/]+[^"\'\s,，)】\]]+', '本机 Windows 用户路径'),
    (r'(?<!\w)/c/Users/[^\s"\'\s,，)】\]]+', '本机 Windows 用户路径 (MSYS 风格)'),
    (r'(?<!\w)/Users/[A-Za-z0-9_\-]+', 'macOS/ Linux 用户路径'),
    (r'ghp_[A-Za-z0-9]{20,}', 'GitHub PAT'),
    (r'github_pat_[A-Za-z0-9_]{20,}', 'GitHub fine-grained PAT'),
    (r'sk-[A-Za-z0-9]{20,}', 'OpenAI 风格密钥'),
    (r'AKIA[0-9A-Z]{16}', 'AWS Access Key'),
    (r'-----BEGIN [A-Z ]*PRIVATE KEY-----', '私钥块'),
    (r'\b(?:api[_-]?key|secret|password|passwd|token)\s*[:=]\s*["\'][^"\']{8,}["\']',
     '硬编码凭据赋值'),
    (r'\b[0-9a-f]{40,64}\b', '长十六进制串（疑似凭据/哈希）'),
]
SELF = os.path.basename(__file__)
IGNORE_FILES = {SELF}  # 本脚本自身包含全部模式，跳过


def changed_files(staged_only=True):
    cmd = ['git', 'diff', '--name-only', '--cached'] if staged_only \
        else ['git', 'diff', '--name-only', 'HEAD']
    out = subprocess.run(cmd, cwd=PROJECT_ROOT, capture_output=True, text=True)
    files = [f for f in out.stdout.splitlines() if f.strip()]
    # staged 为空时 --all 退化为对比 HEAD，含新文件
    if staged_only and not files:
        print('（暂存区为空——请先 git add，或改用 --all）')
    return files


def main():
    staged_only = '--all' not in sys.argv
    files = [f for f in changed_files(staged_only)
             if os.path.basename(f) not in IGNORE_FILES]
    if not files:
        print('没有待检文件。')
        return 0

    hits = 0
    for rel in files:
        path = os.path.join(PROJECT_ROOT, rel)
        if not os.path.isfile(path):
            continue  # 删除的文件跳过
        try:
            text = open(path, encoding='utf-8').read()
        except (UnicodeDecodeError, PermissionError):
            print(f'[跳过] {rel}（二进制或不可读）')
            continue
        for lineno, line in enumerate(text.splitlines(), 1):
            for pat, label in PATTERNS:
                if re.search(pat, line):
                    hits += 1
                    shown = line.strip()[:120]
                    print(f'[命中] {rel}:{lineno}  {label}\n       {shown}')

    if hits:
        print(f'\n共 {hits} 处疑似隐私内容 —— 请先人工确认（误报可放行，真报请先清理再提交）。')
        return 1
    print(f'隐私预检通过：{len(files)} 个待提交文件未发现可疑内容。')
    return 0


if __name__ == '__main__':
    sys.exit(main())
