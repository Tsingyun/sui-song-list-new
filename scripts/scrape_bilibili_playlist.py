"""
Bilibili Playlist Scraper
Extracts video BV numbers, titles from a B站 user's playlist/collection page.
Uses Playwright headless browser to handle SPA JavaScript rendering.

Usage:
    python scrape_bilibili_playlist.py "https://space.bilibili.com/9669499/lists/6453496"
"""

import asyncio
import re
import sys
from playwright.async_api import async_playwright


async def scrape_playlist(url: str) -> list[dict]:
    """
    Navigate to a B站 playlist, go to the last page, and extract video data.

    Returns:
        List of dicts with keys: bvid, title
    """
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={'width': 1920, 'height': 1080})

        print(f'Loading {url}...')
        await page.goto(url, wait_until='networkidle', timeout=30000)
        await page.wait_for_timeout(2000)

        # Go to last page by clicking the highest-numbered page button
        page_num = await page.evaluate('''() => {
            const btns = document.querySelectorAll('.vui_button');
            let maxNum = 0;
            let targetBtn = null;
            btns.forEach(b => {
                const num = parseInt(b.textContent.trim());
                if (!isNaN(num) && num > maxNum) {
                    maxNum = num;
                    targetBtn = b;
                }
            });
            if (targetBtn) {
                targetBtn.click();
                return maxNum;
            }
            return 0;
        }''')

        if page_num == 0:
            print('ERROR: Could not find pagination')
            await browser.close()
            return []

        print(f'Navigated to last page (page {page_num})')
        await page.wait_for_timeout(3000)

        # Extract unique video entries (deduplicate by BV number)
        videos = await page.evaluate('''() => {
            const seen = new Set();
            const results = [];
            document.querySelectorAll('a[href*="/video/BV"]').forEach(a => {
                const href = a.getAttribute('href');
                const text = a.textContent.trim();
                const bvMatch = href.match(/BV[a-zA-Z0-9]{10}/);
                if (bvMatch && !seen.has(bvMatch[0]) && text.includes('【')) {
                    seen.add(bvMatch[0]);
                    results.push({bvid: bvMatch[0], title: text});
                }
            });
            return results;
        }''')

        await browser.close()
        return videos


def main():
    if len(sys.argv) < 2:
        print('Usage: python scrape_bilibili_playlist.py <playlist_url>')
        print('Example: python scrape_bilibili_playlist.py "https://space.bilibili.com/9669499/lists/6453496"')
        sys.exit(1)

    url = sys.argv[1]
    videos = asyncio.run(scrape_playlist(url))

    print(f'\n=== Last page videos ({len(videos)}) ===')
    for v in videos:
        print(f'{v["bvid"]} | {v["title"]}')

    if not videos:
        print('No videos found. The playlist may be empty or require authentication.')


if __name__ == '__main__':
    main()
