import sys, asyncio, json, time
from playwright.async_api import async_playwright
# usage: fullrun.py BOT.js OUTPREFIX [timeout_s]   -> plays the whole game with a bot, polls until results
async def main():
    bot, pre = sys.argv[1], sys.argv[2]
    tmax = int(sys.argv[3]) if len(sys.argv) > 3 and sys.argv[3].isdigit() else 900
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'])
        vw = [a for a in sys.argv if a.startswith('--vp=')]; VW, VH = map(int, vw[0][5:].split('x')) if vw else (390, 844)
        pg = await b.new_page(viewport={'width': VW, 'height': VH}, device_scale_factor=1)
        logs = []
        pg.on('console', lambda m: logs.append(f'[{m.type}] {m.text}') if m.type in ('error',) and 'ERR_' not in m.text and '404' not in m.text else None)
        pg.on('pageerror', lambda e: logs.append(f'[pageerror] {e}'))
        await pg.goto('http://localhost:8765/index.html')
        await pg.wait_for_function('window.__ready === true', timeout=120000)
        if '--learned' in sys.argv: await pg.evaluate("() => localStorage.setItem('swordsong.learned', 'true')")
        await pg.click('#btn-start')
        await pg.wait_for_function('window.__game && __game.state === "play"', timeout=60000)
        await pg.evaluate("() => { __game.hurtPlayer = () => {}; __game.dtMax = 0.25; return true; }")
        print('bot:', await pg.evaluate(open(bot).read().strip()), flush=True)
        if '--spy' in sys.argv: print('spy:', await pg.evaluate(open('/tmp/missspy.js').read().strip()), flush=True)
        jp = [a for a in sys.argv if a.startswith('--jump=')]
        if jp: await pg.evaluate(f"() => __game.debugJump({int(jp[0][7:])})")
        t0 = time.time(); shots = set()
        while time.time() - t0 < tmax:
            await pg.wait_for_timeout(10000)
            r = await pg.evaluate("() => { const g = __game; return {t: Math.round(performance.now()/1000), bar: g.bar, state: g.state, phase: g.boss.phase, hp: g.boss.hpFrac && g.boss.hpFrac(), st: g.stats, maxCombo: g.maxCombo, acc: +g.accuracy().toFixed(3), song: g.audio.song}; }")
            print(json.dumps(r), flush=True)
            ph = r.get('phase')
            if ph and ph not in shots and r['state'] == 'play':
                shots.add(ph); await pg.screenshot(path=f'test/{pre}_p{ph}.png')
            if r['state'] == 'results':
                await pg.wait_for_timeout(1500); await pg.screenshot(path=f'test/{pre}_results.png'); break
        if '--spy' in sys.argv: print('misses:', json.dumps(await pg.evaluate('() => window.__misses')))
        await b.close()
        print('\n'.join(logs[:30]))
asyncio.run(main())
