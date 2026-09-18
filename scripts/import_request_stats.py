# -*- coding: utf-8 -*-
"""Import point-song (点歌) statistics from the sister repo Tsingyun/sui-song-stats.

Keeps only the PRIMARY sources (raw_data / live_dates / user_uids / data_version).
Every leaderboard, percentage, streak etc. is DERIVED at build time by
scripts/sitegen/reqstats.py — never hand-patched (see process_features.py's
warnings in the stats repo).

Usage:  python -X utf8 scripts/import_request_stats.py <path-to-song_data_processed.json>
"""
import json, os, sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
OUT = os.path.join(PROJECT_ROOT, 'data', 'request_stats.json')

def main():
    if len(sys.argv) < 2:
        print('usage: import_request_stats.py <song_data_processed.json>')
        sys.exit(1)
    with open(sys.argv[1], encoding='utf-8') as f:
        src = json.load(f)
    out = {
        'data_version': src.get('data_version', ''),
        'raw_data': src.get('raw_data', []),
        'live_dates': src.get('live_dates', []),
        'user_uids': src.get('user_uids', {}),
    }
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
    n = len(out['raw_data'])
    print(f'Imported {n} request records, {len(out["live_dates"])} live dates, '
          f'{len(out["user_uids"])} uids -> {OUT}')

if __name__ == '__main__':
    main()
