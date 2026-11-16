# 剑歌行 · Swordsong

水墨仙侠御剑音游，竖屏为主，横屏也能玩。手机和 PC 都能玩，操作不靠任何文字引导。题眼是“一剑一音，万剑成歌”。
three.js r170 + Web Audio，用 esbuild 打包成一个 HTML。

## 直接玩
`dist/` 就是可以直接上线的版本：`dist/index.html` 加 `dist/music/` 下的 5 首 MP3。两者要放在同一目录，并通过 http(s) 打开（直接双击本地文件时，浏览器不允许读取音乐）。

```bash
cd dist && python3 -m http.server 8765   # 然后打开 http://localhost:8765
```

## 构建
```bash
npm install
node build.mjs src/main.js   # 生成 dist/index.html
```

## 目录
- `src/`：游戏源码。main.js（流程、输入、判定）、audio.js（速度表音频引擎、合成音色、龙吟）、boss.js / dragon.js（终章的龙）、enemies.js、level.js（谱面）、world.js、post.js（后期，含 NaN 清洗）、tracks.js（自动生成的曲目清单）。
- `tools/`：配乐流水线。`analyze.py` 分析曲子，`build_tracks.py tools/tracks.config.json` 负责剪切、做循环、编码 MP3 并生成 `src/tracks.js`。
- `test/`：无头浏览器测试脚本（Playwright）。包括机器人通关、NaN / 黑框扫描、看龙工具 `dview.js` 等。
- `docs/剑歌行.md`：设计与技术文档。

## 单文件版
`dist/swordsong-single.html`（约 9 MB）把音乐以 base64 内嵌在页面里，一个文件就能在任何地方打开游玩，适合只接受单个 HTML 的平台。重新生成：`node build.mjs src/main.js --single`。

## 授权
- **代码**（src/、tools/、test/ 及构建脚本）：MIT。
- **音乐不在 MIT 授权范围内**，各曲按原作者的条款随本游戏使用：
  - Lotus Pond、Dragon Dance：BiteMe Games《Chinese Game Music》，CC0。
  - 从此江渚春水尽、姽婳剑歌：乌鸦Producer《Crow's Free Commercial Music Pack ⑥ Chinese style music Pack》。可免费商用，须署名，不得转卖曲子。这两首只随本游戏分发，请勿从本仓库单独提取、转卖或作为音乐素材再分发。如需使用，请到原作者处获取。

Music by 乌鸦Producer · BiteMe Games
