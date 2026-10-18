import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDesktopStore } from "../../store/desktopStore";
import { useT } from "../../i18n";
import type { ClientPost } from "../../lib/markdown";

/**
 * 「新建快捷方式」模态框
 * ================================================================
 *
 * 两个标签页，产出的都是桌面上的一个图标：
 *
 *   文章 → 双击在桌面里打开文章窗口（和从「此电脑」里点进去一样）
 *   链接 → 双击在新标签页打开外部地址
 *
 * ── ⚠️ 为什么文章这边做成「可搜索列表」，而不是让用户填 slug ──
 *
 *   需求里写的是「输入文章 ID 或选择现有的文章列表」。
 *   我选了后者为主：因为 slug 是文件名，用户基本记不住 ——
 *   让他手打 "why-win10"，打错一个字母就什么都找不到，
 *   而且报错只会是"文章不存在"，他也不知道该打成什么。
 *
 *   列表还带搜索框，输入标题里的几个字就能筛出来。
 *   （下面仍然保留"手动输入 slug"的路子？没有 —— 列表 + 搜索已经够了，
 *     再加一个输入框只会让人犹豫该用哪个。）
 *
 * ── ⚠️ 重复添加怎么办 ──
 *
 *   store.addShortcut 里会拦下来（同 id 不重复加），并选中已有的那个。
 *   这个组件负责在按钮上给一句提示，免得用户以为"点了没反应"。
 */
export default function ShortcutModal({ posts }: { posts: ClientPost[] }) {
  const { t } = useT();

  const open = useDesktopStore((s) => s.modalOpen);
  const initialKind = useDesktopStore((s) => s.modalKind);
  const items = useDesktopStore((s) => s.items);
  const closeModal = useDesktopStore((s) => s.closeModal);
  const addShortcut = useDesktopStore((s) => s.addShortcut);

  const [tab, setTab] = useState<"post" | "url">("post");
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<ClientPost | null>(null);
  const [url, setUrl] = useState("");
  const [urlName, setUrlName] = useState("");

  const searchRef = useRef<HTMLInputElement>(null);

  /**
   * 每次打开时重置表单。
   *
   * ⚠️ 为什么需要这个？
   *    模态框只是显隐切换（组件没卸载），上一次填的内容会留着。
   *    用户第二次打开看到"上次输入的 bilibili"，会以为界面坏了。
   */
  useEffect(() => {
    if (!open) return;
    setTab(initialKind);
    setQuery("");
    setPicked(null);
    setUrl("");
    setUrlName("");
  }, [open, initialKind]);

  /** 打开后自动聚焦搜索框 —— 少点一次鼠标 */
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => searchRef.current?.focus(), 50);
    return () => window.clearTimeout(id);
  }, [open, tab]);

  /** Esc 关闭 */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closeModal]);

  /** 按标题 / 摘要 / 分类 / 标签筛文章 */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return posts;
    return posts.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.tags.some((tag) => tag.toLowerCase().includes(q)),
    );
  }, [posts, query]);

  if (!open || typeof document === "undefined") return null;

  /* ── 判断"能不能确定" ── */

  const urlTrimmed = url.trim();
  const urlOk = /^https?:\/\/\S+$/i.test(urlTrimmed);

  /**
   * URL 快捷方式的名字：用户没填就用域名。
   *
   * ⚠️ 用 URL 构造函数取 hostname，而不是正则抠字符串 ——
   *    后者要处理端口、路径、查询串，很容易漏。
   *    包 try 是因为不合法的 URL 会抛错（虽然上面已经校验过了，
   *    但校验通过不代表构造函数一定不抛，比如 "https://" 这种）。
   */
  const autoName = useMemo(() => {
    if (!urlOk) return "";
    try {
      return new URL(urlTrimmed).hostname.replace(/^www\./, "");
    } catch {
      return urlTrimmed;
    }
  }, [urlTrimmed, urlOk]);

  const finalUrlName = urlName.trim() || autoName;

  const canSubmit = tab === "post" ? Boolean(picked) : urlOk;

  /** 这个目标是不是已经在桌面上了（用来提示用户） */
  const target = tab === "post" ? picked?.slug ?? "" : urlTrimmed;
  const alreadyOnDesktop = items.some((i) => i.id === `${tab}:${target}`);

  const submit = () => {
    if (!canSubmit) return;

    if (tab === "post" && picked) {
      addShortcut({
        kind: "post",
        name: picked.title,
        icon: "📄",
        target: picked.slug,
      });
      return;
    }

    if (tab === "url" && urlOk) {
      addShortcut({
        kind: "url",
        name: finalUrlName,
        // 外部链接用地球图标；桌面上还会额外画一个小箭头区分（见 DesktopIcons）
        icon: "🌐",
        target: urlTrimmed,
      });
    }
  };

  return createPortal(
    /*
      ⚠️ 遮罩层点一下关闭。
         但必须判 e.target === e.currentTarget ——
         否则在框里选文字、拖鼠标时松手到遮罩上，也会被当成"点了外面"而关掉。
    */
    <div
      className="fixed inset-0 z-[300] grid place-items-center bg-black/35 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) closeModal();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("dk.modalTitle")}
        className="w-full max-w-[420px] overflow-hidden rounded-[6px] border
                   border-[var(--surface-border)] bg-[var(--surface)] text-[var(--fg)]
                   shadow-[0_18px_50px_rgba(0,0,0,.35)]"
      >
        {/* ── 标题栏 ── */}
        <div className="flex items-center gap-2 border-b border-[var(--surface-border)] bg-[var(--surface-2)] px-4 py-2.5">
          <span className="text-[14px] font-semibold">{t("dk.modalTitle")}</span>
          <button
            type="button"
            onClick={closeModal}
            aria-label={t("dk.cancel")}
            className="ml-auto grid h-6 w-6 place-items-center rounded text-[var(--fg-dim)]
                       transition-colors hover:bg-[#e81123] hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* ── 类型切换 ── */}
        <div className="flex gap-1 border-b border-[var(--surface-border)] px-3 pt-3">
          <Tab active={tab === "post"} onClick={() => setTab("post")}>
            📄 {t("dk.tabPost")}
          </Tab>
          <Tab active={tab === "url"} onClick={() => setTab("url")}>
            🔗 {t("dk.tabUrl")}
          </Tab>
        </div>

        {/* ── 内容 ── */}
        <div className="p-4">
          {tab === "post" ? (
            <>
              <label className="mb-1.5 block text-[11.5px] text-[var(--fg-dim)]">
                {t("dk.pickPost")}
              </label>

              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("dk.searchPost")}
                className="mb-2 w-full rounded-[3px] border border-[var(--surface-border)]
                           bg-[var(--surface)] px-2.5 py-1.5 text-[12.5px] outline-none
                           transition-colors focus:border-[var(--accent)]"
              />

              {/*
                ⚠️ 列表限高 + 自己滚动。
                   文章多的时候不限高会把模态框撑到屏幕外面，
                   底部的"确定"按钮就点不到了。
              */}
              <div className="h-[190px] overflow-y-auto rounded-[3px] border border-[var(--surface-border)]">
                {filtered.length === 0 ? (
                  <div className="grid h-full place-items-center text-[12px] text-[var(--fg-faint)]">
                    {t("dk.noPostFound")}
                  </div>
                ) : (
                  filtered.map((p) => (
                    <button
                      key={p.slug}
                      type="button"
                      onClick={() => setPicked(p)}
                      className={`flex w-full items-center gap-2 px-2.5 py-2 text-left text-[12.5px]
                                  transition-colors ${
                                    picked?.slug === p.slug
                                      ? "bg-[var(--accent)] text-white"
                                      : "hover:bg-[var(--hover)]"
                                  }`}
                    >
                      <span className="shrink-0">📄</span>
                      <span className="min-w-0 flex-1 truncate">{p.title}</span>
                      <span
                        className={`shrink-0 text-[10.5px] ${
                          picked?.slug === p.slug ? "text-white/70" : "text-[var(--fg-faint)]"
                        }`}
                      >
                        {p.category}
                      </span>
                    </button>
                  ))
                )}
              </div>

              {picked && (
                <p className="mt-2 text-[11px] leading-relaxed text-[var(--fg-faint)]">
                  {t("dk.willCreate")}「📄 {picked.title}」
                </p>
              )}
            </>
          ) : (
            <>
              <label className="mb-1.5 block text-[11.5px] text-[var(--fg-dim)]">
                {t("dk.urlLabel")}
              </label>
              <input
                ref={searchRef}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.bilibili.com"
                spellCheck={false}
                className="w-full rounded-[3px] border border-[var(--surface-border)]
                           bg-[var(--surface)] px-2.5 py-1.5 text-[12.5px] outline-none
                           transition-colors focus:border-[var(--accent)]"
              />

              {/*
                ⚠️ 只在"用户输了东西、但格式不对"时才报错。
                   一打开就红着字说"地址不合法"很劝退 ——
                   用户什么都还没输呢。
              */}
              {urlTrimmed && !urlOk && (
                <p className="mt-1.5 text-[11px] text-[#c0392b]">{t("dk.urlInvalid")}</p>
              )}

              <label className="mb-1.5 mt-3 block text-[11.5px] text-[var(--fg-dim)]">
                {t("dk.urlName")}
              </label>
              <input
                value={urlName}
                onChange={(e) => setUrlName(e.target.value)}
                placeholder={autoName || t("dk.urlNamePlaceholder")}
                className="w-full rounded-[3px] border border-[var(--surface-border)]
                           bg-[var(--surface)] px-2.5 py-1.5 text-[12.5px] outline-none
                           transition-colors focus:border-[var(--accent)]"
              />
              <p className="mt-1.5 text-[11px] text-[var(--fg-faint)]">{t("dk.urlNameHint")}</p>

              {urlOk && (
                <p className="mt-2 text-[11px] leading-relaxed text-[var(--fg-faint)]">
                  {t("dk.willCreate")}「🌐 {finalUrlName}」
                </p>
              )}
            </>
          )}

          {/* 已经在桌面上时给一句提示 —— 否则用户会以为"点了没反应" */}
          {canSubmit && alreadyOnDesktop && (
            <p className="mt-2 rounded-[3px] bg-[var(--surface-3)] px-2 py-1.5 text-[11px] text-[var(--fg-dim)]">
              {t("dk.alreadyExists")}
            </p>
          )}
        </div>

        {/* ── 底部按钮 ── */}
        <div className="flex items-center justify-end gap-2 border-t border-[var(--surface-border)] bg-[var(--surface-2)] px-4 py-2.5">
          <button
            type="button"
            onClick={closeModal}
            className="rounded-[3px] border border-[var(--surface-border)] px-3.5 py-1.5 text-[12.5px]
                       text-[var(--fg-dim)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--fg)]"
          >
            {t("dk.cancel")}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className="rounded-[3px] bg-[var(--accent)] px-3.5 py-1.5 text-[12.5px] text-white
                       transition-opacity hover:opacity-90
                       disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t("dk.confirm")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ── 小零件 ── */

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-t-[4px] border-b-2 px-3 py-2 text-[12.5px] transition-colors ${
        active
          ? "border-[var(--accent)] font-medium text-[var(--fg)]"
          : "border-transparent text-[var(--fg-dim)] hover:text-[var(--fg)]"
      }`}
    >
      {children}
    </button>
  );
}
