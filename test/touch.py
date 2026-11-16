import asyncio, json
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'])
        ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=1, has_touch=True, is_mobile=True)
        pg = await ctx.new_page()
        logs = []
        pg.on('pageerror', lambda e: logs.append(f'[pageerror] {e}'))
        pg.on('console', lambda m: logs.append(f'[{m.type}] {m.text}') if m.type == 'error' and 'ERR_TUNNEL' not in m.text and '404' not in m.text else None)
        await pg.goto('http://localhost:8765/index.html')
        await pg.wait_for_function('window.__ready === true', timeout=90000)
        await pg.wait_for_timeout(2000)
        await pg.tap('#btn-start')
        await pg.wait_for_function('__game.state === "play"', timeout=60000)
        await pg.evaluate('() => { __game.hurtPlayer = () => {}; }')
        await pg.wait_for_timeout(9000)
        cdp = await ctx.new_cdp_session(pg)
        info = await pg.evaluate('() => ({isTouch: matchMedia("(pointer: coarse)").matches, rx: __game.rx, ry: __game.ry, targets: __game.enemies.list.filter(e => e.alive && e.onScreen).map(e => [Math.round(e.sx), Math.round(e.sy)])})')
        logs.append('before: ' + json.dumps(info))
        x, y = 195, 700
        await cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x, 'y': y, 'id': 1}]})
        for i in range(14):
            x += (-6 if i < 7 else 6) * 3
            y -= 4
            await cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': x, 'y': y, 'id': 1}]})
            await pg.wait_for_timeout(250)
        mid = await pg.evaluate('() => ({holding: __game.holding, locks: __game.locks.length, rx: Math.round(__game.rx), ry: Math.round(__game.ry), pid: __game.pid})')
        logs.append('mid: ' + json.dumps(mid))
        await pg.screenshot(path='test/t_mid.png')
        await cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
        await pg.wait_for_timeout(300)
        after = await pg.evaluate('() => ({holding: __game.holding, queue: __game.queue.length, locks: __game.locks.length})')
        logs.append('after: ' + json.dumps(after))
        # two-finger tap for OD
        await pg.evaluate('() => { __game.od = 2; __game.hud.setOD(2, false); }')
        await cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': 100, 'y': 600, 'id': 1}]})
        await cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': 100, 'y': 600, 'id': 1}, {'x': 250, 'y': 600, 'id': 2}]})
        await cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
        await pg.wait_for_timeout(500)
        od = await pg.evaluate('() => ({odActive: __game.odActive, od: __game.od})')
        logs.append('od: ' + json.dumps(od))
        await b.close()
        print('\n'.join(logs))

asyncio.run(main())
