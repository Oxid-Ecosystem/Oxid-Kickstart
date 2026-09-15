# Oxid-DB 0.9.7 docs: authoring contract (read before writing a page)

Every page is a copy of `_template.html`. **You only edit the `<main class="article">…</main>`
region** (plus `<title>`, the `<meta name="description">`, and the breadcrumb). Do not touch
the header, sidebar, footer, or search modal, they are shared and `assets/docs.js` wires them up.

## What is automatic (do NOT hand-write these)
- **Heading IDs**, `docs.js` slugifies every `<h2>/<h3>`.
- **Heading anchor links** (the `#`), injected automatically.
- **Right-rail "On this page" TOC**, built from your `<h2>/<h3>`. Just write clean headings.
- **Active sidebar link**, matched from the filename.
- **Scrollspy, search index, theme, copy buttons, tab switching**, all automatic.

So: write `<h2>Title</h2>` (no id, no anchor, no TOC entry). Add `data-no-toc` to a heading to keep it out of the TOC.

## Page skeleton to produce
```html
<main class="article">
  <div class="breadcrumb"><a href="index.html">Docs</a> / SECTION / <span>PAGE TITLE</span></div>
  <h1>Page Title</h1>
  <p class="lead">One or two sentence summary.</p>

  ...body...

  <div class="pager">
    <a href="PREV.html"><span class="dir">← Previous</span><span class="ttl">Prev Title</span></a>
    <a class="next" href="NEXT.html"><span class="dir">Next →</span><span class="ttl">Next Title</span></a>
  </div>
  <div class="article-footer">
    <button class="ghost-btn" id="copyMarkdown"> … keep as in template … </button>
    <div class="spacer"></div>
    <span>Oxid-DB 0.9.7 · Built with Rust</span>
  </div>
</main>
```

## Multi-SDK code example (THE key component)
Use this for anything a developer would call from an app. **Language order is fixed**:
`curl, python, typescript, go, java, php, csharp`. Always include **cURL + Python + TypeScript**
at minimum; include the rest when the operation is supported by that SDK. If an SDK genuinely does
not implement an operation, omit only that one panel + its tab (do not invent methods).

```html
<div class="code-tabs" data-tabs>
  <div class="code-tabs-bar" role="tablist">
    <button class="code-tab" data-lang="curl">cURL</button>
    <button class="code-tab" data-lang="python">Python</button>
    <button class="code-tab" data-lang="typescript">TypeScript</button>
    <button class="code-tab" data-lang="go">Go</button>
    <button class="code-tab" data-lang="java">Java</button>
    <button class="code-tab" data-lang="php">PHP</button>
    <button class="code-tab" data-lang="csharp">C#</button>
  </div>
  <div class="code-panel" data-lang="curl">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>curl -s -X POST https://85cfad134a4a.oxid-db.com/query \
  -H 'Content-Type: application/json' \
  -d '{"query":"FIND ?x WHERE ?x IS-A Beer LIMIT 5"}'</code></pre>
  </div>
  <div class="code-panel" data-lang="python">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>from oxiddb_client import OxidDB

with OxidDB("https://85cfad134a4a.oxid-db.com") as db:
    for hit in db.query_all("FIND ?x WHERE ?x IS-A Beer LIMIT 5"):
        print(hit["iri"])</code></pre>
  </div>
  <div class="code-panel" data-lang="typescript">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>import { OxidClient } from "@oxiddb/node";

const db = new OxidClient({ baseUrl: "https://85cfad134a4a.oxid-db.com" });
const page = await db.query({ query: "FIND ?x WHERE ?x IS-A Beer LIMIT 5" });
console.log(page.results.map((r) => r.iri));</code></pre>
  </div>
  <!-- go / java / php / csharp panels … -->
</div>
```
Notes:
- Escape HTML in code: `<` → `&lt;`, `>` → `&gt;`, `&` → `&amp;`.
- Do NOT add `<span class="tok-*">` syntax spans inside multi-SDK panels (too noisy across langs). Keep them plain. Token spans are fine only for standalone **OxQL** blocks (see below).

## Standalone single code block (bash / oxql / json)
```html
<div class="code-block">
  <div class="code-head"><span class="lang">oxql</span><button class="copy-btn">Copy</button></div>
  <pre><code><span class="tok-kw">FIND</span> <span class="tok-var">?x</span> <span class="tok-kw">WHERE</span> <span class="tok-var">?x</span> <span class="tok-kw">IS-A</span> Beer</code></pre>
</div>
```
OxQL token classes: `.tok-kw` (keywords), `.tok-var` (`?x`), `.tok-num`, `.tok-str`, `.tok-cmt`.

## Callouts
```html
<div class="callout note"><svg class="co-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
  <div class="co-body"><span class="co-title">Note</span> …</div></div>
```
Variants: `note` (blue), `tip` (green, use the bulb icon), `warn` (copper), `managed` (closed-source notice, see below).

## The closed-source "managed" notice (paste verbatim where relevant)
Installation, provisioning, CLI administration, and low-level DB settings are **managed for you**
while Oxid-DB is closed-source. Put this near the top of any page that would otherwise document
self-hosting/CLI/settings:
```html
<div class="callout managed">
  <svg class="co-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
  <div class="co-body">
    <span class="co-title">Managed while Oxid-DB is closed-source</span>
    While Oxid-DB is closed-source, <strong>installation, provisioning, and the database
    runtime are managed for you</strong>, you receive a ready-to-use endpoint and connect with a
    client below. When Oxid-DB opens up, this documentation will expand with in-depth
    guides for <strong>self-hosting, CLI commands, and database settings</strong>.
  </div>
</div>
```

## Other components
- Feature cards: `<div class="grid"> <div class="card"><h3>…</h3><p>…</p></div> … </div>` (linkable: `<a class="card" href="…">`). Chips: `<span class="chip symbolic">Symbolic</span>` / `<span class="chip neural">Neural</span>`.
- Tables: wrap in `<div class="table-wrap"><table>…</table></div>`.
- Numbered walkthrough: `<ol class="steps"><li><h3>Step</h3><p>…</p></li>…</ol>`.
- Definition rows: `<dl class="kv"><dt>name</dt><dd>desc</dd>…</dl>`.
- Source citation chip (use it to show a page reflects real code): `<span class="src-cite">crates/oxd-query/src/oxql.pest</span>`.

## Truth rules (be critical)
- The server base URL in all examples is `https://85cfad134a4a.oxid-db.com`.
- Verify EVERY endpoint path, request body field, response field, OxQL keyword, and SDK method
  name against the actual 0.9.7 code and the reference files in `.build/` before writing it.
  If the reference and the code disagree, trust the code and note it.
- Prefer real example data used elsewhere in the repo (the beverage ontology: `Beer`, `Pilsner`,
  `Stout`, `Wine`; 4-dim toy vectors) so examples are runnable and consistent across pages.
- Do NOT document install commands, `oxd` CLI admin, or `[server]`/config-file tuning as
  developer instructions, route those to the managed notice + `operations.html`.
- Write for juniors AND seniors: define the concept in plain language first, then show the code,
  then add depth/edge-cases in a final subsection or callout.
