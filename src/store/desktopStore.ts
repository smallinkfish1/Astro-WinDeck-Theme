/**
 * 桌面图标状态
 * ================================================================
 *
 * 管三件事：
 *   1. 桌面上有哪些图标、各自在第几行第几列
 *   2. 右键菜单开没开、开在哪个坐标
 *   3. 「新建快捷方式」模态框开没开
 *
 * ── ⚠️⚠️ 为什么图标位置存「网格坐标」而不是像素 ──
 *
 *   这是整个拖动功能的地基，先说清楚。用像素存位置会有三个问题：
 *
 *     · 换屏幕就错位 —— 昨天在 1920 宽的屏上排得整整齐齐，
 *       今天换 1366 的笔记本，图标全挤在一起或者跑到屏幕外面
 *     · 判断重叠要写浮点数比较，还得处理误差（"差了 0.5 像素算不算重叠？"）
 *     · 网格吸附变成"把鼠标坐标反推回格子"，每次都要来回换算
 *
 *   存 { col, row } 就没这些事：
 *     · 它描述的是"第 3 列第 2 行"，和屏幕多大无关
 *     · 重叠 = 两个图标 col/row 完全相同，一次整数比较
 *     · 吸附 = 拖动时算出鼠标落在哪一格，松手就是那一格
 *     · 渲染时才换算成像素：left = col * cellW，top = row * cellH
 *
 *   ⚠️ 这和开始菜单的磁贴是同一套思路（见 lib/tiles.ts 顶部的说明）：
 *      位置是一份纯数据，拖动改数据，渲染只管画。
 *
 * ── 为什么内置应用也放在这个 store 里？ ──
 *
 *   因为内置图标（此电脑、记事本…）同样要能拖动、要有位置。
 *   但它们的"身份"（名字、图标、打开什么）仍然来自 config/apps.ts ——
 *   这里只存它们【在哪】，不存它们【是什么】。
 *
 *   所以 item 分成两种：
 *     kind: "app"   → 身份去 APPS 查，本项只有 id 和 position
 *     kind: "post"  → 用户建的快捷方式，name/icon/target 都存这里
 *     kind: "url"   → 同上，只是双击行为不同
 */
import { create } from "zustand";
import { DESKTOP_APP_IDS } from "../config/apps";

/**
 * 桌面网格的公共参数。
 *
 * ⚠️ 格子的宽高【不在这里】—— 它跟着「图标大小」变，见 CELL_SIZES。
 *    以前这里写死了 cellW/cellH，加了「查看 → 大/中/小图标」之后
 *    必须变成可切换的。
 */
export const GRID = {
  /** 桌面左上角留白（px） */
  padX: 12,
  padY: 12,
  /**
   * 一列【至少】放几个图标。
   *
   * ⚠️ 实际数量按视口高度算，见 rowsPerColumn()。
   *    这里只是兜底值 —— 视口算不出来时（构建期）用它。
   */
  minRows: 5,
  /**
   * 最多几列。
   *
   * ⚠️ 这是个保护：防止快捷方式太多时跑到屏幕外面去，
   *    那种情况用户既看不到也删不掉，只能清 localStorage。
   */
  maxCols: 12,
} as const;

/**
 * 图标大小档位。右键菜单「查看」里切换，存在 localStorage。
 */
export type IconSize = "sm" | "md" | "lg";

/**
 * 三档尺寸。
 *
 *   w/h   → 一个格子占多大（决定图标间距）
 *   icon  → 图标本身画多大
 *   font  → 图标下面那行文字的字号
 *
 * ⚠️ 调大档位会让一列能放的图标变少，原本靠下的图标会被 sanitize
 *    挪到上面的空位。这和 Windows 改图标大小后重排是一样的，属预期行为。
 */
export const CELL_SIZES: Record<
  IconSize,
  { w: number; h: number; icon: number; font: number }
> = {
  sm: { w: 72, h: 76, icon: 36, font: 11 },
  md: { w: 88, h: 92, icon: 44, font: 12 },
  lg: { w: 104, h: 110, icon: 56, font: 13 },
};

/**
 * 任务栏高度（px）。
 *
 * ⚠️ 必须和 global.css 里的 --taskbar-h 保持一致。
 *    拖动时用它判断"松手位置是不是落在任务栏上"，
 *    网格计算也用它算可用高度 —— 两处都用这一个常量，避免漂移。
 */
export const TASKBAR_H = 40;

/**
 * 当前视口下，一列能放几个图标。
 *
 * @param cellH 格子高度。不同图标大小档位不一样，所以必须由调用方传进来。
 *
 * ⚠️ 为什么是函数而不是常量：
 *    网格高度必须跟着屏幕长，否则大屏上"下半屏"是死区 ——
 *    拖过去会被钳回来，用户会以为拖动坏了。
 *
 * ⚠️ 为什么减 padY * 2：上下各留一份边距，否则最后一行会被削掉一半。
 */
export function rowsPerColumn(cellH: number = CELL_SIZES.md.h): number {
  if (typeof window === "undefined") return GRID.minRows;
  const usable = window.innerHeight - TASKBAR_H - GRID.padY * 2;
  return Math.max(GRID.minRows, Math.floor(usable / cellH));
}

/** 网格坐标 */
export interface GridPos {
  col: number;
  row: number;
}

export type DesktopItemKind = "app" | "post" | "url";

/** 桌面上的一个图标 */
export interface DesktopItem {
  /** 唯一标识。内置应用直接用 app id（"pc"），快捷方式用 "post:slug" / "url:xxx" */
  id: string;

  /**
   * 这个图标是什么：
   *   "app"  → 内置应用，名字/图标/路径都去 config/apps.ts 查
   *   "post" → 文章快捷方式，name/target 存在本项里
   *   "url"  → 外部链接快捷方式，同上
   */
  kind: DesktopItemKind;

  /** 仅 kind === "app"：指向 APPS 里的 id */
  appId?: string;

  /** 仅 kind !== "app"：显示名 */
  name?: string;

  /** 仅 kind !== "app"：图标（emoji 或 "/icons/xxx.png"） */
  icon?: string;

  /** kind === "post" 时是文章 slug；kind === "url" 时是完整地址 */
  target?: string;

  /** 在哪一格 */
  position: GridPos;
}

/** localStorage 键。和项目其它设置一样带统一前缀 */
const KEY_DESKTOP = "win10-blog:desktop";
/**
 * ⚠️ 图标大小和"显示桌面图标"单独存两个键，不塞进 KEY_DESKTOP 里。
 *
 *    因为 KEY_DESKTOP 存的是【数组】，而这俩是设置项。
 *    混在一起的话，每次开关图标都要把整个数组重写一遍，
 *    而且读取时要兼容两种结构 —— 不值得。
 */
const KEY_ICON_SIZE = "win10-blog:desktop:iconSize";
const KEY_SHOW_ICONS = "win10-blog:desktop:showIcons";

/* ════════════════════════════════════════════════════════════════
   网格工具（纯函数，好推理也好测）
   ════════════════════════════════════════════════════════════════ */

/**
 * 按"先往下、排满往右"的顺序，把网格铺成一个一维列表。
 *
 * ⚠️ 为什么要有这个？
 *    找"下一个空位"本质上是在一个二维网格里找空洞。
 *    把它拉直成一维之后，逻辑就变成"沿着列表找第一个没被占的位置" ——
 *    五行代码，没有嵌套循环，也不容易写错。
 *
 * @param rows 一列放几个。由调用方按当前图标大小算好传进来 ——
 *             ⚠️ 不能在这里自己调 rowsPerColumn()，因为它需要 cellH，
 *             而 cellH 取决于图标档位，是调用方才知道的信息。
 */
function layoutSlots(rows: number): GridPos[] {
  const slots: GridPos[] = [];
  for (let col = 0; col < GRID.maxCols; col++) {
    for (let row = 0; row < rows; row++) {
      slots.push({ col, row });
    }
  }
  return slots;
}

/** 两个坐标是不是同一格 */
export function sameSlot(a: GridPos, b: GridPos): boolean {
  return a.col === b.col && a.row === b.row;
}

/**
 * 找一个空位。
 *
 * @param items     现有图标
 * @param preferred 优先尝试的位置（比如拖动后想放的地方）。
 *                  被占了就从它开始往后找最近的一个空位。
 *                  ⚠️ 不传就是"从左上角开始找第一个空的"。
 * @param rows      一列放几个。默认按「中」档图标算，调用方有更准确的值时应该传。
 *
 * ⚠️ 找不到空位时返回 null，由调用方决定怎么办（我们会给个提示，不会静默丢东西）。
 */
export function findFreeSlot(
  items: DesktopItem[],
  preferred?: GridPos,
  rows: number = rowsPerColumn(),
): GridPos | null {
  const taken = new Set(items.map((i) => `${i.position.col},${i.position.row}`));
  const slots = layoutSlots(rows);

  // 有 preferred 就从它那一格开始，沿着铺好的顺序往后扫
  const start = preferred ? slots.findIndex((s) => sameSlot(s, preferred)) : 0;
  const ordered = start > 0 ? [...slots.slice(start), ...slots.slice(0, start)] : slots;

  for (const slot of ordered) {
    if (!taken.has(`${slot.col},${slot.row}`)) return slot;
  }
  return null;
}

/**
 * 整理已有的位置：把越界的、重复的坐标挪到合法且不冲突的地方。
 *
 * ⚠️⚠️ 为什么必须有这个？因为数据来自 localStorage。
 *
 *    localStorage 里的东西是【可以被用户手改的】，也可能是旧版本写进去的
 *    （比如你以前 GRID.maxCols 是 20，现在改成 12 了）。
 *    不清理的话会出现：
 *      · 两个图标叠在同一格，永远看不见下面那个
 *      · col 是 999，图标跑到屏幕外 —— 用户既看不到也删不掉
 *
 *    处理方式：按顺序重新分配合法空位，保证不重叠、不越界。
 */
function sanitize(items: DesktopItem[], rows: number): DesktopItem[] {
  const out: DesktopItem[] = [];
  for (const item of items) {
    const slot = findFreeSlot(out, item.position, rows);
    if (!slot) continue; // 网格满了，这个就不放了（下面会提示）
    out.push({ ...item, position: slot });
  }
  return out;
}

/** 默认布局：五个内置应用，从左上角开始往下排一列 */
function defaultItems(): DesktopItem[] {
  return DESKTOP_APP_IDS.map((appId, i) => ({
    id: appId,
    kind: "app" as const,
    appId,
    position: { col: 0, row: i },
  }));
}

/* ════════════════════════════════════════════════════════════════
   读 / 写 localStorage
   ════════════════════════════════════════════════════════════════ */

/**
 * 从 localStorage 读。
 *
 * ⚠️ 三个必须做对的点，少一个就会"打开页面白屏"：
 *   1. 构建期（Node）没有 localStorage —— 先判 typeof
 *   2. JSON.parse 会抛错 —— 包 try
 *   3. 解析出来的东西可能根本不是数组 —— 校验 Array.isArray
 *
 * 任何一步不对都【退回默认布局】。降级永远比崩溃好。
 */
/**
 * 读图标大小。
 *
 * ⚠️ 必须做白名单校验 —— localStorage 可被手改，
 *    改成一个不存在的档位会让 CELL_SIZES[size] 变成 undefined，
 *    后面取 .h 直接崩在渲染里。
 */
function readIconSize(): IconSize {
  if (typeof localStorage === "undefined") return "md";
  const raw = localStorage.getItem(KEY_ICON_SIZE);
  return raw === "sm" || raw === "md" || raw === "lg" ? raw : "md";
}

/**
 * 读"是否显示桌面图标"。
 *
 * ⚠️ 默认 true，而且判断的是 `!== "off"` 而不是 `=== "on"`：
 *    没存过（新用户）、值被改坏、读不出来 —— 全都应该显示图标。
 *    桌面空着对用户没有任何好处。
 */
function readShowIcons(): boolean {
  if (typeof localStorage === "undefined") return true;
  return localStorage.getItem(KEY_SHOW_ICONS) !== "off";
}

function readItems(iconSize: IconSize): DesktopItem[] {
  if (typeof localStorage === "undefined") return defaultItems();

  try {
    const raw = localStorage.getItem(KEY_DESKTOP);
    if (!raw) return defaultItems();

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return defaultItems();

    /**
     * ⚠️ 这里【不再】过滤掉快捷方式 —— 「创建快捷方式」功能已经恢复。
     *
     *    中间有一版把这个功能下线了，为了不留下"删不掉的幽灵图标"，
     *    曾经在这里 .filter(i => i.kind === "app")。
     *    现在菜单里有「新建」也有「删除」，快捷方式是正常的桌面住户，
     *    再过滤就等于把用户建的东西全删了。
     */
    const items = parsed.filter(isValidItem);
    if (!items.length) return defaultItems();

    /**
     * ⚠️ 内置应用【必须】都在。
     *
     *    用户把这些图标拖走了、或者 localStorage 里少了某一条，
     *    桌面上就再也看不到"此电脑"了 —— 他没有任何办法找回来
     *    （除非清 localStorage）。所以这里强制补齐。
     */
    for (const appId of DESKTOP_APP_IDS) {
      if (!items.some((i) => i.id === appId)) {
        items.push({ id: appId, kind: "app", appId, position: { col: 0, row: 0 } });
      }
    }

    return sanitize(items, rowsPerColumn(CELL_SIZES[iconSize].h));
  } catch {
    // 值被改坏了 —— 退回默认，别让整个桌面打不开
    return defaultItems();
  }
}

/** 结构校验：宁可少一个图标，也不能让一条脏数据把渲染搞崩 */
function isValidItem(v: unknown): v is DesktopItem {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  if (typeof o.id !== "string") return false;
  if (o.kind !== "app" && o.kind !== "post" && o.kind !== "url") return false;
  const pos = o.position as Record<string, unknown> | undefined;
  if (!pos || typeof pos.col !== "number" || typeof pos.row !== "number") return false;
  return true;
}

function writeItems(items: DesktopItem[]) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(KEY_DESKTOP, JSON.stringify(items));
  } catch {
    /**
     * ⚠️ 配额满了（localStorage 一般 5MB）。
     *    存不下就不存 —— 但界面必须继续能用，不能因为存不上就报错。
     *    桌面图标这点数据几乎不可能撑爆，但理论上存在，所以还是兜一下。
     */
  }
}

/* ════════════════════════════════════════════════════════════════
   Store
   ════════════════════════════════════════════════════════════════ */

/** 右键菜单的位置（视口坐标）。null = 没开 */
export interface MenuAnchor {
  x: number;
  y: number;
}

interface DesktopStore {
  /** 桌面上所有图标 */
  items: DesktopItem[];

  /** 当前选中的图标 id（单击选中，Windows 那种） */
  selectedId: string | null;

  /** 右键菜单开在哪儿 */
  menu: MenuAnchor | null;

  /** 「新建快捷方式」模态框开着吗 */
  modalOpen: boolean;

  /** 打开模态框时预选的类型（右键菜单里点不同的项进来） */
  modalKind: "post" | "url";

  /** 图标大小档位（右键菜单「查看」里切换） */
  iconSize: IconSize;

  /** 是否显示桌面图标。藏起来之后靠右键菜单还能再打开 */
  showIcons: boolean;

  /** 客户端挂载后调用，把 localStorage 里的真实数据读进来 */
  hydrate: () => void;

  select: (id: string | null) => void;

  openMenu: (x: number, y: number) => void;
  closeMenu: () => void;

  openModal: (kind: "post" | "url") => void;
  closeModal: () => void;

  /**
   * 切换图标大小。
   *
   * ⚠️ 会顺带重新整理位置：格子尺寸变了，一列能放几个也变了，
   *    原本靠下的图标可能越界，必须重新分配。
   */
  setIconSize: (size: IconSize) => void;

  /** 显示 / 隐藏桌面图标 */
  setShowIcons: (on: boolean) => void;

  /**
   * 加一个快捷方式。
   *
   * ⚠️ 这个方法就是你要的「怎么把新生成的快捷方式加进桌面状态」——
   *    它负责三件事：生成 id、找个空位、存进 localStorage。
   */
  addShortcut: (input: {
    kind: "post" | "url";
    name: string;
    icon: string;
    target: string;
  }) => void;

  /** 删掉一个快捷方式（内置应用不能删，会被忽略） */
  removeItem: (id: string) => void;

  /** 挪一个图标到指定格子（拖动功能会用到；重叠时会自动让开） */
  moveItem: (id: string, to: GridPos) => void;

  /** 「排列图标」：把所有图标按默认顺序重新铺一遍，去掉中间的空洞 */
  autoArrange: () => void;

  /** 「重置桌面」：删掉所有快捷方式，内置应用回到默认布局 */
  resetDesktop: () => void;
}

export const useDesktopStore = create<DesktopStore>((set, get) => {
  /** 改 items 之后统一走这里：写盘 + 更新内存，避免漏掉其中一个 */
  const commit = (items: DesktopItem[]) => {
    /**
     * ⚠️ 每次 commit 都按【当前图标档位】重新算行数。
     *
     *    格子高度变了，一列能放几个也变了：
     *      md 档 1080p 能放 11 行，lg 档只能放 9 行。
     *    用过期行数去 sanitize，会把本来合法的图标也挪走。
     */
    const rows = rowsPerColumn(CELL_SIZES[get().iconSize].h);
    const fixed = sanitize(items, rows);
    writeItems(fixed);
    set({ items: fixed });
  };

  return {
    items: [],
    selectedId: null,
    menu: null,
    modalOpen: false,
    modalKind: "post",
    iconSize: "md",
    showIcons: true,

    /**
     * ⚠️ 初值给安全值，真实数据在客户端挂载后由 hydrate() 读进来。
     *
     *    不能在这里直接 readItems() —— 这个模块在【构建期】也会被加载，
     *    那时没有 localStorage。虽然 readItems 里判了 typeof，
     *    但更稳的做法是"初值给安全默认、客户端再校正"，
     *    和 useAppearance / i18n store 是同一个套路。
     *
     * ⚠️ hydrate 里必须先读 iconSize，再读 items ——
     *    readItems 要用档位算网格行数，顺序反了会用错档位去 sanitize。
     */
    hydrate: () => {
      const iconSize = readIconSize();
      set({
        iconSize,
        showIcons: readShowIcons(),
        items: readItems(iconSize),
      });
    },

    select: (id) => set({ selectedId: id }),

    /**
     * ⚠️ 这里【不清空 selectedId】。
     *
     *    因为右键点在一个快捷方式上时，我们要「先选中它、再弹菜单」，
     *    菜单里会因此多出一项「删除」。如果这里顺手把选中清了，
     *    那个删除项就永远出不来 —— 菜单判断的就是 selectedId。
     *
     *    至于「在空白处右键要取消选中」，由调用方显式调 select(null)：
     *    那属于「点了空白」的语义，不该塞进「开菜单」里。
     */
    openMenu: (x, y) => set({ menu: { x, y } }),
    closeMenu: () => set({ menu: null }),

    openModal: (kind) => set({ modalOpen: true, modalKind: kind, menu: null }),
    closeModal: () => set({ modalOpen: false }),

    setIconSize: (size) => {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(KEY_ICON_SIZE, size);
      }

      /**
       * ⚠️ 必须重新 sanitize。
       *
       *    格子高度变了，一列能放几个图标也变了 ——
       *    md 档在 1080p 上能放 11 行，切到 lg 档只有 9 行。
       *    原来在第 10、11 行的图标就"越界"了，必须挪到上面的空位。
       */
      const rows = rowsPerColumn(CELL_SIZES[size].h);
      const items = sanitize(get().items, rows);
      writeItems(items);

      // menu: null —— 选完档位顺手关菜单
      set({ items, iconSize: size, menu: null });
    },

    setShowIcons: (on) => {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(KEY_SHOW_ICONS, on ? "on" : "off");
      }
      set({ showIcons: on, menu: null });
    },

    addShortcut: ({ kind, name, icon, target }) => {
      const items = get().items;

      /**
       * ⚠️ id 要能唯一定位到"哪一个目标"，这样重复添加才能被拦下来。
       *    用 "post:why-win10" 这种前缀 + 目标，而不是随机数 ——
       *    随机 id 的话，同一篇文章能被加十遍，桌面上十个一模一样的图标。
       */
      const id = `${kind}:${target}`;

      if (items.some((i) => i.id === id)) {
        /**
         * 已经有了就【不重复添加】，而是把它选中。
         *
         * ⚠️ 为什么不是"报个错让用户自己找"？
         *    因为桌面可能开着好几个图标，重复添加时用户看不到任何变化，
         *    会以为"点了没反应"。选中它至少给了视觉反馈。
         *    （模态框那边也会提示一句，见 ShortcutModal 的说明。）
         */
        set({ selectedId: id, modalOpen: false });
        return;
      }

      // ⚠️ 传 rows：空位是按"当前档位下一列能放几个"算的
      const slot = findFreeSlot(items, undefined, rowsPerColumn(CELL_SIZES[get().iconSize].h));
      if (!slot) {
        // 网格满了。这里只是不添加，界面上的提示由调用方负责
        console.warn("[desktop] 桌面已放满，无法再添加图标。可以调大 GRID.maxCols。");
        return;
      }

      commit([...items, { id, kind, name, icon, target, position: slot }]);
      set({ selectedId: id, modalOpen: false });
    },

    removeItem: (id) => {
      const items = get().items;
      const item = items.find((i) => i.id === id);
      if (!item) return;

      /**
       * ⚠️ 内置应用不给删。
       *
       *    它们不在 APPS 里"可增删"的范畴 —— 删掉之后桌面上就没有
       *    「此电脑」入口了，而用户没有别的地方能把它加回来。
       *    真要隐藏某个应用，应该改 config/apps.ts 的 DESKTOP_APP_IDS。
       */
      if (item.kind === "app") return;

      commit(items.filter((i) => i.id !== id));
      set({ selectedId: null, menu: null });
    },

    moveItem: (id, to) => {
      const items = get().items;
      const self = items.find((i) => i.id === id);
      if (!self) return;

      const occupant = items.find((i) => i.id !== id && sameSlot(i.position, to));

      if (occupant) {
        /**
         * ⚠️⚠️ 目标格被占了 —— 这就是需求里说的「防止重叠」。
         *
         *    处理方式是【交换】：被占的那个图标挪到"当前这个图标原来的位置"。
         *    这正是 Windows 桌面的行为 —— 把一个图标拖到另一个身上，
         *    两个会交换位置，而不是后面那个被挤得满桌乱跑。
         *
         *    （另一种做法是"给被占的图标找最近空位"，但结果是
         *      用户拖一次、三个图标都动了，很难预期。交换更好懂。）
         */
        commit(
          items.map((i) => {
            if (i.id === id) return { ...i, position: to };
            if (i.id === occupant.id) return { ...i, position: self.position };
            return i;
          }),
        );
        return;
      }

      commit(items.map((i) => (i.id === id ? { ...i, position: to } : i)));
    },

    autoArrange: () => {
      const items = get().items;
      const free: DesktopItem[] = [];

      /**
       * ⚠️ 排序规则：内置应用在前（按 DESKTOP_APP_IDS 的顺序），
       *    快捷方式在后（按名字排）。这样"排列图标"的结果是稳定的 ——
       *    点两次不会得到两种不同的顺序。
       */
      const ordered = [...items].sort((a, b) => {
        if (a.kind === "app" && b.kind !== "app") return -1;
        if (a.kind !== "app" && b.kind === "app") return 1;
        if (a.kind === "app" && b.kind === "app") {
          return DESKTOP_APP_IDS.indexOf(a.appId ?? "") - DESKTOP_APP_IDS.indexOf(b.appId ?? "");
        }
        return (a.name ?? "").localeCompare(b.name ?? "", "zh-CN");
      });

      // ⚠️ 行数按当前图标档位算一次，循环里复用
      const rows = rowsPerColumn(CELL_SIZES[get().iconSize].h);

      // 一个个重新分配位置 —— findFreeSlot 会自然地把空洞填上
      for (const item of ordered) {
        const slot = findFreeSlot(free, undefined, rows);
        if (!slot) break;
        free.push({ ...item, position: slot });
      }

      commit(free);
      set({ selectedId: null, menu: null });
    },

    resetDesktop: () => {
      commit(defaultItems());
      set({ selectedId: null, menu: null });
    },
  };
});
