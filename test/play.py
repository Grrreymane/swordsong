import sys, asyncio, json, time
from playwright.async_api import async_playwright

# usage: play.py W H outprefix scenario
async def main():
    W, H = int(sys.argv[1]), int(sys.argv[2])
    pre = sys.argv[3]
    scen = sys.argv[4] if len(sys.argv) > 4 else 'basic'
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=[
            '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
            '--autoplay-policy=no-user-gesture-required'])
        pg = await b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=1)
        logs = []
        pg.on('console', lambda m: logs.append(f'[{m.type}] {m.text}') if m.type in ('error', 'warning', 'log') and 'GPU stall' not in m.text and 'ERR_TUNNEL' not in m.text and '404' not in m.text else None)
        pg.on('pageerror', lambda e: logs.append(f'[pageerror] {e}'))
        await pg.goto('http://localhost:8765/index.html')
        try:
            await pg.wait_for_function('window.__ready === true', timeout=90000)
        except Exception as e:
            logs.append('TIMEOUT ready ' + str(e))
        await pg.wait_for_timeout(2500)
        fps = await pg.evaluate('''() => new Promise(r => { let n = 0; const t0 = performance.now(); function f(){ n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else r(n / 2); } requestAnimationFrame(f); })''')
        logs.append(f'fps ~ {fps}')
        await pg.screenshot(path=f'{pre}_title.png')
        if scen == 'title':
            await b.close(); print('\n'.join(logs)); return
        try:
            await pg.click('#btn-start', timeout=4000)
        except Exception:
            await pg.evaluate("document.getElementById('btn-start').click()")
        await pg.wait_for_timeout(1500)
        steps = json.loads(sys.argv[5]) if len(sys.argv) > 5 else []
        for st in steps:
            k = st[0]
            if k == 'wait': await pg.wait_for_timeout(st[1])
            elif k == 'shot': await pg.screenshot(path=f'{pre}_{st[1]}.png')
            elif k == 'eval':
                r = await pg.evaluate(st[1])
                if r is not None: logs.append('eval: ' + json.dumps(r)[:1500])
            elif k == 'sweep':
                # sweep across enemies' screen positions
                pts = await pg.evaluate('() => __game.enemies.list.filter(e => e.alive && e.onScreen).map(e => [e.sx, e.sy])')
                logs.append(f'targets on screen: {len(pts)}')
                if pts:
                    pts.sort(key=lambda q: q[0])
                    await pg.mouse.move(pts[0][0], pts[0][1])
                    await pg.mouse.down()
                    for q in pts[:8]:
                        await pg.mouse.move(q[0], q[1], steps=3)
                        await pg.wait_for_timeout(120)
                    if len(st) > 1: await pg.screenshot(path=f'{pre}_{st[1]}.png')
                    await pg.mouse.up()
            elif k == 'waitplay':
                await pg.wait_for_function('window.__game && __game.state === "play"', timeout=60000)
            elif k == 'mouse':
                await pg.mouse.move(st[1], st[2])
        await b.close()
        print('\n'.join(logs[-80:]))

asyncio.run(main())
