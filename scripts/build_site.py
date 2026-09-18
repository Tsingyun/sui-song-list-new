# -*- coding: utf-8 -*-
"""Build the 岁己SUI song-list website.

Entry point (kept at scripts/build_site.py so the GitHub Actions workflow
`.github/workflows/rebuild.yml` keeps working unchanged). The implementation
lives in scripts/sitegen/ — data layer, request-statistics layer and page
assembler. Stdlib only; on Windows run with:  python -X utf8 scripts/build_site.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sitegen import builder  # noqa: E402

if __name__ == '__main__':
    builder.build()
