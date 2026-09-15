/* ============================================================================
   Oxid-DB documentation, shared behavior
   Loaded with `defer` on every page. Everything is progressive: a page only
   needs semantic markup (headings with text, a sidebar, code blocks / tab
   groups) and this script wires up theming, search, the table of contents,
   copy buttons, and the multi-SDK code tabs.
   ========================================================================== */
(function () {
  "use strict";
  var root = document.documentElement;
  var onReady = function (fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  };

  /* ---------------------------------------------------------------- THEME */
  var ICONS = {
    light: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    dark: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    system: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>'
  };
  function applyTheme(pref) {
    var resolved = pref === "system"
      ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : pref;
    root.setAttribute("data-theme", resolved);
    root.setAttribute("data-theme-pref", pref);
    try { localStorage.setItem("oxid-theme", pref); } catch (e) {}
    var icon = document.getElementById("themeIcon");
    if (icon) icon.innerHTML = ICONS[pref] || ICONS.system;
    document.querySelectorAll("[data-check]").forEach(function (el) {
      el.style.visibility = el.getAttribute("data-check") === pref ? "visible" : "hidden";
    });
  }

  /* ------------------------------------------------------------ DROPDOWNS */
  function closeAllDropdowns() {
    document.querySelectorAll(".dropdown.open").forEach(function (m) { m.classList.remove("open"); });
    document.querySelectorAll("[aria-haspopup]").forEach(function (b) { b.setAttribute("aria-expanded", "false"); });
  }
  function wireDropdown(btnId, menuId) {
    var btn = document.getElementById(btnId), menu = document.getElementById(menuId);
    if (!btn || !menu) return;
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      var open = menu.classList.contains("open");
      closeAllDropdowns();
      if (!open) { menu.classList.add("open"); btn.setAttribute("aria-expanded", "true"); }
    });
    menu.addEventListener("click", function (e) { e.stopPropagation(); });
  }

  /* ------------------------------------------------------------- MOBILE DRAWER */
  function wireDrawer() {
    var sidebar = document.getElementById("sidebar");
    var backdrop = document.getElementById("drawerBackdrop");
    var hamburger = document.getElementById("hamburger");
    if (!sidebar || !hamburger) return;
    function toggle() {
      var open = sidebar.classList.toggle("open");
      if (backdrop) backdrop.classList.toggle("open", open);
    }
    hamburger.addEventListener("click", toggle);
    if (backdrop) backdrop.addEventListener("click", toggle);
    sidebar.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () { if (sidebar.classList.contains("open")) toggle(); });
    });
  }

  /* ------------------------------------------------------------- COPY BUTTONS */
  function wireCopyButtons() {
    document.querySelectorAll(".copy-btn").forEach(function (btn) {
      if (btn.dataset.wired) return;
      btn.dataset.wired = "1";
      btn.addEventListener("click", function () {
        var scope = btn.closest(".code-panel") || btn.closest(".code-block");
        var pre = scope && scope.querySelector("pre");
        if (!pre) return;
        navigator.clipboard.writeText(pre.innerText).then(function () {
          var label = btn.querySelector(".btn-label") || btn;
          var prev = label.textContent;
          label.textContent = "Copied";
          btn.classList.add("copied");
          setTimeout(function () { label.textContent = prev || "Copy"; btn.classList.remove("copied"); }, 1600);
        });
      });
    });
  }

  /* --------------------------------------------------- MULTI-SDK CODE TABS */
  // A tab group is any element with [data-tabs] containing .code-tab buttons
  // (each with data-lang) and .code-panel panels (each with data-lang).
  // Selecting a language is remembered globally so every group + page follows.
  var SDK_KEY = "oxid-sdk";
  function getSdkPref() { try { return localStorage.getItem(SDK_KEY) || "curl"; } catch (e) { return "curl"; } }
  function setSdkPref(l) { try { localStorage.setItem(SDK_KEY, l); } catch (e) {} }
  function applyTabs(preferred) {
    document.querySelectorAll("[data-tabs]").forEach(function (group) {
      var tabs = Array.prototype.slice.call(group.querySelectorAll(".code-tab"));
      var panels = Array.prototype.slice.call(group.querySelectorAll(".code-panel"));
      if (!tabs.length) return;
      var langs = tabs.map(function (t) { return t.getAttribute("data-lang"); });
      var target = langs.indexOf(preferred) >= 0 ? preferred : langs[0];
      tabs.forEach(function (t) { t.classList.toggle("active", t.getAttribute("data-lang") === target); });
      panels.forEach(function (p) { p.classList.toggle("active", p.getAttribute("data-lang") === target); });
    });
  }
  function wireTabs() {
    document.querySelectorAll("[data-tabs] .code-tab").forEach(function (tab) {
      tab.addEventListener("click", function () {
        var lang = tab.getAttribute("data-lang");
        setSdkPref(lang);
        applyTabs(lang);
      });
    });
    applyTabs(getSdkPref());
  }

  /* ------------------------------------------------- ACTIVE SIDEBAR LINK */
  function markActiveNav() {
    var here = location.pathname.split("/").pop() || "index.html";
    var found = false;
    document.querySelectorAll(".sidebar .nav-item").forEach(function (a) {
      var href = (a.getAttribute("href") || "").split("#")[0].split("/").pop();
      if (href === here) { a.classList.add("active"); found = true; }
      else a.classList.remove("active");
    });
    if (!found && here === "index.html") {
      var first = document.querySelector('.sidebar .nav-item[href="index.html"]');
      if (first) first.classList.add("active");
    }
    // Scroll the active item into view within the sidebar.
    var active = document.querySelector(".sidebar .nav-item.active");
    if (active && active.scrollIntoView) active.scrollIntoView({ block: "center" });
  }

  /* ----------------------------------------- AUTO HEADING IDS + ANCHORS + TOC */
  function slugify(text) {
    return text.toLowerCase().trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
  }
  function buildToc() {
    var article = document.querySelector(".article");
    var tocNav = document.getElementById("tocNav");
    if (!article) return;
    // Only real section headings, never headings inside cards, callouts,
    // steps, tables or key/value lists (those are content, not sections).
    var EXCLUDE = ".card, .callout, .steps, .kv, .table-wrap, .code-tabs, .grid";
    var headings = Array.prototype.slice
      .call(article.querySelectorAll("h2, h3"))
      .filter(function (h) { return !h.closest(EXCLUDE) && !h.hasAttribute("data-no-toc"); });
    var used = {};
    var tocHtml = "";
    headings.forEach(function (h) {
      var id = h.id;
      if (!id) {
        id = slugify(h.textContent) || "section";
        if (used[id]) { used[id]++; id = id + "-" + used[id]; } else { used[id] = 1; }
        h.id = id;
      }
      // Idempotent anchor link.
      if (!h.querySelector(".heading-anchor")) {
        var a = document.createElement("a");
        a.className = "heading-anchor";
        a.href = "#" + id;
        a.setAttribute("aria-label", "Link to this section");
        a.textContent = "#";
        h.appendChild(a);
      }
      var cls = h.tagName === "H3" ? "sub" : "";
      tocHtml += '<a class="' + cls + '" href="#' + id + '">' + h.firstChild.textContent.trim() + "</a>";
    });
    if (tocNav) tocNav.innerHTML = tocHtml;
    return headings;
  }
  function wireScrollspy(headings) {
    var tocLinks = Array.prototype.slice.call(document.querySelectorAll("#tocNav a"));
    if (!tocLinks.length || !headings.length) return;
    var offset = parseInt(getComputedStyle(root).getPropertyValue("--header-height")) || 60;
    function onScroll() {
      var pos = window.scrollY + offset + 60;
      var current = headings[0];
      headings.forEach(function (s) { if (s.offsetTop <= pos) current = s; });
      tocLinks.forEach(function (a) {
        a.classList.toggle("active", a.getAttribute("href") === "#" + (current && current.id));
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* --------------------------------------------------------------- SEARCH */
  function wireSearch() {
    var overlay = document.getElementById("searchOverlay");
    var trigger = document.getElementById("searchTrigger");
    var input = document.getElementById("searchInput");
    var resultsBox = document.getElementById("searchResults");
    if (!overlay || !input || !resultsBox) return;

    // Index = sidebar links (other pages) + this page's headings.
    var INDEX = [];
    document.querySelectorAll(".sidebar .nav-group").forEach(function (group) {
      var lbl = group.querySelector(".nav-group-label");
      var label = lbl ? lbl.textContent : "";
      group.querySelectorAll(".nav-item").forEach(function (a) {
        INDEX.push({ title: a.textContent.trim(), group: label, href: a.getAttribute("href") });
      });
    });
    var SKIP = ".card, .callout, .steps, .kv, .table-wrap, .code-tabs, .grid";
    document.querySelectorAll(".article h2, .article h3").forEach(function (h) {
      if (h.id && !h.closest(SKIP)) INDEX.push({ title: (h.firstChild ? h.firstChild.textContent : h.textContent).trim(), group: "On this page", href: "#" + h.id });
    });

    var activeIdx = -1, currentResults = [];
    function esc(s) { return s.replace(/[&<>]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]; }); }
    function hl(text, q) {
      if (!q) return esc(text);
      var i = text.toLowerCase().indexOf(q.toLowerCase());
      if (i < 0) return esc(text);
      return esc(text.slice(0, i)) + "<mark>" + esc(text.slice(i, i + q.length)) + "</mark>" + esc(text.slice(i + q.length));
    }
    function render(q) {
      var matches = q
        ? INDEX.filter(function (it) { return (it.title + " " + it.group).toLowerCase().indexOf(q.toLowerCase()) >= 0; })
        : INDEX.slice(0, 8);
      currentResults = matches;
      activeIdx = matches.length ? 0 : -1;
      if (!matches.length) { resultsBox.innerHTML = '<div class="search-empty">No results for “' + esc(q) + '”</div>'; return; }
      var byGroup = {}; matches.forEach(function (m) { (byGroup[m.group] = byGroup[m.group] || []).push(m); });
      var html = "", flat = 0;
      Object.keys(byGroup).forEach(function (g) {
        html += '<div class="search-group-label">' + esc(g) + "</div>";
        byGroup[g].forEach(function (m) {
          html += '<a class="search-result" data-idx="' + flat + '" href="' + m.href + '">' +
            '<span class="sr-title">' + hl(m.title, q) + "</span>" +
            '<span class="sr-sub">' + esc(m.group) + "</span></a>";
          flat++;
        });
      });
      resultsBox.innerHTML = html;
      updateActive();
      resultsBox.querySelectorAll(".search-result").forEach(function (el) {
        el.addEventListener("click", function () { closeSearch(); });
        el.addEventListener("mousemove", function () { activeIdx = parseInt(el.getAttribute("data-idx")); updateActive(); });
      });
    }
    function updateActive() {
      resultsBox.querySelectorAll(".search-result").forEach(function (el) {
        el.classList.toggle("active", parseInt(el.getAttribute("data-idx")) === activeIdx);
      });
    }
    function scrollActive() {
      var el = resultsBox.querySelector('.search-result[data-idx="' + activeIdx + '"]');
      if (el) el.scrollIntoView({ block: "nearest" });
    }
    function openSearch() { overlay.classList.add("open"); input.value = ""; render(""); input.focus(); }
    function closeSearch() { overlay.classList.remove("open"); }

    input.addEventListener("input", function () { render(input.value.trim()); });
    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") { e.preventDefault(); activeIdx = Math.min(activeIdx + 1, currentResults.length - 1); updateActive(); scrollActive(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); activeIdx = Math.max(activeIdx - 1, 0); updateActive(); scrollActive(); }
      else if (e.key === "Enter") {
        e.preventDefault();
        var el = resultsBox.querySelector('.search-result[data-idx="' + activeIdx + '"]');
        if (el) { var href = el.getAttribute("href"); closeSearch(); if (href.charAt(0) === "#") location.hash = href; else location.href = href; }
      }
    });
    if (trigger) trigger.addEventListener("click", openSearch);
    overlay.addEventListener("click", function (e) { if (e.target === overlay) closeSearch(); });

    document.addEventListener("keydown", function (e) {
      var typing = /input|textarea/i.test(document.activeElement.tagName);
      if (e.key === "/" && !typing && !overlay.classList.contains("open")) { e.preventDefault(); openSearch(); }
      else if (e.key === "Escape") { if (overlay.classList.contains("open")) closeSearch(); closeAllDropdowns(); }
    });
  }

  /* --------------------------------------------- COPY PAGE AS MARKDOWN */
  function wireCopyMarkdown() {
    var btn = document.getElementById("copyMarkdown");
    if (!btn) return;
    btn.addEventListener("click", function () {
      var h1 = document.querySelector(".article h1");
      var lines = ["# " + (h1 ? h1.textContent.replace(/#$/, "").trim() : document.title), "", location.href, ""];
      document.querySelectorAll(".article h2, .article h3, .article p, .article li").forEach(function (el) {
        var t = el.textContent.replace(/#$/, "").trim();
        if (!t) return;
        if (el.tagName === "H2") lines.push("", "## " + t, "");
        else if (el.tagName === "H3") lines.push("", "### " + t, "");
        else if (el.tagName === "LI") lines.push("- " + t);
        else lines.push(t, "");
      });
      navigator.clipboard.writeText(lines.join("\n")).then(function () {
        var prev = btn.innerHTML; btn.textContent = "✓ Copied Markdown";
        setTimeout(function () { btn.innerHTML = prev; }, 1800);
      });
    });
  }

  /* ------------------------------------------------- SYNTAX HIGHLIGHTING */
  // highlight.js is loaded (deferred) before this script. We assign the right
  // language class from each block's data-lang / label and highlight it. OxQL
  // blocks keep their hand-written .tok-* spans (skipped here).
  var HL_MAP = {
    curl: "bash", bash: "bash", shell: "bash", sh: "bash",
    python: "python", py: "python",
    typescript: "typescript", ts: "typescript", javascript: "javascript", js: "javascript",
    go: "go", golang: "go",
    java: "java", php: "php",
    csharp: "csharp", "c#": "csharp", cs: "csharp",
    json: "json"
  };
  function highlightOne(codeEl, lang) {
    if (!codeEl || codeEl.dataset.hl) return;
    var hl = HL_MAP[(lang || "").trim().toLowerCase()];
    if (!hl) return; // unknown / oxql → leave as-is
    codeEl.classList.add("language-" + hl);
    try { window.hljs.highlightElement(codeEl); } catch (e) {}
    codeEl.dataset.hl = "1";
  }
  function wireHighlight() {
    if (typeof window.hljs === "undefined") return;
    // Multi-SDK tab panels: language from data-lang (works on hidden panels too).
    document.querySelectorAll(".code-panel[data-lang]").forEach(function (panel) {
      highlightOne(panel.querySelector("pre > code"), panel.getAttribute("data-lang"));
    });
    // Standalone code blocks: language from the header label (skips "oxql").
    document.querySelectorAll(".code-block").forEach(function (block) {
      var label = block.querySelector(".code-head .lang");
      highlightOne(block.querySelector("pre > code"), label ? label.textContent : "");
    });
  }

  /* ------------------------------------------------------------------ INIT */
  onReady(function () {
    applyTheme(root.getAttribute("data-theme-pref") || "system");
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () {
      if ((root.getAttribute("data-theme-pref") || "system") === "system") applyTheme("system");
    });
    document.querySelectorAll("[data-theme-set]").forEach(function (b) {
      b.addEventListener("click", function () { applyTheme(b.getAttribute("data-theme-set")); closeAllDropdowns(); });
    });
    wireDropdown("versionBtn", "versionMenu");
    wireDropdown("themeBtn", "themeMenu");
    document.addEventListener("click", closeAllDropdowns);

    wireDrawer();
    markActiveNav();
    wireCopyButtons();
    wireTabs();
    wireHighlight();
    var headings = buildToc();
    wireScrollspy(headings || []);
    wireSearch();
    wireCopyMarkdown();
  });
})();
