import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDesktopStore, type IconSize } from "../../store/desktopStore";
import { useT } from "../../i18n";

/**
 * 桌面右键菜单
 * ================================================================
 *
 * 结构对齐 Win10 中文版：
 *
 *   查看 ▸ ── 大 / 中 / 小图标
 *            ── 显示桌面图标
 *   ─────────────
 *   新建文章快捷方式
 *   新建链接快捷方式
 *   ─────────────
 *   自动排列图标
 *   个性化
 *   ─────────────  （只在图标上右键时出现）
 *   删除
 *
 * ── 为什么不做的几项 ──
 *
 *   · 刷新：Win10 的刷新只重绘桌面，不关程序；我们只能 location.reload()，
 *           会把所有打开的窗口杀掉，语义完全不同。宁可没有。
 *   · 粘贴 / 粘贴快捷方式：没有剪贴板概念。
 *   · 排序方式：桌面只有固定应用 + 用户快捷方式，排序结果和「自动排列」一样。
 *   · 显示设置：和「个性化」在我们的控制面板里是同一个页面（外观）。
 *
 * ── 三个必须做对的点 ──
 *
 *   1. 挂到 body 上（createPortal），否则靠近屏幕边缘会被容器裁掉
 *   2. 靠近边缘要往回收，否则最下面那项永远点不到
 *   3. 子菜单也要判断方向：主菜单已经靠右时，子菜单要往左开
 */
export default function ContextMenu() {
  const { t } = useT();

  const menu = useDesktopStore((s) => s.menu);
  const closeMenu = useDesktopStore((s) => s.closeMenu);
  const openModal = useDesktopStore((s) => s.openModal);
  const autoArrange = useDesktopStore((s) => s.autoArrange);
  const removeItem = useDesktopStore((s) => s.removeItem);
  const selectedId = useDesktopStore((s) => s.selectedId);
  const items = useDesktopStore((s) => s.items);
  const iconSize = useDesktopStore((s) => s.iconSize);
  const setIconSize = useDesktopStore((s) => s.setIconSize);
  const showIcons = useDesktopStore((s) => s.showIcons);
  const setShowIcons = useDesktopStore((s) => s.setShowIcons);

  const ref = useRef<HTMLDivElement>(null);
  /** 修正后的位置。初值和 menu 一致，量完再修正 */
  const [pos, setPos] = useState({ x: 0, y: 0 });
  /** 当前展开的子菜单。null = 都没展开 */
  const [openSub, setOpenSub] = useState<string | null>(null);

  /**
   * 「删除」只在右键点着【快捷方式】时出现。
   *
   * ⚠️ 内置应用不给删 —— 删掉之后桌面上就没有它们的入口了，
   *    而用户没有任何办法加回来。要隐藏某个应用应该去改
   *    config/apps.ts 的 DESKTOP_APP_IDS。
   */
  const selected = items.find((i) => i.id === selectedId);
  const canDelete = Boolean(selected && selected.kind !== "app");

  /**
   * 位置修正 + 视口边界处理。
   *
   * ⚠️ 用 useEffect 而不是 useLayoutEffect：
   *    菜单的显隐由 menu !== null 控制，所以这个 effect 跑的时候
   *    DOM 已经在页面上了，能直接量到尺寸。
   */
  useEffect(() => {
    if (!menu) return;
    const el = ref.current;
    if (!el) return;

    const { offsetWidth: w, offsetHeight: h } = el;
    const margin = 4;

    const x = Math.max(margin, Math.min(menu.x, window.innerWidth - w - margin));
    const y = Math.max(margin, Math.min(menu.y, window.innerHeight - h - margin));

    setPos({ x, y });
  }, [menu]);

  /** 每次重新开菜单，子菜单都要收起 */
  useEffect(() => {
    setOpenSub(null);
  }, [menu]);

  /** 点别处 / 按 Esc 关闭 */
  useEffect(() => {
    if (!menu) return;

    const onDown = (e: MouseEvent) => {
      /**
       * ⚠️ 点在菜单内部就不关。
       *    少了这一行，点菜单项会先把菜单关掉、再也没机会触发它的 onClick。
       */
      if (ref.current?.contains(e.target as Node)) return;
      closeMenu();
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu();
    };

    // capture：桌面图标的 onMouseDown 会取消选中，要抢在它前面
    document.addEventListener("mousedown", onDown, true);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [menu, closeMenu]);

  // ⚠️ 没开菜单就什么都不渲染；createPortal 需要 document，所以也判一下
  if (!menu || typeof document === "undefined") return null;

  /**
   * 子菜单往哪边开。
   *
   * ⚠️ 主菜单本身已经被"往回收"过了（上面的 pos.x），
   *    所以要基于【修正后】的 x 判断，不能用 menu.x。
   *
   * 210 是主菜单的大致宽度，150 是子菜单的大致宽度。
   * 用估算值而不是实际测量：这里只需要一个"会不会溢出"的判断，
   * 差十几像素不影响结果，但测量会引入一次额外的布局计算。
   */
  const subSide: "left" | "right" =
    pos.x + 210 + 150 > window.innerWidth ? "left" : "right";

  /** 个性化：打开控制面板的「外观」页 */
  const openPersonalize = () => {
    closeMenu();
    window.dispatchEvent(
      new CustomEvent("os:open-window", {
        detail: {
          id: "control:appearance",
          title: "",
          icon: "/icons/control.png",
          path: "/settings",
        },
      }),
    );
  };

  return createPortal(
    <div
      ref={ref}
      role="menu"
      aria-label={t("dk.menuAria")}
      style={{ left: pos.x, top: pos.y }}
      className="fixed z-[200] min-w-[200px] rounded-[3px] border border-[var(--surface-border)]
                 bg-[var(--surface)] py-1 text-[12.5px] text-[var(--fg)]
                 shadow-[0_6px_20px_rgba(0,0,0,.22)]"
    >
      {/* ── 查看 ▸ ── */}
      <Item
        icon="👁"
        label={t("dk.view")}
        hasSub
        open={openSub === "view"}
        onEnter={() => setOpenSub("view")}
        onLeave={() => setOpenSub(null)}
        side={subSide}
      >
        <MenuItem
          label={t("dk.sizeLarge")}
          checked={iconSize === "lg"}
          onClick={() => setIconSize("lg")}
        />
        <MenuItem
          label={t("dk.sizeMedium")}
          checked={iconSize === "md"}
          onClick={() => setIconSize("md")}
        />
        <MenuItem
          label={t("dk.sizeSmall")}
          checked={iconSize === "sm"}
          onClick={() => setIconSize("sm")}
        />

        <Divider />

        <MenuItem
          label={t("dk.showIcons")}
          checked={showIcons}
          onClick={() => setShowIcons(!showIcons)}
          /**
           * ⚠️ 隐藏图标之后，菜单会立刻关掉（setShowIcons 里 set menu: null）。
           *    这是必须的 —— 否则菜单还浮在空桌面上，看起来很怪。
           *    而且用户想再打开图标时，右键空白处就能调出菜单。
           */
        />
      </Item>

      <Divider />

      {/* ── 新建 ── */}
      <MenuItem
        icon="📄"
        label={t("dk.newPost")}
        onClick={() => openModal("post")}
      />
      <MenuItem
        icon="🔗"
        label={t("dk.newUrl")}
        onClick={() => openModal("url")}
      />

      <Divider />

      {/* ── 整理 / 设置 ── */}
      <MenuItem icon="▦" label={t("dk.arrange")} onClick={autoArrange} />
      <MenuItem icon="⚙" label={t("dk.personalize")} onClick={openPersonalize} />

      {/* ── 删除（只在快捷方式上出现）── */}
      {canDelete && (
        <>
          <Divider />
          <MenuItem
            icon="🗑"
            label={t("dk.delete")}
            danger
            onClick={() => {
              if (selected) removeItem(selected.id);
              closeMenu();
            }}
          />
        </>
      )}
    </div>,
    document.body,
  );
}

/* ════════════════════════════════════════════════════════════════
   小零件
   ════════════════════════════════════════════════════════════════ */

/**
 * 一行菜单项，可选带子菜单。
 *
 * ⚠️ 为什么外壳是 div、里面才是 button：
 *    带子菜单的项需要"按钮 + 浮层"两层结构，而浮层必须是这个 div 的子元素 ——
 *    这样鼠标移进子菜单时不会触发父级的 mouseleave，
 *    子菜单才不会一碰就消失。
 *
 * ⚠️ 为什么用 mouseenter 而不是 mouseover：
 *    mouseenter 不冒泡。用 mouseover 的话，鼠标在项内部从一个文字移到
 *    另一个文字都会反复触发，子菜单会闪。
 */
function Item({
  icon,
  label,
  hasSub,
  open,
  onEnter,
  onLeave,
  side = "right",
  children,
}: {
  icon: string;
  label: string;
  /** 右边是否显示 ▸ */
  hasSub?: boolean;
  /** 子菜单开着吗 */
  open?: boolean;
  onEnter?: () => void;
  /** 鼠标离开这一项（含它的子菜单）时触发 */
  onLeave?: () => void;
  /** 子菜单往哪边开。默认贴右边，靠近屏幕边缘时由父组件改成 left */
  side?: "left" | "right";
  /** 子菜单内容 */
  children?: React.ReactNode;
}) {
  return (
    /**
     * ⚠️ mouseleave 挂在【外层 div】上，不是按钮上。
     *
     *    子菜单是这个 div 的子元素（视觉上飘在外面，DOM 上仍是子节点），
     *    所以鼠标移进子菜单不会触发 mouseleave —— 子菜单不会一碰就消失。
     *    而移到下面的「新建」项属于离开了这个 div，会正常收起。
     */
    <div className="relative" onMouseEnter={onEnter} onMouseLeave={onLeave}>
      <div
        className={`flex w-full items-center gap-2 px-3 py-[6px] text-left
                    ${open ? "bg-[var(--accent)] text-white" : ""}`}
      >
        <span className="w-4 shrink-0 text-center text-[12px] leading-none" aria-hidden="true">
          {icon}
        </span>
        <span className="flex-1 truncate">{label}</span>
        {hasSub && (
          <span className="shrink-0 text-[9px] opacity-70" aria-hidden="true">
            ▶
          </span>
        )}
      </div>

      {/*
        ⚠️ 子菜单的定位：
             默认 left-full（贴右边）
             靠近屏幕右边缘时 right-full（贴左边）
             top-0 让它和父项顶部对齐

        ⚠️ 子菜单也是 createPortal 出来的菜单的一部分，
           所以不需要再处理"点外面关闭" —— 外层已经管了。
      */}
      {open && (
        <div
          role="menu"
          className={`absolute top-0 z-10 min-w-[150px] rounded-[3px]
                      border border-[var(--surface-border)] bg-[var(--surface)] py-1
                      shadow-[0_6px_20px_rgba(0,0,0,.22)]
                      ${side === "left" ? "right-full -mr-[2px]" : "left-full -ml-[2px]"}`}
        >
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * 普通菜单项。
 *
 * ⚠️ 为什么用 button 而不是 div：
 *    键盘用户要能用 Tab 走过来、回车触发。
 *    用 div + onClick 的话，屏幕阅读器根本不知道这能点。
 */
function MenuItem({
  icon,
  label,
  onClick,
  danger,
  checked,
}: {
  icon?: string;
  label: string;
  onClick: () => void;
  /** 危险操作（会被标红）—— 目前只有「删除」 */
  danger?: boolean;
  /** 前面是否显示 ✓ */
  checked?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`flex w-full items-center gap-2 px-3 py-[6px] text-left transition-colors
                  hover:bg-[var(--accent)] hover:text-white
                  focus:outline-none focus-visible:bg-[var(--accent)] focus-visible:text-white
                  ${danger ? "text-[#c0392b] hover:text-white" : ""}`}
    >
      {/* 勾选位。没有图标时也占位，保证所有项的文字左对齐 */}
      <span
        className="w-4 shrink-0 text-center text-[11px] leading-none"
        aria-hidden="true"
      >
        {checked ? "✓" : icon ?? ""}
      </span>
      <span className="flex-1 truncate">{label}</span>
    </button>
  );
}

/** 分隔线。Win10 的右键菜单里是靠一条浅灰细线分组 */
function Divider() {
  return <div className="my-1 h-px bg-[var(--surface-border)]" />;
}
