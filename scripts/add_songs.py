# -*- coding: utf-8 -*-
"""Quick add/update songs in song_data.json and rebuild the site.

Usage:
    python -X utf8 scripts/add_songs.py --name "流沙" --date "2026-06-14"
    python -X utf8 scripts/add_songs.py --name "新歌名" --artist "原唱" --lang "中文" --date "2026-06-14"
    python -X utf8 scripts/add_songs.py --batch "流沙,2026-06-14;One Last Kiss,2026-06-14"
"""
import argparse, json, os, sys, subprocess

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
DATA_DIR = os.path.join(PROJECT_ROOT, 'data')
DATA_FILE = os.path.join(DATA_DIR, 'song_data.json')
COMPLETE_FILE = os.path.join(DATA_DIR, 'sui_song_list_complete.json')

def load_data():
    with open(DATA_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_data(data):
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f'Saved {DATA_FILE}')

def find_song(songs, name):
    """Find a song by name (exact match, case-insensitive fallback)."""
    for s in songs:
        if s['name'] == name:
            return s
    lower = name.lower()
    for s in songs:
        if s['name'].lower() == lower:
            return s
    return None

def add_or_update(data, name, date, artist=None, lang=None):
    """Add a new song or update an existing one. Returns (action, song)."""
    songs = data['songs']
    existing = find_song(songs, name)

    if existing:
        existing['count'] = existing.get('count', 0) + 1
        # Update last date
        if date > existing.get('last', ''):
            existing['last'] = date
        # Update tier based on new count
        c = existing['count']
        existing['tier'] = 'frequent' if c >= 5 else ('occasional' if c >= 2 else 'rare')
        return 'updated', existing
    else:
        new_song = {
            'name': name,
            'translated': '',
            'artist': artist or '',
            'lang': lang or '中文',
            'count': 1,
            'tier': 'rare',
            'first': date,
            'last': date
        }
        songs.append(new_song)
        return 'added', new_song

def rebuild_site():
    """Run build_site.py to regenerate the HTML."""
    build_script = os.path.join(SCRIPT_DIR, 'build_site.py')
    print(f'\nRebuilding site...')
    result = subprocess.run(
        [sys.executable, '-X', 'utf8', build_script],
        cwd=PROJECT_ROOT,
        capture_output=True,
        text=True
    )
    if result.returncode == 0:
        print('Site rebuilt successfully.')
        if result.stdout:
            print(result.stdout)
    else:
        print(f'Build failed: {result.stderr}', file=sys.stderr)
        sys.exit(1)

def update_complete_file(song_name, date_str):
    """Append a date to sui_song_list_complete.json for heatmap data."""
    if not os.path.exists(COMPLETE_FILE):
        return
    with open(COMPLETE_FILE, 'r', encoding='utf-8') as f:
        complete = json.load(f)
    # Convert YYYY-MM-DD to YYYY/M/D format for complete file
    parts = date_str.split('-')
    date_key = f'{parts[0]}/{int(parts[1])}/{int(parts[2])}'
    for entry in complete:
        if entry.get('song_name', '') == song_name:
            old = entry.get('date_list', '')
            if date_key not in old:
                entry['date_list'] = old + '，' + date_key if old else date_key
            break
    with open(COMPLETE_FILE, 'w', encoding='utf-8') as f:
        json.dump(complete, f, ensure_ascii=False, indent=2)

def main():
    parser = argparse.ArgumentParser(description='Quick add/update songs for 岁己SUI song list')
    parser.add_argument('--name', '-n', help='Song name')
    parser.add_argument('--artist', '-a', default=None, help='Original artist (for new songs)')
    parser.add_argument('--lang', '-l', default=None, help='Language: 中文/日语/英文/韩语 (for new songs)')
    parser.add_argument('--date', '-d', help='Performance date (YYYY-MM-DD)')
    parser.add_argument('--batch', '-b', help='Batch mode: "name1,date1;name2,artist2,lang2,date2;..."')
    parser.add_argument('--no-rebuild', action='store_true', help='Skip rebuilding the site')
    args = parser.parse_args()

    if not args.name and not args.batch:
        parser.print_help()
        sys.exit(1)

    data = load_data()
    changes = []

    if args.batch:
        # Batch mode: "name1,date1;name2,artist2,lang2,date2;..."
        entries = args.batch.split(';')
        for entry in entries:
            parts = [p.strip() for p in entry.split(',')]
            if len(parts) < 2:
                print(f'Skipping invalid entry: {entry}')
                continue
            name = parts[0]
            if len(parts) == 2:
                # name,date
                date = parts[1]
                artist, lang = None, None
            elif len(parts) == 3:
                # name,date,lang  OR  name,artist,date
                if parts[2] in ('中文', '日语', '英文', '韩语'):
                    name, date, lang = parts[0], parts[1], parts[2]
                    artist = None
                else:
                    name, artist, date = parts
                    lang = None
            else:
                # name,artist,lang,date
                name, artist, lang, date = parts[0], parts[1], parts[2], parts[3]

            action, song = add_or_update(data, name, date, artist, lang)
            changes.append((action, song))
    else:
        if not args.date:
            print('Error: --date is required', file=sys.stderr)
            sys.exit(1)
        action, song = add_or_update(data, args.name, args.date, args.artist, args.lang)
        changes.append((action, song))

    # Print summary
    print('\n=== Changes ===')
    for action, song in changes:
        if action == 'updated':
            print(f'  [Updated] {song["name"]} -> count={song["count"]}, last={song["last"]}')
        else:
            print(f'  [Added]   {song["name"]} ({song.get("artist","")}, {song.get("lang","")}) date={song["last"]}')

    save_data(data)

    # Also update sui_song_list_complete.json for heatmap
    for action, song in changes:
        if args.date or args.batch:
            update_complete_file(song['name'], song['last'])

    if not args.no_rebuild:
        rebuild_site()

    print(f'\nDone! {len(changes)} song(s) processed.')

if __name__ == '__main__':
    main()
