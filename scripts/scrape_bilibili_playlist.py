"""
Bilibili Playlist Scraper (rewritten)
Extracts video BV numbers + titles from a B站 user's playlist/collection page,
with login cookie support, reverse-sort toggle, and <img alt> title extraction.

Usage:
    set BILI_COOKIE="SESSDATA=...; bili_jct=...; ..."   (env)
    python scrape_bilibili_playlist.py "<playlist_url>?type=season" [--max-pages N]
"""
import asyncio
import os
import re
import sys
from playwright.async_api import async_playwright


async def scrape(url: str, cookie_str: str, max_pages: int) -> list:
    cookies = []
    if cookie_str:
        for pair in cookie_str.split(';'):
            pair = pair.strip()
            if not pair or '=' not in pair:
                continue
            k, v = pair.split('=', 1)
            cookies.append({
                'name': k.strip(),
                'value': v.strip(),
                'domain': '.bilibili.com',
                'path': '/',
            })

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={'width': 1920, 'height': 1080})
        if cookies:
            await context.add_cookies(cookies)
        page = await context.new_page()

        print(f'Loading {url} ...')
        await page.goto(url, wait_until='networkidle', timeout=45000)
        await page.wait_for_timeout(3000)

        # Click "倒序排序" (reverse sort) so newest clips appear on page 1
        try:
            await page.click('.sort-mode', timeout=8000)
            await page.wait_for_selector('.menu-popover__panel-item', timeout=8000)
            items = page.locator('.menu-popover__panel-item')
            clicked = False
            for i in range(await items.count()):
                t = (await items.nth(i).inner_text()).strip()
                if '倒序' in t:
                    await items.nth(i).click()
                    clicked = True
                    break
            print('reverse-sort toggle:', 'clicked' if clicked else 'NOT FOUND')
        except Exception as e:
            print('sort toggle error:', e)
        await page.wait_for_timeout(4000)

        all_videos = []
        seen = set()
        for pg in range(1, max_pages + 1):
            vids = await page.evaluate('''() => {
                const seen = new Set(); const res = [];
                document.querySelectorAll('a[href*="/video/BV"]').forEach(a => {
                    const href = a.getAttribute('href') || '';
                    const m = href.match(/BV[a-zA-Z0-9]{10}/);
                    const img = a.querySelector('img');
                    const alt = img ? img.getAttribute('alt') : '';
                    const text = a.textContent;
                    let dur = '';
                    const dm = text.match(/(\\d{1,2}):(\\d{2})/);
                    if (dm) dur = dm[1] + ':' + dm[2];
                    if (m && !seen.has(m[0])) {
                        seen.add(m[0]);
                        res.push({bvid: m[0], title: (alt || text).trim(), duration: dur});
                    }
                });
                return res;
            }''')
            for v in vids:
                if v['bvid'] not in seen:
                    seen.add(v['bvid'])
                    all_videos.append(v)
            print(f'page {pg}: {len(vids)} links (cumulative {len(all_videos)})')
            if pg < max_pages:
                try:
                    nxt = page.locator('.vui_button', has_text='下一页')
                    if await nxt.count() > 0:
                        await nxt.first.click()
                        await page.wait_for_timeout(3000)
                    else:
                        print('no next-page button, stop')
                        break
                except Exception as e:
                    print('pagination error:', e)
                    break

        await browser.close()
        return all_videos


def main():
    if len(sys.argv) < 2:
        print('Usage: python scrape_bilibili_playlist.py "<url>?type=season" [--max-pages N]')
        sys.exit(1)
    url = sys.argv[1]
    cookie_str = os.environ.get('BILI_COOKIE', '')
    max_pages = 3
    if '--max-pages' in sys.argv:
        max_pages = int(sys.argv[sys.argv.index('--max-pages') + 1])
    vids = asyncio.run(scrape(url, cookie_str, max_pages))
    print(f'\n=== Total unique videos: {len(vids)} ===')
    for v in vids:
        print(f"{v['bvid']} | {v['title']}")


if __name__ == '__main__':
    main()
