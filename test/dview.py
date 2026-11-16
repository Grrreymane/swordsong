import sys, asyncio, json
from playwright.async_api import async_playwright
from PIL import Image
# usage: dview.py out.png W H '[["side", {...}], ...]'   -> tiles all views into one image (2 columns)
async def main():
    out, W, H = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
    views = json.loads(sys.argv[4])
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        pg = await b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=1)
        logs = []
        pg.on('console', lambda m: logs.append(f'[{m.type}] {m.text}') if m.type in ('error', 'warning') else None)
        pg.on('pageerror', lambda e: logs.append(f'[pageerror] {e}'))
        await pg.goto('http://localhost:8765/dview.html')
        await pg.wait_for_function('window.__ready === true', timeout=60000)
        ims = []
        for i, (v, o) in enumerate(views):
            r = await pg.evaluate(f'() => render({json.dumps(v)}, {json.dumps(o)})')
            await pg.wait_for_timeout(100)
            f = f'/tmp/dv_{i}.png'
            await pg.screenshot(path=f); ims.append(Image.open(f).convert('RGB'))
        await b.close()
        cols = 2 if len(ims) > 1 else 1
        rows = (len(ims) + cols - 1) // cols
        grid = Image.new('RGB', (W * cols, H * rows))
        for i, im in enumerate(ims): grid.paste(im, ((i % cols) * W, (i // cols) * H))
        grid.save(out)
        print('\n'.join(logs[:20]))
asyncio.run(main())
