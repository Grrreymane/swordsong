# Real PC input via CDP: (1) hold the left button and sweep through targets, (2) aim with the mouse and tap Z on the beat.
import asyncio, json, sys, time
from playwright.async_api import async_playwright
W, H = 1280, 720
Q = '''() => { const g = __game; const now = g.audio.heard(); const out = [];
  for (const e of g.enemies.list) { if (!e.alive || !e.onScreen || !e.lockable || !e.nt || e.ni >= e.nt.length) continue;
    out.push({T: e.nt[e.ni], x: e.sx, y: e.sy, sealed: e.sealTo > e.ni}); }
  out.sort((a, b) => a.T - b.T); return {now, out, st: g.stats, combo: g.combo, ptrs: g.ptrs.size}; }'''
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'])
        ctx = await b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=1)
        pg = await ctx.new_page(); logs = []
        pg.on('pageerror', lambda e: logs.append(f'[pageerror] {e}'))
        await pg.goto('http://localhost:8765/index.html')
        await pg.wait_for_function('window.__ready === true', timeout=90000)
        await pg.evaluate("() => { localStorage.setItem('swordsong.learned', 'true'); }")
        await pg.click('#btn-start')
        await pg.wait_for_function('__game.state === "play"', timeout=60000)
        await pg.evaluate("() => { __game.post.render = () => {}; __game.hurtPlayer = () => {}; __game.debugJump(1); window.__errLog = []; }")
        cdp = await ctx.new_cdp_session(pg)
        mx, my = W / 2, H / 2
        async def move(x, y, buttons):
            await cdp.send('Input.dispatchMouseEvent', {'type': 'mouseMoved', 'x': x, 'y': y, 'buttons': buttons, 'button': 'left' if buttons else 'none'})
        # ---- 1) sweep with the button held
        await move(mx, my, 0)
        await cdp.send('Input.dispatchMouseEvent', {'type': 'mousePressed', 'x': mx, 'y': my, 'button': 'left', 'buttons': 1, 'clickCount': 1})
        t_end = time.time() + 45
        while time.time() < t_end:
            q = await pg.evaluate(Q)
            tg = [o for o in q['out'] if not o['sealed']]
            if not tg: await asyncio.sleep(0.05); continue
            o = tg[0]
            for k in range(1, 7):
                x = mx + (o['x'] - mx) * k / 6; y = my + (o['y'] - my) * k / 6
                await move(x, y, 1); await asyncio.sleep(0.016)
            mx, my = o['x'], o['y']
        q = await pg.evaluate(Q); logs.append(f"after sweep: st={json.dumps(q['st'])} combo={q['combo']} ptrs={q['ptrs']}")
        await cdp.send('Input.dispatchMouseEvent', {'type': 'mouseReleased', 'x': mx, 'y': my, 'button': 'left', 'buttons': 0, 'clickCount': 1})
        await asyncio.sleep(0.3)
        q = await pg.evaluate(Q); logs.append(f"released: ptrs={q['ptrs']}")
        base = dict(q['st'])
        # ---- 2) aim with the mouse, tap Z on the beat
        t_end = time.time() + 40; done = set(); presses = 0
        while time.time() < t_end:
            q = await pg.evaluate(Q)
            tg = [o for o in q['out'] if not o['sealed'] and round(o['T'], 3) not in done and o['T'] > q['now'] - 0.05]
            if not tg: await asyncio.sleep(0.03); continue
            o = tg[0]; wait = o['T'] - q['now']
            if wait > 0.5: await move(o['x'], o['y'], 0); await asyncio.sleep(min(0.25, wait - 0.4)); continue
            await move(o['x'], o['y'], 0)
            q2 = await pg.evaluate(Q)
            w2 = o['T'] - q2['now']
            if w2 > 0: await asyncio.sleep(w2)
            await cdp.send('Input.dispatchKeyEvent', {'type': 'keyDown', 'code': 'KeyZ', 'key': 'z', 'windowsVirtualKeyCode': 90})
            await asyncio.sleep(0.04)
            await cdp.send('Input.dispatchKeyEvent', {'type': 'keyUp', 'code': 'KeyZ', 'key': 'z', 'windowsVirtualKeyCode': 90})
            done.add(round(o['T'], 3)); presses += 1
        q = await pg.evaluate(Q)
        st = q['st']; d = {k: st[k] - base.get(k, 0) for k in ('j3', 'j2', 'j1', 'miss')}
        errs = await pg.evaluate('() => window.__errLog.slice(-20)')
        logs.append(f"keys: presses={presses} delta={json.dumps(d)} errs={errs}")
        await b.close()
        print('\n'.join(logs))
asyncio.run(main())
