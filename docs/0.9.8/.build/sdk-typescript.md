# Oxid-DB TypeScript / Node SDK: verified usage snippets

All snippets below are code-verified against `sdk/oxiddb-nodejs-sdk/src/**` (package
`@oxiddb/node`, version `0.9.8`). Method names, option-object shapes, and wire field
names are copied from the source, not guessed. Domain data uses beverages
(Beer/Pilsner/Stout/Wine) with 4-dim vectors and base URL `https://85cfad134a4a.oxid-db.com`.

> Wire-field traps (from the type files): identity is `iri`/`individual` (not `id`);
> class is `class` (single) or `classes` (plural), not `type`; a raw vector is
> `vector` (not `embedding`); collection dim is `dimensions` (not `dim`); OxQL goes
> in `query` (not `oxql`); KGE candidate count is `top_k` (not `k`).

## install

```bash
npm i @oxiddb/node
```

Requires Node.js 20+. Talks to a running `oxd-server` over HTTP; it is transport-only
(no embedded DB, no reasoning). Cited: `sdk/oxiddb-nodejs-sdk/package.json`
(`"name": "@oxiddb/node"`, `"version": "0.9.8"`), README "Quick start".

## client-init

method: `new OxidClient(config?: Partial<OxidConfig>)`
(src: `sdk/oxiddb-nodejs-sdk/src/client.ts:111`; config shape:
`sdk/oxiddb-nodejs-sdk/src/config.ts:36` `OxidConfig`)

```ts
import { OxidClient } from "@oxiddb/node";

// All fields optional; defaults shown.
const db = new OxidClient({
  baseUrl: "https://85cfad134a4a.oxid-db.com", // default
  timeout: 30_000,                  // ms, overall per-request (suspended for streams)
  chunkTimeout: 30_000,             // ms, between-read timeout for /export streams
  retries: 2,                       // transient (5xx/network) retries, idempotent methods only
  rateLimitRetries: 4,              // 429 auto-retries, ALL methods (POST included)
  auth: undefined,                  // optional bearer token; sent as Authorization, never logged
  // userAgent, debug also available
});
```

**`@oxiddb/web` note (browser sibling):** import `OxidWebClient` from `@oxiddb/web`
and construct it the same way, `new OxidWebClient({ baseUrl: "https://85cfad134a4a.oxid-db.com" })`.
The wire types are byte-identical to `@oxiddb/node`. There is **no `connect` step** in
either SDK. Differences relevant to construction/connect: the web client has **no env
layer** (precedence is explicit constructor args > defaults), no `retries` for POST,
and adds an `OxidCorsError` for cross-origin `fetch` rejections; loopback/same-origin
work with no server CORS config. (src: `sdk/oxiddb-web-sdk/README.md` "Configuration"
and "Differences from `@oxiddb/node`".)

### connect

**NOT IMPLEMENTED, no `connect()` method exists** (grep of both SDKs' `src/` returns
none). The SDK is stateless HTTP: you construct the client and call methods directly.
The idiomatic "connect / handshake" equivalent is a readiness probe (see `### ready`)
or a cheap discovery call like `await db.health()` / `await db.schema()`.

```ts
import { OxidClient } from "@oxiddb/node";

const db = new OxidClient({ baseUrl: "https://85cfad134a4a.oxid-db.com" });

// No connect(); verify reachability with a liveness ping instead.
const h = await db.health(); // { status: "ok" }
console.log(h.status);
```

method: `health(opts?: RequestOpts): Promise<HealthResponse>`
(src: `sdk/oxiddb-nodejs-sdk/src/client.ts:161`, `GET /health`)

### ready

method: `ready(opts?: RequestOpts): Promise<ReadyResponse>`
(src: `sdk/oxiddb-nodejs-sdk/src/client.ts:169`, `GET /ready`)

Returns the body for **both** 200 (`status: "ready"`) and 503 (`status: "not_ready"`)
,  it does not throw on 503. A fresh DB reports `not_ready` until you `classify()`.

```ts
const r = await db.ready();
if (r.status === "ready") {
  console.log(`up ${r.uptime_seconds}s, ${r.checks.individuals} individuals`);
} else {
  console.warn("not ready yet, run classify() first");
}
```

### add_subclass

method: `addSubclass(req: SubclassRequest, opts?: RequestOpts): Promise<void>`
(src: `sdk/oxiddb-nodejs-sdk/src/client.ts:358`, `POST /subclass`; body
`{ sub, sup }` from `src/types/mutation.ts:83`)

```ts
// Pilsner ⊑ Beer, Stout ⊑ Beer  (sub is the child, sup the parent)
await db.addSubclass({ sub: "Pilsner", sup: "Beer" });
await db.addSubclass({ sub: "Stout", sup: "Beer" });
```

### add_disjoint

method: `addDisjoint(req: DisjointRequest, opts?: RequestOpts): Promise<void>`
(src: `sdk/oxiddb-nodejs-sdk/src/client.ts:363`, `POST /disjoint`; body
`{ a, b }` from `src/types/mutation.ts:89`)

```ts
// Nothing is both a Beer and a Wine.
await db.addDisjoint({ a: "Beer", b: "Wine" });
```

### insert_individual

method: `insert(req: InsertRequest, opts?: RequestOpts): Promise<InsertResponse>`
(src: `sdk/oxiddb-nodejs-sdk/src/client.ts:317`, `POST /insert`; body from
`src/types/mutation.ts:12`)

Identity is `individual` (or its alias `iri`); membership is `class` (or `classes[]`).
Supply a literal `vector` **or** `text` to auto-embed (mutually exclusive), plus an
optional `collection`.

```ts
// Single individual with an explicit 4-dim vector.
await db.insert({ individual: "Heineken", class: "Pilsner", vector: [0.4, 0.2, 0.1, 0.4] });
await db.insert({ iri: "Guinness", class: "Stout", vector: [0.9, 0.3, 0.0, 0.7] });

// Batch (field is `iri`, not `individual`). Subject to the 32 MiB body cap.
const batch = await db.insertBatch({
  entities: [
    { iri: "Corona", class: "Pilsner", vector: [0.25, 0.2, 0.15, 0.35] },
    { iri: "ImperialStout", class: "Stout", vector: [0.95, 0.35, 0.05, 0.9] },
  ],
});
console.log(batch.ok, batch.inserted); // true 2
```

method (batch): `insertBatch(req: InsertBatchRequest, opts?: RequestOpts): Promise<InsertBatchResponse>`
(src: `sdk/oxiddb-nodejs-sdk/src/client.ts:325`, `POST /insert/batch`)

> To attach data/object properties in the same call, use the DX one-call upsert
> `upsertEntity({ iri, classes, properties, vector })`, `/insert` hard-400s on
> `properties`. (src: `client.ts:337`, `POST /entities`.)

### classify

method: `classify(opts?: RequestOpts): Promise<ClassifyResponse>`
(src: `sdk/oxiddb-nodejs-sdk/src/client.ts:548`, `POST /classify`; no request body)

Runs the EL⊥ classifier (a tractable OWL 2 EL subset). Response carries
`consistent`, `coherent?`, `violations` (count), and optional `violation_witnesses` /
`unsatisfiable`.

```ts
const c = await db.classify();
if (!c.consistent) {
  console.error(`inconsistent: ${c.violations} violation(s)`, c.violation_witnesses);
} else {
  console.log("consistent", c.coherent ? "and coherent" : "");
}
```

### query

method: `query(req: QueryRequest, opts?: RequestOpts): Promise<QueryResponse>`
(src: `sdk/oxiddb-nodejs-sdk/src/client.ts:203`, `POST /query`; body
`{ query, cursor?, hydrate? }` from `src/types/query.ts:12`)

One page. `query` is the OxQL string; `hydrate` is `true` (all props), a string[]
whitelist, or absent (IRI-only). Response has `results[]`, `next_cursor` (null on last
page), and `total_count`.

```ts
const page = await db.query({ query: "FIND ?x WHERE ?x IS-A Beer LIMIT 20" });
console.log(page.results.map((r) => r.iri)); // ["Corona","Guinness","Heineken","ImperialStout"]
console.log(page.total_count);

// Hydrate selected data properties on the hits.
const hydrated = await db.query({
  query: "FIND ?x WHERE ?x IS-A Beer LIMIT 20",
  hydrate: ["abv", "origin"],
});
console.log(hydrated.results[0]?.data_properties);
```

### query_all

method: `queryAll(req: QueryRequest, opts?: RequestOpts): AsyncIterable<QueryHit>`
(src: `sdk/oxiddb-nodejs-sdk/src/client.ts:211`; delegates to `paginate`)

Async iterator that follows `next_cursor` automatically, the recommended read path.
(Note: use a `LIMIT` ≥ the expected result count; the cursor cannot page past the
LIMIT window. `SORT` is not preserved across page boundaries.)

```ts
const iris: string[] = [];
for await (const hit of db.queryAll({ query: "FIND ?x WHERE ?x IS-A Beer LIMIT 1000" })) {
  iris.push(hit.iri);
}
console.log(iris.length);
```

### vector_search

method (by literal/text via OxQL): `query({ query: "... NEAR ?x TO [..] ..." })`
method (by reference IRI): `individualSimilar(iri: string, opts?: SimilarOpts): Promise<IndividualSimilarResponse>`
(src: `sdk/oxiddb-nodejs-sdk/src/client.ts:242`, `GET /individuals/{iri}/similar`;
`SimilarOpts` = `RequestOpts & { k?, collection? }` from `src/types/individual.ts:17`)

There is **no method literally named `vectorSearch`**, nearest-neighbor search has two
verified forms:

```ts
// 1) OxQL NEAR over /query, hybrid-capable (combine with IS-A). Rows carry `score`.
const near = await db.query({
  query: "FIND ?x WHERE ?x IS-A Beer AND NEAR ?x TO [0.9, 0.1, 0.5, 0.7] LIMIT 5",
});
for (const hit of near.results) console.log(hit.iri, hit.score);

// 2) By reference individual, top-k neighbors of an existing IRI.
const sim = await db.individualSimilar("Guinness", { k: 3, collection: "default" });
console.log(sim.reference, sim.collection);
for (const hit of sim.results) console.log(hit.iri, hit.score); // score = 1 - distance
```

### create_collection

method: `createCollection(req: CreateCollectionRequest, opts?: RequestOpts): Promise<void>`
(src: `sdk/oxiddb-nodejs-sdk/src/client.ts:372`, `POST /collections`; body from
`src/types/collections.ts:40`)

Field is `dimensions` (not `dim`). `metric` is one of `"cosine"` (default) / `"l2"` /
`"ip"` / `"manhattan"`. Optional `quantization` (`"none"`/`"sq8"`/`"binary"`) and
`cold_f32` (sq8 + `--features mmap` + durable server only).

```ts
await db.createCollection({ name: "beers", dimensions: 4, metric: "cosine" });

// Quantized + memory-mapped exact f32 (sq8 required for cold_f32).
await db.createCollection({
  name: "beers_cold",
  dimensions: 4,
  metric: "cosine",
  quantization: "sq8",
  cold_f32: true,
});

const list = await db.collections();
console.log(list.collections.map((c) => `${c.name}/${c.dimensions}`));
```

### insert_document

method: `insertDocument(collection: string, doc: OxidDocument, opts?: RequestOpts): Promise<InsertDocumentResponse>`
(src: `sdk/oxiddb-nodejs-sdk/src/client.ts:663`, `POST /documents/{collection}`; doc type
`src/types/documents.ts:78`)

A document is any JSON object; a top-level `_iri` sets its IRI (else the server
synthesizes one). If the collection is bridge-mapped with `auto_type`, the insert also
mints a typed individual.

```ts
const res = await db.insertDocument("beers", {
  _iri: "Heineken",
  name: "Heineken",
  style: "Pilsner",
  abv: 5.0,
});
console.log(res.ok, res.iri); // true "Heineken"
```

### bulk_import_documents

method (JSON array): `bulkInsertDocuments(collection: string, docs: OxidDocument[], opts?: RequestOpts): Promise<BulkInsertDocumentsResponse>`
(src: `sdk/oxiddb-nodejs-sdk/src/client.ts:676`, `POST /documents/{collection}/bulk`)
method (raw NDJSON): `importDocumentsNdjson(collection: string, ndjson: string, opts?: RequestOpts): Promise<ImportNdjsonResponse>`
(src: `sdk/oxiddb-nodejs-sdk/src/client.ts:692`, `POST /documents/{collection}/import`)

Two verified bulk paths. Per-doc identity is `_iri` or `$id`. Both are subject to the
32 MiB request-body cap (no auto-chunking, chunk large inputs client-side).

```ts
// A) JSON array, deferred indexing.
const bulk = await db.bulkInsertDocuments("beers", [
  { _iri: "Corona", name: "Corona", style: "Pilsner", abv: 4.5 },
  { _iri: "Guinness", name: "Guinness", style: "Stout", abv: 4.2 },
]);
console.log(bulk.ok, bulk.inserted); // true 2

// B) Raw NDJSON text, one document per line ($id or _iri per line).
const ndjson =
  '{"$id":"ImperialStout","name":"Imperial Stout","style":"Stout","abv":9.0}\n' +
  '{"$id":"Chardonnay","name":"Chardonnay","style":"Wine","abv":13.0}\n';
const imp = await db.importDocumentsNdjson("beers", ndjson);
console.log(imp.ok, imp.imported); // true 2
```

### map_collection_to_class

method: `registerMapping(req: RegisterMappingRequest, opts?: RequestOpts): Promise<RegisterMappingResponse>`
(src: `sdk/oxiddb-nodejs-sdk/src/client.ts:649`, `POST /collections/map`; body from
`src/types/documents.ts:44`)

Binds a document collection to a class and maps fields to properties (the "bridge").
`field_mappings[].type` is a tagged union: `{ kind: "data_property" }`,
`{ kind: "object_property" }`, or `{ kind: "vector_property", collection }`. Optional
`auto_type` (server default true) and `embed` (per-collection auto-embed).

```ts
const res = await db.registerMapping({
  collection: "beers",
  class: "Beer",
  field_mappings: [
    { field: "name", property: "name", type: { kind: "data_property" } },
    { field: "abv", property: "abv", type: { kind: "data_property" } },
  ],
  auto_type: true,
  // Optional: embed the `name` field into the `beers` vector collection on insert.
  // embed: { text_field: "name", target_collection: "beers" },
});
console.log(res.ok, res.collection, res.auto_type);
```

> One-shot alternative (create collection + binding together):
> `provisionCollection({ vector, binding })` (src: `client.ts:415`,
> `POST /collections/provision`).

### transaction

method (auto): `transaction<T>(fn: (txn: Transaction) => Promise<T>, opts?: RequestOpts): Promise<T>`
(src: `sdk/oxiddb-nodejs-sdk/src/client.ts:140`)
method (manual): `begin(opts?: RequestOpts): Promise<Transaction>`
(src: `sdk/oxiddb-nodejs-sdk/src/client.ts:123`, `POST /txn`)

`transaction(fn)` commits when `fn` resolves and rolls back if it throws (re-raising the
error). `Transaction` mutators (src: `src/transaction.ts`) include `insert`,
`insertIntoCollection`, `upsertVector`, `addSubclass`, `addDisjoint`,
`addObjectProperty`, `addAnnotation`, `insertDocument`, `updateDocument`,
`deleteDocument`, `bulkInsertDocuments`, `registerMapping`, `unregisterMapping`,
`setEmbedderConfig`, plus `savepoint()` / `rollbackTo()` / `commit()` / `rollback()`.
IRIs inserted inside a txn must be new. `txn.insert` returns the interned integer term.

```ts
// Auto commit/rollback.
await db.transaction(async (txn) => {
  await txn.addSubclass({ sub: "Pilsner", sup: "Beer" });
  const term = await txn.insert({ iri: "Corona", class: "Pilsner", vector: [0.2, 0.2, 0.1, 0.3] });
  await txn.addObjectProperty({ subject: "Corona", property: "brewedBy", object: "GrupoModelo" });
  return term; // resolve → commit; throw → rollback
});

// Manual control with a savepoint.
const txn = await db.begin();
try {
  await txn.insert({ iri: "Guinness", class: "Stout" });
  const sp = await txn.savepoint();
  await txn.insert({ iri: "Maybe", class: "Stout" });
  await txn.rollbackTo(sp); // drop "Maybe", keep "Guinness"
  await txn.commit();
} catch (e) {
  if (!txn.settled) await txn.rollback();
  throw e;
}
```

### predict_links

method: `predictLinks(req: PredictLinksRequest, opts?: RequestOpts): Promise<PredictLinksResponse>`
(src: `sdk/oxiddb-nodejs-sdk/src/client.ts:620`, `POST /predict-links`; body from
`src/types/kge.ts:8`)

KGE link prediction for `(head, relation, ?)`. Candidate count is `top_k` (not `k`).
Set `only_consistent: true` to drop reasoner-vetoed candidates server-side. Each
candidate carries `score`, `rank`, `consistent`, and `verdict`. (Requires a trained
model, see `db.train(...)`, `client.ts:611`.)

```ts
const pred = await db.predictLinks({
  head: "Guinness",
  relation: "pairsWith",
  top_k: 5,
  only_consistent: true, // veto inconsistent tails
});
for (const c of pred.candidates) {
  console.log(`${c.t}  score=${c.score.toFixed(3)}  consistent=${c.consistent}`);
}
```

### import_owl

method: `importOwl(owl: string, opts?: RequestOpts): Promise<ImportResponse>`
(src: `sdk/oxiddb-nodejs-sdk/src/client.ts:537`, `POST /import/owl`)

The argument is the **raw OWL / RDF-XML text** (sent as `application/rdf+xml`), not a
JSON wrapper and not a path. Returns `{ ok, classes_added, individuals_added,
axioms_added, warnings }`.

```ts
import { readFile } from "node:fs/promises";

const owl = await readFile("beverages.owl", "utf8");
const res = await db.importOwl(owl);
console.log(res.ok, res.classes_added, res.axioms_added);

// (@oxiddb/web accepts a Blob/File too: await webDb.importOwl(fileInput.files[0]))
```

### import_csv

method: `importCsv(csv: string, opts?: RequestOpts): Promise<ImportResponse>`
(src: `sdk/oxiddb-nodejs-sdk/src/client.ts:528`, `POST /import/csv`)

The argument is the **raw CSV text** (sent as `text/csv`). Same `ImportResponse` shape.

```ts
const csv =
  "subject,predicate,object\n" +
  "Pilsner,subClassOf,Beer\n" +
  "Stout,subClassOf,Beer\n";
const res = await db.importCsv(csv);
console.log(res.ok, res.classes_added, res.axioms_added);
```

---

## Not-implemented / mapping summary

- `connect`, **NOT IMPLEMENTED** in either `@oxiddb/node` or `@oxiddb/web`; the client
  is stateless HTTP (construct then call; use `health()`/`ready()` to probe).
- `vector_search`, no method by that name; use OxQL `NEAR ?x TO [...]` via `query()`,
  or `individualSimilar(iri, { k, collection })` for reference-vector search.
- `map_collection_to_class` → `registerMapping()`; `bulk_import_documents` →
  `bulkInsertDocuments()` (JSON array) or `importDocumentsNdjson()` (raw NDJSON).
- Everything else maps 1:1 (camelCase): `add_subclass`→`addSubclass`,
  `add_disjoint`→`addDisjoint`, `insert_individual`→`insert`, `classify`→`classify`,
  `create_collection`→`createCollection`, `insert_document`→`insertDocument`,
  `predict_links`→`predictLinks`, `import_owl`→`importOwl`, `import_csv`→`importCsv`,
  `transaction`→`transaction`/`begin`.
