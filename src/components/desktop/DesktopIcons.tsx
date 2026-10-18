import { useEffect, useRef, useState } from "react";
import {
  useDesktopStore,
  GRID,
  TASKBAR_H,
  CELL_SIZES,
  rowsPerColumn,
  type DesktopItem,
  type GridPos,
} from "../../store/desktopStore";
import { findApp } from "../../config/apps";
import { useT } from "../../i18n";
import type { Dict } from "../../i18n/types";
import type { ClientPost } from "../../lib/markdown";
import ContextMenu from "./ContextMenu";
import ShortcutModal from "./ShortcutModal";

/**
 * 桌面图标层（React 版）
 * ================================================================
 *
 * ⚠️⚠️ 这一层以前是 Astro 在【构建期】渲染的静态 HTML，靠
 *    DesktopLayout 里一段裸 JS 监听双击。换 React 是为了有状态：
 *    拖动要记位置、右键要开菜单、图标要能增删。
 *
 * ── 布局 ──
 *
 *   绝对定位 + 手算坐标，不用 CSS Grid。
 *   因为拖动必须自己知道"落在第几行第几列"。CSS Grid 的自动排布
 *   不提供这个信息，反推很绕。自己算就没这问题：
 *   位置是一份纯数据（col/row），拖动改数据，渲染只管画。
 *
 * ── 拖动为什么用 Pointer Events 而不是 mouse + touch 两套 ──
 *
 *   Pointer Events 把鼠标、触摸、触控笔统一成一套 API。
 *   而且 setPointerCapture 能保证"鼠标快速移出元素"时
 *   后续事件仍然发给这个元素 —— 用 mouse 事件的话，
 *   甩一下就丢 pointerup，图标会卡在拖动状态。
 */
export default function DesktopIcons({ posts }: { posts: ClientPost[] }) {
  const items = useDesktopStore((s) => s.items);
  const hydrate = useDesktopStore((s) => s.hydrate);
  const select = useDesktopStore((s) => s.select);
  const openMenu = useDesktopStore((s) => s.openMenu);
  const moveItem = useDesktopStore((s) => s.moveItem);
  const iconSize = useDesktopStore((s) => s.iconSize);
  const showIcons = useDesktopStore((s) => s.showIcons);

  /**
   * ⚠️ 客户端挂载后才读 localStorage。
   *
   *    store 的初值是空数组（构建期没有 localStorage），
   *    真实数据靠这一次 hydrate 同步进来。
   *    和 useAppearance / i18n store 是同一个套路。
   */
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  /** 双击一个图标 —— 按类型分流到不同的打开方式 */
  const launch = (item: DesktopItem) => {
    if (item.kind === "app") {
      const app = findApp(item.appId ?? "");
      if (!app) return;

      /**
       * ⚠️ pageOnly：直接打开静态页，【不进窗口系统】。
       *
       *    和下面的 CustomEvent 是两条完全不同的路：
       *      pageOnly  → 新标签页，有导航栏/页脚/主题切换
       *      其他      → 桌面窗口，没有那些
       *
       *    window.open 在 dblclick 里调用，属于用户手势，
       *    不会被浏览器的弹窗拦截器挡掉。
       */
      if (app.pageOnly) {
        window.open(app.path, "_blank", "noopener,noreferrer");
        return;
      }

      /**
       * ⚠️ 走 CustomEvent 而不是直接调 windowStore。
       *
       *    桌面图标层和窗口层是【两个独立的岛屿】，没有父子关系，
       *    拿不到同一个 React Context。用事件通信是它们之间唯一干净的通道。
       */
      window.dispatchEvent(
        new CustomEvent("os:open-window", {
          detail: { id: app.id, title: "", icon: app.icon, path: app.path },
        }),
      );
      return;
    }

    if (item.kind === "post") {
      window.dispatchEvent(
        new CustomEvent("os:open-post", {
          detail: { slug: item.target, title: item.name, icon: "📄" },
        }),
      );
      return;
    }

    if (item.kind === "url" && item.target) {
      // ⚠️ noopener 不能省：防止被打开的页面通过 window.opener 操作本站
      window.open(item.target, "_blank", "noopener,noreferrer");
    }
  };

  const cell = CELL_SIZES[iconSize];

  return (
    <>
      {/*
        ⚠️ 这一层铺满整个桌面，pointer-events 是 auto ——
           因为"在空白处右键"必须能被它接住。

           它不会挡住窗口：DOM 上它排在窗口层之后，但窗口的 z-index
           从 10 起，图标层没有 z-index（0 层级）。谁在上谁先接到事件。

           ⚠️ 别给它加 z-index。加了就要保证比 10 小，
              否则窗口会被图标层盖住、点不动。

        ⚠️ 即使 showIcons 为 false，这个容器【也必须存在】。
           否则图标藏起来之后，桌面空白处没有元素接右键，
           菜单就再也调不出来，用户只能清 localStorage 才能恢复。
      */}
      <div
        className="absolute inset-0"
        onContextMenu={(e) => {
          /**
           * ⚠️ 这里只处理【空白处】的右键。
           *
           *    图标自己的 onContextMenu 会 stopPropagation，
           *    所以点到图标时根本走不到这里 —— 那边要"先选中再开菜单",
           *    因为菜单里的「删除」依赖 selectedId。
           *
           *    preventDefault 是必须的：不拦的话，在"桌面"上右键会弹出
           *    浏览器的「检查元素 / 另存为 / 翻译成中文」，非常出戏。
           */
          if (e.target === e.currentTarget) select(null);
          e.preventDefault();
          openMenu(e.clientX, e.clientY);
        }}
        onMouseDown={(e) => {
          // 点空白处 = 取消选中（Windows 的行为）
          if (e.target === e.currentTarget) select(null);
        }}
      >
        {showIcons &&
          items.map((item) => (
            <DesktopIcon
              key={item.id}
              item={item}
              cell={cell}
              onLaunch={launch}
              onMove={moveItem}
            />
          ))}
      </div>

      {/* 右键菜单和「新建快捷方式」模态框都挂在 body 上（内部用 portal），
          放这里只是为了跟着图标层一起挂载 */}
      <ContextMenu />
      <ShortcutModal posts={posts} />
    </>
  );
}

/* ════════════════════════════════════════════════════════════════
   单个图标
   ════════════════════════════════════════════════════════════════ */

/**
 * 移动超过这个距离才算「拖动」，否则算「点击」。
 *
 * ⚠️ 为什么必须有这个阈值：
 *    光看"按下"和"松开"分不清点击和拖动。手抖 2 像素就判定成拖动的话，
 *    用户想选中图标，结果图标被挪走了一格 —— 非常恼人。
 */
const DRAG_THRESHOLD = 4;

function DesktopIcon({
  item,
  cell,
  onLaunch,
  onMove,
}: {
  item: DesktopItem;
  /** 当前图标档位的格子尺寸。由父组件传下来，避免每个图标都去订阅 store */
  cell: { w: number; h: number; icon: number; font: number };
  onLaunch: (item: DesktopItem) => void;
  onMove: (id: string, to: GridPos) => void;
}) {
  const { t } = useT();

  const selectedId = useDesktopStore((s) => s.selectedId);
  const select = useDesktopStore((s) => s.select);
  const openMenu = useDesktopStore((s) => s.openMenu);

  /** 内置应用去注册表查；快捷方式直接读存在 item 里的 */
  const app = item.kind === "app" ? findApp(item.appId ?? "") : undefined;
  const label = app ? t(app.nameKey as keyof Dict) : (item.name ?? "");
  const icon = app ? app.icon : (item.icon ?? "📄");
  const selected = selectedId === item.id;

  /** 图标要么是 emoji，要么是 public/ 下的图片 —— 判断规则和别处一致 */
  const isImg = icon.startsWith("/") || /^https?:\/\//.test(icon);

  /* ── 拖动状态 ── */

  /**
   * 跟手的位移。null = 没在拖。
   *
   * ⚠️ 拖动过程中【不】改 item.position —— 那样每一帧都要写 localStorage，
   *    而且 store 一更新整层都会重渲染。这里只用 transform 偏移，
   *    松手时才真正落格、写盘。
   */
  const [drag, setDrag] = useState<{ dx: number; dy: number } | null>(null);

  /** 本次手势的起点。用 ref 是因为它变化不需要触发重渲染 */
  const gesture = useRef<{
    pointerId: number;
    x: number;
    y: number;
    moved: boolean;
  } | null>(null);

  /**
   * 拖动结束后要吃掉紧跟而来的那次 click。
   *
   * ⚠️ 为什么需要它：
   *    <button> 上按住、移动、松开，浏览器仍然会补发一次 click。
   *    不拦的话，用户拖完图标会「顺带被选中」。
   *
   * ⚠️ 为什么用 setTimeout(0) 清零而不是立刻清零：
   *    事件顺序是 pointerup → mouseup → click，都在同一个任务里同步派发。
   *    setTimeout 排到下一个任务，所以 click 处理时它还是 true。
   */
  const swallowClick = useRef(false);

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    // 只处理左键。右键交给 onContextMenu，中键忽略
    if (e.button !== 0) return;

    /**
     * ⚠️ setPointerCapture 是拖动不丢事件的关键。
     *
     *    不设的话，鼠标一旦移出这个格子，
     *    pointermove 就不再发给它 —— 拖动会中途"断掉"，
     *    松手也收不到 pointerup，图标永远卡在半路。
     */
    e.currentTarget.setPointerCapture(e.pointerId);

    gesture.current = {
      pointerId: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      moved: false,
    };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const g = gesture.current;
    if (!g || g.pointerId !== e.pointerId) return;

    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;

    // 还没超过阈值：不进入拖动状态，让 click 正常工作
    if (!g.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;

    g.moved = true;
    setDrag({ dx, dy });
  };

  /** 手势结束（松手）。真的落格 + 写盘都在这里 */
  const endGesture = (e: React.PointerEvent<HTMLButtonElement>) => {
    const g = gesture.current;
    gesture.current = null;
    if (!g) return;

    const el = e.currentTarget;
    if (el.hasPointerCapture(g.pointerId)) el.releasePointerCapture(g.pointerId);

    // 没移动 = 这只是一次点击，什么都不用做
    if (!g.moved) {
      setDrag(null);
      return;
    }

    swallowClick.current = true;
    window.setTimeout(() => {
      swallowClick.current = false;
    }, 0);
    setDrag(null);

    /**
     * ⚠️ 松手位置在任务栏上 = 放弃这次拖动。
     *    Windows 里把图标拖到任务栏也是取消，不是吸附。
     */
    if (e.clientY > window.innerHeight - TASKBAR_H) return;

    /**
     * ⚠️ 位移用【松手时】的坐标减起点，而不是取最后一次 pointermove 的值。
     *    快速甩动时两者会差几像素，用松手位置更贴近用户"最后停在哪"的直觉。
     */
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;

    // 图标左上角的像素位置 + 本次位移 = 松手时它应该在的位置
    const left = GRID.padX + item.position.col * cell.w + dx;
    const top = GRID.padY + item.position.row * cell.h + dy;

    /**
     * ⚠️ Math.round = 网格吸附。
     *    除以格子尺寸之后四舍五入，就是"离哪一格最近就归哪一格"。
     */
    const col = Math.round((left - GRID.padX) / cell.w);
    const row = Math.round((top - GRID.padY) / cell.h);

    const target: GridPos = {
      col: Math.min(Math.max(col, 0), GRID.maxCols - 1),
      // ⚠️ 行数按当前档位的格子高度算 —— 大图标档位一列放得少
      row: Math.min(Math.max(row, 0), rowsPerColumn(cell.h) - 1),
    };

    // 原地放下：不写盘（省一次 localStorage 写入）
    if (target.col === item.position.col && target.row === item.position.row) return;

    /**
     * ⚠️ 真正的落格交给 store.moveItem()，它负责：
     *    · 目标格被占 → 和对方交换位置（Windows 的行为）
     *    · 写 localStorage
     */
    onMove(item.id, target);
  };

  /** 手势被系统打断（触屏来了电话、浏览器切标签…）—— 直接放弃，不落格 */
  const cancelGesture = (e: React.PointerEvent<HTMLButtonElement>) => {
    const g = gesture.current;
    gesture.current = null;
    setDrag(null);
    if (g && e.currentTarget.hasPointerCapture(g.pointerId)) {
      e.currentTarget.releasePointerCapture(g.pointerId);
    }
  };

  return (
    <button
      type="button"
      /**
       * ⚠️ 绝对定位 + 手算像素。
       *
       *    网格坐标 → 像素只在这一处发生转换（col * cell.w）。
       *    store、拖动逻辑一律只认 col/row，这样"换屏幕尺寸"、
       *    "换图标大小"时都不存在"存的像素失效"的问题。
       */
      style={{
        left: GRID.padX + item.position.col * cell.w,
        top: GRID.padY + item.position.row * cell.h,
        width: cell.w,
        height: cell.h,
        // 拖动中只动 transform，不动 left/top —— 后者会触发整层重排
        transform: drag ? `translate(${drag.dx}px, ${drag.dy}px)` : undefined,
        /**
         * ⚠️⚠️ 拖动中禁用过渡；松手后【也不要】给 left/top 加过渡。
         *
         *    松手那一刻 left 改新值、transform 归零，两者视觉总和是连续的。
         *    但如果给 left 加 120ms 过渡、transform 却瞬间归零，
         *    就会出现"图标先弹回原位、再滑到新位置"的闪烁。
         *    不加过渡 = 瞬间吸附，正是 Win10 的手感。
         */
        transition: drag ? "none" : undefined,
        zIndex: drag ? 30 : undefined,
        opacity: drag ? 0.8 : undefined,
      }}
      data-icon-id={item.id}
      aria-label={label}
      onClick={() => {
        // 拖动刚结束，吃掉这次 click
        if (swallowClick.current) return;
        select(item.id);
      }}
      onDoubleClick={() => {
        if (swallowClick.current) return;
        onLaunch(item);
      }}
      onContextMenu={(e) => {
        /**
         * ⚠️ 图标上的右键必须 stopPropagation。
         *
         *    不拦的话会冒泡到桌面容器，那里会 select(null) ——
         *    刚选中的图标立刻被取消，菜单里的「删除」就闪没了。
         */
        e.preventDefault();
        e.stopPropagation();
        select(item.id);
        openMenu(e.clientX, e.clientY);
      }}
      onKeyDown={(e) => {
        // 键盘可达：回车/空格 = 打开（键盘用户没有"双击"）
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onLaunch(item);
        }
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endGesture}
      onPointerCancel={cancelGesture}
      className={`absolute flex cursor-default select-none touch-none flex-col items-center justify-center gap-1
                  rounded p-1.5 transition-colors
                  ${drag ? "cursor-grabbing will-change-transform" : ""}
                  ${selected ? "bg-white/25 outline outline-1 outline-white/50" : "hover:bg-white/15"}
                  focus:outline-none focus-visible:bg-white/25`}
    >
      <div className="grid place-items-center" style={{ height: cell.icon }}>
        {isImg ? (
          <img
            src={icon}
            alt=""
            style={{ width: cell.icon, height: cell.icon }}
            /**
             * ⚠️ draggable="false" 必须写。
             *    不写的话，按住图片会触发浏览器【原生图片拖拽】——
             *    你会看到一个半透明的图片跟着鼠标飞，
             *    而我们的拖动逻辑同时也在跑，两个影子叠在一起。
             */
            draggable="false"
            className="pointer-events-none object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,.5)]"
          />
        ) : (
          <span
            className="pointer-events-none leading-none drop-shadow-[0_2px_4px_rgba(0,0,0,.5)]"
            /* emoji 的字号 ≈ 图标尺寸的 0.68 倍时视觉上刚好填满 */
            style={{ fontSize: Math.round(cell.icon * 0.68) }}
          >
            {icon}
          </span>
        )}
      </div>

      <span
        className="pointer-events-none line-clamp-2 w-full text-center leading-tight text-white
                   [overflow-wrap:anywhere] [text-shadow:0_1px_3px_rgba(0,0,0,.95)]"
        style={{ fontSize: cell.font }}
      >
        {label}
      </span>

      {/*
        ⚠️ 外部链接的小箭头 —— Windows 区分"普通图标"和"快捷方式"的方式。
           需求里说"可以加一个小箭头或者不同的底色"，这里两个都做了：
           小箭头 + 半透明黑底（保证在浅色壁纸上也看得见）。

        ⚠️ 不加在"文章快捷方式"上，因为它打开的是站内窗口，
           不是"跳去别的地方"，加箭头反而误导。
      */}
      {item.kind === "url" && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-[22%] left-[14%] grid h-[13px] w-[13px]
                     place-items-center rounded-[2px] bg-black/55 text-[8px] leading-none text-white
                     shadow-[0_1px_2px_rgba(0,0,0,.4)]"
        >
          ↗
        </span>
      )}
    </button>
  );
}
