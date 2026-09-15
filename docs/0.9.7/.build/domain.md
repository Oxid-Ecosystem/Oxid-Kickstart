# Oxid-DB 0.9.7: Code-Verified Conceptual Reference

Source of truth: the Rust workspace at `crates/*`. Every claim below cites the
file it was verified against. Where the *existing* HTML docs overstate or are
stale, that is flagged in **CORRECTION** notes.

Version note: the workspace `Cargo.toml` `[workspace.package].version` is
`0.9.7` (root `Cargo.toml`); `0.9.7` is the release these docs
target. The on-disk checkpoint format is `OXDB_VERSION = 12`
(`crates/oxd-storage/src/lib.rs:176`).

---

## ontologies.html: the ontology model

### Verified facts

- An **ontology** here is a set of `Axiom` values over a native class-expression
  AST. The AST (`ClassExpr`, `crates/oxd-core/src/ontology.rs:8`) has exactly
  five shapes: `Named(Term)`, `Top` (owl:Thing), `Bottom` (owl:Nothing),
  `And(Box, Box)` (⊓ conjunction), `Some(Term, Box)` (∃r.C existential). There
  is **no** union, complement, universal (∀), cardinality, or nominal (oneOf)
  in the native AST, those are OWL constructs outside EL and are collapsed on
  import (see reasoning.html).
- `Axiom` (`ontology.rs:52`) variants: **TBox**, `SubClassOf{sub,sup}`,
  `EquivalentClasses{left,right}` (desugared to two SubClassOf on add),
  `DisjointClasses{classes}` (pairwise). **ABox**, `ClassAssertion`,
  `ObjectPropertyAssertion`, `DataPropertyAssertion`, `AnnotationAssertion`.
  **RBox**, `SubObjectPropertyOf{sub: Vec<Term>, sup}` (added in schema v11).
- **Term(u32)** (`crates/oxd-core/src/term.rs:11`): every IRI, blank node, or
  literal that enters the system is interned into a `TermDictionary` and
  represented internally by a single opaque `u32`. All internal data structures
  operate on `Term`, never strings. IDs `0..32` are reserved well-known terms
  (`FIRST_USER_TERM = 32`); owl:Thing = `Term(0)`, owl:Nothing = `Term(1)`,
  rdf:type = `Term(2)`, rdfs:subClassOf = `Term(3)`, etc. (`term.rs:68-95`).
- Reserved top band `SYNTHETIC_TERM_BASE = 0xC000_0000` (`term.rs:66`) is used
  by the reasoner for internal fresh names during normalization; these never
  enter the dictionary or any caller-visible surface.
- The `Ontology` struct (`ontology.rs:229`) holds derived indexes:
  `direct_supers`, `disjoint_pairs`, `class_assertions`, `object_properties`,
  `data_properties`, `role_closure`, plus `classes` and `individuals` bitsets.
- You build an ontology by: (a) importing OWL (`import_owl*`, six syntaxes, see
  storage.html), (b) asserting axioms over the HTTP/OxQL surface, or (c) the
  document→ontology bridge (documents become typed individuals).

### Plain-language (junior)

An ontology is the schema-plus-facts layer: **classes** (categories like
`Beer`), **individuals** (instances like `duvel`), and **axioms** (rules like
"Beer is a subclass of Beverage", "Beer and Wine are disjoint"). Every name is
turned into a small integer (a `Term`) the moment it is seen, so the engine
compares integers, not strings.

### Precise detail (senior)

- Class-vs-individual is not a type-tag on the `Term`; it is membership in the
  `Ontology::classes` / `Ontology::individuals` bitsets, maintained as axioms
  are added.
- `EquivalentClasses` is stored as two `SubClassOf` edges; there is no separate
  equivalence relation at the storage layer.
- Object properties are stored as an `imbl::HashMap<(subject, property), {objects}>`
  and data properties as `(subject, property) → Vec<Literal>`; property IRIs are
  themselves `Term`s.

### Honest limitations

- The native model is deliberately EL-shaped. Rich OWL axioms are representable
  only insofar as they lower into `{Named, ⊤, ⊥, ⊓, ∃}`; everything else is
  dropped/collapsed at import time (loudly counted, never silent).

---

## reasoning.html: OWL 2 EL⊥ reasoner

### Verified facts (the profile and rules)

- Profile: **OWL 2 EL with ⊥ (EL⊥)**, i.e. the tractable EL family plus bottom
  for unsatisfiability/disjointness. Classification is worklist-based and
  **PTIME** (`crates/oxd-reasoner/src/classify.rs:697` `classify`; the header at
  `classify.rs:25` notes ~0.75 s at 100k individuals, measured).
- The algorithm first **normalizes** every axiom into the four Baader/Brandt/Lutz
  normal forms (NF1 to NF4) via a real structural normalizer
  (`classify.rs:121` `Normalizer`, `classify.rs:496` `from_ontology`), minting
  fresh internal names for complex subexpressions. This is reasoner-04.
- Completion rules actually implemented (grep-verified in `classify_worklist`,
  `classify.rs:707`):
  - **CR1** transitive subsumption / SubClassOf closure (forward + backward,
    `classify.rs:962`, `:971`).
  - **CR2** conjunction: `A ⊓ B ⊑ C` (`classify.rs:985`). Disjointness is
    encoded as `A ⊓ B ⊑ ⊥` (`classify.rs:537`), so disjointness runs through CR2.
  - **CR3** existential propagation `A ⊑ ∃r.B` (`classify.rs:1004`).
  - **CR4** existential absorption `∃r.B ⊑ C` (`classify.rs:677`, in the
    edge-insertion helper).
  - **CR5** ⊥-through-existential: `∃r.⊥ ⊑ ⊥` (`classify.rs:1107`, `:683`).
  - **CR7** role hierarchy: a derived `∃r.filler` edge is mirrored onto every
    super-role in `role_closure[r]` (`classify.rs:641` `insert_existential_edge`;
    closure built at `crates/oxd-core/src/ontology.rs:518` `recompute_role_closure`).
- ABox realization (reasoner-02): individuals are internalized as saturation
  nodes so CR2/CR3/CR4/CR5 fire over asserted types + role edges; asserted-type
  edges participate in CR1 (`classify.rs:923`). `CLASSIFIER_VERSION = 2`
  (`classify.rs:21`), stamped into the persisted classification cache.
- **Consistency** (`classify.rs:1592`, in `build_result`): an ontology is
  inconsistent when (a) an individual belongs to two disjoint classes
  (`ConsistencyViolation`), (b) ⊤ is unsatisfiable (`owl:Thing ⊑ ⊥`, e.g.
  `⊤ ≡ ⊥`), or (c) a named individual is in a class entailed `⊑ ⊥`. Result field
  `consistent` (`classify.rs:557`, `:1634`).
- **Coherence ≠ consistency** (`classify.rs:1693`): `unsatisfiable_classes()`
  reports TBox incoherence (a class forced empty); an incoherent TBox can still
  be consistent (the empty class simply has no members).

### What inference you actually get

- Transitive subclass closure; type propagation up the hierarchy (an individual
  asserted `duvel : Beer` is inferred `duvel : Beverage`, `: owl:Thing`);
  existential-driven inference; disjointness → unsatisfiability; role-hierarchy
  inheritance for `∃`-edges.

### Honest limitations: GAPS (verify before writing marketing copy)

- **Property chains (CR8) are NOT implemented.** `SubObjectPropertyOf` rows with
  `sub.len() ≥ 2` (chains) are stored but **inert**, reasoner-06's input, not
  yet built (`ontology.rs:84-91`; `classify.rs:526-529`; test
  `role_chain_row_is_inert_until_06` at `classify.rs:3632`). `check_fragment`
  reports them as a drop (`DroppedShape::Other`), never silently.
- **Transitive object properties are NOT supported.** `Trans(r)` is expressed as
  the chain `r ∘ r ⊑ r`, which is a length-2 chain → CR8 territory → skipped
  loudly on import (`crates/oxd-core/src/owl_import.rs:570`, `:593`).
- **Domain/range** are not first-class RBox axioms. There is no `rdfs:domain`/
  `rdfs:range` reasoning rule; domain-style constraints only take effect if
  expressed as `∃r.⊤ ⊑ D` EL axioms (`classify.rs:884`).
- **Defined-class / complex-equivalence completeness caveats.** The normalizer
  closed the old silent-drop boundary, but the EL++ completeness audit
  (project memory `project_elpp_completeness_audit`) records residual gaps in
  complex definitional equivalence and some ABox completion rules. Do not claim
  "complete EL++ reasoning."
- **CORRECTION, `docs/owl-reasoner-support.html` is STALE.** It currently says
  (lines 527, 572 to 573): "Sub-property (SubObjectPropertyOf): No property-hierarchy
  inheritance", "Property chains: not present", "No RBox at all", "Reflexive/
  transitive properties: No RBox." As of reasoner-05 (schema v11), **role
  hierarchy (single-property `SubObjectPropertyOf`) IS supported and reasoned via
  CR7**, and there IS a (partial) RBox. Only property **chains** (length ≥ 2)
  and transitivity remain unimplemented. The table must be split:
  role-hierarchy = ✅, chains/transitivity = ❌.
- **CORRECTION, the "EL++" package-description claim.** `owl-reasoner-support.html:205`
  notes the crate historically read "EL++ ontology reasoner". The accurate label
  is **OWL 2 EL⊥ (a subset of EL++)**, see gaps above. Keep the EL⊥ framing.

---

## vectors.html: vector search

### Verified facts

- **Distance metrics** (`crates/oxd-core/src/metric.rs:16` `Metric` enum): four , 
  `Cosine` (default), `L2` (Euclidean squared), `InnerProduct` (negative inner
  product, so lower = more similar), `Manhattan` (L1). Canonical spellings:
  `cosine`, `l2`, `ip`, `manhattan` (`metric.rs:32`, `:56`). Lower = more similar
  for all four.
- **Index types**: the only *usable* index is **HNSW**. `IndexType::IvfPq`
  parses but is refused at collection creation ("recognised but not yet usable , 
  training unimplemented", `crates/oxd-vector/src/lib.rs:210-224`;
  `INDEX_TYPE_ALLOWED = "hnsw"` at `:227`). `FlatIndex` (brute-force, exact)
  exists (`flat.rs`) but is used internally as the recall ground-truth oracle and
  for tiny/low-selectivity filtered scans, not exposed as a user index choice.
- **HNSW default params** (`crates/oxd-vector/src/hnsw.rs:66`): `m = 16`,
  `m_max0 = 32`, `ef_construction = 200`, `ef_search = 64`,
  `ml = 1/ln(m)`, `seed = Some(42)` (deterministic build by default).
- **Per-query `ef_search` override** is supported (perf-08) via OxQL `EF <n>`
  and the `search_with_ef` path (`hnsw.rs:411`; `lib.rs:307`).
- **Quantization** (`lib.rs:110` `QuantizationConfig`): `None` (f32), `Scalar{bits:8}`
  = **SQ8**, and `Binary` (1-bit sign). SQ8 is the production default for
  ingested vectors (collection ctor `new_sq8_hnsw`, `collection.rs:140`). Binary
  exists but was dropped from the default (needs ~32× over-fetch to hit the ≤1%
  recall bar; SQ8 hits it at 8×).
- **Off-RAM / cold-f32 / mmap** is **default-ON** in the shipped binary. The
  `mmap` cargo feature is in `default` for `oxd-vector`, `oxd-server`, `oxd-cli`
  (`oxd-vector/Cargo.toml:23`; `oxd-server/Cargo.toml:12`; `oxd-cli/Cargo.toml:15`).
  The live index is the resident SQ8 `u8` graph; exact `f32` vectors are spilled
  to a read-only mmap base (`crates/oxd-vector/src/mmap_storage.rs`,
  `MmapF32Base`) whose only resident cost is an 8-byte/term offset table
  (`mmap_storage.rs:111`), exact vectors page-fault in on demand for rerank.
  This is how the DB serves datasets larger than RAM.
- **Supported dimensions**: any dimension up to `max_vector_dim` (config default
  **4096**, `crates/oxd-config/src/lib.rs:355`). The auto-created default
  collection's dim comes from config (`default_dim`, else 128 , 
  `oxd-config/src/lib.rs:817`). Common real dims verified in fixtures: 384
  (MiniLM), 1024 (bge/e5-large), 1536 / 3072 (OpenAI 3-small / 3-large).

### Credibly measured recall (cite these, not rounder numbers)

- SQ8 recall gate bar: **≤ 1% absolute recall@10 loss vs the exact-f32 HNSW
  baseline** (`crates/oxd-vector/tests/recall_quantization_gate.rs:42`).
- 1024-d bge-large, 4000 base / 500 query: Flat(exact)=1.0000, f32-HNSW=0.9872,
  **SQ8=0.9970**, Binary=0.9588 (`bench-website/runs/recall-bge-1024.txt`).
- **1M** vectors, 1536-d, real OpenAI text-embedding-3-large (DBpedia), cold_f32
  SQ8, cosine: **recall@10 = 0.9839**, reopen 0.51 s, RSS ~6.8 GB
  (`bench-website/runs/recall-scale-1m-1536.json`).
- **10M** vectors, 1536-d, cold_f32: residency proof only (peak RSS ~25.9 GiB;
  ~61 GB of f32 stays on disk). Recall NOT claimed at 10M (exact GT won't fit)
  (`bench-website/runs/recall-scale-10m-1536.json`).

### Plain-language (junior)

Store an embedding per entity; find the nearest ones to a query vector. Oxid
uses HNSW (a navigable graph) so search is sub-linear. Vectors are compressed to
1 byte/dimension (SQ8) in RAM; the exact copies live on disk and are only read
when needed, so the database can hold far more vectors than fit in memory.

### Honest positioning (senior): parity, NOT ahead

- Feature set (HNSW + SQ8/binary quantization + cosine/L2/IP/L1 + mmap cold
  storage) is **at parity with Qdrant/Weaviate on the vector axis, not ahead of
  it.** The differentiation is the *neurosymbolic* combination (reasoner-scoped
  filtering + KGE), not raw ANN speed. See the alignment audit
  (`docs/alignment/`), biggest bounded gap is named-vectors ("A2").
- macOS latency numbers are indicative only; publish latency from Linux runs
  (every bench JSON carries this caveat in its `platform.note`).

### Honest limitations

- IVF-PQ is not available. Named per-collection vectors exist but the web UI only
  surfaces vectors on the default collection (project memory).

---

## hybrid-queries.html: filter-during-traversal

### Verified facts

- A hybrid query combines a **logical filter** (an ontology constraint such as
  `IS-A <Class>`, resolved to a class extent) with a **vector NEAR** stage. The
  reasoner's `ClassificationResult::extents[class]` is a `TermBitSet`
  (`crates/oxd-reasoner/src/classify.rs:554`); document/individual IDs are `Term`s,
  so the extent *is* the candidate bitset, no join, no separate ID space.
- The planner picks one of four strategies by estimated selectivity
  (`crates/oxd-query/src/planner.rs:326` `select_strategy`):
  - `LogicalOnly`, no vector stage.
  - `VectorOnly`, no filter, or a trivial one (`IS-A owl:Thing`, selectivity ≥ 1.0).
  - **`FilterThenSearch`**, selective filter (**selectivity ≤ 0.5**): the class
    bitset is pushed *into* the HNSW search.
  - **`SearchThenFilter`**, broad filter (**selectivity > 0.5**): oversample the
    vector search (`oversample_factor = min(1/selectivity, 100)`,
    `planner.rs:371`) then filter results.
- **Filter-during-traversal** (`crates/oxd-vector/src/hnsw.rs:212`
  `search_layer_filtered`): every graph node is used as a routing waypoint, but
  **only nodes whose `Term` is in the filter bitset enter the result heap**
  (`hnsw.rs:235`, `:278`). For very low selectivity the planner instead does a
  `brute_force_filtered` scan over just the filter members
  (`hnsw.rs:366`, O(|filter|)).
- Multi-collection results are fused with **Reciprocal Rank Fusion, k = 60**
  (`crates/oxd-query/src/fusion.rs:18`, Cormack et al. 2009), with a deterministic
  ascending-Term-id tie-break.

### Why it beats post-filtering (senior)

Naive post-filtering runs ANN over the whole graph, then discards non-matching
hits, if the class is rare, top-k comes back mostly empty and you must
re-query with a larger k (or miss results). Filter-during-traversal keeps the
graph's routing intact (all nodes steer the walk) while guaranteeing the
returned k are all in-class, so a rare class doesn't collapse recall. The
selectivity switch means broad filters (where the whole-graph walk is already
fine) take the cheaper oversample-then-filter path instead.

### Honest limitations

- Selectivity is *estimated* (System-R-style heuristics, `planner.rs:216`,
  `:249`); a bad estimate picks a sub-optimal (still correct) strategy.
- The filter must come from an ontology-backed stage; arbitrary post-hoc
  predicates are not pushed into traversal.

---

## scoring.html: how results are scored/ranked

### Verified facts

- Vector results carry a raw **distance** (`SearchResult.distance`,
  `crates/oxd-vector/src/lib.rs:278`); lower = closer for all four metrics
  (`metric.rs`). Cosine queries are normalized before search
  (`hnsw.rs:409` note).
- SQ8/binary indexes search on quantized codes then can rerank against exact
  vectors; `rerank_multiplier()` (`lib.rs:137`) is 8× for binary.
- Multi-list ranking uses **RRF (k=60)**, which is *rank*-based not score-based,
  so it fuses across collections with different metrics/dimensions without tuning
  (`fusion.rs`). RRF_score(d) = Σ 1/(60 + rank_i(d)).
- KGE link-prediction scores are **distance-based plausibility** (lower = more
  plausible), from `KGModel::score` (`crates/oxd-train/src/lib.rs:184`).

### Plain-language (junior)

Similarity search returns a distance (smaller = more similar). When you combine
lists from multiple vector collections, Oxid ranks by *position* in each list
(RRF) rather than by raw distance, because distances from different metrics
aren't comparable.

### Honest limitations

- There is **no learned/weighted hybrid fusion** blending a similarity score
  with a logical score into one tunable number. The logical side is a hard
  filter (in/out of the class extent); the vector side supplies the ordering; RRF
  only fuses multiple *vector* lists. Don't describe scoring as a weighted
  logical+vector blend.
- RRF k=60 is intentionally not configurable (`fusion.rs:16`).

---

## kge.html: knowledge-graph embeddings

### Verified facts

- Models: **TransE** (`crates/oxd-train/src/transe.rs`) and **RotatE**
  (`rotate.rs`), both implementing the `KGModel` trait
  (`crates/oxd-train/src/lib.rs:174`). Model kinds enumerated in
  `KgeKind` (`persist.rs`).
- Training triples come from three sources (`lib.rs:31`
  `extract_training_triples`): ABox class assertions as `(i, rdf:type, C)`, object
  property assertions `(s, p, o)`, and TBox `SubClassOf` as
  `(sub, rdfs:subClassOf, sup)`. Triples are sorted to a canonical order so a
  fixed seed trains reproducibly (`lib.rs:63`).
- `TrainConfig` defaults (`lib.rs:142`): `dim = 128`, `epochs = 100`, `lr = 0.01`,
  `margin = 1.0`, `batch_size = 128`, L1 norm, `neg_samples = 1`, `seed = 42`.
- Link prediction: `predict_tails(h, r, k, entities)` scores every candidate and
  returns the top-k lowest-distance tails (`lib.rs:187`).
- **ReasonKGE loop** (`crates/oxd-train/src/reason_kge.rs:54` `run_reason_kge`,
  Jain et al. ISWC 2021): train → predict top-k → check each prediction against
  the reasoner for disjointness violations → feed inconsistent predictions back
  as hard negatives → retrain. Defaults: 3 iterations, 50 inner epochs, top_k 5
  (`reason_kge.rs:24`).
- HTTP surface (`crates/oxd-server/src/lib.rs:677-679`): `POST /train`,
  `GET /train/status`, `POST /predict-links`. `/predict-links` vets candidates
  against disjointness via `vet_prediction` (`lib.rs:17`). Trained models are
  persisted under `<data_dir>/kge-models/` and held in a request-spanning
  `RwLock` store (`server/src/lib.rs:81`).

### Plain-language (junior)

KGE learns a vector per entity and per relation so that `head + relation ≈ tail`
(TransE). You can then ask "given this entity and relation, what are the most
likely missing links?", link prediction. The reasoner acts as a fact-checker:
predictions that violate the ontology (e.g. making something both a Beer and a
Wine when those are disjoint) are rejected and used to correct training.

### Honest limitations

- **CORRECTION / scope check:** `run_reason_kge` (the full iterative retrain loop)
  is a **library function** exercised in tests; the HTTP `/predict-links` path
  does single-shot prediction + disjointness vetting (`vet_prediction`), not the
  full multi-iteration retrain loop. Don't imply the online endpoint runs the
  whole ReasonKGE loop unless you verify the handler wiring.
- Training is CPU/ndarray, single-machine; no GPU path.

---

## documents.html / documents-insert.html / documents-indexing.html / ontology-bridge.html

### Document model (verified)

- A `Document` (`crates/oxd-document/src/document.rs:24`) is: an identity `Term`
  (interned in the main dictionary, DOC-D1), a `Vec<(FieldKey, FieldValue)>`
  sorted by field key, and an optional schema id. Field *keys* live in a separate
  `FieldDictionary` (`lib.rs:13`) so heterogeneous field cardinality never
  pollutes the reasoner's Term space.
- `FieldValue` has **10 variants** (`document.rs:38`): Null, Bool, Int(i64),
  Float(f64), String, Binary, Array, Object (nested doc), Timestamp(epoch ms),
  Vector(Vec<f32>). Max nesting depth 16 (`document.rs:16`).
- Collections are `DocumentCollection` (`store.rs`); the whole store is
  `DocumentStore`. JSON in/out via `from_json`/`to_json` (`json.rs`).

### Indexing (verified)

- Secondary indexes are **BTreeMap-based** (`crates/oxd-document/src/index.rs:10`):
  `FieldIndex` = single-field `BTreeMap<IndexKey, TermBitSet>`; `CompoundIndex` =
  multi-field lexicographic key. BTreeMap gives **equality and range** queries
  (`index.rs:74` range scan). There is a `QueryPatternTracker` / `IndexSuggestion`
  path that recommends indexes from observed query patterns (`index.rs:53`).
- Bulk load: `bulk.rs` (`import_ndjson`, `BulkInsertConfig`,
  `bulk_rebuild_indexes`); NDJSON export too.

### The ontology bridge (verified: `crates/oxd-storage/src/bridge.rs`)

- A `CollectionTypeMapping` (`bridge.rs:68`) maps a document collection to an
  ontology **class** plus a list of `FieldPropertyMapping`s. When `auto_type` is
  true, every insert/update/delete into that collection fires the bridge.
- On insert, a mapped document becomes: one `AddIndividual` (the doc's `Term`),
  N property assertions, and optionally one vector upsert, atomically within one
  `&mut Database` call (`bridge.rs:35`).
- `MappingType` (`bridge.rs:99`): `DataProperty` (value → literal; arrays fan out
  to one assertion per element), `ObjectProperty` (a String IRI → interned Term →
  object-property assertion; non-IRI → `BridgeError::ObjectPropertyNotIri`), and
  `VectorProperty{collection, store_inline}` (a `FieldValue::Vector` → upsert into
  the named collection; `store_inline=false` strips the vector from the stored
  doc bytes so it lives only in the vector collection).
- **The payoff:** because a mapped document's `Term` lands in the class extent
  after the next `classify()`, the same hybrid IS-A + NEAR query works over
  ingested JSON with zero extra machinery (`bridge.rs:1-8`).
- Disjointness is checked cheaply and incompletely at insert
  (`quick_disjoint_check`, catches direct pairs only); the authoritative check is
  post-classification `ClassificationResult::violations` (`bridge.rs:27`).

### Plain-language (junior)

Push JSON documents into a collection; tell Oxid "documents in this collection
are of class X, and field `manufacturer` is the object-property `producedBy`."
From then on, each inserted document automatically becomes a typed individual
with those facts, so the reasoner and vector search can see it.

### Honest limitations: CORRECTION

- **`bridge.rs` module doc (lines 21 to 23) is STALE.** It says bridge mappings are
  "In-memory only for Phase 4 … mappings must be re-registered on each restart."
  In fact `CollectionTypeMapping`s ARE persisted: they live in
  `DatabaseState::bridge_mappings` (`crates/oxd-storage/src/lib.rs:275`), survive
  every schema version v3 to v8, and reload on open (see the doc-comment at
  `bridge.rs:72` and the reap-liveness note). Mappings do **not** need
  re-registering after restart. Write the persisted behavior.
- `value_to_literals` is a total policy table but intentionally **lossy** for
  some variants (each "no" is an explicit `BridgeError`, never a silent skip).

---

## architecture.html: the workspace

### Verified crate map (`Cargo.toml`, verified per-crate)

- `oxd-core`, the shared spine: `Term(u32)` + `TermDictionary`, `Ontology` /
  `Axiom` / `ClassExpr`, `Metric`, `TermBitSet`, OWL import (`owl_import`),
  version chains.
- `oxd-config`, typed config + env boundary parses (`SyncPolicy`, bind addrs,
  limits).
- `oxd-persist`, crash-safe persistence primitives (CRC-framed bincode,
  `save_with_checksum` / `load_with_checksum`), re-exported as
  `oxd_storage::persist`.
- `oxd-auth`, accounts/roles/sessions/API keys/audit (Argon2id + sha256).
- `oxd-reasoner`, EL⊥ classifier + fragment checker.
- `oxd-vector`, HNSW / SQ8 / binary indexes, mmap cold-f32 base, metrics, recall
  measurement.
- `oxd-document`, JSON document store, field dictionary, BTreeMap secondary
  indexes, bulk load.
- `oxd-storage`, the `Database` engine: WAL, checkpoints, MVCC primitives,
  transaction manager (strict-2PL), the **ontology↔document bridge**, bundle
  backup/restore, memory governor.
- `oxd-embed`, embedder trait + FastEmbed (local ONNX), Ollama, OpenAI adapters,
  caching wrapper.
- `oxd-query`, OxQL parser (pest grammar `oxql.pest`), planner (selectivity +
  strategy), executor, aggregation, RRF fusion, query cache.
- `oxd-okf`, OKF export format.
- `oxd-cli`, the `oxd` binary (serve, import, backup, compact, check-fragment,
  recall-check, …).
- `oxd-server`, the axum HTTP server: JSON API + embedded web UI, auth gate,
  TLS, memory admission.
- `oxd-train`, TransE/RotatE + ReasonKGE + model persistence.
- `oxd-python`, embedded Python bindings.
- `oxd-surface-*` (core/cli/mcp), **opt-in** agentic add-on (excluded from the
  default build); the MCP/agent tool surface.
- `owl2oxid` / `owl2oxid-core`, clean-room permissively-licensed OWL library
  (aliased as `oxwl`), replaces the vendored horned-owl copy.
- `benchmarks`, the nsbench neurosymbolic capability suite (workspace member,
  not a default build member).

### How it fits (senior)

Everything is `Term`-centric: the dictionary in `oxd-core` is the shared ID
space, so an ontology individual, a vector, a document, and a KGE entity that
denote the same thing are literally the same `u32`. `oxd-storage`'s `Database`
composes reasoner + vector + document + bridge behind one WAL and one lock; the
server and CLI are thin surfaces over it. A plain `cargo build` builds the
DB-only default members; Surface (MCP/agent) is built explicitly.

---

## storage.html: persistence, durability, MVCC

### Verified facts

- **Format version** `OXDB_VERSION = 12` (`crates/oxd-storage/src/lib.rs:176`).
  Old binaries refuse a newer file loudly; older files migrate forward through
  the `DatabaseStateV3..V8` chain (`lib.rs:380`+).
- **WAL** (`crates/oxd-storage/src/wal.rs`, `WalRecordType`): every mutation is
  logged; recovery replays it. Records are append-only; new variants are appended
  to keep old files decodable.
- **Durability / SyncPolicy** (`crates/oxd-config/src/lib.rs:690`): `PerRecord`
  (default, fsync per commit) or `GroupCommit` (batch N committers' fsyncs into
  one `sync_all`, `crates/oxd-storage/src/group_committer.rs`).
- **Transactions**: strict-2PL logical locks (per operation→lock table, held to
  commit/abort) over a WAL-routed `Database`; all mutations funnel through a
  single `tokio::Mutex<Database>` serialization point; rollback replays in-memory
  inverses + writes compensation records (`crates/oxd-storage/src/txn/manager.rs:1-18`).
  This gives serializable isolation.
- **MVCC snapshots** (`crates/oxd-storage/src/version.rs`; `txn/manager.rs:434`):
  monotonic commit timestamps + version chains back **AS OF** snapshot reads , 
  a read of a past snapshot classifies once and never blocks writers
  (`manager.rs:450`, `:466`). Note the module header (`lib.rs:36-42`) that the
  general MVCC primitives are not wired into *every* path; the AS OF read path is.
- **Crash safety**: CRC-framed checkpoints with distinct inner magic; delta
  checkpoints (`delta.rs`, OXDD/OXDM envelopes); full-fidelity `.oxdb-bundle`
  backup/restore (`bundle.rs`) that captures paged docs + KGE models (the
  single-file `.oxbak`/`/export` path does **not**, it refuses by default to
  avoid silent data loss, per the CHANGELOG).
- **Compaction**: `Database::compact` (`lib.rs:2914`) and `compact_documents`
  (`lib.rs:2964`, reclaims redb churn); exposed as `oxd compact` and online
  `/admin/compact`.
- **Off-RAM residency**: the DB serves datasets larger than RAM, SQ8 index
  resident, exact f32 vectors mmap'd cold (see vectors.html). Proven to ~25× RAM
  in the fable-06 flagship result (project memory).

### Honest limitations

- Single-writer serialization point (one mutex); different-collection writers
  hold non-conflicting logical locks but still serialize their `apply`, true
  physical write parallelism is a deferred step (`txn/parallel.rs:15`).
- No replication/HA in the shipped build (repl- series shipped spikes + a
  determinism oracle, but no commercial replication driver, project memory).

---

## web-ui.html: the embedded SPA

### Verified facts

- The UI is a Vue 3 SPA (`web-next/`), built and **embedded in the server
  binary**, served under `/app/*` on a **separate host** from the API.
- **Addresses**: managed instances expose the JSON API at
  `https://<id>.oxid-db.com` and the web UI at `https://<id>-ui.oxid-db.com`
  (same 12-char id plus `-ui`; HTTPS, no ports to configure). Underlying code
  defaults for a local bind are `127.0.0.1:7878` (API) and `127.0.0.1:7880` (UI)
  (`crates/oxd-config/src/lib.rs:178-179`). The UI host carries the full API too
  and is held to the same TLS/exposure gate. UI can be disabled
  (`enable_ui` / `oxd serve --no-ui`).
- **Views** (`web-next/src/router/*`, `web-next/src/views/`): Graph (default
  route `/app/graph`), Documents (`/app/documents`), Query (`/app/query`),
  Predict-Links (`/app/predict`), and Settings (`/app/settings/*`) with pages:
  data, embeddings (+ pipeline, + config), ontology, security, appearance,
  danger, help.
- Graph view is class-first for large ABoxes (>400 individuals → class backbone
  with count badges, EXPAND_CAP 300, project memory).

### Honest limitations

- The UI's "vectors" counter and similarity filter only see the **default**
  vector collection's `has_vector` docs; named-collection vectors are invisible in
  the UI (project memory).

---

## mcp.html: Model Context Protocol integration

### Verified facts

- Oxid Surface MCP (`crates/oxd-surface-mcp`) is an **opt-in add-on** (not in the
  default build). Two transports (`SurfaceTransport`, `lib.rs:29`): **stdio**
  (default, client spawns the binary) and **Streamable HTTP** (opt-in via
  `OXID_SURFACE_TRANSPORT=http`, binds an axum listener, default `:7879`, path
  `/mcp`, project memory `project_mcp_http_transport`).
- **Tools exposed**: the registry has **12 tools** (`default_registry`,
  `crates/oxd-surface-core/src/tools/mod.rs:55`; test
  `default_registry_has_exactly_the_twelve_tools`): `query` (OxQL + natural
  language), `explain`, `classify`, `schema`, `entity`, `ontology`, `aggregate`,
  `check_consistency`, `assert_typed`, `add_axiom`, `train_embeddings`,
  `predict_links`. Built via `rmcp`.
- MCP auth (`crates/oxd-surface-mcp/src/auth.rs`): loopback-detection +
  `allow_insecure` opt-in, mirroring the DB server's exposure gate.

### Honest limitations: CORRECTION

- **`crates/oxd-surface-core/src/lib.rs:5` says "the 6-tool registry", STALE.**
  The registry is now **12 tools** (verified by the count test). Write 12.

---

## authentication.html: accounts, roles, sessions, keys, audit

### Verified facts (`crates/oxd-auth/`)

- **Password hashing**: **Argon2id**, OWASP-2024 profile 1 (m=19456 KiB, t=2,
  p=1), `crates/oxd-auth/src/hash.rs:26`. Invoked only on login/password-set,
  never on the per-request path.
- **API keys** (`oxk_…`) and **sessions** (`oxs_…`) are hashed with **sha256**,
  not Argon2 (32 B of OsRng has no brute/rainbow risk, and Argon2 per-request
  would be fatal), `model.rs:108-125`, `token.rs`. Sessions store a 16-byte map
  key + full 32-byte hash (constant-time compared).
- **Roles** (RBAC): four built-ins forming a strict chain
  **reader ⊂ writer ⊂ schema ⊂ admin** (`perm.rs:8`, `:146-149`). Custom roles
  are allowed (same `RoleDef` struct with `builtin:false`). `Backup`,
  `ResetDatabase`, user management, and runtime-config apply are admin-only.
- **Sessions**: default hard TTL 12 h (`model.rs:24`).
- **Audit**: a bounded append-only ring, default cap 10,000 entries
  (`model.rs:22`); actions include LoginSuccess/Failure, Logout, PasswordChange,
  UserCreate/Update/Disable, ApiKeyCreate/Revoke, PermissionDenied
  (`model.rs:160`). Only hashes persist; plaintext leaves the process once
  (`model.rs:8`).
- **Credential store** is a separate CRC-framed bincode file (`users.oxa`) with
  inner magic `OXDU`, distinct from the `OXDB` checkpoint (`model.rs:17`).

### TLS / network exposure: CORRECTION

- **TLS exists and is real** (`crates/oxd-server/src/tls.rs`, in-process rustls,
  TLS 1.2+, no OpenSSL, HSTS when on). Configure via `[server].tls`.
- The accurate statement is **not** "loopback-only until TLS." It is: a
  **non-loopback bind without TLS is refused** unless the operator explicitly
  opts in with `[server].allow_insecure = true` / `--insecure`
  (`crates/oxd-server/src/lib.rs:1369-1388`, `security::check_exposure`). With TLS
  configured, non-loopback binds are allowed. When you write authentication.html,
  correct any "loopback-only / no TLS yet" language.

### Honest limitations

- mTLS / client certs are noted as a future option, not implemented (`tls.rs:6`).
- The remaining pre-sell blocker is a licensing/IP sign-off, not a missing auth
  feature (project memory).

---

## Summary of biggest corrections caught

1. **Reasoner role hierarchy is now supported (CR7).** `owl-reasoner-support.html`
   still says "No RBox at all / no sub-property inheritance / no property chains" , 
   stale. Single-property `SubObjectPropertyOf` IS reasoned; only length-≥2 chains
   and transitivity (CR8/reasoner-06) remain unbuilt.
2. **Bridge mappings are persisted**, not in-memory-only, `bridge.rs` module doc
   (and any doc echoing "re-register on restart") is stale.
3. **TLS is implemented**; "loopback-only until TLS" is wrong. Correct framing:
   non-loopback without TLS is refused unless `--insecure`.
4. **MCP exposes 12 tools**, not 6 (surface-core lib.rs doc-comment is stale).
5. **Vectors are at parity with Qdrant/Weaviate, not ahead**, 4 metrics, HNSW
   only (IVF-PQ refused), SQ8 default, mmap cold-f32 default-ON; recall@10=0.9839
   @1M measured. Differentiation is neurosymbolic, not ANN speed.
6. Watch two "EL++" overclaims: the profile is **OWL 2 EL⊥** (subset of EL++)
   with documented completeness gaps; and online `/predict-links` does single-shot
   vetting, not the full iterative ReasonKGE retrain loop (that's a library fn).
