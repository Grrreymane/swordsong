import asyncio, json, base64, sys
from playwright.async_api import async_playwright
async def main():
    secs = json.loads(sys.argv[1]); sfx = sys.argv[2] == '1'; out = sys.argv[3]
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await b.new_page()
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8765/audiotest.html')
        await pg.wait_for_function('window.__ready === true', timeout=60000)
        r = await pg.evaluate(f'async () => await __renderAudio({json.dumps(secs)}, {str(sfx).lower()})')
        open(out, 'wb').write(base64.b64decode(r['wav']))
        print('peak', r['peak'], 'marks', r['marks']); print('rms/peak per s', r['rms']); print('errors', errs)
        await b.close()
asyncio.run(main())
