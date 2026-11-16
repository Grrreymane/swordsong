import asyncio, json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'])
        ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=1, has_touch=True, is_mobile=True)
        pg = await ctx.new_page(); logs = []
        pg.on('pageerror', lambda e: logs.append(f'[pageerror] {e}'))
        await pg.goto('http://localhost:8765/index.html')
        await pg.wait_for_function('window.__ready === true', timeout=90000)
        await pg.evaluate("() => { localStorage.setItem('swordsong.learned', 'true'); }")
        try: await pg.tap('#btn-start', timeout=5000)
        except Exception: await pg.evaluate("document.getElementById('btn-start').click()")
        await pg.wait_for_function('__game.state === "play"', timeout=60000)
        await pg.evaluate("() => { __game.post.render = () => {}; __game.hurtPlayer = () => {}; __game.debugJump(13); __game.od = 2; }")
        # wait for the ring of 8 (bar 13) to be on screen
        await pg.wait_for_function("__game.enemies.list.filter(e => e.alive && e.onScreen && e.lockable && e.nt && e.ni < e.nt.length).length >= 4", timeout=30000)
        tg = await pg.evaluate("() => __game.enemies.list.filter(e => e.alive && e.onScreen && e.lockable && e.nt && e.ni < e.nt.length).map(e => ({id: e.id, x: e.sx, y: e.sy, T: e.nt[e.ni] - __game.audio.heard()})).sort((a,b)=>a.x-b.x)")
        a, c = tg[0], tg[-1]
        await pg.evaluate("() => { window.__pe = []; for (const t of ['pointerdown','pointerup','pointercancel']) window.addEventListener(t, e => window.__pe.push([t, e.pointerType, e.pointerId, e.target.id || e.target.className, Math.round(e.clientX), Math.round(e.clientY)]), true); }")
        cdp = await ctx.new_cdp_session(pg)
        await cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': a['x'], 'y': a['y'], 'id': 1}, {'x': c['x'], 'y': c['y'], 'id': 2}]})
        await asyncio.sleep(0.15)
        st = await pg.evaluate(f"() => {{ const g = __game; const f = id => g.enemies.list.find(e => e.id === id); return {{ptrs: g.ptrs.size, sealedA: f({a['id']}).sealTo, sealedC: f({c['id']}).sealTo, od: g.od, odActive: g.odActive, trails: g.trailUse}}; }}")
        logs.append('events: ' + json.dumps(await pg.evaluate('() => window.__pe')))
        logs.append(f"targets dt: {a['T']:.2f}s, {c['T']:.2f}s -> {json.dumps(st)}")
        await cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
        await asyncio.sleep(0.15)
        logs.append('after lift: ' + json.dumps(await pg.evaluate("() => ({ptrs: __game.ptrs.size, holding: __game.holding, trails: __game.trailUse})")))
        await b.close(); print('\n'.join(logs))
asyncio.run(main())
