# Oxid-DB .NET (C#) SDK: verified usage

Every snippet below is code-verified against the SDK source at
`sdk/oxiddb-dotnet-sdk/`. Method signatures are copied verbatim from the cited
file. Package: **`OxidDb.Client`** (namespace `OxidDb.Client`), targets **.NET 8**.

> Coordinates are provisional/unpublished, the NuGet id `OxidDb.Client` is
> reserved but nothing is pushed yet (see `sdk/oxiddb-dotnet-sdk/README.md`).
> The package version is **0.9.4**, tested against oxd-server 0.9.4.

Data used throughout: beverage ontology (Beer/Pilsner/Stout/Wine) with 4-dim
vectors, against `https://85cfad134a4a.oxid-db.com`.

## install

`PackageId` is `OxidDb.Client` (`src/OxidDb.Client/OxidDb.Client.csproj:11`, `<Version>0.9.4</Version>`).

```bash
dotnet add package OxidDb.Client --version 0.9.4
```

Or as a `<PackageReference>` (from the README):

```xml
<PackageReference Include="OxidDb.Client" Version="0.9.4" />
```

## client-init

method: `public static OxidClient Create(Action<OxidClientOptions>? configure = null)` (`src/OxidDb.Client/OxidClient.cs:29`)
method: `public OxidClient(OxidClientOptions options)` (`src/OxidDb.Client/OxidClient.cs:21`)

`OxidClient` is `IDisposable` and safe for concurrent use (the HTTP connection
pool lives on it). Construct it once and reuse it. Endpoint defaults to
`https://85cfad134a4a.oxid-db.com`; `OXID_ENDPOINT` / `OXID_TOKEN` env vars are honored as
fallbacks (`OxidClient.cs:36-55`). Options are in `OxidClientOptions.cs`.

```csharp
using OxidDb.Client;

// Convenience factory (shown once, reused by every example below).
using var oxid = OxidClient.Create(o =>
{
    o.Endpoint = new Uri("https://85cfad134a4a.oxid-db.com");                 // API port (or $OXID_ENDPOINT)
    o.Auth     = Environment.GetEnvironmentVariable("OXID_TOKEN"); // optional bearer; off by default
    o.Timeout  = TimeSpan.FromSeconds(30);
});

// Equivalent explicit-options form:
// using var oxid = new OxidClient(new OxidClientOptions
// {
//     Endpoint = new Uri("https://85cfad134a4a.oxid-db.com"),
//     Timeout  = TimeSpan.FromSeconds(30),
// });
```

### connect

There is **no explicit `connect` call**, the client is stateless over HTTP; the
connection pool is lazy. To verify the server is up, call the health endpoint.

method: `public Task<HealthResponse> HealthAsync(CancellationToken ct = default)` (`src/OxidDb.Client/OxidClient.cs:63`)

```csharp
HealthResponse health = await oxid.HealthAsync();
Console.WriteLine(health.Status); // e.g. "ok"
```

`HealthResponse` is `record HealthResponse(string Status)` (`Models/Models.Core.cs:10`).

### ready

method: `public Task<ReadyResponse> ReadyAsync(CancellationToken ct = default)` (`src/OxidDb.Client/OxidClient.cs:67`)

Returns the body for **both** HTTP 200 and 503 (503 = not-yet-classified), it
does not throw on 503 (`OxidClient.cs:68`, the trailing `503` allow-list arg).

```csharp
ReadyResponse ready = await oxid.ReadyAsync();
Console.WriteLine($"{ready.Status}, {ready.Checks.Classes} classes, " +
                  $"{ready.Checks.Individuals} individuals, classified={ready.Checks.ClassificationCurrent}");
```

`ReadyResponse(string Status, ReadyChecks Checks, double UptimeSeconds, string Version)`
and `ReadyChecks(bool DatabaseLoaded, bool ClassificationCurrent, bool Consistent, int Classes, int Individuals, Dictionary<string, ReadyCollection> Collections)` (`Models/Models.Core.cs:12-22`).

### add_subclass

method: `public Task AddSubclassAsync(SubclassRequest req, CancellationToken ct = default)` (`src/OxidDb.Client/OxidClient.cs:197`)

`SubclassRequest(string Sub, string Sup)`, Sub is the child (`Models/Models.Mutation.cs:40`).

```csharp
// Pilsner ⊑ Beer, Stout ⊑ Beer
await oxid.AddSubclassAsync(new SubclassRequest("Pilsner", "Beer"));
await oxid.AddSubclassAsync(new SubclassRequest("Stout", "Beer"));
```

### add_disjoint

method: `public Task AddDisjointAsync(DisjointRequest req, CancellationToken ct = default)` (`src/OxidDb.Client/OxidClient.cs:200`)

`DisjointRequest(string A, string B)` (`Models/Models.Mutation.cs:42`).

```csharp
// A beverage cannot be both a Beer and a Wine.
await oxid.AddDisjointAsync(new DisjointRequest("Beer", "Wine"));
```

### insert_individual

method: `public Task<OkResponse> InsertAsync(InsertRequest req, CancellationToken ct = default)` (`src/OxidDb.Client/OxidClient.cs:166`)

`InsertRequest(string? Individual, string? Class, string? Text = null, double[]? Vector = null, string? Collection = null, string? Iri = null, List<string>? Classes = null)` (`Models/Models.Mutation.cs:18-25`).
The classic positional form emits `individual`/`class`; the `Iri`/`Classes`
aliases emit `iri`/`classes` (multi-class), verified in
`tests/.../WireTrapTests.cs:9` and `DxTests.cs:314`.

```csharp
// Positional (single class), emits {"individual","class",...}
OkResponse ok = await oxid.InsertAsync(new InsertRequest(
    "Heineken", "Pilsner",
    Vector: new[] { 0.9, 0.1, 0.5, 0.2 }));

// Multi-class via the aliases, emits {"iri","classes":[...]}
await oxid.InsertAsync(new InsertRequest(
    Individual: null, Class: null,
    Iri: "Guinness", Classes: new List<string> { "Stout" },
    Vector: new[] { 0.1, 0.8, 0.3, 0.4 }));
```

`OkResponse(bool Ok)` (`Models/Models.Mutation.cs:10`).

For the ergonomic upsert (classes + properties + vector in one call, optionally
reasoner-gated) use `UpsertEntityAsync` (`OxidClient.cs:179`) with `EntityInput`
(`Models/Models.Dx.cs:33`).

### classify

method: `public Task<ClassifyResponse> ClassifyAsync(CancellationToken ct = default)` (`src/OxidDb.Client/OxidClient.cs:288`)

```csharp
ClassifyResponse res = await oxid.ClassifyAsync();
Console.WriteLine($"ok={res.Ok} consistent={res.Consistent} " +
                  $"coherent={res.Coherent} violations={res.Violations}");

foreach (var u in res.Unsatisfiable ?? [])
{
    Console.WriteLine($"  unsatisfiable class: {u}");
}
```

`ClassifyResponse(bool Ok, bool Consistent, bool Coherent, int Violations, List<SpeculativeViolation>? ViolationWitnesses = null, List<string>? Unsatisfiable = null)` (`Models/Models.Neuro.cs:83-85`).
Note: `Violations` is an **int count** here (not a list).

### query

method: `public Task<QueryResponse> QueryAsync(QueryRequest req, CancellationToken ct = default)` (`src/OxidDb.Client/OxidClient.cs:89`)

OxQL travels as an opaque string. Use `Oxql.Quote(string)` (`src/OxidDb.Client/Oxql.cs:17`)
to escape literals, or the fluent `QueryBuilder` (`src/OxidDb.Client/QueryBuilder.cs:19`).
`?x IS-A Beer` returns instances of every subclass transitively (Pilsner, Stout).

```csharp
// Raw OxQL string, escaping the class literal.
QueryResponse page = await oxid.QueryAsync(
    new QueryRequest("FIND ?x WHERE ?x IS-A " + Oxql.Quote("Beer") + " LIMIT 20"));
Console.WriteLine($"{page.Results.Count} of {page.TotalCount} hit(s)");
foreach (QueryHit hit in page.Results)
{
    Console.WriteLine($"  {hit.Iri} (score={hit.Score})");
}

// Same thing via the fluent builder (client-side string assembly only).
string oxql = new QueryBuilder().Find("x").IsA("Beer").Limit(20).ToOxql();
QueryResponse page2 = await oxid.QueryAsync(new QueryRequest(oxql));
```

`QueryRequest(string Query, string? Cursor = null, object? Hydrate = null)`, `Hydrate`
is an untagged union: pass `true` (all properties) or a `string[]` whitelist
(`Models/Models.Core.cs:53`). `QueryResponse(List<QueryHit> Results, string? NextCursor, int TotalCount, object? Aggregation = null, long? ElapsedMicros = null)` (`Models/Models.Core.cs:62-67`).
`QueryHit(string Iri, double? Score = null, ...)` (`Models/Models.Core.cs:55-60`).

### query_all

method: `public async IAsyncEnumerable<QueryHit> QueryAllAsync(QueryRequest req, [EnumeratorCancellation] CancellationToken ct = default)` (`src/OxidDb.Client/OxidClient.cs:93`)

Streams every hit across all pages, following `next_cursor` to exhaustion.

```csharp
var total = 0;
await foreach (QueryHit hit in oxid.QueryAllAsync(
    new QueryRequest("FIND ?x WHERE ?x IS-A Beverage")))
{
    total++;
    Console.WriteLine(hit.Iri);
}
Console.WriteLine($"drained {total} hit(s) across all pages");
```

Caveat (README + `api-oxql.md`): OxQL `SORT` is **not preserved across
pagination**, draining yields IRI/score-ordered hits overall. For a stable
whole-set order, request one large page or sort client-side.

### vector_search

There is **no dedicated `vector_search` / `search` method**, vector search is
expressed as an OxQL `NEAR ?x TO [vec]` clause sent through
`QueryAsync`/`QueryAllAsync` (hybrid-capable: combine with `IS-A`). The
`QueryBuilder.Near(IEnumerable<double>)` helper builds the clause
(`QueryBuilder.cs:64`). Confirmed corpus output in `QueryBuilderTests.cs:117-123`.

method (query transport): `public Task<QueryResponse> QueryAsync(QueryRequest req, CancellationToken ct = default)` (`src/OxidDb.Client/OxidClient.cs:89`)
method (builder clause): `public QueryBuilder Near(IEnumerable<double> vector)` (`src/OxidDb.Client/QueryBuilder.cs:64`)

```csharp
// Hybrid: a Beer near this 4-dim probe vector, top 5.
// QueryBuilder emits: FIND ?x WHERE ?x IS-A Beer AND NEAR ?x TO [0.9, 0.1, 0.5, 0.2] LIMIT 5
string oxql = new QueryBuilder()
    .Find("x").IsA("Beer").Near(new[] { 0.9, 0.1, 0.5, 0.2 }).Limit(5)
    .ToOxql();

QueryResponse hits = await oxid.QueryAsync(new QueryRequest(oxql));
foreach (QueryHit hit in hits.Results)
{
    Console.WriteLine($"{hit.Iri}  score={hit.Score}");
}
```

Related helpers exist for reference-based similarity:
method: `public Task<IndividualSimilarResponse> IndividualSimilarAsync(string iri, int k = 0, string? collection = null, CancellationToken ct = default)` (`src/OxidDb.Client/OxidClient.cs:130`)

```csharp
// Nearest neighbours of an existing individual.
IndividualSimilarResponse sim = await oxid.IndividualSimilarAsync("Heineken", k: 3);
foreach (SimilarHit s in sim.Results)
{
    Console.WriteLine($"{s.Iri}  {s.Score}");
}
```

### create_collection

method: `public Task CreateCollectionAsync(CreateCollectionRequest req, CancellationToken ct = default)` (`src/OxidDb.Client/OxidClient.cs:203`)

`CreateCollectionRequest(string Name, int Dimensions, string? Metric = null, string? Quantization = null, bool? ColdF32 = null)`, the wire key is `dimensions`, **not** `dim` (`Models/Models.Mutation.cs:55-56`; verified `WireTrapTests.cs:22`). Returns no body (void).

```csharp
// A 4-dim collection for beverage vectors.
await oxid.CreateCollectionAsync(new CreateCollectionRequest("beers", 4));

// With an explicit metric:
await oxid.CreateCollectionAsync(new CreateCollectionRequest("beers", 4, Metric: "cosine"));
```

For a one-shot vector-collection + document→ontology binding in a single call,
use `ProvisionCollectionAsync` (`OxidClient.cs:191`).

### insert_document

method: `public Task<InsertDocumentResponse> InsertDocumentAsync(string collection, IReadOnlyDictionary<string, object?> doc, CancellationToken ct = default)` (`src/OxidDb.Client/OxidClient.cs:350`)

A document is a `Dictionary<string, object?>`.

```csharp
InsertDocumentResponse res = await oxid.InsertDocumentAsync("beers",
    new Dictionary<string, object?>
    {
        ["name"]  = "Pilsner Urquell",
        ["style"] = "Pilsner",
        ["abv"]   = 4.4,
    });
Console.WriteLine($"inserted {res.Iri} into {res.Collection} (ok={res.Ok})");
```

`InsertDocumentResponse(bool Ok, string Collection, string Iri)` (`Models/Models.Documents.cs:35`).

### bulk_import_documents

Two distinct bulk paths exist. Both are subject to the 32 MiB request-body cap
(a 413 surfaces as `OxidHttpException(413)`).

method: `public Task<BulkInsertDocumentsResponse> BulkInsertDocumentsAsync(string collection, IEnumerable<IReadOnlyDictionary<string, object?>> docs, CancellationToken ct = default)` (`src/OxidDb.Client/OxidClient.cs:353`)

```csharp
// JSON array of documents in one POST.
BulkInsertDocumentsResponse bulk = await oxid.BulkInsertDocumentsAsync("beers", new[]
{
    new Dictionary<string, object?> { ["name"] = "Guinness", ["style"] = "Stout" },
    new Dictionary<string, object?> { ["name"] = "Chimay",   ["style"] = "Ale"   },
});
Console.WriteLine($"inserted={bulk.Inserted} upserts={bulk.Upserts} " +
                  $"indexesBuilt={bulk.IndexesBuilt}");
```

method: `public Task<ImportNdjsonResponse> ImportDocumentsNdjsonAsync(string collection, string ndjson, CancellationToken ct = default)` (`src/OxidDb.Client/OxidClient.cs:356`)

```csharp
// Line-delimited JSON (NDJSON) upload.
string ndjson =
    "{\"name\":\"Weihenstephaner\",\"style\":\"WheatBeer\"}\n" +
    "{\"name\":\"Duvel\",\"style\":\"Ale\"}\n";
ImportNdjsonResponse imp = await oxid.ImportDocumentsNdjsonAsync("beers", ndjson);
Console.WriteLine($"imported={imp.Imported} upserts={imp.Upserts}");
```

`BulkInsertDocumentsResponse(bool Ok, string Collection, int Inserted, int Upserts, int IndexesBuilt, List<BulkDocumentResult>? Results = null, bool? ResultsTruncated = null)` (`Models/Models.Documents.cs:40-47`).
`ImportNdjsonResponse(bool Ok, string Collection, int Imported, int Upserts)` (`Models/Models.Documents.cs:49`).

### map_collection_to_class

method: `public Task<RegisterMappingResponse> RegisterMappingAsync(RegisterMappingRequest req, CancellationToken ct = default)` (`src/OxidDb.Client/OxidClient.cs:344`)

Binds a document collection to an ontology class via `POST /collections/map`,
with per-field mappings. `MappingType` is a tagged union
(`DataProperty()` / `ObjectProperty()` / `VectorProperty(collection)`),
verified in `WireTrapTests.cs:48`.

```csharp
RegisterMappingResponse map = await oxid.RegisterMappingAsync(
    new RegisterMappingRequest(
        Collection: "beers",
        Class: "Beer",
        FieldMappings: new List<FieldMapping>
        {
            new("name",  "hasName",  MappingType.DataProperty()),
            new("style", "hasStyle", MappingType.DataProperty()),
            new("vec",   "hasVec",   MappingType.VectorProperty("beers")),
        },
        AutoType: true));
Console.WriteLine($"mapped {map.Collection} → autoType={map.AutoType} (ok={map.Ok})");
```

`RegisterMappingRequest(string Collection, string Class, List<FieldMapping> FieldMappings, bool? AutoType = null, EmbedConfig? Embed = null)` (`Models/Models.Documents.cs:26`).
`RegisterMappingResponse(bool Ok, string Collection, bool AutoType)` (`Models/Models.Documents.cs:29`).
To create the collection *and* the binding in one call, see
`ProvisionCollectionAsync` with a `ProvisionBinding` (`Models/Models.Dx.cs:82`).

### transaction

method: `public async Task TransactionAsync(Func<Transaction, Task> fn, CancellationToken ct = default)` (`src/OxidDb.Client/OxidClient.cs:382`)
method: `public async Task<T> TransactionAsync<T>(Func<Transaction, Task<T>> fn, CancellationToken ct = default)` (`src/OxidDb.Client/OxidClient.cs:413`)
method: `public async Task<Transaction> BeginTransactionAsync(CancellationToken ct = default)` (`src/OxidDb.Client/OxidClient.cs:375`)

The callback form commits when `fn` returns and rolls back if it throws.
Transaction mutators live on the `Transaction` handle (`src/OxidDb.Client/Transaction.cs`);
`Transaction.InsertAsync` takes a `TxnInsertRequest` and returns the interned
integer Term.

```csharp
// Callback form, auto commit/rollback.
await oxid.TransactionAsync(async tx =>
{
    await tx.InsertAsync(new TxnInsertRequest("Corona", "Pilsner",
        Vector: new[] { 0.7, 0.2, 0.4, 0.1 }, Collection: "beers"));
    await tx.AddSubclassAsync(new SubclassRequest("Pilsner", "Beer"));
    await tx.AddObjectPropertyAsync("Corona", "brewedBy", "GrupoModelo");
    // returns → COMMIT ; throws → ROLLBACK (exception re-raised)
});

// Manual form with a savepoint; `await using` rolls back if never committed.
await using Transaction tx = await oxid.BeginTransactionAsync();
await tx.InsertAsync(new TxnInsertRequest("Maybe", "Stout"));
int sp = await tx.SavepointAsync();
await tx.InsertAsync(new TxnInsertRequest("Discarded", "Stout"));
await tx.RollbackToAsync(sp);   // drop "Discarded", keep "Maybe"
await tx.CommitAsync();
```

`Transaction.InsertAsync` → `public async Task<int> InsertAsync(TxnInsertRequest req, CancellationToken ct = default)` (`Transaction.cs:102`).
`TxnInsertRequest(string Iri, string Class, string? Text = null, double[]? Vector = null, string? Collection = null)` (`Models/Models.Documents.cs:78-79`).
A settled transaction refuses further mutators with `OxidUsageException`
before touching the network (`Transaction.cs:32-38`).

### predict_links

method: `public Task<PredictLinksResponse> PredictLinksAsync(PredictLinksRequest req, CancellationToken ct = default)` (`src/OxidDb.Client/OxidClient.cs:323`)

KGE link prediction. The wire key is `top_k`, **not** `k` (verified
`WireTrapTests.cs:35`). A model is trained separately via `TrainAsync`
(`OxidClient.cs:320`).

```csharp
PredictLinksResponse pred = await oxid.PredictLinksAsync(
    new PredictLinksRequest("Heineken", Relation: "similarTo", TopK: 5, OnlyConsistent: true));

Console.WriteLine($"tier={pred.Tier} model={pred.Model} stale={pred.Stale}");
foreach (LinkCandidate c in pred.Candidates)
{
    Console.WriteLine($"  {c.H} -{c.R}-> {c.T}  score={c.Score} rank={c.Rank} " +
                      $"consistent={c.Consistent} verdict={c.Verdict}");
}
```

`PredictLinksRequest(string Head, string? Relation = null, string? Model = null, int? TopK = null, bool? OnlyConsistent = null)` (`Models/Models.Neuro.cs:67-68`).
`PredictLinksResponse(string Tier, string Provenance, string Model, string Kind, bool Stale, int TrainedAboxTriples, List<LinkCandidate> Candidates)` (`Models/Models.Neuro.cs:72-79`).
`LinkCandidate(string H, string R, string T, double Score, int Rank, bool Consistent, string Verdict)` (`Models/Models.Neuro.cs:70`).

### import_owl

method: `public Task<ImportResponse> ImportOwlAsync(string owl, CancellationToken ct = default)` (`src/OxidDb.Client/OxidClient.cs:283`)

POSTs raw RDF/XML (`application/rdf+xml`) to `/import/owl`.

```csharp
string owl = await File.ReadAllTextAsync("beverages.owl"); // RDF/XML
ImportResponse res = await oxid.ImportOwlAsync(owl);
Console.WriteLine($"classes+={res.ClassesAdded} individuals+={res.IndividualsAdded} " +
                  $"axioms+={res.AxiomsAdded}");
foreach (string w in res.Warnings)
{
    Console.WriteLine($"  warning: {w}");
}
```

`ImportResponse(bool Ok, int ClassesAdded, int IndividualsAdded, int AxiomsAdded, List<string> Warnings)` (`Models/Models.Neuro.cs:134-135`).

### import_csv

method: `public Task<ImportResponse> ImportCsvAsync(string csv, CancellationToken ct = default)` (`src/OxidDb.Client/OxidClient.cs:280`)

POSTs raw CSV (`text/csv; charset=utf-8`) to `/import/csv`. Same
`ImportResponse` shape as `ImportOwlAsync`.

```csharp
string csv =
    "individual,class\n" +
    "Heineken,Pilsner\n" +
    "Guinness,Stout\n";
ImportResponse res = await oxid.ImportCsvAsync(csv);
Console.WriteLine($"individuals+={res.IndividualsAdded} axioms+={res.AxiomsAdded}");
```

---

## Error handling (shared)

All SDK errors derive from `OxidException` (`src/OxidDb.Client/Errors.cs`):
`OxidNetworkException`, `OxidHttpException` (carries `Status`, `Code`, `Body`,
`RawBody`, `RetryAfterSeconds`, `IsRateLimited`), `OxidDecodeException`, and
`OxidUsageException` (client-side misuse, e.g. reusing a settled transaction).

```csharp
try
{
    await oxid.IndividualAsync("does-not-exist");
}
catch (OxidHttpException e) when (e.Status == 404)
{
    Console.WriteLine("not found");
}
catch (OxidException e)
{
    Console.WriteLine($"SDK error: {e.Message}");
}
```
