import asyncio, json, sys
from playwright.async_api import async_playwright
sys.path.insert(0, 'test'); from d3dpow import PATCH
PAGE = sys.argv[1]; OUT = sys.argv[2]; NOSAN = len(sys.argv) > 3
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'])
        ctx = await b.new_context(viewport={'width': 300, 'height': 640}, device_scale_factor=1)
        await ctx.add_init_script(PATCH + ("\nwindow.__noSanitize = true;" if NOSAN else ""))
        pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'ERR_' not in m.text else None)
        await pg.goto(f'http://localhost:8765/{PAGE}')
        await pg.wait_for_function('window.__ready === true', timeout=120000)
        await pg.evaluate("() => localStorage.setItem('swordsong.learned', 'true')")
        await pg.click('#btn-start')
        await pg.wait_for_function('__game.state === "play"', timeout=60000)
        await pg.evaluate("() => { __game.hurtPlayer = () => {}; __game.dtMax = 0.25; }")
        await pg.evaluate("() => __game.debugJump(72)")
        ns = open('test/nanscan.js').read().strip(); await pg.evaluate(ns)
        await pg.wait_for_timeout(13000)
        await pg.screenshot(path=f'test/{OUT}_a.png')
        await pg.evaluate("() => { const g = __game; g.boss.seals.forEach(s => g.enemies.damage(s, 99, g)); }")
        await pg.wait_for_timeout(6000)
        await pg.screenshot(path=f'test/{OUT}_b.png')
        await pg.evaluate("() => { const g = __game; g.enemies.damage(g.boss.heartE, 99, g); }")
        await pg.wait_for_timeout(7000)
        await pg.screenshot(path=f'test/{OUT}_c.png')
        nan = await pg.evaluate('() => window.__nan')
        await b.close()
        print(json.dumps(nan), errs[:3])
asyncio.run(main())
