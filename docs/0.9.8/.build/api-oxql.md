# Oxid-DB 0.9.8: HTTP API & OxQL (code-verified reference)

Every claim below is verified against source. Primary sources:
`crates/oxd-server/src/lib.rs` (axum router + handlers, one giant file),
`crates/oxd-server/src/auth.rs`, `crates/oxd-config/src/lib.rs`,
`crates/oxd-query/src/oxql.pest` (grammar), `crates/oxd-query/src/lib.rs`
(Query AST + semantics), and the captured wire fixtures in
`sdk/_contract/fixtures/*.json` + `sdk/_contract/scenarios.json`.

---

## 1. Connection

- **API base URL:** managed instances are reached at `https://<id>.oxid-db.com` (example `https://85cfad134a4a.oxid-db.com`), where `<id>` is the 12-char hex instance id. (Underlying code default for a local bind is `ServerConfig::default().bind = "127.0.0.1:7878"`, `crates/oxd-config/src/lib.rs:178`; `DEFAULT_DB_URL = "http://127.0.0.1:7878"` in `crates/oxd-surface-core/src/config.rs:29`.)
- **Two-host model, presented to users as subdomains (verified `crates/oxd-server/src/lib.rs:1333-1367`):** managed instances expose the API at `https://<id>.oxid-db.com` and the web UI at `https://<id>-ui.oxid-db.com` (same id plus `-ui`; HTTPS, no ports). Under the hood this is two listeners:
  - The **API listener** (`bind`, local default port 7878) is **API-only**, no SPA fallback, so unknown paths return a clean JSON 404 (`build_router_api_only_with_idempotency`).
  - When `enable_ui = true` (the default), a **separate listener on `ui_bind` (local default `127.0.0.1:7880`, `crates/oxd-config/src/lib.rs:179`)** serves the **full API + the web-next SPA fallback** (`static_handler`). The browser app is same-origin with a full copy of the API; its client routes are under `/app/*`. `--no-ui` / `enable_ui=false` disables the UI listener.
  - Both listeners carry the entire JSON API. The only difference is the UI host adds the `index.html` SPA fallback for unmatched paths.
  - (The existing `docs/api.html` prose stating "API at `https://<id>.oxid-db.com`, UI at `https://<id>-ui.oxid-db.com`, `--no-ui`" is **CORRECT**, do not "fix" it to single-host.)
- **TLS:** off by default (plaintext). Enabled only when **both** `[server.tls].cert_file` and `key_file` are set (`crates/oxd-config/src/lib.rs:193-198`). A non-loopback bind without TLS is a **hard startup refusal** unless `[server].allow_insecure = true` / `--insecure` (`security::check_exposure`, `crates/oxd-server/src/lib.rs:1374`).
- **Auth (verified `crates/oxd-server/src/auth.rs:37-99`, `242-248`):** three modes, auto-selected:
  - `Disabled`, **the default**; every route open (no header needed).
  - `LegacyToken`, a single shared bearer token from `[server].auth_token` / env `OXD_API_TOKEN`.
  - `Users`, full multi-user RBAC backed by a `users.oxa` file (created via `/auth/*` bootstrap or CLI).
  - **Auth header when enabled:** `Authorization: Bearer <token>` (case-insensitive `Bearer`/`bearer`; `extract_bearer`, `auth.rs:244`). Observed token prefixes in tests: `oxs_…` (session), `oxk_…` (API key). There is no `X-Api-Key` header, everything goes through `Authorization: Bearer`.
  - Session/key management lives under `/auth/*` (login/logout/me/password/sessions/api-keys/audit/roles), `crates/oxd-server/src/auth_api.rs:1050-1071`.
- **Content type:** JSON everywhere except raw-body import endpoints (CSV/OWL/NDJSON, see below). Error envelope is `{"code": "<CODE>", "error": "<message>"}` (e.g. `{"code":"NOT_FOUND", ...}`, `{"code":"BAD_REQUEST", ...}`, `{"code":"QUERY_ERROR", ...}`).

---

## 2. Operation → HTTP request/response

Field names below are copied verbatim from handler structs / `serde_json::json!` bodies / fixtures. **Precision note up front:** the wire uses `iri` (not `id`), `class`/`classes` (not `type`), `vector` (raw `Vec<f32>`, not `embedding`), `query` (not `oxql`), and results come back under `results` with rows shaped `{"iri": ...}` (+ optional `score`, `fields`).

### ready (readiness): `GET /ready`
Also: `GET /health` (liveness, never touches DB), `GET /health/live`, `GET /health/query`.
- Request: none.
- `GET /health` → `200 {"status":"ok"}` (`lib.rs:1550`).
- `GET /ready` (`lib.rs:1612`) → `200` when consistent, `503` while draining or when known-inconsistent. Body:
```json
{
  "status": "ready",
  "checks": {
    "database_loaded": true,
    "classification_current": true,
    "consistent": true
  },
  "collections": { "default": { "vectors": 20, "dimension": 4 } },
  "num_classes": 7,
  "num_individuals": 20,
  "uptime_seconds": 42,
  "memory": {
    "estimated_bytes": 0, "rss_bytes": 0, "budget_bytes": 0,
    "admission_state": "ok"
  }
}
```
  - Empty/unclassified DB is still `200 ready` (only drain or known-inconsistent → 503). `status` is `"draining"` during shutdown drain.

### add_subclass (subclass axiom): `POST /subclass`
Struct `AddSubclassRequest { sub, sup }` (`lib.rs:7804`).
- Request: `{ "sub": "Lager", "sup": "Beer" }`
- Response: `200 {"ok": true}` (`lib.rs:7831`).
- (Same path `DELETE /subclass` retracts it. Gated variant: `POST /actions/add-axiom {"kind":"subclass","sub":...,"sup":...}`.)

### add_disjoint (disjointness): `POST /disjoint`
Struct `AddDisjointRequest { a, b }` (`lib.rs:7835`), note fields are **`a` / `b`**, not `class1`/`class2`.
- Request: `{ "a": "Lager", "b": "Ale" }`
- Response: `200 {"ok": true}` (`lib.rs:7858`).

### insert_individual: `POST /insert`
Struct `InsertRequest` (`lib.rs:4989`). Fields:
- **`iri`**, canonical (serde alias: the legacy field name is `individual`; **both deserialize**, alias declared `#[serde(alias = "iri")]` on the `individual` field, so wire clients send `iri`).
- **`class`** (singular, `Option<String>`) OR **`classes`** (`Option<Vec<String>>`), set one, not both.
- `text` (`Option<String>`, server-embedded), `vector` (`Option<Vec<f32>>`, literal), `collection` (`Option<String>`, default = configured default collection).
- Request (minimal, with vector): `{ "iri": "Heineken", "class": "Lager", "vector": [0.6,0.3,0.1,0.6] }`
- Response: `200 {"ok": true}` (`lib.rs:5133`).
- **Hard 400** if you send `properties`, `property`, `label`, or `annotations` on `/insert`, it loudly refuses and routes you to `POST /entities` (`lib.rs:5033`). `/insert` writes exactly: iri + class(es) + optional vector/text.
- **Compound write:** `POST /entities` (struct `EntityUpsertRequest { iri, classes[], properties[], vector{values|text,collection}, gate }`, `lib.rs:5155`) writes classes + data/object properties + a vector in **one** transaction; `gate:true` runs the EL⊥ consistency gate before commit.

### classify: `POST /classify`
- Request: none.
- Response (`lib.rs:5588`, fixture `classify_response.json` + scenario adds `violation_witnesses`):
```json
{ "ok": true, "consistent": true, "coherent": true, "violations": 0, "violation_witnesses": [], "unsatisfiable": [] }
```
  - `coherent`/`unsatisfiable` = TBox class-satisfiability (classes entailed ⊥). `consistent`/`violations`/`violation_witnesses` = ABox disjointness conflicts.

### query (one page of OxQL): `POST /query`
Struct `QueryRequest { query, cursor?, hydrate? }` (`lib.rs:2514`). The OxQL text is the **`query`** field (not `oxql`).
- Request: `{ "query": "FIND ?x WHERE ?x IS-A Lager LIMIT 20" }`
- Response (fixture `query_response_basic.json`):
```json
{
  "results": [ { "iri": "BudLight" }, { "iri": "Corona" }, { "iri": "Heineken" } ],
  "total_count": 3,
  "next_cursor": "eyJ0ZXJtIjoi..."
}
```
  - Each row is `{"iri": ...}`; `score` (f32) is added for NEAR/hybrid rows; `fields` (object) is added when `PROJECT` is used (`QueryResult`, `oxd-query/src/lib.rs:217`). `elapsed_micros` may also appear (contract ignores it).
  - `hydrate`: `["name", ...]` whitelist (or `true`) to inline data-property fields, see `query_response_hydrate_whitelist.json`. Absent ⇒ IRI-only rows, byte-identical to pre-hydrate.
  - `total_count` is the count of rows **in this page**, not the full match count.
- Bad OxQL → `400 {"code":"QUERY_ERROR", "error":"..."}` (fixture `error_query_error.json`); unparseable text → `400 {"code":"BAD_REQUEST"}`.

### query_all (pagination)
Two mechanisms, both on `POST /query`:
1. **`OFFSET`/`LIMIT` inside the OxQL**, the primary, always-correct paginator. `OFFSET m` skips the first *m* rows; `LIMIT n` caps the page. It selects the true top-N over the **full sorted candidate set** each call. This is what `docs/api.html` recommends for deep pages.
2. **Opaque `next_cursor`**, the response returns a base64 cursor (`QueryCursor { term, score? }`, base64-encoded JSON, `lib.rs:2524-2548`); resend it as `{"query": "...", "cursor": "<next_cursor>"}` to resume. Caveat from `docs/api.html`: deep multi-page cursors over `SORT`/`NEAR` result sets are **not fully supported**, use `OFFSET`/`LIMIT` for those.
- To page through everything: keep the same `query` and increment `OFFSET` by `LIMIT` until `results` is empty (or shorter than `LIMIT`). There is no server-side "fetch all" endpoint; a single `/query` fully materializes its result in RAM and is subject to `[server.limits].max_query_rows` (`enforce_query_row_cap`, `lib.rs:2557`, an explicit `LIMIT` above the cap is a 400).

### vector_search (nearest neighbors): two ways
1. **OxQL `NEAR ... TO` over `POST /query`** (hybrid-capable):
   - `{ "query": "FIND ?x WHERE ?x IS-A Beer AND NEAR ?x TO [0.9,0.1,0.5] LIMIT 5" }`
   - `NEAR ?x TO [vec]` (literal), `NEAR ?x TO "text"` (auto-embed, needs an embedder), `NEAR ?x.collection TO ...` (named collection), optional `EF <n>` for per-query HNSW breadth. Rows carry `score`.
2. **`GET /individuals/{iri}/similar`** (by reference vector; `individual_similar`, `lib.rs:7352`):
   - Query params: `?k=<n>` (default 20, `default_k`, `lib.rs:7346`) and `?collection=<name>` (absent ⇒ **configured** default collection, not literal `"default"`).
   - Request: `GET /individuals/Heineken/similar?k=3&collection=default`
   - Response (fixture `individual_similar.json`):
```json
{
  "reference": "Heineken",
  "collection": "default",
  "results": [ { "iri": "FoundersPorter", "score": 0.991 }, { "iri": "BudLight", "score": 0.99 } ]
}
```
   - `score` = `1.0 - distance`, rounded to 3 dp (`lib.rs:7408`); self is excluded.

### create_collection (provision a vector collection)
Two endpoints:
- **`POST /collections`**, struct `CreateCollectionRequest { name, dimensions, metric, quantization, cold_f32 }` (`lib.rs:7460`):
  - `dimensions` (usize, **field name is `dimensions`**, NOT `dim`), `metric` default `"cosine"` (`default_metric`, `lib.rs:7483`; parsed to cosine/l2/ip + aliases), `quantization` default `"none"` (or `"sq8"`), `cold_f32` default `false`.
  - Request: `{ "name": "beers", "dimensions": 384, "metric": "cosine", "quantization": "none" }`
  - `GET /collections` → `collections_list.json`: `{"collections":[{"name","dimensions","metric","quantization","cold_f32","default","vectors"}]}`.
- **`POST /collections/provision`** (one-shot vector collection + document→class binding; struct `ProvisionRequest { vector?, binding? }`, `lib.rs:9720`):
  - `vector`: `{ name, dimensions, metric, quantization }`.
  - `binding`: `{ document_collection, class, field_mappings[], auto_type, embed? }` (SAGA, idempotent create; same-shape re-POST is retry-safe, different shape → `409 COLLECTION_SHAPE_CONFLICT`).

### insert_document (one JSON doc): `POST /documents/{collection}`
Handler `handle_insert_document` (`lib.rs:9938`). Body is the **raw JSON document object**; an optional top-level `_iri` sets the document IRI (lifted out before storage).
- Request: `POST /documents/people` body `{ "_iri": "Dave", "name": "Dave", "score": 3 }`
- Response: `200 {"ok": true, "collection": "people", "iri": "Dave"}` (`lib.rs:9974`).
- If the collection has a bridge mapping + `auto_type`, the document is auto-typed as an individual of the mapped class with mapped data/object properties.

### bulk_import_documents: three flavors
- **`POST /documents/{collection}/import`**, **raw NDJSON body** (one JSON object per line; `Content-Type` is plain text, body deserialized as `String`, `handle_import_ndjson`, `lib.rs:10562`). Per-line IRI from **`$id`** (or `_iri`). Response: `200 {"ok":true,"collection":..,"imported":<n>,"upserts":<n>}` (`lib.rs:10628`).
- **`POST /documents/{collection}/bulk`**, JSON body (struct `BulkInsertBody`, either a bare JSON array or `{documents:[...]}`; per-doc `_iri`/`$id`). Response: `200 {"ok":true,"collection":..,"inserted":<n>,"upserts":<n>,"indexes_built":..,"results":[{index,iri,ok}],"results_truncated":<bool>}` (`lib.rs:10547`).
- **`POST /txn/{id}/bulk-insert-documents`**, transactional; body `{collection, documents:[...]}`; response `{inserted_count, upsert_count}` (fixture `txn_bulk_insert_documents.json`).
- **`GET /documents/{collection}/export`** → streams NDJSON (`Content-Type: application/x-ndjson`, `$id`-tagged, `$vector` re-injected for round-trip).

### map_collection_to_class (ontology bridge): `POST /collections/map`
Struct `CollectionMapDto { collection, class, field_mappings[], auto_type, embed? }` (`lib.rs:9453`). Query `?replace=true` to overwrite a different existing mapping.
- `field_mappings[]`: `{ field: "address.city", property: "<IRI>", type: {"kind": "data_property" | "object_property" | "vector_property", ...} }` (`FieldMappingDto`, `lib.rs:9480`; `type` is tagged by inner `kind`, snake_case; `vector_property` also takes `collection` + `store_inline`).
- `auto_type` default `true`; `embed`: `{ text_field, target_collection }`.
- Request: `{ "collection": "people", "class": "Person", "field_mappings": [{"field":"name","property":"name","type":{"kind":"data_property"}}], "auto_type": true }`
- Responses (issue #72): new → `200 {"changed":true,"replaced":false}`; identical → `200 {"changed":false}`; different w/o replace → `409 {"code":"COLLECTION_ALREADY_MAPPED_DIFFERENT"}`; different + `?replace=true` → `200 {"changed":true,"replaced":true}`.
- `GET /collections/map` → `mappings_list.json`: `{"mappings":[{"collection","class","auto_type","field_count"}]}`. `DELETE /collections/map/{collection}` unregisters.

### transaction (begin / mutate / commit)
- **`POST /txn`** (`handle_txn_begin`, `lib.rs:7911`) → `200 {"txn_id": 1}`. **Capture `txn_id`** and interpolate into subsequent paths. IDs are **not deterministic** (autocommit writes share the counter).
- **`POST /txn/{id}/insert`** (struct `TxnInsertRequest { iri, class, text?, vector?, collection? }`, `lib.rs:8138`) → `200 {"term": 76}` (the interned Term id; fixture `txn_insert.json`). Note: IRI must be **new** in a txn insert (no widening).
- Other txn mutators (all under `/txn/{id}/…`): `subclass {sub,sup}`→`{ok:true}`, `disjoint {a,b}`, `object-property`, `annotation`, `upsert-vector`, `insert-into-collection`, `insert-document {collection,document,iri?}`→`{term}`, `update-document`, `delete-document {collection,id}`→`{existed}`, `bulk-insert-documents`→`{inserted_count,upsert_count}`, `register-mapping`, `unregister-mapping`→`{existed}`, `set-embedder-config`, `savepoint`→`{ok,savepoint}`, `rollback-to/{savepoint}`→`{ok,rolled_back_to}`.
- **`POST /txn/{id}/commit`** (`lib.rs:7932`) → `200 {"ok":true,"txn_id":<id>,"state":"committed"}`.
- **`POST /txn/{id}/rollback`** → `200 {"ok":true,"txn_id":<id>,"state":"aborted"}`.
- Unknown/settled id → `404 {"code":"NOT_FOUND"}`. Header **`Idempotency-Key`** dedupes `POST /txn/*` (`lib.rs:698`).

### predict_links (KGE): `POST /predict-links`
Struct `PredictLinksRequest { head, relation?, model, top_k?, only_consistent }` (`lib.rs:4728`).
- **Field-name gotcha:** the request field is **`top_k`** (default = `[inference].top_k`), NOT `k`. `model` defaults to `"default"`. `relation` defaults to `rdf:type`. The `sdk/_contract` scenario sends `"k":5` which serde **silently ignores** (unknown field), so it falls back to the config `top_k`, do not copy `k` into real requests; use `top_k`.
- Request: `{ "head": "Heineken", "relation": "brewedBy", "model": "default", "top_k": 5 }`
- Success response (`lib.rs:4868`): `{ "tier":"deterministic-inferential", "provenance":"...", "model":"default", "kind":"...", "stale":<bool>, "trained_abox_triples":<n>, "candidates":[ {"h","r","t","score","rank","consistent","verdict"} ] }`.
- No trained model → `400` (fixture `predict_links_error.json`): `{"code":"BAD_REQUEST","error":"no trained model named \`default\`, POST /train first (collection = model name)"}`.
- Train first: `POST /train` (struct `TrainRequest`, `lib.rs:4483`; collection name = model name), poll `GET /train/status`.

### import_owl / import_csv (raw-body imports)
- **`POST /import/owl`** (`handle_import_owl`, `lib.rs:8646`): body is the **raw OWL file bytes** (`axum::body::Bytes`). Query params: `?base=<IRI>` (base for relative refs), `?format=owx|owl|xml|ofn|obo|omn|ttl|nt|auto` (omit ⇒ content sniff; **RDF/XML not supported** → 400). Response: `200 {"ok":true,"classes_added","individuals_added","axioms_added","edges_added","individuals_skipped","edges_skipped","iris_unresolved","warnings":[...]}`.
- **`POST /import/csv`** (`handle_import_csv`, `lib.rs:8604`): body is the **raw CSV text** (deserialized as `String`). Response: `200 {"ok":true,"classes_added","individuals_added","axioms_added","warnings":[...]}`.
- Both wrap the import in an exclusive autocommit txn. Empty body → 400.

---

## 3. Full route table

Extracted from `crates/oxd-server/src/lib.rs:468-679` (+ `auth_api.rs:1050-1071`). Every route is registered on **both** the API-only and the UI listeners.

### Health / readiness
| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Process liveness, `{"status":"ok"}`, never touches the DB. |
| GET | `/health/live` | DB read-lock reachability probe → `{"healthy":bool}` (503 if wedged). |
| GET | `/health/query` | Deep DB read probe (counts every collection) → `{"healthy":bool}`. |
| GET | `/ready` | Readiness w/ classification + memory + collections detail; 503 on drain/inconsistent. |
| GET | `/metrics` | Prometheus text exposition. |

### Ontology (classes / axioms / schema)
| Method | Path | Purpose |
|---|---|---|
| GET | `/schema` | Class hierarchy + counts. |
| GET | `/properties` | Data/object property inventory. |
| GET | `/ontology` | Full ontology dump. |
| GET | `/ontology/summary` | Class backbone + per-class counts, no individuals (scale-safe). |
| POST | `/classes` | Create a class. |
| DELETE | `/classes/{iri}` | Delete a class (`?mode=cascade\|orphan`, `?reattach=parent\|thing`). |
| POST | `/classes/{iri}/preview` | Dry-run class deletion → `ConflictReport`. |
| POST | `/classes/{iri}/deprecate` · `/undeprecate` | Deprecate / restore a class. |
| POST | `/subclass` | Add subclass axiom `{sub,sup}` → `{ok:true}`. |
| DELETE | `/subclass` | Retract subclass axiom. |
| POST | `/disjoint` | Add disjointness `{a,b}` → `{ok:true}`. |
| POST | `/classify` | Run classification → consistency/coherence verdict. |
| POST | `/consistency/check` | Speculative EL⊥ verdict (no commit) `{assertions[]}`. |
| POST | `/actions/assert-typed` | Gated typed assertion `{individual/iri, class/classes, client_txn?}`. |
| POST | `/actions/add-axiom` | Gated axiom `{kind:subclass\|disjoint\|equivalent, ...}`. |
| GET | `/reasoner/fragment` | Read-only reasoner-fragment/limitation diagnostic. |

### Individuals / query
| Method | Path | Purpose |
|---|---|---|
| POST | `/query` | Execute OxQL, one page `{query, cursor?, hydrate?}`. |
| POST | `/explain` · `/explain/analyze` | Query plan (+ execution stats for analyze). |
| GET | `/snapshot` | Point-in-time ontology snapshot. |
| POST | `/insert` | Insert one individual `{iri, class/classes, text?, vector?, collection?}`. |
| POST | `/insert/batch` | Bulk insert `{entities:[...], collection?}`. |
| POST | `/entities` | Compound entity upsert (classes + properties + vector, one txn). |
| POST | `/entities/batch` | Compound entity upsert, batched. |
| GET | `/classes/{iri}/individuals` | Page one class's members. |
| GET | `/individuals/search` | Bounded text scan over individuals. |
| GET / PUT / DELETE | `/individuals/{iri}` | Detail / replace / delete an individual. |
| GET | `/individuals/{iri}/similar` | Nearest neighbors `?k=&collection=`. |
| POST / PUT | `/individuals/{iri}/classes` | Add (union) / replace an individual's classes. |
| POST / DELETE | `/individuals/{iri}/property` | Assert / retract a property. |

### Documents / collections
| Method | Path | Purpose |
|---|---|---|
| GET | `/collections` | List vector collections. |
| POST | `/collections` | Create vector collection `{name,dimensions,metric,quantization,cold_f32}`. |
| POST | `/collections/provision` | Provision collection + document→class binding in one call. |
| DELETE / PATCH | `/collections/{name}` | Drop / reshape (empty named only) a collection. |
| POST | `/collections/{name}/default` | Promote to default insert target. |
| GET / POST | `/collections/map` | List / register bridge mappings (`?replace=true`). |
| DELETE | `/collections/map/{collection}` | Unregister a bridge mapping. |
| GET | `/collections/{name}/schema` · `/stats` · `/entities` | Doc schema / stats / vector-owner list. |
| GET / POST | `/collections/{name}/indexes` | List / create a document index. |
| DELETE | `/collections/{name}/indexes/{id}` | Drop a document index. |
| GET | `/documents` | List document collections (bridge-decorated). |
| POST | `/documents/{collection}` | Insert one JSON document. |
| GET / DELETE | `/documents/{collection}/{id}` | Get / delete a document by IRI. |
| POST | `/documents/{collection}/bulk` | Bulk insert (JSON array / `{documents}`). |
| POST | `/documents/{collection}/import` | Import raw **NDJSON** body. |
| GET | `/documents/{collection}/export` | Export collection as NDJSON. |

### Transactions
| Method | Path | Purpose |
|---|---|---|
| POST | `/txn` | Begin → `{txn_id}`. |
| POST | `/txn/{id}/commit` · `/rollback` | Commit / abort. |
| POST | `/txn/{id}/savepoint` · `/rollback-to/{savepoint}` | Savepoint / partial rollback. |
| POST | `/txn/{id}/insert` | Transactional individual insert → `{term}`. |
| POST | `/txn/{id}/subclass` · `/disjoint` · `/object-property` · `/annotation` | Ontology mutators. |
| POST | `/txn/{id}/upsert-vector` · `/insert-into-collection` | Vector mutators. |
| POST | `/txn/{id}/insert-document` · `/update-document` · `/delete-document` · `/bulk-insert-documents` | Document mutators. |
| POST | `/txn/{id}/register-mapping` · `/unregister-mapping` · `/set-embedder-config` | Registry/config mutators. |

### Import / export / backup
| Method | Path | Purpose |
|---|---|---|
| POST | `/import/csv` | Import raw CSV text. |
| POST | `/import/owl` | Import raw OWL bytes (`?base=`, `?format=`). |
| GET | `/export` | Full-DB bincode export. |
| GET | `/export/okf` | OKF v0.2 export (read-only). |
| POST | `/backup` | Single-file backup `{name}` → `{ok,name,format,partial,dropped,size,timestamp}`. |

### Train (KGE)
| Method | Path | Purpose |
|---|---|---|
| POST | `/train` | Train a KGE model (collection name = model name). |
| GET | `/train/status` | Training progress. |
| POST | `/predict-links` | KGE link prediction `{head, relation?, model, top_k?, only_consistent}`. |

### Admin / config
| Method | Path | Purpose |
|---|---|---|
| GET | `/admin/memory` | Per-region memory estimate + admission state. |
| POST | `/admin/compact` | Paged-store compaction → before/after/reclaimed bytes. |
| POST | `/admin/reset` | Destructive reset `{scope, collection?}`. |
| GET / POST | `/admin/export` · `/admin/import` | Full-DB bundle download / upload+restart. |
| GET | `/config` | Running config (redacted). |
| POST | `/config/plan` · `/config/apply` | Dry-run / apply a config change. |
| GET / PUT | `/config/embedder` | Get / set embedder config. |
| POST | `/config/embedder/probe` | Probe an embedder config. |
| GET / POST | `/demos` · `/demos/{id}/install` | List / install bundled demo datasets. |

### Auth (`auth_api::routes()`)
| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/login` · `/auth/logout` | Session lifecycle. |
| GET | `/auth/config` · `/auth/me` | Auth mode / current principal. |
| POST | `/auth/password` | Change password. |
| GET | `/auth/sessions` · DELETE `/auth/sessions/{id}` | List / revoke sessions. |
| (CRUD) | `/auth/api-keys` · `/auth/api-keys/{id}` | Manage API keys. |
| (CRUD) | `/auth/users` · `/auth/users/{id}` | Manage users (RBAC). |
| GET | `/auth/audit` · `/auth/roles` | Audit log / role list. |

---

## 4. OxQL language reference

Grammar of record: `crates/oxd-query/src/oxql.pest`. AST: `crates/oxd-query/src/lib.rs` (`Query`, `Stage`).

### Statement shape (from `query` rule, `oxql.pest:28-33`)
```
FIND ?var
     [FROM <collection>]
     [WHERE <stage> ( (EXCEPT | [AND]) <stage> )* ]
     [ PROJECT <field>,... | AGGREGATE <fn>,... [GROUP BY ...] [HAVING ...] [ORDER BY ...] [TOP n] ]
     [SORT <field> [ASC|DESC]]
     [LIMIT n] [OFFSET m] [AS OF <commit_ts>]
```

### Keywords / clauses actually in the grammar
- **`FIND ?var`**, mandatory; exactly one variable (`?` + alpha/alnum/underscore).
- **`FROM <ident>`**, switches to **document mode** (predicates route to the document store instead of the ontology).
- **`WHERE`**, stage chain. Optional **only** when `FROM` is present (pure-aggregate). Without `FROM`, `WHERE` + ≥1 stage is **mandatory** (`oxql.pest:29-30`, comment lines 14-20).
- Stage connectors: bare juxtaposition, optional **`AND`**, or **`EXCEPT`** (desugars to `AND NOT`, `oxql.pest:22-35`). **There is no `OR`.** `OR` is a *reserved keyword* (so it can't be an identifier) but is **not** a grammar production, you cannot write disjunction.
- Stage kinds (`stage` rule, `oxql.pest:37-47`):
  - `?x IS-A <Class>`, class membership **with inference** (see below).
  - `?x <property> <object>`, object-property (relation) filter, e.g. `?x brewedBy HeinekenNV`.
  - `?x.<field> <op> <literal>`, property/field predicate; ops `= != > < >= <=` (`op`, `oxql.pest:136`).
  - `NEAR ?x TO <vec|"text">` [`EF <n>`], vector search; `NEAR ?x.<collection> TO ...` targets a named collection (`near_stage`, `oxql.pest:99`).
  - `LIKE ?x[.<collection>] TO <EntityName>`, vector-by-reference (use another entity's vector as the query; `like_stage`, `oxql.pest:104`).
  - `EXISTS ?x.<field>`, document has a value at path (document mode).
  - `?x.<field> CONTAINS <literal>`, array membership (document mode).
  - `?x.<field> IN [lit, lit, ...]`, set membership (union of `=`; non-empty list).
  - `NOT <stage>`, closed-world complement; recursive (`NOT NOT` = identity).
- **Aggregation** (`agg_clause`, `oxql.pest:81-91`): `AGGREGATE COUNT(*) | COUNT(f) | SUM(f) | AVG(f) | MIN(f) | MAX(f) | COUNT_DISTINCT(f)`, then optional `GROUP BY <field>,...`, `HAVING <agg> <op> <literal>`, `ORDER BY <agg> [ASC|DESC]`, `TOP <n>`. Order is fixed: `AGGREGATE → GROUP BY → HAVING → ORDER BY → TOP`. `HAVING`/`ORDER BY`/`TOP` **only** exist inside `AGGREGATE`. `AGGREGATE` and `PROJECT` are mutually exclusive.
- **`PROJECT <field>,...`**, return selected document fields (document mode) in the `fields` object of each row.
- **`SORT <field> [ASC|DESC]`**, parses and sorts document-mode results; **see the SORT caveat below**.
- **`LIMIT n`** / **`OFFSET m`**, paging. Default `LIMIT` = **10** (`DEFAULT_QUERY_LIMIT`, `oxd-query/src/lib.rs:1069`).
- **`AS OF <integer>`**, time-travel to a commit timestamp (integer only; wall-clock strings not yet supported, `oxql.pest:112-117`).
- **`COUNT(*)`** is the literal token `COUNT ( * )`; `COUNT()` is invalid, use `COUNT(*)` or `COUNT(field)`.
- Reserved keywords (cannot be identifiers): `EXCEPT HAVING ORDER NOT TOP OR` (`reserved_kw`, `oxql.pest:131`). Everything else (including `IS-A` operands, `AND`, `IN`, `CONTAINS`, `EXISTS`, `NEAR`, `LIKE`, `TO`, `FROM`, `EF`) is contextual.
- Comments: `-- to end of line`. Whitespace-insensitive.

### Hard constraints
- `FIND ?x` is mandatory (single variable only, no joins, no second variable).
- ≥1 `WHERE` stage required unless `FROM` + `AGGREGATE` (pure-aggregate).
- Default `LIMIT` = 10 when omitted. An explicit `LIMIT` above `[server.limits].max_query_rows` is a **400** (`enforce_query_row_cap`).
- `?x.field` predicates: LHS is `?var` `.` field name; RHS is a quoted string, number, or `true`/`false`.
- **`SORT` is a NO-OP over HTTP.** Per `sdk/_contract/README.md:56-58`: the `/query` wire order is IRI (or score-then-IRI for NEAR/hybrid), **not** any OxQL `SORT`. `SORT` parses and applies to document-mode projections in-engine, but the HTTP response ordering the contract pins is IRI/score, not `SORT`. Do not rely on `SORT` to order `/query` JSON.
- **`NOT` is v1-scoped:** the negated leaf must be `IsA` or `Relation`, and only in `FROM`-less (ontology) queries. Negating property/document/vector stages is rejected loudly (`oxd-query/src/lib.rs:158-166`, plan-time check). So `NOT ?x IS-A Ale` is fine; `NOT ?x.abv > 5` is not.
- **No `OR`, no parentheses/grouping, no nested boolean expressions.** The stage chain is a flat AND/EXCEPT fold. Disjunction over a single field is expressible only via `?x.field IN [...]`.

### IS-A inference semantics
`?x IS-A C` returns **all instances of C including instances of every subclass, transitively**, driven by the reasoner's classification closure (`ClassificationResult` threaded into the planner, `oxd-query/src/lib.rs:1082+`). E.g. `?x IS-A Beer` returns members of Pilsner/Stout/IPA/Lager/WheatBeer even if none was asserted directly as `Beer`. Classification is triggered automatically on first query if stale (`docs/cli-query-language.html:191-192`, verified against `handle_classify`/planner). The fixture `individual_detail.json` shows `inferred_classes: ["AlcoholicBeverage","Beverage","Lager","Beer"]` for `Heineken` (asserted only `Lager`), confirming transitive superclass inference.

### Verified example queries
All lifted from `sdk/_contract/query-builder-corpus.json` and `scenarios.json` (real, parse+run-green against the seeded server):
```oxql
-- 1. Class membership with inference (returns subclass members too)
FIND ?x WHERE ?x IS-A Beer LIMIT 20

-- 2. Pure vector NEAR (literal vector; dims must match the collection)
FIND ?x WHERE NEAR ?x TO [0.9, 0.1, 0.5] LIMIT 5

-- 3. Hybrid: symbolic filter AND vector rank in one statement
FIND ?x WHERE ?x IS-A Beer AND NEAR ?x TO [0.9, 0.1, 0.5] LIMIT 5

-- 4. Object-property (relation) filter
FIND ?x WHERE ?x brewedBy HeinekenNV LIMIT 10

-- 5. Data-property filter, ontology mode
FIND ?x WHERE ?x IS-A Beer AND ?x.abv > 4.5 AND ?x.abv < 6.0 LIMIT 10

-- 6. Document-mode field predicates (FROM switches to the doc store)
FIND ?x FROM beers WHERE ?x.abv > 0.5 LIMIT 10

-- 7. Set membership (union of equalities)
FIND ?x FROM awards WHERE ?x.amount IN [100, 500] LIMIT 100

-- 8. Project + sort + page (document mode)
FIND ?x FROM beers WHERE ?x.abv > 0.5 PROJECT name, abv SORT abv DESC LIMIT 2 OFFSET 1

-- 9. Aggregation with GROUP BY / HAVING / ORDER BY / TOP
FIND ?x FROM people AGGREGATE COUNT(*) GROUP BY manager HAVING COUNT(*) > 1 ORDER BY COUNT(*) DESC TOP 5

-- 10. Per-query HNSW breadth override
FIND ?x WHERE NEAR ?x TO "crisp pale lager" EF 200 LIMIT 10

-- 11. Closed-world negation (IsA/Relation leaf, ontology mode only)
FIND ?x WHERE ?x IS-A Beer AND NOT ?x IS-A Ale LIMIT 10
```

### What the grammar does NOT support (be critical)
- **No `OR`**, reserved but not a production; no disjunction of stages. Closest workaround: `IN [...]` on one field.
- **No parentheses / grouping / nested boolean expressions**, flat AND/EXCEPT fold only.
- **No second variable / no joins**, single `?var`.
- **`NOT` cannot negate property, document, or vector stages**, only `IS-A` / relation, ontology mode.
- **`AS OF` only takes an integer commit timestamp**, no wall-clock date strings.
- **`SORT` does not order the HTTP `/query` response** (IRI/score order is what the wire guarantees).
- **`RDF/XML` is not an accepted `?format=` for `/import/owl`** (400).

---

### Corrections / notes vs existing prose (`docs/api.html`, `docs/cli-query-language.html`)
1. **Two-port claim is CORRECT**, `docs/api.html:166` (API 7878 program-only, UI on 7880 under `/app/*`, `--no-ui`) matches `run_server` (`lib.rs:1333-1367`). Keep it.
2. **Default `LIMIT` = 10**, `docs/cli-query-language.html:185` is CORRECT (`DEFAULT_QUERY_LIMIT = 10`).
3. **IS-A transitive inference**, `docs/cli-query-language.html:191-192` is CORRECT.
4. **Auth header**, use `Authorization: Bearer <token>`; there is no `X-Api-Key`. Default mode is `Disabled` (no header).
5. **`SORT` no-op over HTTP**, neither existing doc states this; it is the single biggest gotcha. Document it (source: `sdk/_contract/README.md:56-58`).
6. **`predict_links` field is `top_k`, not `k`**, the contract scenario's `"k":5` is silently ignored by serde; real clients must send `top_k`.
7. **`/insert` rejects `properties`/`property`/`label`/`annotations`** with a 400, use `POST /entities` for compound writes (not mentioned in existing prose).
8. **`create_collection` field is `dimensions`** (not `dim`); **`disjoint` fields are `a`/`b`** (not class1/class2); insert canonical field is **`iri`** (legacy alias `individual`).
