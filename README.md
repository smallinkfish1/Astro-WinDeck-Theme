<!--
  ⚠️ 顶部预览图 —— 换成你自己的截图。

  建议截「桌面 + 两三个窗口叠着」的样子（比如左边开个记事本、右边开个此电脑），
  一眼就能看出这是个什么项目。宽 1600px 左右、png、放 docs/preview.png。

  还没截图之前，下面这行会显示成一个破图 —— 那是正常的，删掉或补图即可。
![Win10 Blog 预览](docs/preview.png)

-->

# Astro WinDeck Blog (WIP)

> 一个把博客做成 **Windows 10 桌面**的 Astro 项目。
> 文章是文件，分类是磁贴，归档是「此电脑」，草稿丢进「回收站」。

[![Astro](https://img.shields.io/badge/Astro-7-ff5d01?style=for-the-badge&logo=astro&logoColor=white)](https://astro.build)
[![React](https://img.shields.io/badge/React-19-61dafb?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38bdf8?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Node](https://img.shields.io/badge/Node-%E2%89%A522-5fa04e?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](./LICENSE)

---
## License

[MIT](./LICENSE)

---
## 项目结构

```
src/
├── components/
│   ├── article/          PostCard（静态页的文章卡片）
│   ├── desktop/          Desktop、DesktopIcon（桌面和图标）
│   ├── social/           SocialLinks（静态页的社交链接）
│   ├── taskbar/          Taskbar、StartMenu、TileGrid、Tile、LiveTile
│   └── window/
│       ├── Window.tsx          单个窗口（标题栏 + 内容区 + 拖动缩放）
│       ├── WindowManager.tsx   窗口调度 + URL 同步
│       └── views/              每个应用一个视图
│           ├── ExplorerView      此电脑 / 归档
│           ├── NotepadView       记事本
│           ├── BrowserView       浏览器（Blog Explorer）
│           ├── DraftsView        回收站
│           ├── ControlPanelView  控制面板
│           ├── ArticleView       文章阅读排版
│           ├── PostList / TagsView / ArchiveView / AboutView
│           ├── Toc / WallpaperPicker
│           ├── explorer/         文件管理器的外壳与数据层
│           └── browser/          浏览器三个标签页
├── config/
│   ├── apps.ts           应用注册表（所有能点开的东西，唯一真相源）
│   ├── tiles.ts          磁贴分组
│   ├── startMenu.ts      开始菜单的左栏
│   ├── links.ts          友情链接
│   ├── site.ts           站点信息、社交链接
│   └── browser-tabs.ts   浏览器标签页
├── content/
│   ├── blog/             文章（.md）
│   └── guide/            教程（.md）
├── content.config.ts     frontmatter schema 校验
├── hooks/                useAppearance / useClock / useIsMobile
├── i18n/                 中英词典 + 运行时切换
├── layouts/              DesktopLayout（桌面）、ContentLayout（静态页）
├── lib/                  markdown、posts、theme、tiles、wallpaper、guide
├── pages/                路由（静态页 + rss / sitemap / 搜索索引）
├── store/windowStore.ts  窗口状态
└── styles/global.css     全部 CSS 变量和主题

.verify/                  验收脚本（不需要构建的那几个几秒就能跑）
```

---

## 在线预览 （WIP）

| 入口 | 地址 |
|---|---|
| 桌面（主界面） | `https://your-site.example` |
| 静态文章页 | `https://your-site.example/posts/why-win10` |
| RSS 订阅 | `https://your-site.example/rss.xml` |
| 站点地图 | `https://your-site.example/sitemap.xml` |
| 搜索索引 | `https://your-site.example/search-index.json` |

**本地跑起来**：

```bash
npm install
npm run dev      # → http://localhost:4321
```

---
## 特性

- 🖥️ **桌面就是导航** —— 窗口能拖能缩、任务栏能切换、开始菜单有真实分类和标签的磁贴。不需要教用户怎么用，他见过 Windows。
- 📄 **两条渲染路径** —— 每篇文章都有独立的静态 HTML（爬虫和禁用 JS 也能读），窗口里再用 `marked` 渲染一遍（有交互）。见 [核心设计](#核心设计)。
- 🌐 **中英双语** —— 控制面板里切换，**不刷新页面、不丢打开的窗口**。系统组件名对齐微软官方 Windows 10 术语。
- 🎨 **主题是变量，不是两套样式** —— 暗色 / 毛玻璃 / 界面动画 / 开始菜单深色 / 壁纸，全部由 CSS 变量驱动。
- ✍️ **写文章就是放文件** —— 内容放在 `src/content/blog/`，写 `.md` 就行，frontmatter 有构建期类型校验。
- ✅ **自带验收** —— 三套脚本，改完随手跑一遍，比翻页面快得多。见 [验收](#验收)。

---
## 核心设计

**这是整个项目最需要理解的一点。**

一个长得像操作系统的博客，天然会和 SEO 冲突 —— 如果文章都靠 JS 在窗口里渲染，爬虫看到的就是一个空壳。

所以这里做了两条并行的渲染路径：

```
                    ┌─→ 静态路由 /posts/[slug]  → 完整 HTML，爬虫和直接访问用
同一个 .md 文件 ────┤
                    └─→ 窗口内 marked 渲染      → 交互体验用
```

两条路产出的 HTML **都套同一个 CSS 类 `.md-body`**，排版规则只写一次，所以视觉不会漂移。

结果就是：每篇文章都有独立 URL，`sitemap.xml` / `rss.xml` / `search-index.json` 自动生成；禁用 JavaScript 后正文依然完整可读（任务栏和桌面外壳会失效，那本来就是需要 JS 的部分）。

---
## 快速开始

**环境要求**：Node.js **≥ 22.12**。

```bash
# 1. 拿到代码
git clone https://github.com/smallinkfish1/Astro-WinDeck-Theme.git
cd Astro-WinDeck-Theme
# 2. 装依赖
npm install
# 3. 开发
npm run dev        # → http://localhost:4321
# 4. 构建（产物在 dist/）
npm run build
# 5. 本地预览构建产物
npm run preview
```

| 命令 | 作用 |
|---|---|
| `npm run dev` | 开发服务器，热更新 |
| `npm run build` | 构建静态站点到 `dist/` |
| `npm run preview` | 预览 `dist/`（改代码后要重新 build） |
<!--
| `npm run verify` | 完整验收（静态检查 + 浏览器测试） |
| `npm run verify:i18n` | 只查多语言词典 |
| `npm run verify:apps` | 只查应用注册表 |
-->
---
## 怎么用

### 写一篇文章

在 `src/content/blog/` 下新建 `.md`：

```markdown
---
title: 我的第一篇文章
description: 列表页和搜索结果里显示的一句话摘要
pubDate: 2026-10-11
category: 随笔
tags: ["建站", "随想"]
---

正文从这里开始，支持 **Markdown**、公式 $E = mc^2$、代码块……
```

frontmatter 由 `src/content.config.ts` 用 Zod 校验，**字段写错会在构建期直接报错**，不会等到页面上出现 `undefined`。

| 字段 | 必填 | 说明 |
|---|---|---|
| `title` | ✅ | 标题 |
| `pubDate` | ✅ | 发布日期 |
| `description` | | 摘要（列表页 / SEO description） |
| `updatedDate` | | 更新日期 |
| `category` | | 分类，支持 `技术/前端` 这样的层级 |
| `tags` | | 标签数组 |
| `draft` | | `true` 就进「回收站」，不参与公开列表和搜索 |

### 改常见的东西

| 想改 | 改哪 |
|---|---|
| 加 / 减磁贴、换颜色尺寸 | `src/config/tiles.ts` |
| 开始菜单里有哪些应用 | `src/config/apps.ts` 的 `START_MENU_APP_IDS` |
| 桌面放哪几个图标 | `src/config/apps.ts` 的 `DESKTOP_APP_IDS` |
| 应用的名字、图标、路径 | `src/config/apps.ts` |
| 友情链接 | `src/config/links.ts` |
| 社交链接、昵称、头像、简介 | `src/config/site.ts` |
| 浏览器窗口的标签页 | `src/config/browser-tabs.ts` |
| 壁纸清单 | `src/lib/wallpaper.ts` |
| 控制面板的分类 | `src/lib/settings-sections.ts` |
| 界面文案（中/英） | `src/i18n/zh-CN.ts` 和 `src/i18n/en.ts` |

> 📖 仓库里还有几篇更细的教程，`src/content/guide/` 下：
> 写文章、加浏览器标签页、改友链、改社交链接、改外观。

### 加一个新应用

以「相册」为例，三步：

**① 在 `src/config/apps.ts` 登记**

```ts
{
  id: "photos",
  nameKey: "app.photos",        // 词典里的 key
  icon: "🖼️",
  path: "/photos",              // 必须真的有这个页面
},
```

**② 加进想让它出现的地方**

```ts
export const START_MENU_APP_IDS = [..., "photos"];
```

**③ 让窗口层认识它** —— 在 `WindowManager.tsx` 的 `renderContent` 里加一个分支：

```tsx
case "photos":
  return <PhotosView />;
```

> ⚠️ 忘了第 ③ 步的话，点开只会显示「这个窗口打不开」。
> 不过不用怕 —— `npm run verify:apps` 会直接告诉你漏了哪个。

### 切换语言

桌面双击 **控制面板** → 左侧 **🌐 语言和区域** → 选 **English**。

切换是**立刻生效**的，不刷新页面、不丢掉开着的窗口。日期和数字的格式由一个独立的「地区格式」开关控制 —— 关着的时候即使切到英文，日期也保持中文格式（真实 Windows 里这也是两个独立设置）。

---

## 技术栈

| 层 | 选型 | 为什么 |
|---|---|---|
| 框架 | **Astro 7** | 岛屿架构：内容静态化，交互局部水合 |
| 交互 | **React 19** | 只用在窗口、任务栏、开始菜单这些岛屿上 |
| 样式 | **Tailwind CSS 4** | 原子类 + CSS 变量做主题 |
| 状态 | **Zustand 5** | 窗口状态，比 Context 轻；且能跨岛屿共享 |
| 拖拽缩放 | **react-rnd** | 窗口拖动 + 八向缩放 |
| 动画 | **motion 14** | 窗口开关的进出场动画 |
| Markdown | **marked 18** | 窗口内那条渲染路径 |
| 代码高亮 | **Shiki**（Astro 内置） | 构建期上色，零配置 |
| 公式 | **remark-math + rehype-katex** / **marked-katex-extension** | 两条渲染路径各需要一套 |
| 类型校验 | **TypeScript + Zod** | frontmatter 和词典都在构建期校验 |

> ⚠️ `motion` 是 `framer-motion` 改名后的新包名，导入路径是 `"motion/react"`。
> 网上老教程写的 `npm i framer-motion` 装的是旧包，导入路径不一样。

---
## 主题与外观

整套外观由 **CSS 变量**驱动，切主题只是给 `<html>` 换个 class：

```css
:root        { --surface: #fff;    --fg: #1a1a1a; }
.theme-dark  { --surface: #1c1e22; --fg: #e8e8e8; }
```

好处是**组件里一行颜色都不用改**，新增一个主题只要再写一组变量。

| 设置 | 作用方式 |
|---|---|
| 亮色 / 暗色 | 覆盖 `:root` 里的颜色变量 |
| 毛玻璃 | 移除 `backdrop-filter` 并改用实色底 |
| 界面动画 | 把所有动画时长压成 `0.01ms` |
| 开始菜单深色 | 只作用于开始菜单，不影响任务栏和窗口 |
| 壁纸 | `<html data-wallpaper="...">` 属性 |

几个踩过的坑写在代码注释里，比如：

- **毛玻璃必须把标准属性写在 `-webkit-` 前缀后面** —— Tailwind 4 用的 lightningcss 会在同时出现两者时删掉标准属性。
- **壁纸用属性而不是 class** —— 它是「多选一」和「亮/暗」两个维度的组合，用属性是线性增长，用 class 是指数级。

---
## 中英双语怎么工作的

不是 `/en/` 路由那套，而是**运行时字典**：

```ts
import { useT } from "../i18n";

function MyView() {
  const { t } = useT();
  return <button>{t("ex.delete")}</button>;   // 中文「删除」/ 英文 Delete
}
```

切语言时**不刷新页面**，所以开着的五个窗口、记事本里读到的位置，全都原样保留 —— 这才像"操作系统里改了个设置"，而不是"电脑重启了"。

几个关键决定：

- **两本词典 `zh-CN.ts` / `en.ts` 都是 `Record<keyof Dict, string>`** —— 少翻译一条，TypeScript 直接报错，漏翻进不了构建产物。
- **配置表存 key 不存文案**（`app.notepad` 而不是"记事本"）—— 因为在模块顶层还没有 `t()` 可用，存文案会固化成一个不会更新的值。
- **桌面图标用纯 CSS 切换** —— 它是 Astro 构建期渲染的静态 HTML，不在 React 岛屿里。所以中英两份都写进 HTML，靠 `html[lang]` 选择器显示其中一份，零 JavaScript。

---

<!--
## 验收

改完代码随手跑一下，比在浏览器里翻页面快得多：

```bash
npm run verify          # 全跑（静态检查 + 5 个浏览器套件）
npm run verify:i18n     # 只查词典
npm run verify:apps     # 只查应用注册表
```

`.verify/` 下是全部脚本。前两个**只读源码、不用构建、几秒钟出结果**：

**`verify:i18n`** —— 词典有没有漏、有没有拼错：

```
✅ 三份词典 key 完全一致      ✅ 无重复 key
✅ 除量词外没有空值           ✅ 代码里 t("…") 引用的 key 都存在
✅ 配置表里存的 key 都存在
```

第二条最值钱：词典自己漏 key 会被 TypeScript 拦下，但**调用方把 key 拼错**是拦不住的（`t("cp.nav.aparence")` 少个 `r`，类型系统看不出来，界面上只是一个空字符串）。

**`verify:apps`** —— 应用注册表有没有漂移：

```
✅ id 无重复 · nameKey 都在词典里 · 都有 path
✅ 桌面 / 最近添加 / 所有应用 / 磁贴里的 id 都登记过
✅ 已实现的应用，窗口层都有对应分支
✅ 已实现的站内应用，path 都指向真实页面
```

这两条是被一个真实故障逼出来的：**「应用」曾经被手抄四遍，四套 id 各不相同**，导致开始菜单里几乎每一项都点不开。现在所有 id 收在 `src/config/apps.ts` 一处，这两个断言负责保证它不再漂移。

后面的 `verify.mjs` / `verify-theme.mjs` / `verify-tiles.mjs` / `verify-desktop.mjs` / `verify-apps.mjs` 是 Playwright 浏览器测试，跑的是**构建产物**（所以 `npm run verify` 会先提醒你 `npm run build`）。

## 更多文档

仓库根目录还有几份针对具体操作的文档：

- **`安装说明-先读我.md`** —— 从零把项目跑起来
- **`改桌面和图标改哪里.md`** —— 换壁纸、换图标、调图标顺序
- **`从Hexo迁移-迁移前必读.md`** —— 如果你原来用 Hexo
- **`上传到GitHub-操作指南.md`** —— 部署到线上
!-->
---
## 反馈

- 发现 bug 或者有想法，开一个 [Issue](../../issues)。
- 想加一个功能，先在 Issue 里说一下，免得做完发现方向不对。

---
## 致谢

这个项目站在这些开源项目和工作上：

- [Astro](https://astro.build) —— 岛屿架构，让"桌面壳 + 静态内容"这件事变得自然
- [React](https://react.dev) / [Zustand](https://zustand.docs.pmnd.rs) —— 窗口系统
- [react-rnd](https://github.com/bokuweb/react-rnd) —— 拖动 + 八向缩放
- [motion](https://motion.dev) —— 进出场动画
- [Tailwind CSS](https://tailwindcss.com) —— 样式
- [marked](https://marked.js.org) / [KaTeX](https://katex.org) —— 窗口内的 Markdown 与公式渲染
- [Shiki](https://shiki.style) —— 构建期代码高亮
- [Microsoft Learn](https://learn.microsoft.com) 的 Windows UI 术语表 —— 英文界面里的 `This PC` / `Date modified` / `Language & region` 这些叫法都对着它校准过
- [WorkBuddy](https://www.workbuddy.cn) AI 辅助开发

这个项目的代码、注释和文档，在开发过程中借助了 AI 工具。

|---|---|
| 工具 | [WorkBuddy](https://www.workbuddy.cn) |
| 模型 | DeepSeek-V4.1-Flash |

**分工大致是这样**：

- **需求、设计取舍、验收标准 —— 由人主导。**
  为什么坚持"两条渲染路径"、哪些界面必须保留静态页、英文术语为什么逐条对齐微软官方、
  以及每一次"这么做还是那么做"的决定，都是人拍的。
- **代码实现、重构、注释与文档 —— 由 AI 辅助完成。**
  项目里的代码注释（包括那些"为什么不用另一种写法"的长段说明）、主要出自 AI。
<!--
  - **验收 —— 靠脚本和人工共同把关。**
  `npm run verify` 系列会跑静态检查和浏览器测试，
  改动是否合格由它们和实际点击共同判断，不依赖"看起来没问题"。
-->

> ⚠️ **AI 写的代码必须经过人工审查和实际运行验证。**
>
> 这个项目在开发过程中确实被人工揪出过几个真实问题 ——
> 比如窗口标题栏的高度被一个重复的 `style` 属性悄悄吃掉、
> 开始菜单里四套应用 id 互不相通导致几乎每一项都点不开。
> 这类问题不是"再问一次 AI"能发现的，是靠读代码、跑构建、真的去点才暴露出来的。

---


