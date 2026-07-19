"""
Bilibili Playlist Scraper (cookie-free by default)

B站歌单列表对"已登录"和"无登录的普通浏览器"都开放。
之前失败是因为 headless 被识别成自动化脚本、返回了登录墙。
解决办法：隐藏 navigator.webdriver + 使用真实 UA，无 cookie 也能正常抓取。

COOKIE 现在是可选的：仅在设置了 BILI_COOKIE 环境变量（或传入 --cookie）时才带上，
用于加速或访问私有列表；不设置也能跑。

Usage:
    # 无 cookie（推荐，普通浏览器即可访问）
    python scrape_bilibili_playlist.py "<playlist_url>?type=season" [--max-pages N]
    # 带 cookie（可选）
    BILI_COOKIE="SESSDATA=...; ..." python scrape_bilibili_playlist.py "<url>?type=season"
"""
import asyncio
import os
import re
import sys
from playwright.async_api import async_playwright

# 真实桌面浏览器 UA，避免被识别为 bot
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")


async def scrape(url: str, cookie_str: str = None, max_pages: int = 3) -> list:
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
        browser = await p.chromium.launch(
            headless=True,
            args=["--disable-blink-features=AutomationControlled", "--no-sandbox"],
        )
        context = await browser.new_context(
            user_agent=UA,
            viewport={'width': 1721, 'height': 1305},
            locale='zh-CN',
        )
        # 关键：隐藏 webdriver 标记，让 B站当成普通浏览器
        await context.add_init_script(
            "Object.defineProperty(navigator, 'webdriver', {get: () => undefined});"
        )
        if cookies:
            await context.add_cookies(cookies)
        page = await context.new_page()

        print(f'Loading {url} (cookie={"yes" if cookies else "NO"}) ...')
        await page.goto(url, wait_until='domcontentloaded', timeout=60000)
        # 等歌切链接真实渲染出来（SPA 不保证 networkidle）
        try:
            await page.wait_for_selector('a[href*="/video/BV"]', timeout=30000)
        except Exception as e:
            print('WARN: 30s 内未出现歌切链接，可能仍被挡：', e)
        await page.wait_for_timeout(3000)

        # 点击"倒序排序"，让最新歌切出现在第 1 页
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
        print('Usage: python scrape_bilibili_playlist.py "<url>?type=season" [--max-pages N] [--cookie "..."]')
        sys.exit(1)
    url = sys.argv[1]
    cookie_str = os.environ.get('BILI_COOKIE', '')
    max_pages = 3
    if '--max-pages' in sys.argv:
        max_pages = int(sys.argv[sys.argv.index('--max-pages') + 1])
    if '--cookie' in sys.argv:
        cookie_str = sys.argv[sys.argv.index('--cookie') + 1]
    vids = asyncio.run(scrape(url, cookie_str, max_pages))
    print(f'\n=== Total unique videos: {len(vids)} ===')
    for v in vids:
        print(f"{v['bvid']} | {v['title']}")


if __name__ == '__main__':
    main()
