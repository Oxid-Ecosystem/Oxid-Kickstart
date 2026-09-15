# Oxid-DB Go SDK: verified usage snippets

All snippets are code-verified against `sdk/oxiddb-golang-sdk` (module
`github.com/moonlight-array/oxid-go`, `go 1.23`). Signatures are copied verbatim
from `client.go`, `query.go`, `query_builder.go`, `txn.go`, and `options.go`.
Data model: Beverage ontology (Beer / Pilsner / Stout / Wine) with 4-dim
vectors; base URL `https://85cfad134a4a.oxid-db.com`.

> Import alias is `oxid` (package name is `oxid`). The module path is
> **provisional / unpublished** per the SDK README and `TODO.md`.

## install

```
go get github.com/moonlight-array/oxid-go
```

```go
import oxid "github.com/moonlight-array/oxid-go"
```

`method: module github.com/moonlight-array/oxid-go (go.mod); import path cited from README.md line 13`

## client-init

`method: func New(endpoint string, opts ...Option) (*Client, error)` (options.go / client.go:40)

```go
package main

import (
	"context"
	"log"
	"time"

	oxid "github.com/moonlight-array/oxid-go"
)

func main() {
	// Config precedence: explicit option > env var (OXID_ENDPOINT/OXID_TOKEN) > default.
	client, err := oxid.New("https://85cfad134a4a.oxid-db.com",
		oxid.WithBearerToken(""),            // optional; auth is off by default on loopback
		oxid.WithTimeout(30*time.Second),    // overall per-request timeout (default 30s)
	)
	if err != nil {
		log.Fatal(err)
	}
	defer client.Close() // releases idle connections on the owned HTTP client

	_ = context.Background()
}
```

### connect

There is no explicit "connect" call, `New` builds a pooled client and the first
network call happens lazily. Use `Health` (always 200) to confirm reachability.

`method: func (c *Client) Health(ctx context.Context) (HealthResponse, error)` (client.go:97)

```go
ctx := context.Background()

h, err := client.Health(ctx)
if err != nil {
	log.Fatalf("health: %v", err)
}
log.Println("status:", h.Status) // HealthResponse.Status
```

### ready

`method: func (c *Client) Ready(ctx context.Context) (ReadyResponse, error)` (client.go:106)

`/ready` returns 503 (with a body) until the DB is classified; `Ready` returns
the body rather than erroring on 503, so branch on `Status`.

```go
r, err := client.Ready(ctx)
if err != nil {
	log.Fatalf("ready: %v", err)
}
// r.Status is "ready" (200) or "not_ready" (503).
if r.Status != "ready" {
	log.Printf("not ready yet: classified=%v consistent=%v",
		r.Checks.ClassificationCurrent, r.Checks.Consistent)
}
log.Printf("classes=%d individuals=%d version=%s",
	r.Checks.Classes, r.Checks.Individuals, r.Version)
```

### add_subclass

`method: func (c *Client) AddSubclass(ctx context.Context, req SubclassRequest) error` (client.go:299)

`SubclassRequest{Sub, Sup}`, a `SubClassOf` axiom (Sub ⊑ Sup).

```go
// Pilsner ⊑ Beer, Stout ⊑ Beer, Beer ⊑ Beverage, Wine ⊑ Beverage.
for _, sc := range []oxid.SubclassRequest{
	{Sub: "Pilsner", Sup: "Beer"},
	{Sub: "Stout", Sup: "Beer"},
	{Sub: "Beer", Sup: "Beverage"},
	{Sub: "Wine", Sup: "Beverage"},
} {
	if err := client.AddSubclass(ctx, sc); err != nil {
		log.Fatalf("subclass %s ⊑ %s: %v", sc.Sub, sc.Sup, err)
	}
}
```

### add_disjoint

`method: func (c *Client) AddDisjoint(ctx context.Context, req DisjointRequest) error` (client.go:304)

`DisjointRequest{A, B}`, a disjointness axiom (A ⊓ B ⊑ ⊥).

```go
// Beer and Wine are disjoint: nothing can be both.
if err := client.AddDisjoint(ctx, oxid.DisjointRequest{A: "Beer", B: "Wine"}); err != nil {
	log.Fatalf("disjoint: %v", err)
}
```

### insert_individual

`method: func (c *Client) Insert(ctx context.Context, req InsertRequest) (InsertResponse, error)` (client.go:259)

`InsertResponse` is an alias for `OkResponse`. Supply a class + either a `Vector`
or `Text` (auto-embed). `Individual`/`IRI` and `Class`/`Classes` are accepted
aliases; the singular spellings are shown here.

```go
res, err := client.Insert(ctx, oxid.InsertRequest{
	Individual: "PilsnerUrquell",
	Class:      "Pilsner",
	Vector:     []float64{0.9, 0.1, 0.0, 0.2}, // 4-dim
})
if err != nil {
	log.Fatalf("insert: %v", err)
}
_ = res

// Batch form (subject to the 32 MiB body cap):
batch, err := client.InsertBatch(ctx, oxid.InsertBatchRequest{
	Entities: []oxid.BatchEntity{
		{IRI: "Guinness", Class: "Stout", Vector: []float64{0.8, 0.2, 0.1, 0.9}},
		{IRI: "Chardonnay", Class: "Wine", Vector: []float64{0.1, 0.9, 0.7, 0.3}},
	},
})
if err != nil {
	log.Fatalf("insert batch: %v", err)
}
log.Printf("inserted %d (ok=%v)", batch.Inserted, batch.Ok)
```

### classify

`method: func (c *Client) Classify(ctx context.Context) (ClassifyResponse, error)` (client.go:485)

Runs the EL⊥ classifier; no request body. Branch on `Consistent`/`Coherent`.

```go
cls, err := client.Classify(ctx)
if err != nil {
	log.Fatalf("classify: %v", err)
}
log.Printf("consistent=%v coherent=%v violations=%d",
	cls.Consistent, cls.Coherent, cls.Violations)
for _, w := range cls.ViolationWitnesses { // additive; nil on older servers
	log.Printf("  %s is both %s and %s (%s)", w.Individual, w.ClassA, w.ClassB, w.Reason)
}
```

### query

`method: func (c *Client) Query(ctx context.Context, req QueryRequest) (QueryResponse, error)` (client.go:155)

OxQL travels as an opaque string. Use `oxid.Quote` for string literals, or the
fluent `oxid.NewQueryBuilder()`. `SORT` is a no-op over HTTP (wire order is IRI,
or score-then-IRI for NEAR/hybrid).

```go
// Raw OxQL (quote the class name):
res, err := client.Query(ctx, oxid.QueryRequest{
	Query: "FIND ?x WHERE ?x IS-A " + oxid.Quote("Beer"),
})
if err != nil {
	log.Fatalf("query: %v", err)
}
log.Printf("matched %d (showing %d)", res.TotalCount, len(res.Results))
for _, hit := range res.Results {
	log.Println(" -", hit.IRI)
}

// Fluent builder, FIND ?x WHERE ?x IS-A Beer LIMIT 5:
oxql := oxid.NewQueryBuilder().Find("x").IsA("Beer").Limit(5).ToOxql()
res2, err := client.Query(ctx, oxid.QueryRequest{Query: oxql})
_ = res2
```

`builder methods: func NewQueryBuilder() *QueryBuilder; (*QueryBuilder).Find/From/IsA/Where/Near/Project/Sort/Aggregate/GroupBy/Limit/Offset/ToOxql` (query_builder.go)

### query_all

`method: func (c *Client) QueryAll(ctx context.Context, req QueryRequest) iter.Seq2[QueryHit, error]` (query.go:23)

A Go 1.23 range-over-func iterator that follows `next_cursor` to exhaustion. The
first yield with a non-nil error is terminal.

```go
count := 0
for hit, err := range client.QueryAll(ctx, oxid.QueryRequest{Query: "FIND ?x WHERE ?x IS-A Beverage"}) {
	if err != nil {
		log.Fatalf("query-all: %v", err) // first error is terminal
	}
	count++
	log.Println(hit.IRI)
}
log.Printf("streamed %d hits across all pages", count)
```

### vector_search

**NOT IMPLEMENTED as a dedicated method**, there is no `VectorSearch` on the
client. Vector / hybrid search is expressed as OxQL `NEAR` and run through
`Query` (or `QueryAll`). Build it with `QueryBuilder.Near`, or hand-write the
NEAR clause. For an individual's own neighbors there is `IndividualSimilar`.

`method: func (b *QueryBuilder) Near(vector []float64) *QueryBuilder` (query_builder.go:130)
`method: func (c *Client) IndividualSimilar(ctx context.Context, iri string, opts *SimilarOpts) (IndividualSimilarResponse, error)` (client.go:203)

```go
// Hybrid: Beers nearest a 4-dim probe vector, top 5.
oxql := oxid.NewQueryBuilder().
	Find("x").
	IsA("Beer").
	Near([]float64{0.9, 0.1, 0.0, 0.2}).
	Limit(5).
	ToOxql()
// => FIND ?x WHERE ?x IS-A Beer AND NEAR ?x TO [0.9, 0.1, 0, 0.2] LIMIT 5
res, err := client.Query(ctx, oxid.QueryRequest{Query: oxql})
if err != nil {
	log.Fatalf("vector search: %v", err)
}
for _, hit := range res.Results {
	if hit.Score != nil {
		log.Printf("%s score=%.4f", hit.IRI, *hit.Score)
	}
}

// Neighbors of a known individual:
sim, err := client.IndividualSimilar(ctx, "PilsnerUrquell",
	&oxid.SimilarOpts{K: 5, Collection: "default"})
_, _ = sim, err
```

### create_collection

`method: func (c *Client) CreateCollection(ctx context.Context, req CreateCollectionRequest) error` (client.go:309)

The field is `Dimensions` (not `dim`). Metric is one of `cosine | l2 | ip | manhattan`.

```go
if err := client.CreateCollection(ctx, oxid.CreateCollectionRequest{
	Name:       "beverages",
	Dimensions: 4,        // 4-dim vectors
	Metric:     "cosine",
}); err != nil {
	log.Fatalf("create collection: %v", err)
}
```

### insert_document

`method: func (c *Client) InsertDocument(ctx context.Context, collection string, doc Document) (InsertDocumentResponse, error)` (client.go:604)

`Document` is `map[string]any`. A top-level `_iri` sets the document's IRI; the
class bridge fires if the collection is `auto_type`-mapped.

```go
res, err := client.InsertDocument(ctx, "beverages", oxid.Document{
	"_iri":  "PilsnerUrquell",
	"name":  "Pilsner Urquell",
	"style": "Pilsner",
	"abv":   4.4,
})
if err != nil {
	log.Fatalf("insert document: %v", err)
}
log.Printf("ok=%v iri=%s", res.Ok, res.IRI)
```

### bulk_import_documents

`method: func (c *Client) BulkInsertDocuments(ctx context.Context, collection string, docs []Document) (BulkInsertDocumentsResponse, error)` (client.go:611)

Array form (32 MiB body cap). For raw NDJSON text there is `ImportDocumentsNdjson`.

```go
docs := []oxid.Document{
	{"_iri": "Guinness", "name": "Guinness", "style": "Stout", "abv": 4.2},
	{"_iri": "Chardonnay", "name": "Chardonnay", "style": "Wine", "abv": 13.5},
}
res, err := client.BulkInsertDocuments(ctx, "beverages", docs)
if err != nil {
	log.Fatalf("bulk import: %v", err)
}
log.Printf("inserted=%d upserts=%d indexes_built=%d", res.Inserted, res.Upserts, res.IndexesBuilt)

// Raw NDJSON alternative:
// func (c *Client) ImportDocumentsNdjson(ctx context.Context, collection, ndjson string) (ImportNdjsonResponse, error) (client.go:619)
ndjson := `{"_iri":"Weissbier","name":"Weissbier","style":"Beer"}` + "\n" +
	`{"_iri":"Merlot","name":"Merlot","style":"Wine"}`
_, _ = client.ImportDocumentsNdjson(ctx, "beverages", ndjson)
```

### map_collection_to_class

`method: func (c *Client) RegisterMapping(ctx context.Context, req RegisterMappingRequest) (RegisterMappingResponse, error)` (client.go:591)

Binds a document collection to an ontology class (the `/collections/map`
bridge). Set `AutoType` to mint typed individuals as documents land; add a
`vector_property` field mapping (or `Embed`) to route vectors.

```go
autoType := true
res, err := client.RegisterMapping(ctx, oxid.RegisterMappingRequest{
	Collection: "beverages",
	Class:      "Beverage",
	AutoType:   &autoType,
	FieldMappings: []oxid.FieldMapping{
		{Field: "name", Property: "label", Type: oxid.MappingType{Kind: "data_property"}},
		{Field: "abv", Property: "abv", Type: oxid.MappingType{Kind: "data_property"}},
		{Field: "vector", Property: "embedding",
			Type: oxid.MappingType{Kind: "vector_property", Collection: "beverages"}},
	},
})
if err != nil {
	log.Fatalf("register mapping: %v", err)
}
log.Printf("ok=%v collection=%s auto_type=%v", res.Ok, res.Collection, res.AutoType)
```

> Alternatively `ProvisionCollection` (client.go:337) creates the vector
> collection and the document→class binding in one idempotent call.

### transaction

`method: func (c *Client) Transaction(ctx context.Context, fn func(tx *Txn) error) error` (txn.go:189)

Closure scope: commits when `fn` returns nil, rolls back (best-effort) on error.
A `Txn` is single-use and not safe for concurrent use. Explicit control is also
available via `Begin` / `(*Txn).Commit` / `(*Txn).Rollback` / `Savepoint`.

```go
err := client.Transaction(ctx, func(tx *oxid.Txn) error {
	// tx.Insert returns the interned Term (int); iri must be new.
	if _, err := tx.Insert(ctx, oxid.TxnInsertRequest{
		IRI:    "PortSaintNick",
		Class:  "Stout",
		Vector: []float64{0.8, 0.2, 0.1, 0.9},
	}); err != nil {
		return err // triggers rollback
	}
	return tx.AddSubclass(ctx, oxid.SubclassRequest{Sub: "Stout", Sup: "Beer"})
})
if err != nil {
	log.Fatalf("transaction rolled back: %v", err)
}
log.Println("transaction committed")
```

`txn mutators: (*Txn).Insert/InsertIntoCollection/UpsertVector/AddSubclass/AddDisjoint/AddObjectProperty/AddAnnotation/InsertDocument/UpdateDocument/DeleteDocument/BulkInsertDocuments/RegisterMapping/... + Commit/Rollback/Savepoint/RollbackTo` (txn.go)

### predict_links

`method: func (c *Client) PredictLinks(ctx context.Context, req PredictLinksRequest) (PredictLinksResponse, error)` (client.go:544)

KGE link prediction, reasoner-vetted. The field is `TopK` (JSON `top_k`), not
`k`. Train first with `Train` (POST /train) if embeddings are stale.

```go
res, err := client.PredictLinks(ctx, oxid.PredictLinksRequest{
	Head:           "PilsnerUrquell",
	Relation:       "pairsWith",
	TopK:           5,
	OnlyConsistent: true, // keep only reasoner-consistent candidates
})
if err != nil {
	log.Fatalf("predict-links: %v", err)
}
log.Printf("tier=%s model=%s stale=%v", res.Tier, res.Model, res.Stale)
for _, c := range res.Candidates {
	log.Printf("  (%s %s %s) score=%.4f consistent=%v verdict=%s",
		c.H, c.R, c.T, c.Score, c.Consistent, c.Verdict)
}
```

### import_owl

`method: func (c *Client) ImportOWL(ctx context.Context, owl string) (ImportResponse, error)` (client.go:474)

POSTs raw OWL/RDF-XML text (`Content-Type: application/rdf+xml`).

```go
owl := `<?xml version="1.0"?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
         xmlns:owl="http://www.w3.org/2002/07/owl#">
  <owl:Class rdf:about="Beer"/>
  <owl:Class rdf:about="Pilsner">
    <rdfs:subClassOf rdf:resource="Beer"/>
  </owl:Class>
</rdf:RDF>`

res, err := client.ImportOWL(ctx, owl)
if err != nil {
	log.Fatalf("import owl: %v", err)
}
log.Printf("ok=%v classes_added=%d axioms_added=%d warnings=%v",
	res.Ok, res.ClassesAdded, res.AxiomsAdded, res.Warnings)
```

### import_csv

`method: func (c *Client) ImportCSV(ctx context.Context, csv string) (ImportResponse, error)` (client.go:467)

POSTs raw CSV text (`Content-Type: text/csv; charset=utf-8`).

```go
csv := "individual,class,abv\n" +
	"PilsnerUrquell,Pilsner,4.4\n" +
	"Guinness,Stout,4.2\n" +
	"Chardonnay,Wine,13.5\n"

res, err := client.ImportCSV(ctx, csv)
if err != nil {
	log.Fatalf("import csv: %v", err)
}
log.Printf("ok=%v classes_added=%d individuals_added=%d",
	res.Ok, res.ClassesAdded, res.IndividualsAdded)
```

---

## Bonus: governed write (OAG)

Not in the requested list but load-bearing for the neurosymbolic surface. A gated
action returns HTTP 200 whether committed **or vetoed**, branch on `Committed`,
do not treat a veto as an error.

`method: func (c *Client) AssertTyped(ctx context.Context, req AssertTypedRequest) (ActionResult, error)` (client.go:505)

```go
// With Beer ⊓ Wine ⊑ ⊥ already asserted, typing a Beer individual as Wine is vetoed.
result, err := client.AssertTyped(ctx, oxid.AssertTypedRequest{
	Individual: "PilsnerUrquell",
	Class:      "Wine",
})
if err != nil {
	log.Fatalf("assert-typed transport error: %v", err) // a veto is NOT an error
}
if result.Committed {
	log.Println("assertion committed")
} else {
	for _, v := range result.Violations { // SpeculativeViolation{Individual, ClassA, ClassB, Reason}
		log.Printf("VETOED: %s is both %s and %s (%s)", v.Individual, v.ClassA, v.ClassB, v.Reason)
	}
}
```

## Error handling (verified from errors.go)

Sentinels + typed errors; both `errors.Is` and `errors.As` work.

```go
import "errors"

if errors.Is(err, oxid.ErrNotFound) { /* 404 */ }

var httpErr *oxid.OxidHTTPError
if errors.As(err, &httpErr) {
	log.Printf("HTTP %d code=%s", httpErr.Status, httpErr.Code)
}
```

Sentinels: `ErrNotFound` (404), `ErrAuth` (401/403), `ErrBadRequest` (400),
`ErrQuery` (`QUERY_ERROR`), `ErrTimeout`, `ErrRateLimited` (429). Concrete types:
`*OxidHTTPError`, `*OxidNetworkError`, `*OxidDecodeError`, `*OxidUsageError`.
