# -*- coding: utf-8 -*-
"""Generate a Vaporwave-themed single-page song list website for 岁己SUI. v2"""
import json, os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
DATA_DIR = os.path.join(PROJECT_ROOT, 'data')

with open(os.path.join(DATA_DIR, 'song_data.json'), 'r', encoding='utf-8') as f:
    data = json.load(f)

# Load Bilibili matching data and merge into songs
bili_map = {}
try:
    with open(os.path.join(DATA_DIR, 'song_bilibili_map.json'), 'r', encoding='utf-8') as f:
        bili_data = json.load(f)
        bili_map = bili_data.get('matches', {})
        print(f'Loaded {len(bili_map)} song-video matches')
except:
    print('No bilibili matching data found')

# Merge bili data into songs (compact format)
for song in data['songs']:
    clips = bili_map.get(song['name'], [])
    if clips:
        song['bili'] = [{'bv': c['bvid'], 't': c['title'], 'd': c.get('duration', 0), 'dt': c.get('date', '')} for c in clips]

songs_json = json.dumps(data['songs'], ensure_ascii=False)
stats_json = json.dumps(data['stats'], ensure_ascii=False)
lang_json = json.dumps(data['lang_counts'], ensure_ascii=False)

html = r'''<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>岁己SUI ▸ 歌单档案</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;700;900&family=Share+Tech+Mono&family=Noto+Sans+SC:wght@300;400;500;700&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
:root{
  --void:#090014;--card:rgba(26,16,60,.82);--magenta:#FF00FF;--cyan:#00FFFF;--orange:#FF9900;
  --text:#E0E0E0;--text-dim:#A0A0B0;--border:#2D1B4E;
  --glow-m:0 0 20px rgba(255,0,255,.35);--glow-c:0 0 20px rgba(0,255,255,.25);
  --font-h:'Orbitron',sans-serif;--font-m:'Share Tech Mono',monospace;
  --font-cjk:'Noto Sans SC','Microsoft YaHei',sans-serif;
}
html{scroll-behavior:smooth}
body{background:var(--void);color:var(--text);font-family:var(--font-cjk);line-height:1.6;overflow-x:hidden;min-height:100vh}

.scanlines{pointer-events:none;position:fixed;inset:0;z-index:9999;
  background:repeating-linear-gradient(0deg,transparent 0,transparent 2px,rgba(0,0,0,.18) 2px,rgba(0,0,0,.18) 4px)}
.scanlines::after{content:'';position:fixed;inset:0;
  background:linear-gradient(90deg,rgba(255,0,0,.04),rgba(0,255,0,.015),rgba(0,0,255,.04));pointer-events:none}

.grid-bg{position:fixed;bottom:0;left:0;right:0;height:55vh;z-index:0;pointer-events:none;
  background-image:linear-gradient(transparent 94%,rgba(255,0,255,.28) 94%),linear-gradient(90deg,transparent 94%,rgba(255,0,255,.28) 94%);
  background-size:48px 48px;transform:perspective(400px) rotateX(62deg) translateY(40px) scale(2.2);transform-origin:bottom center;
  mask-image:linear-gradient(to top,rgba(0,0,0,.7) 0%,transparent 80%);-webkit-mask-image:linear-gradient(to top,rgba(0,0,0,.7) 0%,transparent 80%);
  animation:gridScroll 20s linear infinite}
@keyframes gridScroll{0%{background-position:0 0}100%{background-position:0 48px}}

.sun{position:fixed;top:-120px;left:50%;transform:translateX(-50%);width:500px;height:500px;border-radius:50%;
  background:radial-gradient(circle,rgba(255,153,0,.22) 0%,rgba(255,0,255,.12) 50%,transparent 70%);filter:blur(80px);pointer-events:none;z-index:0}

.container{max-width:1200px;margin:0 auto;padding:0 20px;position:relative;z-index:1}

/* HERO */
.hero{padding:80px 0 40px;text-align:center;position:relative}
.hero-label{font-family:var(--font-m);font-size:13px;letter-spacing:6px;text-transform:uppercase;color:var(--cyan);margin-bottom:12px;text-shadow:0 0 12px rgba(0,255,255,.6)}
.hero-title{font-family:var(--font-h);font-size:clamp(2.2rem,6vw,4.8rem);font-weight:900;line-height:1.1;
  background:linear-gradient(135deg,var(--orange),var(--magenta),var(--cyan));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;
  filter:drop-shadow(0 0 30px rgba(255,0,255,.4));margin-bottom:8px}
.hero-sub{font-family:var(--font-h);font-size:clamp(1rem,2.5vw,1.6rem);font-weight:400;color:var(--text);letter-spacing:3px;margin-bottom:28px;text-shadow:0 0 8px rgba(255,255,255,.2)}
.hero-sub span{color:var(--cyan)}

/* STATS */
.stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;margin-bottom:40px}
.stat-card{border:1px solid rgba(255,0,255,.25);border-top:2px solid var(--cyan);background:var(--card);backdrop-filter:blur(12px);padding:18px 14px;text-align:center;transition:all .2s}
.stat-card:hover{transform:translateY(-3px);box-shadow:var(--glow-c);border-top-color:var(--magenta)}
.stat-num{font-family:var(--font-h);font-size:2rem;font-weight:900;background:linear-gradient(135deg,var(--cyan),var(--magenta));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;line-height:1.2}
.stat-label{font-family:var(--font-cjk);font-size:13px;color:var(--text-dim);margin-top:4px}

/* CONTROLS */
.controls{display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin-bottom:20px}
.search-box{flex:1;min-width:220px;position:relative}
.search-box input{width:100%;border:none;border-bottom:2px solid var(--magenta);background:rgba(0,0,0,.5);color:var(--cyan);font-family:var(--font-m);font-size:15px;padding:10px 14px 10px 36px;outline:none;transition:all .2s}
.search-box input:focus{border-bottom-color:var(--cyan);box-shadow:0 4px 20px rgba(0,255,255,.15)}
.search-box input::placeholder{color:rgba(255,0,255,.4)}
.search-box::before{content:'>';position:absolute;left:12px;top:50%;transform:translateY(-50%);font-family:var(--font-m);color:var(--magenta);font-size:16px}
.filter-btn{font-family:var(--font-m);font-size:12px;letter-spacing:1.5px;padding:8px 16px;border:1px solid var(--border);background:transparent;color:var(--text-dim);cursor:pointer;transition:all .2s;white-space:nowrap}
.filter-btn:hover,.filter-btn.active{border-color:var(--cyan);color:var(--cyan);box-shadow:0 0 10px rgba(0,255,255,.15)}
.filter-btn.active{background:rgba(0,255,255,.08)}
.sort-select{font-family:var(--font-cjk);font-size:13px;padding:8px 12px;border:1px solid var(--border);background:rgba(0,0,0,.5);color:var(--cyan);cursor:pointer;outline:none}
.sort-select option{background:#090014;color:var(--text)}

/* TABLE */
.table-wrap{border:1px solid rgba(255,0,255,.2);border-top:2px solid var(--cyan);background:var(--card);backdrop-filter:blur(12px);overflow:hidden;margin-bottom:20px}
.table-header{display:grid;grid-template-columns:54px 36px 1fr 100px 80px 60px 90px;border-bottom:1px solid rgba(255,0,255,.2);background:rgba(0,0,0,.3)}
.table-header span{font-family:var(--font-m);font-size:11px;letter-spacing:2px;color:var(--cyan);padding:12px 10px;text-shadow:0 0 8px rgba(0,255,255,.5)}
.song-list{overflow-y:auto}
.song-list::-webkit-scrollbar{width:6px}
.song-list::-webkit-scrollbar-track{background:transparent}
.song-list::-webkit-scrollbar-thumb{background:rgba(255,0,255,.3)}
.song-row{display:grid;grid-template-columns:54px 36px 1fr 100px 80px 60px 90px;align-items:center;border-bottom:1px solid rgba(45,27,78,.4);transition:all .15s;cursor:default}
.song-row:hover{background:rgba(0,255,255,.04);box-shadow:inset 0 0 20px rgba(0,255,255,.03)}
.song-row span{padding:10px 10px;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.song-row .idx{font-family:var(--font-m);font-size:12px;color:var(--text-dim);text-align:center}
.song-row .name{font-weight:500;color:var(--text)}
.song-row .name small{display:block;font-size:11px;color:var(--text-dim);font-weight:300;margin-top:1px}
.song-row .artist{color:var(--text-dim);font-size:13px}
.song-row .lang{font-family:var(--font-m);font-size:11px;text-align:center}
.song-row .count{font-family:var(--font-h);font-size:14px;font-weight:700;text-align:center}
.song-row .dates{font-family:var(--font-m);font-size:11px;color:var(--text-dim);text-align:center}

.tier-frequent .count{color:var(--orange);text-shadow:0 0 8px rgba(255,153,0,.4)}
.tier-frequent .name{color:#fff}
.tier-occasional .count{color:var(--cyan)}
.tier-rare .count{color:var(--text-dim)}
.lang-badge{display:inline-block;padding:2px 8px;font-size:10px;letter-spacing:1px;border:1px solid}
.lang-中文{border-color:#e74c3c;color:#e74c3c}.lang-日语{border-color:#f39c12;color:#f39c12}
.lang-英文{border-color:#3498db;color:#3498db}.lang-韩语{border-color:#9b59b6;color:#9b59b6}
.lang-中英混合{border-color:#1abc9c;color:#1abc9c}.lang-其他{border-color:var(--text-dim);color:var(--text-dim)}
.top10-row{background:linear-gradient(90deg,rgba(255,153,0,.06),transparent 60%);border-left:2px solid var(--orange)}
.top10-row:hover{background:linear-gradient(90deg,rgba(255,153,0,.1),transparent 60%)}

/* PAGINATION */
.pagination{display:flex;justify-content:center;align-items:center;gap:8px;padding:20px 0 20px;flex-wrap:wrap}
.page-btn{font-family:var(--font-m);font-size:13px;padding:6px 14px;border:1px solid var(--border);background:transparent;color:var(--text-dim);cursor:pointer;transition:all .2s}
.page-btn:hover{border-color:var(--cyan);color:var(--cyan)}
.page-btn.active{border-color:var(--magenta);color:var(--magenta);background:rgba(255,0,255,.08);box-shadow:0 0 10px rgba(255,0,255,.15)}
.page-btn:disabled{opacity:.3;cursor:default}
.page-info{font-family:var(--font-m);font-size:12px;color:var(--text-dim);letter-spacing:1px}

/* SECTION TABS */
.section-tabs{display:flex;gap:0;margin-bottom:24px;border-bottom:1px solid var(--border)}
.section-tab{font-family:var(--font-m);font-size:13px;letter-spacing:2px;padding:12px 20px;border:none;background:transparent;color:var(--text-dim);cursor:pointer;transition:all .2s;position:relative}
.section-tab:hover{color:var(--text)}
.section-tab.active{color:var(--cyan);text-shadow:0 0 10px rgba(0,255,255,.5)}
.section-tab.active::after{content:'';position:absolute;bottom:-1px;left:0;right:0;height:2px;background:linear-gradient(90deg,var(--cyan),var(--magenta))}

/* ARTIST */
.artist-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px;margin-bottom:40px}
.artist-card{border:1px solid rgba(255,0,255,.15);border-top:2px solid var(--magenta);background:var(--card);backdrop-filter:blur(8px);padding:16px;transition:all .2s}
.artist-card:hover{transform:translateY(-2px);box-shadow:var(--glow-m);border-top-color:var(--cyan)}
.artist-name{font-family:var(--font-h);font-size:13px;font-weight:700;color:var(--cyan);letter-spacing:1px;text-shadow:0 0 8px rgba(0,255,255,.4);margin-bottom:6px}
.artist-meta{font-family:var(--font-m);font-size:11px;color:var(--text-dim);letter-spacing:1px}
.artist-songs{margin-top:10px;font-size:13px;color:var(--text);line-height:1.7}
.artist-songs span{display:inline-block;margin-right:6px;padding:1px 6px;background:rgba(0,255,255,.06);border:1px solid rgba(0,255,255,.1);font-size:12px}

/* LANG */
.lang-quick-nav{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:24px;padding:14px 0;border-bottom:1px solid var(--border)}
.lang-quick-nav a{font-family:var(--font-cjk);font-size:14px;font-weight:500;color:var(--text-dim);text-decoration:none;padding:6px 18px;border:1px solid var(--border);transition:all .2s;letter-spacing:1px}
.lang-quick-nav a:hover{border-color:var(--cyan);color:var(--cyan);box-shadow:0 0 12px rgba(0,255,255,.15)}
.lang-quick-nav a .nav-count{font-family:var(--font-m);font-size:11px;color:var(--text-dim);margin-left:4px;opacity:.7}
.lang-section{margin-bottom:30px;scroll-margin-top:20px}
.lang-header{font-family:var(--font-h);font-size:18px;font-weight:700;padding:10px 0;border-bottom:1px solid var(--border);margin-bottom:12px}
.lang-header .count-tag{font-family:var(--font-m);font-size:12px;color:var(--text-dim);margin-left:10px;letter-spacing:1px}

/* FOOTER */
.footer{text-align:center;padding:40px 0 30px;font-family:var(--font-m);font-size:11px;color:var(--text-dim);letter-spacing:2px;border-top:1px solid var(--border);margin-top:40px}
.footer a{color:var(--cyan);text-decoration:none}.footer a:hover{text-shadow:0 0 8px rgba(0,255,255,.5)}

/* BACK TO TOP */
.back-top{position:fixed;bottom:30px;right:30px;width:44px;height:44px;border:1px solid var(--magenta);background:rgba(26,16,60,.9);color:var(--magenta);font-family:var(--font-m);font-size:18px;display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:100;opacity:0;transition:all .3s;backdrop-filter:blur(8px)}
.back-top.visible{opacity:1}
.back-top:hover{background:var(--magenta);color:#000;box-shadow:var(--glow-m)}

.section{display:none}.section.active{display:block}

/* ═══════ BLIND BOX BUTTON ═══════ */
.blindbox-btn{
  position:fixed;bottom:36px;left:30px;z-index:200;
  width:72px;height:72px;border:2px solid var(--orange);border-radius:50%;
  background:linear-gradient(135deg,rgba(255,153,0,.3),rgba(255,0,255,.25));
  backdrop-filter:blur(12px);
  color:var(--orange);font-size:30px;font-weight:900;
  display:flex;align-items:center;justify-content:center;
  cursor:pointer;transition:all .3s;
  box-shadow:0 0 20px rgba(255,153,0,.45),0 0 40px rgba(255,0,255,.15);
  animation:blindboxFloat 3s ease-in-out infinite,blindboxPulse 2s ease-in-out infinite;
}
.blindbox-btn::before{
  content:'';position:absolute;inset:-8px;border-radius:50%;
  border:2px solid rgba(255,153,0,.35);
  animation:blindboxRing 2s ease-in-out infinite;pointer-events:none;
}
.blindbox-btn::after{
  content:'';position:absolute;inset:-16px;border-radius:50%;
  border:1px solid rgba(255,0,255,.2);
  animation:blindboxRing 2s ease-in-out infinite .5s;pointer-events:none;
}
.blindbox-btn:hover{
  transform:scale(1.2) rotate(15deg);
  box-shadow:0 0 40px rgba(255,153,0,.6),0 0 80px rgba(255,0,255,.35);
  border-color:var(--magenta);
}
@keyframes blindboxPulse{0%,100%{box-shadow:0 0 20px rgba(255,153,0,.45),0 0 40px rgba(255,0,255,.15)}50%{box-shadow:0 0 35px rgba(255,153,0,.6),0 0 60px rgba(255,0,255,.25)}}
@keyframes blindboxFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
@keyframes blindboxRing{0%,100%{transform:scale(1);opacity:.6}50%{transform:scale(1.12);opacity:.2}}
.blindbox-btn .btn-tooltip{
  position:absolute;left:86px;top:50%;transform:translateY(-50%);
  background:rgba(26,16,60,.95);border:1px solid var(--orange);padding:8px 16px;
  font-family:var(--font-cjk);font-size:14px;font-weight:700;color:var(--orange);white-space:nowrap;
  opacity:1;pointer-events:none;letter-spacing:2px;
  text-shadow:0 0 8px rgba(255,153,0,.5);
  box-shadow:0 0 12px rgba(255,153,0,.2);
}

/* ═══════ BLIND BOX MODAL ═══════ */
.blindbox-overlay{
  position:fixed;inset:0;z-index:9000;
  background:rgba(9,0,20,.85);backdrop-filter:blur(8px);
  display:none;align-items:center;justify-content:center;
  opacity:0;transition:opacity .3s;
}
.blindbox-overlay.show{display:flex;opacity:1}
.blindbox-modal{
  position:relative;width:90%;max-width:520px;
  border:2px solid var(--magenta);border-top:2px solid var(--cyan);
  background:rgba(26,16,60,.95);backdrop-filter:blur(20px);
  padding:0;overflow:hidden;
  box-shadow:0 0 40px rgba(255,0,255,.3),0 0 80px rgba(0,255,255,.15);
}
.bb-titlebar{
  background:rgba(0,255,255,.08);border-bottom:1px solid var(--cyan);padding:12px 16px;
  display:flex;align-items:center;justify-content:space-between;
}
.bb-titlebar-dots{display:flex;gap:6px}
.bb-titlebar-dots div{width:12px;height:12px;border-radius:50%}
.bb-dots-r{background:var(--magenta)}.bb-dots-c{background:var(--cyan)}.bb-dots-o{background:var(--orange)}
.bb-title{font-family:var(--font-h);font-size:13px;color:var(--cyan);letter-spacing:2px;text-shadow:0 0 8px rgba(0,255,255,.5)}
.bb-close{font-family:var(--font-m);font-size:18px;color:var(--text-dim);cursor:pointer;background:none;border:none;transition:color .2s}
.bb-close:hover{color:var(--magenta)}
.bb-body{padding:40px 30px;text-align:center;min-height:280px;display:flex;flex-direction:column;align-items:center;justify-content:center}

/* Slot animation */
.bb-slot-area{width:100%;margin-bottom:30px}
.bb-slot-track{
  overflow:hidden;height:60px;position:relative;
  border:1px solid var(--border);background:rgba(0,0,0,.4);margin-bottom:20px;
}
.bb-slot-track::before,.bb-slot-track::after{
  content:'';position:absolute;left:0;right:0;height:15px;z-index:2;pointer-events:none;
}
.bb-slot-track::before{top:0;background:linear-gradient(to bottom,rgba(9,0,20,.9),transparent)}
.bb-slot-track::after{bottom:0;background:linear-gradient(to top,rgba(9,0,20,.9),transparent)}
.bb-slot-inner{
  transition:transform 0s linear;
  will-change:transform;
}
.bb-slot-item{
  height:60px;display:flex;align-items:center;justify-content:center;
  font-family:var(--font-cjk);font-size:20px;font-weight:700;color:var(--text);
  letter-spacing:2px;
}
.bb-pointer{
  position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);
  height:60px;border-top:2px solid var(--cyan);border-bottom:2px solid var(--cyan);
  pointer-events:none;z-index:3;
  box-shadow:0 0 10px rgba(0,255,255,.3) inset;
}

/* Result display */
.bb-result{opacity:0;transform:translateY(20px);transition:all .5s ease-out;text-align:center}
.bb-result.show{opacity:1;transform:translateY(0)}
.bb-result-name{
  font-family:var(--font-cjk);font-size:28px;font-weight:700;
  background:linear-gradient(135deg,var(--orange),var(--magenta),var(--cyan));
  -webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;
  filter:drop-shadow(0 0 20px rgba(255,0,255,.5));
  margin-bottom:8px;line-height:1.3;
}
.bb-result-meta{font-family:var(--font-m);font-size:13px;color:var(--text-dim);letter-spacing:1px;margin-bottom:4px}
.bb-result-count{font-family:var(--font-h);font-size:16px;color:var(--cyan);margin-top:8px}
.bb-play-btn{
  margin-top:16px;padding:10px 28px;
  font-family:var(--font-cjk);font-size:14px;font-weight:700;letter-spacing:2px;
  border:2px solid var(--cyan);background:transparent;color:var(--cyan);
  cursor:pointer;transition:all .25s;position:relative;overflow:hidden;
  text-shadow:0 0 8px rgba(0,255,255,.5);
  box-shadow:0 0 12px rgba(0,255,255,.2);
}
.bb-play-btn:hover{background:var(--cyan);color:#000;box-shadow:0 0 25px rgba(0,255,255,.5);text-shadow:none}
.bb-play-btn.search{border-color:var(--orange);color:var(--orange);text-shadow:0 0 8px rgba(255,153,0,.5);box-shadow:0 0 12px rgba(255,153,0,.2)}
.bb-play-btn.search:hover{background:var(--orange);color:#000;box-shadow:0 0 25px rgba(255,153,0,.5);text-shadow:none}

/* Draw button */
.bb-draw-btn{
  font-family:var(--font-cjk);font-size:15px;font-weight:700;letter-spacing:3px;
  padding:12px 40px;border:2px solid var(--orange);background:transparent;color:var(--orange);
  cursor:pointer;transition:all .25s;position:relative;overflow:hidden;
}
.bb-draw-btn:hover{background:var(--orange);color:#000;box-shadow:0 0 25px rgba(255,153,0,.4)}
.bb-draw-btn:disabled{opacity:.4;cursor:default}
.bb-draw-btn:disabled:hover{background:transparent;color:var(--orange);box-shadow:none}

/* Confetti */
.bb-confetti{position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:1}
.bb-confetti-piece{
  position:absolute;width:8px;height:8px;top:-10px;
  animation:confettiFall 1.5s ease-out forwards;
}
@keyframes confettiFall{
  0%{transform:translateY(0) rotate(0deg) scale(1);opacity:1}
  100%{transform:translateY(400px) rotate(720deg) scale(.3);opacity:0}
}

/* Glow burst */
.bb-glow-burst{
  position:absolute;top:50%;left:50%;width:0;height:0;border-radius:50%;
  transform:translate(-50%,-50%);
  background:radial-gradient(circle,rgba(255,153,0,.4),rgba(255,0,255,.2),transparent 70%);
  animation:burstExpand .8s ease-out forwards;pointer-events:none;z-index:0;
}
@keyframes burstExpand{0%{width:0;height:0;opacity:1}100%{width:600px;height:600px;opacity:0}}

/* ═══════ PLAYER ═══════ */
.play-btn{position:relative;display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border:1px solid var(--cyan);background:transparent;color:var(--cyan);font-size:12px;cursor:pointer;transition:all .2s;flex-shrink:0}
.play-btn:hover{background:var(--cyan);color:#000;box-shadow:0 0 12px rgba(0,255,255,.4)}
.play-btn.no-match{border-color:var(--border);color:var(--text-dim);font-size:11px}
.play-btn.no-match:hover{border-color:var(--magenta);color:var(--magenta);background:transparent;box-shadow:0 0 8px rgba(255,0,255,.2)}
.play-btn.active{background:var(--magenta);border-color:var(--magenta);color:#fff;box-shadow:0 0 12px rgba(255,0,255,.4)}
.play-dot{position:absolute;top:-2px;right:-2px;width:7px;height:7px;border-radius:50%;background:var(--orange);box-shadow:0 0 6px rgba(255,153,0,.6);font-style:normal}

.player-panel{position:fixed;bottom:0;left:0;right:0;z-index:500;background:rgba(9,0,20,.97);border-top:2px solid var(--cyan);backdrop-filter:blur(20px);transform:translateY(100%);transition:transform .35s cubic-bezier(.4,0,.2,1);box-shadow:0 -4px 40px rgba(0,255,255,.15)}
.player-panel.open{transform:translateY(0)}
.player-bar{display:flex;align-items:center;padding:10px 20px;gap:14px;border-bottom:1px solid rgba(0,255,255,.15)}
.player-song-info{flex:1;min-width:0}
.player-song-name{font-family:var(--font-cjk);font-size:16px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.player-song-artist{font-family:var(--font-m);font-size:12px;color:var(--text-dim);letter-spacing:1px}
.player-controls{display:flex;align-items:center;gap:10px}
.player-clip-select{font-family:var(--font-m);font-size:12px;padding:6px 10px;border:1px solid var(--border);background:rgba(0,0,0,.6);color:var(--cyan);cursor:pointer;outline:none;max-width:200px}
.player-clip-select option{background:#090014}
.player-bili-link{font-family:var(--font-m);font-size:12px;padding:6px 14px;border:1px solid var(--magenta);color:var(--magenta);background:transparent;text-decoration:none;transition:all .2s;white-space:nowrap}
.player-bili-link:hover{background:var(--magenta);color:#fff;box-shadow:0 0 10px rgba(255,0,255,.3)}
.player-close{font-family:var(--font-m);font-size:22px;color:var(--text-dim);cursor:pointer;background:none;border:none;transition:color .2s;padding:4px 8px}
.player-close:hover{color:var(--magenta)}
.player-iframe-wrap{width:100%;height:0;overflow:hidden;transition:height .3s}
.player-iframe-wrap.expanded{height:380px}
.player-iframe-wrap iframe{width:100%;height:100%;border:none}
.player-toggle-bar{font-family:var(--font-m);font-size:11px;color:var(--text-dim);text-align:center;padding:4px;cursor:pointer;letter-spacing:1px;transition:color .2s}
.player-toggle-bar:hover{color:var(--cyan)}

@media(max-width:768px){
  .hero{padding:50px 0 24px}
  .stats-grid{grid-template-columns:repeat(2,1fr);gap:10px}
  .stat-num{font-size:1.5rem}
  .controls{gap:8px}
  .section-tab{padding:10px 12px;font-size:11px;letter-spacing:1px}
  .table-header,.song-row{grid-template-columns:36px 30px 1fr 70px 56px 44px 76px}
  .table-header span,.song-row span{padding:8px 6px;font-size:12px}
  .song-row .name small{font-size:10px}
  .artist-grid{grid-template-columns:1fr}
  .grid-bg{height:35vh}
  .blindbox-btn{width:60px;height:60px;font-size:26px;bottom:20px;left:20px}
  .blindbox-btn .btn-tooltip{font-size:12px;padding:6px 12px;left:72px}
  .bb-modal{width:95%}
  .bb-body{padding:24px 16px}
  .bb-result-name{font-size:22px}
  .player-bar{padding:8px 12px;gap:8px;flex-wrap:wrap}
  .player-song-name{font-size:14px}
  .player-controls{width:100%;justify-content:flex-end}
  .player-clip-select{max-width:140px;font-size:11px}
  .player-iframe-wrap.expanded{height:280px}
  .play-btn{width:24px;height:24px;font-size:10px}
}
@media(max-width:480px){
  .table-header,.song-row{grid-template-columns:30px 28px 1fr 54px 44px 80px}
  .table-header span:nth-child(5),.song-row span:nth-child(5){display:none}
  .stats-grid{grid-template-columns:repeat(2,1fr)}
}
</style>
</head>
<body>

<div class="scanlines"></div>
<div class="grid-bg"></div>
<div class="sun"></div>

<div class="container">
  <section class="hero">
    <div class="hero-label">// SUI_SONG_DATABASE v2.0</div>
    <h1 class="hero-title">岁己SUI</h1>
    <div class="hero-sub">完 整 歌 单 档 案 &nbsp;<span>▸</span>&nbsp; <span>2022.09 — 2026.06</span></div>
  </section>

  <div class="stats-grid" id="statsGrid"></div>

  <div class="section-tabs">
    <button class="section-tab active" data-section="all">全部歌曲</button>
    <button class="section-tab" data-section="frequent">常唱金曲</button>
    <button class="section-tab" data-section="lang">语言分类</button>
    <button class="section-tab" data-section="artist">原唱分类</button>
  </div>

  <div class="section active" id="sec-all">
    <div class="controls">
      <div class="search-box"><input type="text" id="searchInput" placeholder="搜索歌曲名、原唱..."></div>
      <select class="sort-select" id="sortSelect">
        <option value="count-desc">演唱次数 ↓</option>
        <option value="count-asc">演唱次数 ↑</option>
        <option value="name-asc">歌曲名 A-Z</option>
        <option value="first-asc">最早演唱 ↑</option>
        <option value="last-desc">最近演唱 ↓</option>
        <option value="last-asc">最久没唱 ↑</option>
      </select>
      <div id="langFilters" style="display:flex;gap:6px;flex-wrap:wrap;"></div>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;">
      <button class="filter-btn" data-quick="all">全部</button>
      <button class="filter-btn" data-quick="frequent">常唱 (5+)</button>
      <button class="filter-btn" data-quick="occasional">偶尔 (2-4)</button>
      <button class="filter-btn" data-quick="once">仅唱一次</button>
      <button class="filter-btn" data-quick="dormant">很久没唱</button>
    </div>
    <div class="table-wrap">
      <div class="table-header"><span>#</span><span>♪</span><span>歌曲名</span><span>原唱</span><span>语言</span><span>次</span><span>日期</span></div>
      <div class="song-list" id="songList"></div>
    </div>
    <div class="pagination" id="pagination"></div>
    <div class="page-info" id="pageInfo" style="text-align:center;margin-bottom:40px;"></div>
  </div>

  <div class="section" id="sec-frequent">
    <div class="controls"><div class="search-box"><input type="text" id="freqSearch" placeholder="搜索常唱金曲..."></div></div>
    <div class="table-wrap">
      <div class="table-header"><span>#</span><span>♪</span><span>歌曲名</span><span>原唱</span><span>语言</span><span>次</span><span>日期</span></div>
      <div class="song-list" id="freqList"></div>
    </div>
  </div>

  <div class="section" id="sec-lang"><div id="langContent"></div></div>

  <div class="section" id="sec-artist">
    <div class="controls"><div class="search-box"><input type="text" id="artistSearch" placeholder="搜索原唱..."></div></div>
    <div class="artist-grid" id="artistGrid"></div>
  </div>

  <div class="footer">
    <p>部分数据来源：<a href="https://www.suijisui.space" target="_blank">suijisui.space</a>（<a href="https://github.com/PQL87/sui-song-list" target="_blank">GitHub: PQL87/sui-song-list</a>）</p>
    <p style="margin-top:10px;"><a href="https://github.com/Tsingyun/sui-song-list-new" target="_blank" style="font-size:13px;letter-spacing:3px;border:1px solid var(--cyan);padding:6px 16px;display:inline-block;">◈ 项目源码 GitHub ◈</a></p>
    <p style="margin-top:10px;">2022.09 — 2026.06</p>
  </div>
</div>

<!-- BLIND BOX BUTTON -->
<button class="blindbox-btn" id="blindboxBtn" title="抽盲盒">
  ?
  <span class="btn-tooltip">抽盲盒</span>
</button>

<!-- BLIND BOX MODAL -->
<div class="blindbox-overlay" id="bbOverlay">
  <div class="blindbox-modal">
    <div class="bb-titlebar">
      <div class="bb-titlebar-dots"><div class="bb-dots-r"></div><div class="bb-dots-c"></div><div class="bb-dots-o"></div></div>
      <span class="bb-title">SUI_GACHA.exe</span>
      <button class="bb-close" id="bbClose">&times;</button>
    </div>
    <div class="bb-body">
      <div class="bb-confetti" id="bbConfetti"></div>
      <div class="bb-slot-area">
        <div class="bb-slot-track" id="bbTrack">
          <div class="bb-pointer"></div>
          <div class="bb-slot-inner" id="bbSlotInner"></div>
        </div>
      </div>
      <div class="bb-result" id="bbResult">
        <div class="bb-result-name" id="bbResultName"></div>
        <div class="bb-result-meta" id="bbResultMeta"></div>
        <div class="bb-result-count" id="bbResultCount"></div>
        <button class="bb-play-btn" id="bbPlayBtn" style="display:none"></button>
      </div>
      <button class="bb-draw-btn" id="bbDrawBtn">抽 一 首</button>
    </div>
  </div>
</div>

<!-- BACK TO TOP -->
<button class="back-top" id="backTop" onclick="window.scrollTo({top:0,behavior:'smooth'})">↑</button>

<!-- PLAYER PANEL -->
<div class="player-panel" id="playerPanel">
  <div class="player-toggle-bar" id="playerToggle">▾ 展开/收起播放器 ▾</div>
  <div class="player-bar">
    <div class="player-song-info">
      <div class="player-song-name" id="playerSongName">—</div>
      <div class="player-song-artist" id="playerSongArtist">—</div>
    </div>
    <div class="player-controls">
      <select class="player-clip-select" id="clipSelect" style="display:none"></select>
      <a class="player-bili-link" id="biliLink" href="#" target="_blank">B站 ↗</a>
      <button class="player-close" id="playerClose">&times;</button>
    </div>
  </div>
  <div class="player-iframe-wrap" id="iframeWrap">
    <iframe id="playerIframe" allow="autoplay; fullscreen" sandbox="allow-scripts allow-same-origin allow-popups"></iframe>
  </div>
</div>

<script>
const SONGS = ''' + songs_json + ''';
const STATS = ''' + stats_json + ''';
const LANG_COUNTS = ''' + lang_json + ''';

let currentSection='all',currentLang='all',currentSort='count-desc',searchQuery='',currentPage=1,currentQuick='all';
const PAGE_SIZE=50;
const TODAY=new Date('2026-06-14');

// ═══════ PLAYER ═══════
let currentPlaySong=null,currentClipIdx=0;
function playBtnHTML(s){
  if(s.bili&&s.bili.length){
    const tip=s.bili.length>1?' title="'+s.bili.length+'个版本可切换"':'';
    return'<span class="play-btn" onclick="playSong(this,event)"'+tip+'>▶</span>';
  }
  return'<span class="play-btn no-match" onclick="searchBili(this,event)" title="在B站搜索">↗</span>';
}
function playSong(btn,e){
  e.stopPropagation();
  const row=btn.closest('.song-row');
  const nameEl=row.querySelector('.name');
  const songName=nameEl.childNodes[0].textContent.trim();
  const song=SONGS.find(s=>s.name===songName);
  if(!song||!song.bili||!song.bili.length)return;
  currentPlaySong=song;currentClipIdx=0;
  openPlayer(song,0);
  // Highlight active button
  document.querySelectorAll('.play-btn.active').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
}
function searchBili(btn,e){
  e.stopPropagation();
  const row=btn.closest('.song-row');
  const nameEl=row.querySelector('.name');
  const songName=nameEl.childNodes[0].textContent.trim();
  const url='https://search.bilibili.com/all?keyword='+encodeURIComponent('岁己SUI '+songName+' 歌切');
  const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener';document.body.appendChild(a);a.click();a.remove();
}
function openPlayer(song,clipIdx){
  const panel=document.getElementById('playerPanel');
  const iframe=document.getElementById('playerIframe');
  const wrap=document.getElementById('iframeWrap');
  const sel=document.getElementById('clipSelect');
  const clip=song.bili[clipIdx];
  document.getElementById('playerSongName').textContent=song.name;
  document.getElementById('playerSongArtist').textContent=(song.artist||'—')+' · '+(clip.dt||'')+(clip.d?' · '+Math.floor(clip.d/60)+':'+String(clip.d%60).padStart(2,'0'):'');
  document.getElementById('biliLink').href='https://www.bilibili.com/video/'+clip.bv;
  // Clip selector for multi-clip songs
  if(song.bili.length>1){
    sel.style.display='';
    sel.innerHTML=song.bili.map((c,i)=>'<option value="'+i+'"'+(i===clipIdx?' selected':'')+'>'+
      (c.dt||'?')+(c.d?' · '+Math.floor(c.d/60)+':'+String(c.d%60).padStart(2,'0'):'')+
      (c.bv===clip.bv?' ◂':'')+'</option>').join('');
    sel.onchange=function(){openPlayer(song,parseInt(this.value));};
  }else{sel.style.display='none';}
  // Load iframe
  iframe.src='https://player.bilibili.com/player.html?bvid='+clip.bv+'&autoplay=1&high_quality=1&danmaku=0';
  panel.classList.add('open');
  wrap.classList.add('expanded');
}
function closePlayer(){
  const panel=document.getElementById('playerPanel');
  const iframe=document.getElementById('playerIframe');
  panel.classList.remove('open');
  document.getElementById('iframeWrap').classList.remove('expanded');
  setTimeout(()=>{iframe.src='';},350);
  document.querySelectorAll('.play-btn.active').forEach(b=>b.classList.remove('active'));
  currentPlaySong=null;
}
function bindPlayer(){
  document.getElementById('playerClose').addEventListener('click',closePlayer);
  document.getElementById('playerToggle').addEventListener('click',function(){
    document.getElementById('iframeWrap').classList.toggle('expanded');
  });
}

function init(){renderStats();renderLangFilters();renderSongList();bindEvents();bindBlindBox();bindPlayer()}

function renderStats(){
  const g=document.getElementById('statsGrid');
  const items=[
    {n:STATS.total,l:'歌曲总数'},{n:STATS.performances,l:'演唱次数'},{n:STATS.frequent,l:'常唱 (5+)'},
    {n:STATS.occasional,l:'偶尔'},{n:STATS.once,l:'仅唱一次'}
  ];
  g.innerHTML=items.map(i=>`<div class="stat-card"><div class="stat-num">${i.n.toLocaleString()}</div><div class="stat-label">${i.l}</div></div>`).join('');
}

function renderLangFilters(){
  const c=document.getElementById('langFilters');
  const langs=['all','中文','日语','英文','韩语'];
  c.innerHTML=langs.map(l=>`<button class="filter-btn ${l==='all'?'active':''}" data-lang="${l}">${l==='all'?'全部语言':l}</button>`).join('');
  c.querySelectorAll('.filter-btn').forEach(b=>{
    b.addEventListener('click',()=>{
      c.querySelectorAll('.filter-btn').forEach(x=>x.classList.remove('active'));
      b.classList.add('active');currentLang=b.dataset.lang;currentPage=1;renderSongList();
    });
  });
}

function daysSince(dateStr){
  if(!dateStr)return 99999;
  const d=new Date(dateStr);
  return Math.floor((TODAY-d)/(86400000));
}

function getFilteredSongs(){
  let list=[...SONGS];
  // Quick filter
  if(currentQuick==='frequent')list=list.filter(s=>s.count>=5);
  else if(currentQuick==='occasional')list=list.filter(s=>s.count>=2&&s.count<=4);
  else if(currentQuick==='once')list=list.filter(s=>s.count===1);
  else if(currentQuick==='dormant')list=list.filter(s=>daysSince(s.last)>=180).sort((a,b)=>daysSince(b.last)-daysSince(a.last));
  // Lang
  if(currentLang!=='all')list=list.filter(s=>s.lang===currentLang);
  // Search
  if(searchQuery){const q=searchQuery.toLowerCase();list=list.filter(s=>s.name.toLowerCase().includes(q)||s.artist.toLowerCase().includes(q)||s.translated.toLowerCase().includes(q));}
  // Sort (skip if dormant already sorted)
  if(currentQuick!=='dormant'){
    switch(currentSort){
      case'count-desc':list.sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,'zh'));break;
      case'count-asc':list.sort((a,b)=>a.count-b.count||a.name.localeCompare(b.name,'zh'));break;
      case'name-asc':list.sort((a,b)=>a.name.localeCompare(b.name,'zh'));break;
      case'first-asc':list.sort((a,b)=>(a.first||'z').localeCompare(b.first||'z'));break;
      case'last-desc':list.sort((a,b)=>(b.last||'').localeCompare(a.last||''));break;
      case'last-asc':list.sort((a,b)=>(a.last||'z').localeCompare(b.last||'z'));break;
    }
  }
  return list;
}

function renderSongList(){
  const filtered=getFilteredSongs();
  const totalPages=Math.ceil(filtered.length/PAGE_SIZE);
  if(currentPage>totalPages)currentPage=totalPages||1;
  const start=(currentPage-1)*PAGE_SIZE;
  const pageSongs=filtered.slice(start,start+PAGE_SIZE);
  const allSorted=[...SONGS].sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,'zh'));
  const rankMap={};allSorted.forEach((s,i)=>{rankMap[s.name]=i+1;});
  const container=document.getElementById('songList');
  if(!pageSongs.length){container.innerHTML='<div style="padding:40px;text-align:center;font-family:var(--font-m);color:var(--text-dim);">> 没有找到匹配的歌曲</div>';
  }else{
    container.innerHTML=pageSongs.map(s=>{
      const gr=rankMap[s.name],isTop10=gr<=10;
      const tier=s.count>=5?'frequent':(s.count>=2?'occasional':'rare');
      const transInfo=s.translated?`<small>${s.translated}</small>`:'';
      const dateStr=s.first===s.last?(s.first||'—'):`${s.first||'—'} ~ ${s.last||'—'}`;
      const pb=playBtnHTML(s);
      return`<div class="song-row tier-${tier} ${isTop10?'top10-row':''}">
        <span class="idx">${isTop10?'★'+gr:gr}</span>${pb}<span class="name">${s.name}${transInfo}</span>
        <span class="artist">${s.artist||'—'}</span><span class="lang"><span class="lang-badge lang-${s.lang}">${s.lang}</span></span>
        <span class="count">${s.count}</span><span class="dates">${dateStr}</span></div>`;
    }).join('');
  }
  renderPagination(filtered.length,totalPages);
  document.getElementById('pageInfo').textContent=`> ${filtered.length} 首 | 第 ${currentPage}/${totalPages||1} 页`;
}

function renderPagination(total,totalPages){
  const c=document.getElementById('pagination');
  if(totalPages<=1){c.innerHTML='';return;}
  let html=`<button class="page-btn" ${currentPage===1?'disabled':''} onclick="goPage(${currentPage-1})">◂ 上一页</button>`;
  const pages=[];
  if(totalPages<=7){for(let i=1;i<=totalPages;i++)pages.push(i);}
  else{pages.push(1);if(currentPage>3)pages.push('...');for(let i=Math.max(2,currentPage-1);i<=Math.min(totalPages-1,currentPage+1);i++)pages.push(i);if(currentPage<totalPages-2)pages.push('...');pages.push(totalPages);}
  pages.forEach(p=>{if(p==='...')html+=`<span class="page-info">...</span>`;else html+=`<button class="page-btn ${p===currentPage?'active':''}" onclick="goPage(${p})">${p}</button>`;});
  html+=`<button class="page-btn" ${currentPage===totalPages?'disabled':''} onclick="goPage(${currentPage+1})">下一页 ▸</button>`;
  c.innerHTML=html;
}
window.goPage=function(p){currentPage=p;renderSongList();document.getElementById('songList').scrollTop=0;};

function renderFrequent(){
  const q=document.getElementById('freqSearch').value.toLowerCase();
  let list=SONGS.filter(s=>s.count>=5);
  if(q)list=list.filter(s=>s.name.toLowerCase().includes(q)||s.artist.toLowerCase().includes(q));
  list.sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,'zh'));
  document.getElementById('freqList').innerHTML=list.map((s,i)=>{
    const transInfo=s.translated?`<small>${s.translated}</small>`:'';
    const dateStr=s.first===s.last?(s.first||'—'):`${s.first||'—'} ~ ${s.last||'—'}`;
    return`<div class="song-row tier-frequent ${i<10?'top10-row':''}"><span class="idx">${i<10?'★':''}${i+1}</span>
      ${playBtnHTML(s)}<span class="name">${s.name}${transInfo}</span><span class="artist">${s.artist||'—'}</span>
      <span class="lang"><span class="lang-badge lang-${s.lang}">${s.lang}</span></span>
      <span class="count">${s.count}</span><span class="dates">${dateStr}</span></div>`;
  }).join('');
}

function renderByLang(){
  const c=document.getElementById('langContent');
  const order=['中文','日语','英文','韩语','其他'];
  const colors={'中文':'#e74c3c','日语':'#f39c12','英文':'#3498db','韩语':'#9b59b6','中英混合':'#1abc9c','其他':'var(--text-dim)'};
  // Quick nav
  let nav='<div class="lang-quick-nav">';
  order.forEach(lang=>{
    const cnt=SONGS.filter(s=>s.lang===lang).length;
    if(cnt)nav+=`<a href="#lang-${lang}" style="border-color:${colors[lang]};color:${colors[lang]==='var(--text-dim)'?'var(--text-dim)':colors[lang]}">${lang}<span class="nav-count">${cnt}</span></a>`;
  });
  nav+='</div>';
  let html=nav;
  order.forEach(lang=>{
    const songs=SONGS.filter(s=>s.lang===lang).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,'zh'));
    if(!songs.length)return;
    html+=`<div class="lang-section" id="lang-${lang}"><div class="lang-header" style="color:${colors[lang]}">${lang}<span class="count-tag">${songs.length} 首</span></div>`;
    songs.forEach((s,i)=>{
      html+=`<div class="song-row tier-${s.count>=5?'frequent':(s.count>=2?'occasional':'rare')}" style="grid-template-columns:46px 1fr 100px 60px 80px;">
        <span class="idx">${i+1}</span><span class="name">${s.name}</span><span class="artist">${s.artist||'—'}</span>
        <span class="count">${s.count}</span><span class="dates">${s.first||'—'}</span></div>`;
    });
    html+='</div>';
  });
  c.innerHTML=html;
}

function renderByArtist(){
  const q=document.getElementById('artistSearch').value.toLowerCase();
  const am={};
  SONGS.forEach(s=>{const a=s.artist||'未知';if(!am[a])am[a]=[];am[a].push(s);});
  let entries=Object.entries(am).map(([name,songs])=>({name,songs:songs.sort((a,b)=>b.count-a.count),total:songs.reduce((sum,s)=>sum+s.count,0)})).sort((a,b)=>b.songs.length-a.songs.length||b.total-a.total);
  if(q)entries=entries.filter(e=>e.name.toLowerCase().includes(q));
  const c=document.getElementById('artistGrid');
  c.innerHTML=entries.slice(0,100).map(e=>{
    const tags=e.songs.slice(0,5).map(s=>`<span>${s.name}${s.count>1?' ×'+s.count:''}</span>`).join('');
    const more=e.songs.length>5?`<span>+${e.songs.length-5}</span>`:'';
    return`<div class="artist-card"><div class="artist-name">${e.name}</div><div class="artist-meta">${e.songs.length} 首 · ${e.total} 次演唱</div><div class="artist-songs">${tags}${more}</div></div>`;
  }).join('');
  if(entries.length>100)c.innerHTML+=`<div style="grid-column:1/-1;text-align:center;font-family:var(--font-m);color:var(--text-dim);padding:20px;">> 显示前 100 位（共 ${entries.length} 位原唱）</div>`;
}

// ═══════ BLIND BOX ═══════
function bindBlindBox(){
  const overlay=document.getElementById('bbOverlay');
  const drawBtn=document.getElementById('bbDrawBtn');
  const closeBtn=document.getElementById('bbClose');
  const slotInner=document.getElementById('bbSlotInner');
  const resultEl=document.getElementById('bbResult');
  const confettiEl=document.getElementById('bbConfetti');
  let isDrawing=false;

  document.getElementById('blindboxBtn').addEventListener('click',()=>{
    overlay.classList.add('show');
    resultEl.classList.remove('show');
    slotInner.innerHTML='';
    confettiEl.innerHTML='';
    drawBtn.disabled=false;
    // Pre-fill slot with random songs
    const shuffled=[...SONGS].sort(()=>Math.random()-.5).slice(0,20);
    slotInner.innerHTML=shuffled.map(s=>`<div class="bb-slot-item">${s.name}</div>`).join('');
  });

  closeBtn.addEventListener('click',()=>overlay.classList.remove('show'));
  overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.classList.remove('show');});

  drawBtn.addEventListener('click',()=>{
    if(isDrawing)return;
    isDrawing=true;
    drawBtn.disabled=true;
    resultEl.classList.remove('show');
    confettiEl.innerHTML='';

    // Pick random song
    const picked=SONGS[Math.floor(Math.random()*SONGS.length)];

    // Build slot reel: 40 random items + picked at end
    const reel=[];
    for(let i=0;i<40;i++)reel.push(SONGS[Math.floor(Math.random()*SONGS.length)]);
    reel.push(picked);

    slotInner.innerHTML=reel.map(s=>`<div class="bb-slot-item">${s.name}</div>`).join('');
    slotInner.style.transition='none';
    slotInner.style.transform='translateY(0)';

    // Animate
    requestAnimationFrame(()=>{
      requestAnimationFrame(()=>{
        const targetY=-(reel.length-1)*60;
        slotInner.style.transition='transform 3s cubic-bezier(0.15,0.8,0.3,1)';
        slotInner.style.transform=`translateY(${targetY}px)`;
      });
    });

    // Show result after animation
    setTimeout(()=>{
      // Glow burst
      const burst=document.createElement('div');
      burst.className='bb-glow-burst';
      document.querySelector('.bb-body').appendChild(burst);
      setTimeout(()=>burst.remove(),1000);

      // Confetti
      const colors=['#FF00FF','#00FFFF','#FF9900','#e74c3c','#f39c12','#9b59b6'];
      for(let i=0;i<40;i++){
        const piece=document.createElement('div');
        piece.className='bb-confetti-piece';
        piece.style.left=Math.random()*100+'%';
        piece.style.background=colors[Math.floor(Math.random()*colors.length)];
        piece.style.animationDelay=Math.random()*0.5+'s';
        piece.style.borderRadius=Math.random()>.5?'50%':'0';
        piece.style.width=(4+Math.random()*8)+'px';
        piece.style.height=(4+Math.random()*8)+'px';
        confettiEl.appendChild(piece);
      }

      // Show result
      document.getElementById('bbResultName').textContent=picked.name;
      const tier=picked.count>=5?'常唱':(picked.count>=2?'偶尔':'稀有');
      document.getElementById('bbResultMeta').textContent=`${picked.artist||'—'} · ${picked.lang} · ${tier}`;
      document.getElementById('bbResultCount').textContent=`演唱 ${picked.count} 次${picked.last?' · 最近 '+picked.last:''}`;
      // Play button
      const bbPlay=document.getElementById('bbPlayBtn');
      if(picked.bili&&picked.bili.length){
        bbPlay.style.display='';bbPlay.className='bb-play-btn';
        bbPlay.textContent='▶ 播放这首歌';
        bbPlay.onclick=function(){overlay.classList.remove('show');openPlayer(picked,0);};
      }else{
        bbPlay.style.display='';bbPlay.className='bb-play-btn search';
        bbPlay.textContent='↗ 在B站搜索';
        bbPlay.onclick=function(){
          const url='https://search.bilibili.com/all?keyword='+encodeURIComponent('岁己SUI '+picked.name+' 歌切');
          const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener';document.body.appendChild(a);a.click();a.remove();
        };
      }
      resultEl.classList.add('show');

      isDrawing=false;
      drawBtn.disabled=false;
    },3200);
  });
}

// ═══════ EVENTS ═══════
function bindEvents(){
  document.querySelectorAll('.section-tab').forEach(tab=>{
    tab.addEventListener('click',()=>{
      document.querySelectorAll('.section-tab').forEach(t=>t.classList.remove('active'));
      tab.classList.add('active');currentSection=tab.dataset.section;
      document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
      document.getElementById('sec-'+currentSection).classList.add('active');
      if(currentSection==='frequent')renderFrequent();
      if(currentSection==='lang')renderByLang();
      if(currentSection==='artist')renderByArtist();
      if(currentSection==='all')renderSongList();
    });
  });

  // Quick filters
  document.querySelectorAll('[data-quick]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      document.querySelectorAll('[data-quick]').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      currentQuick=btn.dataset.quick;
      currentPage=1;renderSongList();
    });
  });
  // Activate "all" by default
  document.querySelector('[data-quick="all"]').classList.add('active');

  let debounce;
  document.getElementById('searchInput').addEventListener('input',e=>{
    clearTimeout(debounce);debounce=setTimeout(()=>{searchQuery=e.target.value.trim();currentPage=1;renderSongList();},200);
  });
  document.getElementById('freqSearch').addEventListener('input',()=>renderFrequent());
  document.getElementById('artistSearch').addEventListener('input',()=>renderByArtist());
  document.getElementById('sortSelect').addEventListener('change',e=>{currentSort=e.target.value;currentPage=1;renderSongList();});
  window.addEventListener('scroll',()=>{document.getElementById('backTop').classList.toggle('visible',window.scrollY>400);});
}

init();
</script>
</body>
</html>'''

out = os.path.join(PROJECT_ROOT, 'docs', 'index.html')
with open(out, 'w', encoding='utf-8') as f:
    f.write(html)
print(f'Written: {out}')
print(f'Size: {os.path.getsize(out)/1024:.1f} KB')
