import asyncio, json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await b.new_page(); await pg.goto('http://localhost:8765/audiotest.html')
        await pg.wait_for_function('window.__ready === true', timeout=60000)
        r = await pg.evaluate('async () => await __pitchTest([35, 47, 59, 62, 69, 71, 76, 81, 83, 86, 90, 93])')
        for row in r: print(row)
        await b.close()
asyncio.run(main())
