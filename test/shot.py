import sys, asyncio, json
from playwright.async_api import async_playwright

# usage: shot.py url out.png width height [frames] [jsBefore]
async def main():
    url, out = sys.argv[1], sys.argv[2]
    W, H = int(sys.argv[3]), int(sys.argv[4])
    frames = int(sys.argv[5]) if len(sys.argv) > 5 else 3
    js = sys.argv[6] if len(sys.argv) > 6 else ''
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=[
            '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl',
            '--autoplay-policy=no-user-gesture-required'])
        pg = await b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=1)
        logs = []
        pg.on('console', lambda m: logs.append(f'[{m.type}] {m.text}'))
        pg.on('pageerror', lambda e: logs.append(f'[pageerror] {e}'))
        await pg.goto(url)
        try:
            await pg.wait_for_function('window.__ready === true', timeout=60000)
        except Exception as e:
            logs.append('TIMEOUT waiting ready: ' + str(e))
        if js:
            try:
                r = await pg.evaluate(js)
                if r is not None: logs.append('eval: ' + json.dumps(r)[:2000])
            except Exception as e:
                logs.append('eval error: ' + str(e))
        for i in range(frames):
            try:
                await pg.evaluate('window.__frame && window.__frame()')
            except Exception as e:
                logs.append('frame error: ' + str(e)); break
        await pg.screenshot(path=out)
        await b.close()
        print('\n'.join(logs[-60:]))

asyncio.run(main())
