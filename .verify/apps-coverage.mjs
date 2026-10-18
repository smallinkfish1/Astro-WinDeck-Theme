/**
 * 应用注册表覆盖率验收
 * ================================================================
 *
 * 跑法：npm run verify:apps   （或 node .verify/apps-coverage.mjs）
 *
 * ⚠️ 只读源码，不需要构建、不需要浏览器。几秒钟出结果。
 *
 * ── 它守的是哪条线 ──
 *
 *   这个脚本的诞生原因是一个真实故障：从开始菜单点「此电脑」，
 *   开出来的窗口写着「未知窗口类型：recent-explorer」。
 *
 *   根因是"应用"这个概念被手抄了四遍，四套 id 各不相同：
 *     桌面图标一套、开始菜单一套、磁贴一套、窗口层自己一套。
 *     只有磁贴"记事本"能用 —— 纯粹因为两边恰好都叫 notepad。
 *
 *   修法是把所有 id 收进 config/apps.ts 一处定义。这个脚本负责
 *   **保证以后不会再有新的漂移**。
 *
 * ── 七项检查 ──
 *
 *   1. 注册表里 id 没有重复
 *   2. 每个应用都有 nameKey，且该 key 在词典里真的存在
 *   3. 每个应用都有 path
 *   4. 桌面 / 最近添加 / 所有应用 三个 id 列表里的 id 都登记过
 *   5. 磁贴里用到的 id 都登记过
 *   6. 【最值钱】已实现的应用，窗口层都认识（有对应的 case 分支）
 *   7. 已实现的站内应用，path 指向的静态页真实存在
 *
 * 第 6 条直接对应这次那个 bug；第 7 条防的是"窗口开出来了，
 * 但地址栏指向一个不存在的页面，一刷新就 404"。
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "..");

const results = [];
function check(name, pass, detail = "") {
  results.push({ name, pass, detail });
  console.log(`${pass ? "✅" : "❌"} ${name}${detail ? `  → ${detail}` : ""}`);
}

/* ════════════════════════════════════════════════════════════════
   工具：解析源码
   ════════════════════════════════════════════════════════════════ */

const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

/** 注释行不算 —— 注释里经常出现示例 id */
const isComment = (line) => /^\s*(\*|\/\/|\/\*)/.test(line);

/**
 * 从 apps.ts 里抠出 APPS 数组，逐行解析成对象。
 *
 * ⚠️ 为什么按行扫而不是一条大正则？
 *    因为每个应用是多行对象、字段顺序还可能变。
 *    逐行扫见到 id: 就开一条新记录，后面的字段往里填 ——
 *    这样加字段、换顺序都不会把它搞坏。
 */
function parseApps() {
  const src = read("src/config/apps.ts");
  const start = src.indexOf("export const APPS");
  const end = src.indexOf("\n];", start);
  if (start < 0 || end < 0) throw new Error("在 src/config/apps.ts 里找不到 APPS 数组");

  const apps = [];
  let cur = null;

  for (const line of src.slice(start, end).split("\n")) {
    const t = line.trim();
    if (isComment(t)) continue;

    const id = t.match(/^id:\s*"([^"]+)",?$/);
    if (id) {
      cur = { id: id[1], ready: true, external: false, pageOnly: false };
      apps.push(cur);
      continue;
    }
    if (!cur) continue;

    const nk = t.match(/^nameKey:\s*"([^"]+)",?$/);
    if (nk) {
      cur.nameKey = nk[1];
      continue;
    }
    const p = t.match(/^path:\s*"([^"]+)",?$/);
    if (p) {
      cur.path = p[1];
      continue;
    }
    if (/^ready:\s*false,?$/.test(t)) cur.ready = false;
    if (/^external:\s*true,?$/.test(t)) cur.external = true;
    if (/^pageOnly:\s*true,?$/.test(t)) cur.pageOnly = true;
  }

  return apps;
}

/** 抠出 apps.ts 里某个 id 列表常量的内容 */
function parseIdList(src, name) {
  const m = src.match(new RegExp(`${name}\\s*=\\s*\\[([\\s\\S]*?)\\]`));
  if (!m) throw new Error(`在 apps.ts 里找不到 ${name}`);
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
}

/** 某个路径有没有对应的静态页 */
function routeExists(path) {
  const clean = path.replace(/^\/+/, "").replace(/\/+$/, "");
  if (clean === "") return existsSync(join(ROOT, "src/pages/index.astro"));
  return (
    existsSync(join(ROOT, "src/pages", `${clean}.astro`)) ||
    existsSync(join(ROOT, "src/pages", clean, "index.astro"))
  );
}

/* ════════════════════════════════════════════════════════════════
   开始检查
   ════════════════════════════════════════════════════════════════ */

const appsSrc = read("src/config/apps.ts");
const apps = parseApps();
const byId = new Map(apps.map((a) => [a.id, a]));

console.log(`应用注册表：${apps.length} 个应用\n`);

/* 1. id 无重复 */
const dupIds = apps.map((a) => a.id).filter((id, i, arr) => arr.indexOf(id) !== i);
check("注册表里 id 无重复", dupIds.length === 0, [...new Set(dupIds)].join(", "));

/* 2. nameKey 都在词典里 */
const typesSrc = read("src/i18n/types.ts");
const dictBlock = typesSrc.slice(typesSrc.indexOf("interface Dict"), typesSrc.indexOf("export type DictMap"));
const dictKeys = new Set([...dictBlock.matchAll(/"([^"]+)":/g)].map((m) => m[1]));

const badNameKey = apps.filter((a) => !a.nameKey || !dictKeys.has(a.nameKey));
check(
  "每个应用的 nameKey 都在词典里",
  badNameKey.length === 0,
  badNameKey.map((a) => `${a.id}${a.nameKey ? ` → ${a.nameKey}` : "（缺 nameKey）"}`).join(", "),
);

/* 3. 每个应用都有 path */
const noPath = apps.filter((a) => !a.path);
check("每个应用都有 path", noPath.length === 0, noPath.map((a) => a.id).join(", "));

/* 4. 三个 id 列表里的 id 都登记过 */
let listMissing = [];
for (const listName of ["DESKTOP_APP_IDS", "RECENT_APP_IDS", "START_MENU_APP_IDS"]) {
  for (const id of parseIdList(appsSrc, listName)) {
    if (!byId.has(id)) listMissing.push(`${id}（来自 ${listName}）`);
  }
}
check(
  "桌面 / 最近添加 / 所有应用 里的 id 都登记过",
  listMissing.length === 0,
  listMissing.join(", "),
);

/* 5. 磁贴里用到的 id 都登记过 */
const tilesSrc = read("src/config/tiles.ts");
const tileIds = [...tilesSrc.matchAll(/tile\(\{\s*id:\s*"([^"]+)"/g)].map((m) => m[1]);
const badTileIds = tileIds.filter((id) => !byId.has(id));
check(
  `磁贴里的 id 都登记过（共 ${tileIds.length} 个磁贴）`,
  badTileIds.length === 0,
  badTileIds.join(", "),
);

/* 6. 已实现的应用，窗口层都认识 —— 这条就是这次那个 bug 的护栏 */
const wmSrc = read("src/components/window/WindowManager.tsx");
const windowCases = new Set([...wmSrc.matchAll(/case\s+"([^"]+)":/g)].map((m) => m[1]));

const windowApps = apps.filter((a) => !a.external && a.ready);

/**
 * ⚠️ pageOnly 的应用【不需要】窗口分支 ——
 *    它们打开的是静态页，根本不进窗口系统。
 *    （比如 posts：桌面图标开 /posts 网页，不开窗口）
 *
 * ⚠️ 但第 7 条仍然要检查它们的 path：
 *    打开静态页这条路上，路径写错一样是 404。
 */
const appsNeedingWindow = windowApps.filter((a) => !a.pageOnly);
const noBranch = appsNeedingWindow.filter((a) => !windowCases.has(a.id));
check(
  "已实现的应用，窗口层都有对应分支",
  noBranch.length === 0,
  noBranch.length
    ? `${noBranch.map((a) => a.id).join(", ")} —— 窗口层没认，点开会显示"这个窗口打不开"`
    : "",
);

/* 7. 已实现的站内应用，path 指向的页面真实存在 */
const badPath = windowApps.filter((a) => !routeExists(a.path));
check(
  "已实现的站内应用，path 都指向真实页面",
  badPath.length === 0,
  badPath.length
    ? `${badPath.map((a) => `${a.id} → ${a.path}`).join(", ")} —— 窗口能开，但一刷新就 404`
    : "",
);

/* 顺带提示一下：未实现的应用有哪些（不是错误，是给你看的） */
const notReady = apps.filter((a) => !a.ready);
if (notReady.length) {
  console.log(`\n未实现的应用（点开显示「功能开发中…」）：${notReady.map((a) => a.id).join(", ")}`);
}

/* ════════════════════════════════════════════════════════════════
   汇总
   ════════════════════════════════════════════════════════════════ */

const failed = results.filter((r) => !r.pass).length;
console.log("\n" + "═".repeat(58));
console.log(failed === 0 ? "  应用注册表覆盖率：全部通过 ✅" : `  应用注册表覆盖率：${failed} 项失败 ❌`);
console.log("═".repeat(58));

process.exit(failed === 0 ? 0 : 1);
