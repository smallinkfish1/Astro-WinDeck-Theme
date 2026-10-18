import type { DictMap } from "./types";

/**
 * English dictionary
 * ================================================================
 *
 * ⚠️ System component names follow [Microsoft's official Windows 10
 *    terminology] word for word — that's the whole point of this file.
 *    Cross-checked against Microsoft Language Portal / Windows UI
 *    string conventions:
 *
 *      This PC · Recycle Bin · Control Panel · Notepad · File Explorer
 *      Start · Settings · Personalization · Display · About
 *      Shut down / Restart / Sleep · Folder · Type · Size · Name
 *      Date modified · Sort by · New folder · Properties · Open · Edit
 *      Administrator · Date & time · Language & region
 *
 *    Where Microsoft uses a specific capitalisation ("Date modified",
 *    lowercase "modified"), this file keeps it. Don't "fix" it to
 *    "Date Modified" — that would make it *less* authentic.
 *
 * ⚠️ App names that belong to this blog (Blog Explorer, Drafts,
 *    About This Blog) are the owner's own naming, not Microsoft's.
 *
 * ⚠️ Placeholders {like} {this} must survive translation unchanged —
 *    they're substituted at runtime. Reordering them is fine;
 *    deleting one breaks the sentence silently.
 */
export const en: DictMap = {
  /* ── App names ── */
  "app.thisPC": "This PC",
  "app.notepad": "Notepad",
  "app.browser": "Blog Explorer",
  "app.recycleBin": "Recycle Bin",
  "app.controlPanel": "Control Panel",
  "app.tags": "Tags",
  "app.about": "About",
  "app.archive": "Archive",
  "app.posts": "Latest Posts",
  "app.allPosts": "All posts",
  "app.search": "Search",
  "app.bilibili": "Bilibili",
  "app.github": "GitHub",
  "app.photos": "Photos",
  "app.aboutMe": "About Me",

  /* ── Window controls ── */
  "win.minimize": "Minimize",
  "win.maximize": "Maximize",
  "win.restore": "Restore Down",
  "win.close": "Close",
  "win.emptyTitle": "This window has no content yet.",
  "win.emptyBody": "There's no view for this window — the path may be incorrect.",
  "win.emptyPath": "URL path: {path}",
  "win.notFoundPost": "Post not found: {slug}",
  "win.notFoundDraft": "Draft not found: {slug}",
  "win.unknownType": "This window can't be opened",
  "win.comingSoon": "Coming soon…",
  "win.readonlySuffix": " (read-only)",
  "win.tagTitle": "Tag: {name}",
  "win.categoryTitle": "Category: {name}",
  "win.controlPanelTitle": "Control Panel - {name}",

  /* ── Taskbar ── */
  "taskbar.start": "Start",
  "taskbar.showDesktop": "Show desktop",
  "taskbar.openCalendar": "Open calendar",

  /* ── Start menu ── */
  "menu.recentlyAdded": "Recently added",
  "menu.expand": "Expand",
  "menu.collapse": "Collapse",
  "menu.tileCount": "{n} tiles",
  "menu.tileCountHint": "Edit src/config/tiles.ts to add or remove",

  /* ── Calendar panel ── */
  "cal.aria": "Calendar",
  "cal.today": "Today",
  "cal.prevMonth": "Previous month",
  "cal.nextMonth": "Next month",
  "cal.todaySummary": "Today: {text}",

  /* ── This PC / Recycle Bin ── */
  "ex.new": "New",
  "ex.share": "Share",
  "ex.delete": "Delete",
  "ex.viewFolder": "Folder",
  "ex.viewList": "List",
  "ex.viewFolderTip": "Browse by category folder",
  "ex.viewListTip": "Show all posts as a flat list",
  "ex.back": "Back",
  "ex.search": "Search",
  "ex.searchTip": "Use the search box in the Start menu",
  "ex.allItems": "All items",
  "ex.itemCount": "{n} items",
  "ex.selected": "Selected: {name}",
  "ex.doubleClickOpen": "Double-click to open",
  "ex.emptyFolder": "This folder is empty",
  "ex.folder": "Folder",
  "ex.uncategorized": "Uncategorized",
  "ex.name": "Name",
  "ex.type": "Type",
  "ex.dateModified": "Date modified",
  "ex.sortTip": "Sort by “{name}” — click again to reverse",
  "ex.demoOnly": "{name} (demo UI, not implemented)",
  "ex.noPosts": "No posts yet. Create a .md file under src/content/blog/ and it will show up here.",
  "ex.draftCount": "{n} drafts · not shown in public lists",
  "ex.recycleEmpty":
    "The Recycle Bin is empty. Set draft: true in a post's frontmatter and it will show up here.",
  "ex.postKind": "Post",
  "ex.draftKind": "Draft",

  /* ── Notepad ── */
  "np.file": "File",
  "np.new": "New",
  "np.openStatic": "Open static page ↗",
  "np.exit": "Exit Notepad",
  "np.edit": "Edit",
  "np.selectAll": "Select All",
  "np.copy": "Copy",
  "np.find": "Find… (use Ctrl+F in the browser)",
  "np.format": "Format",
  "np.wordWrap": "Word Wrap",
  "np.wordWrapOff": "No wrap",
  "np.font": "Font {size}px",
  "np.view": "View",
  "np.renderedView": "Rendered view  (F9)",
  "np.sourceView": "Source view — raw .md  (F9)",
  "np.prev": "Previous",
  "np.next": "Next",
  "np.random": "Random post",
  "np.help": "Help",
  "np.aboutNotepad": "About Notepad",
  "np.switchArticle": "Switch post",
  "np.empty": "Notepad is empty",
  "np.readonly": "Read-only",
  "np.readonlyTip": "Drafts are unfinished content — only the raw file is shown here",
  "np.readonlyAria": "Raw Markdown of {title} (read-only)",
  "np.markdownAria": "Raw Markdown of {title}",
  "np.toggleTip": "Drafts in the Recycle Bin can only be viewed as source",
  "np.toggleTipNormal": "Switch between rendered and source view",
  "np.lineCol": "Ln {line}, Col {col}",
  "np.reading": "read",
  "np.bytes": "{n} bytes",
  "np.renderedViewShort": "Rendered view",
  "np.sourceViewShort": "Source view",
  "np.centerReading": "Centered reading",

  /* ── Blog Explorer ── */
  "bv.back": "Back",
  "bv.forward": "Forward",
  "bv.refresh": "Refresh",
  "bv.address": "Address bar",
  "bv.favorite": "Favorite",
  "bv.newTab": "New tab (demo UI)",
  "bv.statusBar": "Demo page · external links open in a new tab",
  "bv.noFriendLinks": "No friend links yet",
  "bv.friendHint": "To add or remove links, edit src/config/links.ts — no code changes needed.",
  "bv.noSocials": "No social links configured",
  "bv.socialHint": "These links live in src/config/site.ts.",
  "bv.toc": "Contents",
  "bv.noGuides": "No guides yet",
  "bv.noGuidesHint": "Create a .md file under src/content/guide/ and it will show up here",
  "bv.tab.links": "Friend Links",
  "bv.tab.social": "Find Me",
  "bv.tab.guide": "Guides",
  "bv.tab.linksDesc": "Places that helped along the way — recommended to anyone building a personal site.",
  "bv.tab.socialDesc": "Want to talk, subscribe, or read the source? Start here.",
  "bv.tab.guideDesc": "How to use and customise this theme — all written up here.",

  /* ── Control Panel ── */
  "cp.title": "Control Panel",
  "cp.navAria": "Control Panel categories",
  "cp.savedLocally": "Settings are saved in this browser",
  "cp.inDevelopment": "Coming soon…",
  "cp.nav.appearance": "Personalization",
  "cp.nav.about": "About",
  "cp.nav.language": "Language & region",
  "cp.nav.changelog": "Changelog",
  "cp.desc.appearance": "Wallpaper, light/dark mode, acrylic, animations, and Start menu color.",
  "cp.desc.about": "The tech stack, design trade-offs, and implementation notes behind this desktop theme.",
  "cp.desc.language": "Display language and regional format.",
  "cp.desc.changelog": "What each stage of this theme added.",
  "cp.appearance.lead": "Every option here takes effect immediately and is saved in your browser — it'll still be here next time.",
  "cp.wallpaper": "Background",
  "cp.colors": "Colors",
  "cp.appMode": "App mode",
  "cp.appModeDesc": "Switches the color scheme across the desktop, windows, and Start menu.",
  "cp.light": "Light",
  "cp.dark": "Dark",
  "cp.startMenuDark": "Dark Start menu",
  "cp.startMenuDarkDesc":
    "Darkens only the Start menu with acrylic — the taskbar and windows are unaffected. This is the classic Windows 10 Start menu look.",
  "cp.effects": "Effects",
  "cp.acrylic": "Transparency effects",
  "cp.acrylicDesc":
    "The translucent, blurred material behind the taskbar and Start menu. Turn it off for an opaque background that's smoother on low-end devices.",
  "cp.anim": "Animation effects",
  "cp.animDesc": "Window scaling, Start menu slide-in, tile hover, and more. Turn it off to make all transitions instant.",
  "cp.reset": "Reset to defaults",
  "cp.resetHint": "(background, colors, transparency, animation, and Start menu all reset)",
  "cp.aboutLead":
    "This desktop turns a blog into an operating system — but not just for fun: every post is still an independent, search-engine-friendly static page. The desktop is just the second face of on-site navigation.",
  "cp.overview": "Overview",
  "cp.notes": "Notes",
  "cp.kb.position": "What it is",
  "cp.kb.stack": "Tech stack",
  "cp.kb.theming": "Theming",
  "cp.kb.render": "Post rendering",
  "cp.kb.data": "Data source",
  "cp.v.position": "A Windows 10-style personal blog desktop",
  "cp.v.stack": "Astro + React islands + Zustand + Tailwind",
  "cp.v.theming": "CSS custom properties + class/data attributes on <html>",
  "cp.v.render": "Markdown → KaTeX (math) + syntax highlighting",
  "cp.v.data": "Content collections read at build time; runtime only displays",
  "cp.note1": "· Settings live in browser localStorage — clearing browser data resets them, and they don't sync across devices.",
  "cp.note2": "· On first visit the theme follows your system's light/dark preference; once you choose manually, your choice wins.",
  "cp.note3": "· With “Animation effects” on, if your system requests reduced motion, the browser will respect that first.",
  "cp.wallpaperMissing": "{name} (image pending)",
  "cp.wallpaperPending": "Pending",
  "cp.wallpaperNotReady": "Not ready",
  "cp.wallpaperHint":
    "Wallpapers marked “Pending” are missing their image files — drop the files into public/wallpapers/ to enable them (one light and one dark version each; filenames are listed below). Light and dark themes pick the matching version automatically.",

  /* ── Language & region ── */
  "lang.title": "Language & region",
  "lang.lead": "Choose the display language of the interface. The change takes effect immediately and is saved in your browser.",
  "lang.displayLanguage": "Display language",
  "lang.displayLanguageDesc":
    "The language for the desktop, windows, Start menu, and taskbar. The body of posts and guides is unaffected — it always stays in its original language.",
  "lang.regionalFormat": "Regional format",
  "lang.regionalFormatDesc":
    "When on, dates and numbers follow the selected language's conventions. When off, Chinese formatting is always used.",
  "lang.regionalOn": "Match language",
  "lang.regionalOff": "Always Chinese",
  "lang.hour24": "24-hour clock",
  "lang.hour24Desc": "Off shows 10:24 PM; on shows 22:24.",
  "lang.note1": "· Post bodies and guide content do not switch with the language — they're content, not interface.",
  "lang.note2": "· Static pages (/posts, /about, etc.) stay in Chinese for now; only the interface inside desktop windows switches.",
  "lang.note3": "· The language setting lives in localStorage — clearing browser data resets it.",

  /* ── Article contents (TOC) ── */
  "toc.title": "Contents",
  "toc.aria": "Article contents",
  "toc.expand": "Expand contents",
  "toc.collapse": "Collapse contents",

  /* ── About view ── */
  "about.stats": "Site stats",
  "about.findMe": "Find me",
  "about.stack": "Tech stack",
  "about.stackNote":
    "Static pages are rendered by Astro at build time; the window system is the only React island. Both share the same .md-body class for article typography, so prose never looks different between the two.",
  "about.recentlyUpdated": "Last updated: {date}",
  "about.avatarAlt": "{name}'s avatar",

  /* ── Post list / archive / tags ── */
  "post.allPosts": "All Posts",
  "post.filterPlaceholder": "Filter this list…",
  "post.noPosts": "No posts here yet",
  "post.noMatch": "No matching posts",
  "post.noSummary": "(No summary)",
  "post.count": "{n} posts",
  "post.staticPage": "Static page ↗",
  "post.footerTip": "Double-click to open · single-click to select · updated {date}",
  "post.dateLabel": "Date modified",
  "post.categoryLabel": "Category",
  "post.openAria": "Open {title}",
  "post.ctrlClickTip": "Ctrl-click to open the static page in a new tab",
  "post.hasStaticPage": "This post also has its own static page:",
  "archive.empty": "Archive is empty",
  "archive.footer": "{n} posts · double-click to open in a window",
  "archive.yearUnit": "{n}",
  "archive.monthUnit": "{n} months",
  "tags.cloud": "Tag cloud",
  "tags.categories": "Categories",
  "tags.noPosts": "No posts",
  "tags.postCount": "{n} posts",
  "tags.tagCount": "{n}",
  "tags.categoryCount": "{n}",

  /* ── Stats ── */
  "stats.posts": "Posts",
  "stats.categories": "Categories",
  "stats.tags": "Tags",
  "stats.words": "Words",

  /* ── Units ── */
  "unit.post": "",
  "unit.item": "",
  "unit.itemShort": "items",
  "unit.tag": "",
  "unit.category": "",
  "unit.words": "~",
  "unit.about": "~",

  /* ── Site itself ── */
  "site.profileName": "Hi, I'm the author",
  "site.bio1":
    "This is a blog built to look like a Windows 10 desktop. Double-click an icon to open a window, switch windows from the taskbar, and browse real categories and tags in the Start menu.",
  "site.bio2":
    "The interface looks like a shell, but every post still has its own static page — experience is experience, content is content.",
  "site.note.source": "Source",
  "site.note.subscribe": "Subscribe",
  "site.note.contact": "Contact",
  "site.note.sitemap": "Sitemap",
  "site.note.video": "Videos",
  "site.note.channel": "Channel",
  "site.note.community": "Community",
  "site.note.moments": "Updates",
  "site.note.oldAccount": "Old account",

  /* ── Time ── */
  "time.sunday": "Sunday",
  "time.monday": "Monday",
  "time.tuesday": "Tuesday",
  "time.wednesday": "Wednesday",
  "time.thursday": "Thursday",
  "time.friday": "Friday",
  "time.saturday": "Saturday",
  "time.justNow": "just now",
  "time.minutesAgo": "{n} min ago",
  "time.hoursAgo": "{n} h ago",
  "time.daysAgo": "{n} d ago",
  "time.readingTime": "{n} min read",

  /* ── Tiles ── */
  "tile.group.create": "Create",
  "tile.group.play": "Play",
  "tile.group.explore": "Explore",
  "tile.external": " (external link)",
  "tile.weather.cloudy": "Cloudy",
  "tile.weather.placeholder": "—",

  /* ── Desktop icons / context menu / shortcuts ── */
  "dk.menuAria": "Desktop menu",
  "dk.view": "View",
  "dk.sizeLarge": "Large icons",
  "dk.sizeMedium": "Medium icons",
  "dk.sizeSmall": "Small icons",
  "dk.showIcons": "Show desktop icons",
  "dk.personalize": "Personalize",
  "dk.refresh": "Refresh",
  "dk.newPost": "New post shortcut",
  "dk.newUrl": "New link shortcut",
  "dk.arrange": "Auto arrange icons",
  "dk.reset": "Reset desktop",
  "dk.delete": "Delete",
  "dk.modalTitle": "New shortcut",
  "dk.tabPost": "Post",
  "dk.tabUrl": "External link",
  "dk.pickPost": "Pick a post",
  "dk.searchPost": "Search by title, category, or tag…",
  "dk.noPostFound": "No matching posts",
  "dk.willCreate": "Will create:",
  "dk.urlLabel": "URL",
  "dk.urlInvalid": "The URL must start with http:// or https://",
  "dk.urlName": "Name (optional)",
  "dk.urlNamePlaceholder": "Defaults to the domain",
  "dk.urlNameHint": "This is what shows under the icon on the desktop.",
  "dk.alreadyExists": "This shortcut is already on the desktop — clicking Create will select it.",
  "dk.cancel": "Cancel",
  "dk.confirm": "Create",

  /* ── Wallpaper names ── */
  "wallpaper.default": "Default (Win10 Blue)",
  "wallpaper.aurora": "Aurora",
  "wallpaper.mountain": "Mountains",
  "wallpaper.geometric": "Abstract",
};
