# 春风像素屋 · 项目说明文档

> 更新日期：2026-09-28
> 交付物：`index.html`（单文件，约 1MB，零外部依赖）

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

导航栏动物联动 · 跑步柴犬进度条 · 英雄区兔子（点击回话）· 文章卡片 · **文章详情页（hash 路由）** · 侧栏组件（天气 / 像素动物园 / 访客计数）· 日夜切换 · 搜索框猫咪 · 飞鸟回顶 · 页脚动物 lineup + 爪印小径 · 随机生活动画（眨眼、打哈欠）· 交错入场 · 滚动淡入。

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
- 详情页打开时隐藏 `#posts`/`#friends`，滚动进度条（柴犬）基于 window scroll 自动生效；返回时若 hash 为页面锚点则补一次 `scrollIntoView`（目标此前 hidden，浏览器可能未滚到位）。

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
├── index.html            ← 交付物：单文件博客
├── README.md             ← 本文档
└── tools/                ← 开发辅助（不随站点部署亦可）
    ├── gen-sprites.js    # 32×32 精灵生成器（写入 index.html 标记区）
    ├── serve.js          # 本地静态预览服务器
    ├── sheet.html        # 精灵总表参考页
    └── sprites.css       # 精灵 CSS 源/参考
```

本地预览：

```powershell
node tools\serve.js 8080
# 浏览器打开 http://localhost:8080/index.html
```

> 注意：浏览器工具不接受 `file://`，必须走 http 预览。

---

## 5. 数据与状态说明

- **访客计数 / 点赞**：纯前端模拟。计数初始为 0（JS 模拟滚动增长），点赞为会话内状态（无持久化，刷新即恢复）。
- **文章阅读量**：`localStorage['pf-views']`，详情页每次打开 +1，首次打开给随机基数；纯本地模拟。
- **日夜偏好**：`localStorage['pf-night']`，当前为 `'0'`（白天）。
- 无任何后端、无网络请求。

---

## 6. 待办事项

| # | 事项 | 状态 |
|---|---|---|
| 1 | OpenCode 窗口手动最大化（响应式测试时被缩小，视口 532px，恢复后约 903px） | ⏳ 需用户操作 |
| 2 | GitHub + Cloudflare Pages 部署 | ⏳ 方案见 6.1，待执行 |
| 3 | 是否购买自有域名 | ⏳ 待决策，建议见 6.2 |
| 4 | （可选）清除测试点赞状态 | ✅ 已核实无需处理：点赞无持久化，计数初始为 0（见第 5 节） |

### 6.1 部署方案（GitHub + Cloudflare Pages）

零构建纯静态，两步走：

1. **推送到 GitHub**
   ```bash
   cd spring-pixel-house
   git init
   git add index.html README.md
   git commit -m "春风像素屋：像素游戏风单文件博客"
   # 在 GitHub 建仓库 spring-pixel-house 后：
   git remote add origin https://github.com/<你>/spring-pixel-house.git
   git push -u origin main
   ```
2. **Cloudflare Pages 接入**
   Dashboard → Workers & Pages → Create → Pages → Connect to Git → 选仓库 →
   Framework preset: **None**；Build command: **留空**；Output directory: **`/`（根目录）** → Deploy。
   完成后获得 `spring-pixel-house.pages.dev` 免费域名，HTTPS 自动，带宽免费、不限流量。
   之后每次 `git push` 自动重新部署。

> 备选：不用 GitHub 也行——Pages 支持 Direct Upload（仪表盘直接拖文件夹）或 `wrangler pages deploy`。

### 6.2 自有域名建议

- Pages 绑定自定义域名**免费**（含 apex 裸域）。
- 最省心：在 **Cloudflare Registrar** 注册（成本价无溢价，DNS 同账号，绑定时自动写 CNAME/A 记录）；域名→ Pages 项目 → Custom domains → 添加 → 自动签发 HTTPS。
- 预算有限可先用免费的 `*.pages.dev`，随时可加域名（互不影响）。

---

## 7. 结论

项目已达可交付状态：单文件、零依赖、全交互、响应式、日夜双模式，四大重构目标全部落地；唯一曾阻断交付的"爪印不绘制"问题已根因定位并修复、经像素级验证。本轮借鉴前身项目"像素爪印"补齐了**文章详情视图**（hash 路由 + 正文排版 + 上下篇 + 阅读量），39 项 jsdom 交互测试全通过，站内死链归零。下一步为部署上线（6.1）与域名决策（6.2）。
