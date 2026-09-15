# Oxid-DB Python HTTP SDK: verified usage snippets

Package `oxiddb-client` (import name `oxiddb_client`). Pure-Python HTTP client for a
running `oxd-server`. All snippets below are code-verified against
`sdk/oxiddb-python-sdk/src/oxiddb_client/client.py` (sync `OxidDB`) and the canonical
wire contract in `docs/online/0.9.8/.build/api-oxql.md`.

Toy domain: a beverage ontology (Beer / Pilsner / Stout / Wine) with 4-dim vectors.
Base URL: `https://85cfad134a4a.oxid-db.com`.

> Note: `oxiddb-client` (HTTP, this doc) is a sibling of `oxiddb` (embedded PyO3
> bindings). Same logical surface, different constructor, pick by deployment.

## install

```bash
pip install oxiddb-client   # requires Python 3.10+
```

- Package name: `oxiddb-client`; import name: `oxiddb_client` (`pyproject.toml`).
- `requires-python = ">=3.10"`; only runtime dependency is `httpx>=0.27`.

## client-init

Construct the client directly (there is no `connect()` factory) and use it as a
context manager so the underlying `httpx` client is closed. The optional bearer
token is the `auth=` keyword.

```python
# Sync
from oxiddb_client import OxidDB

with OxidDB("https://85cfad134a4a.oxid-db.com", auth="my-token", timeout=30.0) as db:
    db.classify()

# Async (same surface, awaited; safe inside an existing event loop)
import asyncio
from oxiddb_client import AsyncOxidDB

async def main() -> None:
    async with AsyncOxidDB("https://85cfad134a4a.oxid-db.com", auth="my-token") as db:
        await db.classify()

asyncio.run(main())
```

`constructor: OxidDB(base_url="https://85cfad134a4a.oxid-db.com", *, timeout=30.0, chunk_timeout=30.0, retries=2, rate_limit_retries=4, auth=None, user_agent=None, debug=None)` (`src/oxiddb_client/client.py:270`); async equivalent `AsyncOxidDB(...)` same signature (`src/oxiddb_client/async_client.py:300`). `auth` is sent as `Authorization: Bearer <token>` and is never logged (`src/oxiddb_client/config.py:44`).

### connect

There is no `connect()` method or factory function, you construct `OxidDB` /
`AsyncOxidDB` directly (see **client-init** above). The client is lazy: no
connection is opened at construction. To probe liveness explicitly, call
`health()` or `ready()`.

```python
from oxiddb_client import OxidDB

db = OxidDB("https://85cfad134a4a.oxid-db.com")
print(db.health())        # {"status": "ok"}
db.close()                # or use `with OxidDB(...) as db:`
```

`method: OxidDB.health(*, opts=None) -> HealthResponse` (`src/oxiddb_client/client.py:331`). Async: `AsyncOxidDB.health(...)` + `AsyncOxidDB.aclose()`.

### ready

Returns the body for both 200 (ready) and 503 (not yet classified) instead of
raising on 503, so you can inspect the readiness reason.

```python
with OxidDB("https://85cfad134a4a.oxid-db.com") as db:
    status = db.ready()
    print(status.get("ready"))
```

`method: OxidDB.ready(*, opts=None) -> ReadyResponse` (`src/oxiddb_client/client.py:334`; `GET /ready`, accepts 503).

### add_subclass

```python
with OxidDB("https://85cfad134a4a.oxid-db.com") as db:
    db.add_subclass("Pilsner", "Beer")
    db.add_subclass("Stout", "Beer")
```

`method: OxidDB.add_subclass(sub, sup, *, opts=None) -> None` (`src/oxiddb_client/client.py:543`; `POST /subclass`, body `{"sub","sup"}`).

### add_disjoint

```python
with OxidDB("https://85cfad134a4a.oxid-db.com") as db:
    db.add_disjoint("Beer", "Wine")
```

`method: OxidDB.add_disjoint(a, b, *, opts=None) -> None` (`src/oxiddb_client/client.py:546`; `POST /disjoint`, body `{"a","b"}`).

### insert_individual

The method is named `insert` (positional args are `individual` and `class_name`).
`vector` is a literal list; `text` server-embeds; `collection` picks the target
vector collection (default = configured default).

```python
with OxidDB("https://85cfad134a4a.oxid-db.com") as db:
    res = db.insert("Heineken", "Pilsner", vector=[0.4, 0.2, 0.1, 0.4])
    # res: InsertResponse: e.g. {"iri": "Heineken", ...}
```

`method: OxidDB.insert(individual, class_name, *, text=None, vector=None, collection=None, opts=None) -> InsertResponse` (`src/oxiddb_client/client.py:467`; `POST /insert`). Do NOT pass `properties`/`label`/`annotations` here, the server returns a hard 400 and routes you to `upsert_entity` (`POST /entities`).

### classify

```python
with OxidDB("https://85cfad134a4a.oxid-db.com") as db:
    result = db.classify()
    print("consistent:", result.get("consistent"))
```

`method: OxidDB.classify(*, opts=None) -> ClassifyResponse` (`src/oxiddb_client/client.py:682`; `POST /classify`).

### query

Runs one OxQL statement (one page). Returns a `QueryResponse` dict with `results`
and an optional `next_cursor`. Symbolic + vector (`NEAR`) can be combined.

```python
with OxidDB("https://85cfad134a4a.oxid-db.com") as db:
    page = db.query("FIND ?x WHERE ?x IS-A Beer LIMIT 20")
    for hit in page.get("results", []):
        print(hit["iri"])
    # hybrid symbolic + vector rank:
    page2 = db.query("FIND ?x WHERE ?x IS-A Beer AND NEAR ?x TO [0.4,0.2,0.1,0.4] LIMIT 5")
```

`method: OxidDB.query(query, *, cursor=None, hydrate=None, opts=None) -> QueryResponse` (`src/oxiddb_client/client.py:358`; `POST /query`, body `{"query", "cursor"?, "hydrate"?}`).

### query_all

Generator that transparently follows `next_cursor` across all pages, yielding one
hit at a time.

```python
with OxidDB("https://85cfad134a4a.oxid-db.com") as db:
    for hit in db.query_all("FIND ?x WHERE ?x IS-A Beer"):
        print(hit["iri"])
```

`method: OxidDB.query_all(query, *, hydrate=None, opts=None) -> Iterator[QueryHit]` (`src/oxiddb_client/client.py:369`; loops `POST /query` on `next_cursor`). Async: `async for hit in db.query_all(...)`.

### vector_search

There is NO method literally named `vector_search`. Nearest-neighbor search is
done two ways in this SDK:

1. **By query vector / hybrid**, OxQL `NEAR ?x TO [vec]` (or `NEAR ?x TO "text"`
   for auto-embed) via `query` / `query_all`. Rows carry a `score`.
2. **By reference IRI**, `individual_similar(iri, k=..., collection=...)`
   (`GET /individuals/{iri}/similar`); returns `{reference, collection, results:[{iri, score}]}`, self excluded.

```python
with OxidDB("https://85cfad134a4a.oxid-db.com") as db:
    # (1) literal query vector (dims must match the collection)
    hits = db.query("FIND ?x WHERE NEAR ?x TO [0.4, 0.2, 0.1, 0.4] LIMIT 5")
    for h in hits.get("results", []):
        print(h["iri"], h.get("score"))

    # (2) nearest neighbours of an existing individual
    sim = db.individual_similar("Heineken", k=3, collection="default")
    print([h["iri"] for h in sim.get("results", [])])
```

`method: OxidDB.query(query, ...)` (OxQL `NEAR`; `src/oxiddb_client/client.py:358`) and `method: OxidDB.individual_similar(iri, *, k=None, collection=None, opts=None) -> IndividualSimilarResponse` (`src/oxiddb_client/client.py:399`; `GET /individuals/{iri}/similar?k=&collection=`).

### create_collection

Note the SDK keyword is `dim` (it maps to the wire field `dimensions`). `metric`
defaults to `"cosine"`.

```python
with OxidDB("https://85cfad134a4a.oxid-db.com") as db:
    db.create_collection("beers", dim=4, metric="cosine")
    # a fresh DB ships empty; creating the same shape again returns 409:
    # catch OxidHttpError and ignore exc.status == 409 for idempotent setup
```

`method: OxidDB.create_collection(name, *, dim, metric="cosine", quantization=None, cold_f32=None, opts=None) -> None` (`src/oxiddb_client/client.py:549`; `POST /collections`, body uses `dimensions`).

### insert_document

Inserts one raw JSON document into a document collection. An optional `iri=` is
lifted into the wire body as `_iri`.

```python
with OxidDB("https://85cfad134a4a.oxid-db.com") as db:
    res = db.insert_document("beers", {"name": "Heineken", "abv": 5.0}, iri="Heineken")
    # res: {"ok": true, "collection": "beers", "iri": "Heineken"}
```

`method: OxidDB.insert_document(collection, document, *, iri=None, opts=None) -> InsertDocumentResponse` (`src/oxiddb_client/client.py:812`; `POST /documents/{collection}`).

### bulk_import_documents

The nearest sync method is `bulk_insert_documents(collection, documents)`, a JSON
array body to `POST /documents/{collection}/bulk`. (For raw NDJSON there is a
separate `import_documents_ndjson(collection, ndjson)`; the transactional variant
is `Transaction.bulk_insert_documents`.)

```python
with OxidDB("https://85cfad134a4a.oxid-db.com") as db:
    res = db.bulk_insert_documents("beers", [
        {"_iri": "Heineken", "name": "Heineken", "abv": 5.0},
        {"_iri": "Guinness", "name": "Guinness", "abv": 4.2},
    ])
    # res: {"ok": true, "inserted": 2, "upserts": 0, ...}

    # raw-NDJSON alternative:
    ndjson = '{"$id":"Heineken","name":"Heineken"}\n{"$id":"Guinness","name":"Guinness"}\n'
    db.import_documents_ndjson("beers", ndjson)
```

`method: OxidDB.bulk_insert_documents(collection, documents, *, opts=None) -> BulkInsertDocumentsResponse` (`src/oxiddb_client/client.py:825`; `POST /documents/{collection}/bulk`). Related: `OxidDB.import_documents_ndjson(collection, ndjson, *, opts=None)` (`src/oxiddb_client/client.py:835`). Note the 32 MiB request-body cap → 413.

### map_collection_to_class

The SDK method is `register_mapping`, binds a document collection to an ontology
class with field mappings (the "ontology bridge").

```python
with OxidDB("https://85cfad134a4a.oxid-db.com") as db:
    db.register_mapping(
        "beers",
        "Beer",
        [{"field": "name", "property": "name", "type": {"kind": "data_property"}}],
        auto_type=True,
    )
```

`method: OxidDB.register_mapping(collection, class_name, field_mappings, *, auto_type=None, embed=None, opts=None) -> RegisterMappingResponse` (`src/oxiddb_client/client.py:788`; `POST /collections/map`, wire field `class`). A `field_mappings` entry is `{"field", "property", "type": {"kind": "data_property"|"object_property"|"vector_property", ...}}`.

### transaction

Context manager that opens a txn, commits on clean exit, and rolls back on
exception. Do not call `commit`/`rollback` yourself inside the block.

```python
with OxidDB("https://85cfad134a4a.oxid-db.com") as db:
    with db.transaction() as txn:
        term = txn.insert("Heineken", "Pilsner", vector=[0.4, 0.2, 0.1, 0.4])
        txn.add_subclass("Pilsner", "Beer")
        sp = txn.savepoint()
        txn.insert_document("beers", {"name": "Heineken"})
        txn.rollback_to(sp)     # undo just the document
    # committed here on clean exit
```

`method: OxidDB.transaction(*, opts=None) -> Iterator[Transaction]` (contextmanager, `src/oxiddb_client/client.py:310`; `POST /txn` + `/commit`|/rollback`). Lower-level `OxidDB.begin() -> Transaction` also exists (`client.py:305`). Txn mutators include `Transaction.insert`, `add_subclass`, `add_disjoint`, `add_object_property`, `insert_document`, `bulk_insert_documents`, `savepoint`, `rollback_to`.

### predict_links

KGE link prediction. The SDK keyword is `k` (mapped to the wire field `top_k`;
sending `k` on the raw wire is silently ignored, so use the SDK method). Requires a
trained model first (`train()`), else the server returns 400.

```python
with OxidDB("https://85cfad134a4a.oxid-db.com") as db:
    db.train(model="default", dim=4, epochs=50)   # collection == model name
    preds = db.predict_links("Heineken", relation="similarTo", k=5)
    for p in preds.get("results", []):
        print(p)
```

`method: OxidDB.predict_links(head, *, relation=None, model=None, k=10, only_consistent=None, opts=None) -> PredictLinksResponse` (`src/oxiddb_client/client.py:749`; `POST /predict-links`, sends `top_k` from `k`). Related: `OxidDB.train(...)` (`client.py:733`).

### import_owl

Posts a raw OWL document (bytes/string) as the request body. Note: RDF/XML is not
accepted by the server (400); use OWX/OFN/OBO/OMN/Turtle/NT.

```python
with OxidDB("https://85cfad134a4a.oxid-db.com") as db:
    owl = open("beverages.owx").read()
    res = db.import_owl(owl)
    # res: {"ok": true, "classes_added": .., "individuals_added": .., ...}
```

`method: OxidDB.import_owl(owl, *, opts=None) -> ImportResponse` (`src/oxiddb_client/client.py:671`; `POST /import/owl`, raw body, `Content-Type: application/rdf+xml`).

### import_csv

Posts raw CSV text as the request body.

```python
with OxidDB("https://85cfad134a4a.oxid-db.com") as db:
    csv = "iri,class\nHeineken,Pilsner\nGuinness,Stout\n"
    res = db.import_csv(csv)
    # res: {"ok": true, "classes_added": .., "individuals_added": .., ...}
```

`method: OxidDB.import_csv(csv, *, opts=None) -> ImportResponse` (`src/oxiddb_client/client.py:662`; `POST /import/csv`, raw body, `Content-Type: text/csv; charset=utf-8`).
