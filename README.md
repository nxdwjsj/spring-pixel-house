# 春风像素屋 · 项目说明文档

> 更新日期：2026-09-30
> 交付物：`index.html`（单文件，约 1.1MB，零外部依赖）+ `worker.js`（Cloudflare Worker 后端，可选）

---

## 1. 项目目标

打造一个**统一像素游戏风的春日博客**：文章内容是绝对主角，像素动物降级为小装饰，背景充满春日氛围（樱花、草地、蝴蝶、阳光、柳条），整页如沐春风。

### 1.1 硬性约束（基线要求）

| 项目 | 要求 |
|---|---|
| 文件形式 | 单个 HTML 文件，CSS 写在 `<style>`，JS 写在 `<script>` |
| 外部资源 | **零**（无框架 / 字体 / 图片 / 库 / SVG / canvas） |
| 字体 | 系统圆体栈 |
| 动画 | 只用 `transform` / `opacity`，带原生 JS 注释 |
| 响应式 | 桌面 + 移动端（≤640px 断点） |
| 代码 | 完整无省略，可直接打开运行 |

### 1.2 本轮重构的四大问题（已全部落地）

1. **像素动物分辨率太低、看不清** → 制定 32×32 精灵规范：box-shadow 以 2px 步进绘制、深色描边、眼睛白色高光、至少 3 层颜色，逐动物特征化（兔子腮红、柴犬眉点、青蛙荷叶帽等）。
2. **像素风只在动物上，与背景 UI 格格不入** → 全页 UI 像素化：圆角 ≤2px、2px 深色实线边框、实心像素阴影 `4px 4px 0`（hover 下沉/按压位移）、按钮标签用阶梯角 clip-path、导航/侧栏/标题统一处理。
3. **动物喧宾夺主** → 文章卡片改为**文字优先**布局，动物缩小为 48×64px（32×32 分辨率）装饰，5 种错落摆放，默认安静、仅 hover 时动，点赞时脸红。
4. **背景不够春天** → 分层春日背景系统：天空→草地渐变、径向阳光、像素草带、垂柳、蝴蝶+蜜蜂（0.5s 扇翅）、淡背景小花、13 片樱花瓣、3 朵飘云、淡像素网格；全部半透明/缓慢/不抢戏。夜间模式 = 深蓝 + 星星 + 萤火虫，春日元素调暗或隐藏。

### 1.3 保留的原生交互（全部在位）

导航栏动物联动 · 跑步柴犬进度条 · 英雄区兔子（点击回话）· 文章卡片 · **文章详情页（hash 路由）** · 侧栏组件（天气 / 像素动物园 / **我的访客**）· 日夜切换 · 搜索框猫咪 · 飞鸟回顶 · 页脚动物 lineup + 爪印小径 · 随机生活动画（眨眼、打哈欠）· 交错入场 · 滚动淡入 · **站长模式（站内发文章 / 管理恋爱存档 / 相册）**。

---

## 2. 技术方案要点

### 2.1 精灵（Sprite）渲染

- 32×32 分辨率，全部由 `box-shadow` 像素点阵构成，无任何图片。
- 尺寸缩放：`.spr{--s:N; width:calc(var(--s)*64px)}`，缩放值写在 `.spr` 元素本身（级联陷阱注意）。
- 精灵 CSS 位于 `/*__SPRITES_START__*/ … /*__SPRITES_END__*/` 标记之间，**禁止手改**，由 `tools/gen-sprites.js` 重新生成注入。
- 爪印颜色 `#f48fb1`（C.p）。

### 2.2 背景与日夜

- 背景元素分层：渐变底 → 阳光 → 像素网格 → 柳条 → 草带/小花 → 云 → 花瓣 → 蝴蝶/蜜蜂 → 萤火虫（夜间）。
- 全部为静态 HTML + CSS 动画或 JS 生成的 box-shadow 元素，无 canvas / SVG。
- `localStorage['pf-night']` 记忆日夜偏好。

### 2.3 入场动画机制

- 单个共享的 `IntersectionObserver`（`enterIO`，threshold 0.25）+ `stageIn(selector, step, base)` 错落 API。
- 触发时设置 `data-delay` → `animationDelay`，添加 `.enter` 类播放 `popIn`，随后 unobserve。
- 当前调用：`#zoo .zoo-cell`、`#footerRow .foot-item`、`.widget` 循环；卡片观察器独立。

### 2.4 文章详情视图（借鉴像素爪印的文章页）

- **单文件 hash 路由**：`#/post/<slug>`；`hashchange` → `route()` → `openPost(slug)` / `closePost()`，支持直链、刷新恢复、浏览器前进后退。
- 正文数据嵌在卡片内 `.post-full`（hidden 容器），打开时克隆进 `#postDetail` 的 `.prose`——HTML 保持自包含，JS 只做搬运。
- 排版借鉴前身项目"像素爪印"（butterfly 文章页）：meta 行（日期 + 标签 chips）、h2 像素方块前缀、引用块、浅底像素代码块，全部换用本项目的像素 UI 语言（2px 描边、`4px 4px 0` 实心阴影、阶梯角）。
- 阅读量 `localStorage['pf-views']` 纯本地模拟（首开随机基数，此后每次 +1）；点赞与列表卡片**双向同步**（同一篇共享状态）。
- 上一篇/下一篇按卡片顺序跳转，边界显示 `off`；详情页动物精灵复制自卡片 `data-spr/data-day/data-blush`，昼夜切换自动跟随。
- 详情页打开时隐藏 `#posts`/`#friends`/**`#hero`**/**`#love`**，滚动进度条（柴犬）基于 window scroll 自动生效；返回时若 hash 为页面锚点则补一次 `scrollIntoView`（目标此前 hidden，浏览器可能未滚到位）。

---

## 3. 当前进度

### 3.1 已完成 ✅

| 阶段 | 状态 |
|---|---|
| 按四大问题规范重建整页（CSS/HTML/JS） | ✅ |
| 32×32 精灵生成器 + 全量精灵注入 | ✅ |
| 全页像素化 UI（边框/阴影/阶梯角/导航/侧栏） | ✅ |
| 春日背景系统 + 夜间模式 | ✅ |
| 语法校验（`node --check` 提取脚本） | ✅ |
| 桌面端视觉 QA（顶/中/底/夜间截图） | ✅ |
| 交互抽查：卡片 hover、点赞 ♥ 变红 + 兔子脸红 | ✅ |
| ≤640 响应式验证（单列卡片、爪印小径隐藏、装饰正常） | ✅ |
| 零外部资源审计（URL/link/img/url()/@import 全为 0） | ✅ |
| 爪印消失 bug 根因定位与修复（见 3.3） | ✅ |
| 测试产物清理（pawA/pawB/pawtest/mk-* 已删除） | ✅ |
| **文章详情视图**（hash 路由 / 正文排版 / 上下篇 / 阅读量，借鉴像素爪印） | ✅ |
| 详情视图 jsdom 交互测试 39 项全通过（打开/返回/直链/点赞联动/搜索回归/容错） | ✅ |
| **修复「阅读全文」跳到恋爱存档点的 bug**（详见 3.5） | ✅ |
| 删除 6 篇 AI 生成文章，仅保留《雨天、数学与火鸡面》 | ✅ |
| 恋爱存档点扩展：纪念日倒计时 / 回忆便签 / 回忆相册（5 面板） | ✅ |
| 真实访客记录（云端 KV / 本地降级双模式） | ✅ |
| 站长模式（站内发文章、Markdown 编辑器、8 色卡片、恋爱存档与相册管理） | ✅ |
| Cloudflare Worker 后端 `worker.js` + `wrangler.toml`（可选部署） | ✅ |
| 三套测试 115 项全通过（前端本地 59 / 前端云端 25 / 后端 31） | ✅ |

### 3.5 本轮修复与扩展（2026-09-30）

**Bug 修复 · 「阅读全文」跳到恋爱存档点**

- 现象：点「阅读全文」后视口顶部停在第二屏的恋爱存档点，而不是文章开头。
- 根因：`openPost()` 隐藏了 `#posts/#friends/#hero`，但漏掉 `#love`（`min-height:100vh` 且 `display:flex`），它占据了视口顶部。
- 修复：`openPost()` 补 `loveSec.hidden = true`、`closePost()` 补 `loveSec.hidden = false`，并新增 `#love[hidden]{display:none}`（覆盖 `.love-grid` 等 display 规则）。
- 回归用例：`tools/tests/test-blog.js` 第 [2] 节。

**内容瘦身**：删除 6 篇 AI 生成文章（野餐/第一行代码/彩虹/猫日记/烘焙/夜代码），文章区只保留《雨天、数学与火鸡面》（slug `rainy-math`），正文以 Markdown 源文存入 `RAINY_MD` 作为种子。

**恋爱存档点（5 面板）**：此刻 / 心动轨迹 / **纪念日**（每条倒计时，「每年」自动滚到下一个年份，当天变「就是今天 ♥」）/ **回忆便签**（原糖分记录，可增删改）/ **回忆相册**（缩略图 + 灯箱大图）。内容由站长模式维护，云端存 KV，本地存 localStorage。

**我的访客（替换原假计数）**：每次到访 `POST /api/visit` 上报自生成的 `vid`（存 `pf-vid`），云端按 vid 去重统计「总到访 / 独立访客 / 最近到访」；隐私上不存 IP，只记 `cf.country`、来源、设备类型。连不上后端时自动降级：只统计本机到访次数，UI 明确标注「本地模式」。

**站长模式（导航栏 ✎ 按钮）**：密钥登录（云模式校验 `GET /api/admin/ping`；本地模式仅防误触，密钥记在 `pf-adminkey`）→ 四个页签：

1. **写文章**：标题 / slug 自动生成 / 日期 / 标签 / 摘要 / 9 种动物 / 5 种装饰位 / 8 种主题色 / Markdown 正文（## 列表 引用 代码块 加粗 行内码），卡片与正文**实时预览**。
2. **管理文章**：改标题/日期、进编辑器、删除。
3. **恋爱存档**：轨迹 / 纪念日（含「每年」勾选）/ 回忆便签三组行内编辑。
4. **回忆相册**：多选图片 → canvas 压缩（最长边 1000px、JPEG 0.82）→ 填说明 → 保存（单张 base64 ≤1.5MB、最多 60 张）。

**数据层 `Store`**：启动时 `GET /api/ping` 探测 2.5s，成功则走云端（读写全走 Worker），失败自动降级 localStorage；云端文章为空时先展示种子文章，站长**首次保存任何文章时**把种子一并写入 KV（`seeded` 标记），避免数据丢失。

**防注入**：Markdown 解析前先整体转义 HTML，正文/标题/说明等所有入 DOM 字符串均经 `escHtml()`。

### 3.2 新增：文章详情视图

前身项目"像素爪印"有完整的文章页，本项目原本没有——6 篇卡片的"阅读全文"是死链接（`href="#posts"`）。本轮补上：

- 6 篇各配一篇正文（段落 / h2 / 引用块 / 代码块），嵌在卡片内 `.post-full` 隐藏容器。
- 详情视图 `#postDetail`：返回按钮、标题 + meta（日期/标签 chips）、专属动物精灵、`.prose` 正文排版、点赞 + 阅读量、上一篇/下一篇。
- hash 路由 `#/post/<slug>`：点击打开、返回关列表、刷新/直链可恢复、前进后退可用。
- 点赞与列表卡片**双向同步**；阅读量本地模拟（`pf-views`）；非法 slug 自动回退列表。
- 修复细节：`.heart` 在卡片中是绝对定位，详情页以 `#dHeart{position:relative}` 回归文档流；`<body id="top">` 补上原站就存在的 `#top` 死锚点。
- 回归：JS `node --check` 通过、标签配对全对、零外部资源保持 0、死锚点 0、原点赞/搜索逻辑 jsdom 回归通过。

### 3.3 本次关键修复：爪印小径不绘制

**现象**：整页 JS 加载后，页脚 12 枚爪印在截图中消失（DOM、计算样式、命中检测全部正常——opacity 1、无遮挡、`elementFromPoint` 为自身），即"计算样式正常但像素不绘制"。

**定位方法**：二分法——生成无 JS / 全 JS 隔离页对比，逐步裁剪脚本行；最终锁定 `stageIn('#pawline .spr', 55, 0)` 一行；再用"包裹层试验"排除了"动画挂在谁身上"的因素。

**根因**：`.enter` 的 `popIn` 动画**完成后**，带**静态 `rotate()` 变换**的 `.spr`（box-shadow 精灵）会被浏览器合成层丢弃，停止绘制；动画运行中反而正常；`#pawline` 恰好是全页唯一对 `.spr` 直接做静态旋转的规则（`nth-child(even){rotate(14deg)}` / `nth-child(3n){rotate(-10deg)}`）。

**修复**：删除 `index.html` 第 1491 行 `stageIn('#pawline .spr', 55, 0);`（原地留注释说明）。爪印改为静态显示（其位于页脚折下，入场动画收益极小）。

**修复后验证**：像素级扫描 = 12/12 爪印绘制（每枚 ~250px 粉色像素），与无 JS 干净基线完全一致。

### 3.4 维护红线 ⚠️

> **不要给带静态 `rotate()` 的 `.spr` 元素（或其包裹层）挂 `.enter` 入场动画**——动画完成后精灵会停止绘制。若未来要给爪印加入场动画，需先解决该合成层问题（例如改用纯 opacity 关键帧并实测，或动画后强制重绘）。

---

## 4. 文件结构与本地预览

```
spring-pixel-house/
├── index.html            ← 交付物：单文件博客（前端全部内容）
├── worker.js             ← Cloudflare Worker 后端（/api/*，可选部署）
├── wrangler.toml         ← 部署配置（assets 静态 + KV 绑定）
├── package.json          ← 开发依赖（仅 jsdom 测试用）与 npm scripts
├── README.md             ← 本文档
├── .gitignore            ← node_modules / dist / *.log
└── tools/                ← 开发辅助（不随站点部署亦可）
    ├── gen-sprites.js    # 32×32 精灵生成器（写入 index.html 标记区）
    ├── serve.js          # 本地静态预览服务器（无 /api，前端会降级本地模式）
    ├── sheet.html        # 精灵总表参考页
    ├── sprites.css       # 精灵 CSS 源/参考
    └── tests/            # 回归测试（见下）
        ├── test-blog.js   # 前端本地降级模式 59 项
        ├── test-cloud.js  # 前端云端模式（模拟 Worker）25 项
        └── test-worker.mjs# Worker 后端 31 项
```

本地预览与测试：

```bash
npm install            # 仅测试需要（jsdom），站点本身零依赖
npm run serve          # http://localhost:8080 （本地无 /api → 自动降级 localStorage）
npm test               # 115 项回归：31 后端 + 59 前端本地 + 25 前端云端
npm run check          # node --check worker.js
node tools/gen-sprites.js   # 改动精灵时重新生成（勿手改标记区）
```

> 注意：浏览器工具不接受 `file://`，必须走 http 预览。

---

## 5. 数据与状态说明（双模式）

前端启动时 `GET /api/ping` 探测 2.5 秒：**成功 → 云端模式**（Cloudflare Worker + KV），**失败/超时 → 本地模式**（localStorage），UI 在站长模式顶部与访客小工具里明确标注当前模式。

| 数据 | 云端（KV key） | 本地（localStorage） |
|---|---|---|
| 文章 | `posts`（[{slug,title,date,tags,summary,body(md),animal,theme,deco}]） | `pf-posts` |
| 恋爱存档 | `love`（{milestones,anniversaries,memories}） | `pf-love`（含 photos） |
| 相册 | `photos`（[{id,date,caption,data(base64)}]，≤60 张、单张 ≤1.5MB） | `pf-love.photos` |
| 访客 | `visitors`（{total,unique,recent[],vids{}}，不存 IP） | `pf-visits` + `pf-vrecent` |
| 管理密钥 | 请求头 `X-Admin-Key` ← 环境变量 `ADMIN_KEY`（secret） | `pf-adminkey`（仅本机） |

其余本地状态：`pf-vid`（访客 ID）、`pf-views`（阅读量模拟）、`pf-night`（日夜）、点赞为会话内状态。

- 本地模式受浏览器约 5MB 配额限制（保存失败会提示「本地存储空间不足」）。
- 云端文章为空时先展示种子文章《雨天、数学与火鸡面》，站长首次保存文章时种子会一并写入 KV。
- 本地预览（`npm run serve`）没有 `/api`，因此是纯本地模式；部署到 Cloudflare 后自动切云端。

---

## 6. 待办事项

| # | 事项 | 状态 |
|---|---|---|
| 1 | OpenCode 窗口手动最大化（响应式测试时被缩小，视口 532px，恢复后约 903px） | ⏳ 需用户操作 |
| 2 | Cloudflare 部署（Worker + KV + ADMIN_KEY） | ⏳ 步骤见 6.1，需用户执行（登录/建 KV） |
| 3 | 是否购买自有域名 | ⏳ 待决策，建议见 6.2 |
| 4 | （可选）清除测试点赞状态 | ✅ 已核实无需处理：点赞无持久化（见第 5 节） |
| 5 | 站长模式真实浏览器点检（发文章/相册上传视觉） | ⏳ 自动化已覆盖逻辑，视觉需部署后自查 |

### 6.1 部署方案（Cloudflare Workers + KV，推荐）

项目带 `wrangler.toml`：静态文件由 Workers Assets 提供，只有 `/api/*` 进入 `worker.js`，数据存 KV。三步：

```bash
# 0) 安装 wrangler 并登录
npm i -g wrangler && wrangler login

# 1) 创建 KV 命名空间，把输出的 id 填进 wrangler.toml 的
#    [[kv_namespaces]] binding="DATA" id="..."
npx wrangler kv namespace create DATA

# 2) 设置管理员密钥（站长模式登录口令，别提交进仓库）
npx wrangler secret put ADMIN_KEY

# 3) 部署
npx wrangler deploy
# → https://spring-pixel-house.<你的子域>.workers.dev
```

部署后：打开站点应显示访客「云端统计」；点导航栏 ✎ → 输入刚才的 `ADMIN_KEY` → 即可站内发文章、编辑恋爱存档、上传相册。之后 `npx wrangler deploy` 一键更新（或接 GitHub 自动部署）。

> 降级说明：即使没做上述任何步骤，把 `index.html` 丢到任何静态托管（GitHub Pages / Pages Direct Upload）也能用——前端探测不到 `/api` 会自动切到本地 localStorage 模式，只是访客统计仅限本机、内容不跨设备。

### 6.2 自有域名建议

- Pages 绑定自定义域名**免费**（含 apex 裸域）。
- 最省心：在 **Cloudflare Registrar** 注册（成本价无溢价，DNS 同账号，绑定时自动写 CNAME/A 记录）；域名→ Pages 项目 → Custom domains → 添加 → 自动签发 HTTPS。
- 预算有限可先用免费的 `*.pages.dev`，随时可加域名（互不影响）。

---

## 7. 结论

项目已达可交付状态：单文件、零依赖、全交互、响应式、日夜双模式，四大重构目标全部落地；曾阻断交付的"爪印不绘制"问题与本轮"阅读全文跳错位置"的路由 bug 均已根因定位并修复。本轮还完成了内容瘦身（仅保留真实文章）、恋爱存档点扩展（纪念日 / 回忆便签 / 相册）、真实访客记录与站内站长模式，并补上可选的 Cloudflare Worker + KV 后端（未部署时前端自动降级 localStorage）。三套回归测试 115 项全部通过（`npm test`）。下一步为按 6.1 部署上线与域名决策（6.2）。
