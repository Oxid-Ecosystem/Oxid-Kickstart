# Oxid-DB PHP SDK: verified usage snippets

Composer package `oxiddb/client`, namespace `OxidDb\Client`. All snippets below are
code-verified against `sdk/oxiddb-php-sdk/src/**` (client class `OxidClient`, models
under `OxidDb\Client\Model`). PHP 8.2+; PSR-18/PSR-17 (bring your own HTTP client).

The client exposes **no vector-search method** and **no NDJSON/OWL/CSV-file
convenience wrappers beyond raw-text**; where an operation is not a first-class
method, the note under the heading says so and shows the real method to use.

Base URL used throughout: `https://85cfad134a4a.oxid-db.com`. Beverage domain: `Beer`,
`Pilsner`, `Stout`, `Wine`; 4-dim vectors.

## install

```bash
composer require oxiddb/client guzzlehttp/guzzle
```

(Guzzle is a suggested PSR-18 client; the SDK auto-discovers any installed
PSR-18 client + PSR-17 factories. `guzzlehttp/guzzle` additionally enables
per-request timeouts and true streaming exports., `composer.json:22-24`, `README.md:19-24`.)

## client-init

method: `OxidClient::__construct(?OxidClientOptions $options = null)`, `src/OxidClient.php:103`
method: `OxidClientOptions::__construct(?string $endpoint = null, ?string $token = null, float $timeout = 30.0, float $connectTimeout = 10.0, float $chunkTimeout = 30.0, int $retries = 2, int $rateLimitRetries = 4, ?string $userAgent = null, ?ClientInterface $httpClient = null, ?RequestFactoryInterface $requestFactory = null, ?StreamFactoryInterface $streamFactory = null, ?Closure $telemetry = null, ?string $caBundle = null, bool $insecureSkipVerify = false)`, `src/OxidClientOptions.php:43`

```php
<?php

require __DIR__ . '/vendor/autoload.php';

use OxidDb\Client\OxidClient;
use OxidDb\Client\OxidClientOptions;

$oxid = new OxidClient(new OxidClientOptions(
    endpoint: 'https://85cfad134a4a.oxid-db.com',        // or env OXID_ENDPOINT
    token: getenv('OXID_TOKEN') ?: null,      // optional bearer; off by default
));

// Equivalent convenience factory (mirrors the other-language SDKs):
// $oxid = OxidClient::create(new OxidClientOptions(endpoint: 'https://85cfad134a4a.oxid-db.com'));
```

`$oxid` is reused as the client in every snippet below. It is safe to share as a
singleton (`src/OxidClient.php:84-118`).

### connect

method: (no explicit connect), construction is lazy; `OxidClient::health(): HealthResponse`, `src/OxidClient.php:123`

There is no `connect()` call. The client connects lazily on the first request.
Use `health()` (liveness, always 200) to confirm reachability.

```php
use OxidDb\Client\Model\HealthResponse;

$health = $oxid->health();          // GET /health
echo $health->status, "\n";         // e.g. "ok"
```

### ready

method: `OxidClient::ready(): ReadyResponse`, `src/OxidClient.php:133`

`GET /ready` returns the body for both 200 (ready) and 503 (not yet classified) , 
a fresh DB reports `not_ready` until it has been classified, so 503 is not an error.

```php
$ready = $oxid->ready();                        // GET /ready (200 or 503 both parsed)
echo $ready->status, "\n";                      // "ready" | "not_ready"
echo $ready->version, "\n";
printf("uptime: %.1fs\n", $ready->uptimeSeconds);
```

(`ReadyResponse` fields: `status`, `checks`, `uptimeSeconds`, `version`, `src/Model/ReadyResponse.php:12`.)

### add_subclass

method: `OxidClient::addSubclass(SubclassRequest $request): void`, `src/OxidClient.php:312`
method: `SubclassRequest::__construct(string $sub, string $sup)`, `src/Model/SubclassRequest.php:12`

Asserts a `SubClassOf` axiom. First argument is the sub-class, second the super-class.

```php
use OxidDb\Client\Model\CreateClassRequest;
use OxidDb\Client\Model\SubclassRequest;

$oxid->createClass(new CreateClassRequest('Beverage'));   // POST /classes
$oxid->createClass(new CreateClassRequest('Beer'));
$oxid->createClass(new CreateClassRequest('Pilsner'));

$oxid->addSubclass(new SubclassRequest('Beer', 'Beverage'));    // Beer ⊑ Beverage
$oxid->addSubclass(new SubclassRequest('Pilsner', 'Beer'));     // Pilsner ⊑ Beer
```

(You can also set the parent at creation time: `new CreateClassRequest('Beer', 'Beverage')`
,  `src/Model/CreateClassRequest.php:12`.)

### add_disjoint

method: `OxidClient::addDisjoint(DisjointRequest $request): void`, `src/OxidClient.php:318`
method: `DisjointRequest::__construct(string $a, string $b)`, `src/Model/DisjointRequest.php:12`

Asserts a `DisjointClasses(a, b)` axiom. This is what makes a later contradictory
class assertion get vetoed by the governed-write gate.

```php
use OxidDb\Client\Model\DisjointRequest;

$oxid->addDisjoint(new DisjointRequest('Beer', 'Wine'));   // POST /disjoint, Beer ⊓ Wine = ⊥
```

### insert_individual

method: `OxidClient::insert(InsertRequest $request): OkResponse`, `src/OxidClient.php:273`
method: `InsertRequest::__construct(?string $individual = null, ?string $class = null, ?string $text = null, ?array $vector = null, ?string $collection = null, ?string $iri = null, ?array $classes = null)`, `src/Model/InsertRequest.php:19`
method (alias helper): `InsertRequest::forIri(string $iri, array $classes, ?string $text = null, ?array $vector = null, ?string $collection = null): self`, `src/Model/InsertRequest.php:37`

`POST /insert` writes exactly one individual: identity + class(es) + optional
vector/text. Supply the vector/collection by name (they are the 4th/5th ctor args).
`/insert` refuses properties/labels, use `upsertEntity()` (POST /entities) for those.

```php
use OxidDb\Client\Model\InsertRequest;

// Positional identity + class, then named vector/collection (as in the shipped examples):
$res = $oxid->insert(new InsertRequest(
    'Heineken',
    'Pilsner',
    vector: [0.6, 0.3, 0.1, 0.6],
    collection: 'demo_beers',
));
echo $res->ok ? "inserted\n" : "failed\n";

// Multi-class via the alias helper (uses `iri` + `classes` spellings):
$oxid->insert(InsertRequest::forIri('Guinness', ['Stout'], vector: [0.1, 0.1, 0.9, 0.2], collection: 'demo_beers'));
```

### classify

method: `OxidClient::classify(): ClassifyResponse`, `src/OxidClient.php:454`

`POST /classify` runs the EL⊥ classifier (no request body). Do this after building
the ontology so IS-A queries return inferred super-classes.

```php
$classify = $oxid->classify();                       // POST /classify
printf("consistent=%s coherent=%s violations=%d\n",
    $classify->consistent ? 'true' : 'false',
    $classify->coherent   ? 'true' : 'false',
    $classify->violations,
);
```

(`ClassifyResponse` fields: `ok`, `consistent`, `coherent`, `violations` (int count),
`violationWitnesses`, `unsatisfiable`, `src/Model/ClassifyResponse.php:19`.)

### query

method: `OxidClient::query(QueryRequest $request): QueryResponse`, `src/OxidClient.php:173`
method: `QueryRequest::__construct(string $query, ?string $cursor = null, bool|array|null $hydrate = null)`, `src/Model/QueryRequest.php:16`

`POST /query` returns **one page** of OxQL results. OxQL is an opaque string;
`IS-A` takes a bare class identifier (not a quoted literal). Use `Oxql::quote()`
only for string-literal predicates.

```php
use OxidDb\Client\Model\QueryRequest;
use OxidDb\Client\Oxql;

// Inferred-class query (Pilsner ⊑ Beer ⊑ Beverage ⇒ Heineken is a Beverage):
$page = $oxid->query(new QueryRequest('FIND ?x WHERE ?x IS-A Beverage'));
echo "total: {$page->totalCount}\n";
foreach ($page->results as $hit) {
    echo "  {$hit->iri}", $hit->score !== null ? " ({$hit->score})" : "", "\n";
}

// String-literal predicate needs Oxql::quote (class identifiers stay bare):
$q = 'FIND ?x WHERE ?x.name = ' . Oxql::quote('Heineken');   // ?x.name = "Heineken"
$named = $oxid->query(new QueryRequest($q));

// hydrate: true (all props) or a whitelist list<string>; null = IRI-only hits:
$hydrated = $oxid->query(new QueryRequest('FIND ?x WHERE ?x IS-A Beer', hydrate: true));
```

(`QueryResponse` fields: `results` (list of `QueryHit`), `nextCursor`, `totalCount`,
`aggregation`, `elapsedMicros`, `src/Model/QueryResponse.php:16`. `QueryHit`:
`iri`, `score`, `fields`, `dataProperties`, `objectProperties`, `src/Model/QueryHit.php:17`.
NOTE: an OxQL `SORT` clause is a no-op over HTTP, wire order is IRI, or
score-then-IRI for NEAR/hybrid.)

### query_all

method: `OxidClient::queryAll(QueryRequest $request): Generator<int, QueryHit>`, `src/OxidClient.php:185`

Pages an OxQL query to exhaustion, following `next_cursor` automatically, and
yields each `QueryHit`.

```php
use OxidDb\Client\Model\QueryRequest;

foreach ($oxid->queryAll(new QueryRequest('FIND ?x WHERE ?x IS-A Beer')) as $hit) {
    echo $hit->iri, "\n";
}
```

### vector_search

method: NOT IMPLEMENTED as a dedicated method, use OxQL `NEAR ... TO` via `query()`/`queryAll()`, or `OxidClient::individualSimilar()` for by-reference search.
method (by reference): `OxidClient::individualSimilar(string $iri, ?int $k = null, ?string $collection = null): IndividualSimilarResponse`, `src/OxidClient.php:227`

There is no `vectorSearch()` method. Two verified paths (matching the server's two
ways, see `api-oxql.md:111-118`):

```php
use OxidDb\Client\Model\QueryRequest;

// 1) OxQL NEAR over POST /query, literal query vector, hybrid-capable.
//    Rows carry a `score`. Dims must match the collection (here 4-dim).
$near = $oxid->query(new QueryRequest(
    'FIND ?x WHERE ?x IS-A Beer AND NEAR ?x TO [0.9, 0.1, 0.5, 0.2] LIMIT 5'
));
foreach ($near->results as $hit) {
    printf("  %s  score=%s\n", $hit->iri, $hit->score);
}

// Pure vector NEAR (no symbolic filter):
$oxid->query(new QueryRequest('FIND ?x WHERE NEAR ?x TO [0.9, 0.1, 0.5, 0.2] LIMIT 5'));

// Optional per-query HNSW breadth with EF:
$oxid->query(new QueryRequest('FIND ?x WHERE NEAR ?x TO [0.9,0.1,0.5,0.2] EF 200 LIMIT 10'));

// 2) By-reference nearest neighbours: GET /individuals/{iri}/similar
$similar = $oxid->individualSimilar('Heineken', k: 3, collection: 'demo_beers');
echo "reference={$similar->reference} collection={$similar->collection}\n";
foreach ($similar->results as $hit) {
    // SimilarHit, see src/Model/SimilarHit.php
    print_r($hit);
}
```

### create_collection

method: `OxidClient::createCollection(CreateCollectionRequest $request): void`, `src/OxidClient.php:324`
method: `CreateCollectionRequest::__construct(string $name, int $dimensions, ?string $metric = null, ?string $quantization = null, ?bool $coldF32 = null)`, `src/Model/CreateCollectionRequest.php:12`

`POST /collections`. The field is **`dimensions`, not `dim`**. `POST /collections`
has no `index_type`.

```php
use OxidDb\Client\Model\CreateCollectionRequest;

$oxid->createCollection(new CreateCollectionRequest('demo_beers', 4, 'cosine'));

// With quantization / cold-f32 (mmap):
$oxid->createCollection(new CreateCollectionRequest(
    'demo_beers_big',
    dimensions: 4,
    metric: 'cosine',
    quantization: 'sq8',
    coldF32: true,      // serialized as cold_f32
));
```

### insert_document

method: `OxidClient::insertDocument(string $collection, array $document): InsertDocumentResponse`, `src/OxidClient.php:566`

`POST /documents/{collection}`. The document is a plain associative array. A
top-level `_iri` key sets the individual's IRI; the ontology bridge fires when the
collection is `auto_type`-mapped (see map_collection_to_class).

```php
$res = $oxid->insertDocument('beer_catalog', [
    '_iri'  => 'Heineken',
    'name'  => 'Heineken',
    'style' => 'Pilsner',
    'abv'   => 5.0,
]);
// InsertDocumentResponse, see src/Model/InsertDocumentResponse.php
print_r($res);
```

### bulk_import_documents

method: `OxidClient::bulkInsertDocuments(string $collection, array $documents): BulkInsertDocumentsResponse`, `src/OxidClient.php:576`
method (raw NDJSON): `OxidClient::importDocumentsNdjson(string $collection, string $ndjson): ImportNdjsonResponse`, `src/OxidClient.php:582`

`POST /documents/{collection}/bulk`, pass a `list<array>` of documents (32 MiB
body cap). For a raw NDJSON body use `importDocumentsNdjson()`.

```php
$bulk = $oxid->bulkInsertDocuments('beer_catalog', [
    ['_iri' => 'Heineken', 'name' => 'Heineken', 'style' => 'Pilsner', 'abv' => 5.0],
    ['_iri' => 'Guinness', 'name' => 'Guinness', 'style' => 'Stout',   'abv' => 4.2],
    ['_iri' => 'Merlot',   'name' => 'Merlot',   'style' => 'Wine',    'abv' => 13.5],
]);
printf("ok=%s inserted=%d upserts=%d indexes_built=%d\n",
    $bulk->ok ? 'true' : 'false', $bulk->inserted, $bulk->upserts, $bulk->indexesBuilt);

// Raw NDJSON alternative:
$ndjson = implode("\n", [
    json_encode(['_iri' => 'Pils',  'name' => 'Pils',  'style' => 'Pilsner']),
    json_encode(['_iri' => 'Stout', 'name' => 'Stout', 'style' => 'Stout']),
]);
$oxid->importDocumentsNdjson('beer_catalog', $ndjson);
```

(`BulkInsertDocumentsResponse` fields: `ok`, `collection`, `inserted`, `upserts`,
`indexesBuilt`, `results`, `resultsTruncated`, `src/Model/BulkInsertDocumentsResponse.php:17`.)

### map_collection_to_class

method: `OxidClient::registerMapping(RegisterMappingRequest $request): RegisterMappingResponse`, `src/OxidClient.php:549`
method: `RegisterMappingRequest::__construct(string $collection, string $class, array $fieldMappings, ?bool $autoType = null, ?EmbedConfig $embed = null)`, `src/Model/RegisterMappingRequest.php:15`
method: `FieldMapping::__construct(string $field, string $property, MappingType $type)`, `src/Model/FieldMapping.php:13`
method: `MappingType::__construct(string $kind, ?string $collection = null)`, `src/Model/MappingType.php:14`

`POST /collections/map` binds a document collection to an ontology class and maps
its fields to properties. Set `autoType: true` so inserted documents are typed as
the class (the bridge). `MappingType` kind is one of `data_property`,
`object_property`, `vector_property` (the last also carries `collection`).

```php
use OxidDb\Client\Model\RegisterMappingRequest;
use OxidDb\Client\Model\FieldMapping;
use OxidDb\Client\Model\MappingType;

$oxid->registerMapping(new RegisterMappingRequest(
    collection: 'beer_catalog',
    class: 'Beer',
    fieldMappings: [
        new FieldMapping('abv',  'hasAbv',   new MappingType('data_property')),
        new FieldMapping('vec',  'hasVector', new MappingType('vector_property', 'demo_beers')),
    ],
    autoType: true,
));
```

(There is also a transactional `Transaction::registerMapping()`, but its `embed`
auto-embed config is NOT applied transactionally; use the client method for `embed`.
`src/Transaction.php:192`.)

### transaction

method: `OxidClient::transaction(callable $fn): mixed`, `src/OxidClient.php:698`
method: `OxidClient::begin(): Transaction`, `src/OxidClient.php:681`
method: `Transaction::insert(TxnInsertRequest $request): int`, `src/Transaction.php:128`
method: `TxnInsertRequest::__construct(string $iri, string $class, ?string $text = null, ?array $vector = null, ?string $collection = null)`, `src/Model/TxnInsertRequest.php:15`

`transaction()` opens a `POST /txn`, runs the callback, commits if it returns
normally, and rolls back (best-effort) if it throws, re-raising the original
throwable. The callback must not commit/rollback itself. The transaction id is
server-assigned and non-deterministic, never assume 1. `Transaction::insert()`
returns the interned Term id (int).

```php
use OxidDb\Client\Transaction;
use OxidDb\Client\Model\TxnInsertRequest;

// Scope helper, commits on success, rolls back on throw.
$oxid->transaction(function (Transaction $tx): void {
    $tx->insert(new TxnInsertRequest('Duvel', 'Beer', vector: [0.2, 0.4, 0.1, 0.3], collection: 'demo_beers'));
    $tx->insert(new TxnInsertRequest('Chimay', 'Beer'));
});

// Manual control, begin / rollback explicitly.
$tx = $oxid->begin();
$term = $tx->insert(new TxnInsertRequest('Ghost', 'Beer'));  // returns interned Term id
$rollback = $tx->rollback();                                 // Ghost discarded
printf("rolled back txn %d (state=%s)\n", $tx->id(), $rollback->state);
```

(Other `Transaction` mutators: `addSubclass`, `addDisjoint`, `addObjectProperty`,
`addAnnotation`, `insertIntoCollection`, `upsertVector`, `insertDocument`,
`updateDocument`, `deleteDocument`, `bulkInsertDocuments`, `registerMapping`,
`unregisterMapping`, `setEmbedderConfig`, plus `savepoint()` / `rollbackTo()` , 
`src/Transaction.php`.)

### predict_links

method: `OxidClient::predictLinks(PredictLinksRequest $request): PredictLinksResponse`, `src/OxidClient.php:511`
method: `PredictLinksRequest::__construct(string $head, ?string $relation = null, ?string $model = null, ?int $topK = null, ?bool $onlyConsistent = null)`, `src/Model/PredictLinksRequest.php:12`
method (train first): `OxidClient::train(TrainRequest $request): TrainResponse`, `src/OxidClient.php:505`

`POST /predict-links`, KGE link prediction, reasoner-vetted. The field is
**`top_k`, not `k`** (ctor arg `topK`). Train KGE embeddings first with `train()`
(all `TrainRequest` fields optional; may serialize to `{}`).

```php
use OxidDb\Client\Model\TrainRequest;
use OxidDb\Client\Model\PredictLinksRequest;

$oxid->train(new TrainRequest());                    // POST /train (defaults)

$pred = $oxid->predictLinks(new PredictLinksRequest(
    head: 'Heineken',
    relation: 'pairsWith',
    topK: 5,
    onlyConsistent: true,
));
printf("model=%s tier=%s stale=%s\n", $pred->model, $pred->tier, $pred->stale ? 'true' : 'false');
foreach ($pred->candidates as $c) {
    // LinkCandidate: h, r, t, score, rank, consistent, verdict
    printf("  %s -%s-> %s  score=%.4f verdict=%s\n", $c->h, $c->r, $c->t, $c->score, $c->verdict);
}
```

(`PredictLinksResponse` fields: `tier`, `provenance`, `model`, `kind`, `stale`,
`trainedAboxTriples`, `candidates`, `src/Model/PredictLinksResponse.php:15`.
`LinkCandidate`: `h`, `r`, `t`, `score`, `rank`, `consistent`, `verdict` , 
`src/Model/LinkCandidate.php:12`.)

### import_owl

method: `OxidClient::importOwl(string $owl): ImportResponse`, `src/OxidClient.php:446`

`POST /import/owl` with the **raw OWL / RDF-XML text** as the body
(`Content-Type: application/rdf+xml`). The SDK takes a string, not a file path , 
read the file yourself.

```php
$owl = file_get_contents('beverages.owl');       // raw RDF/XML string
$res = $oxid->importOwl($owl);
printf("ok=%s classes=%d individuals=%d axioms=%d\n",
    $res->ok ? 'true' : 'false',
    $res->classesAdded, $res->individualsAdded, $res->axiomsAdded);
foreach ($res->warnings as $w) {
    echo "  warn: $w\n";
}
```

(`ImportResponse` fields: `ok`, `classesAdded`, `individualsAdded`, `axiomsAdded`,
`warnings`, `src/Model/ImportResponse.php:15`.)

### import_csv

method: `OxidClient::importCsv(string $csv): ImportResponse`, `src/OxidClient.php:440`

`POST /import/csv` with the **raw CSV text** as the body
(`Content-Type: text/csv; charset=utf-8`). String in, `ImportResponse` out.

```php
$csv = <<<CSV
individual,class
Heineken,Pilsner
Guinness,Stout
Merlot,Wine
CSV;

$res = $oxid->importCsv($csv);
printf("ok=%s classes=%d individuals=%d axioms=%d\n",
    $res->ok ? 'true' : 'false',
    $res->classesAdded, $res->individualsAdded, $res->axiomsAdded);
```

---

## Errors (context)

All errors extend `OxidDb\Client\Error\OxidException`. Governed writes
(`assertTyped`, `addAxiom`) return **HTTP 200 whether committed or vetoed**, branch
on the `committed` field of `ActionResult`, never on an exception
(`src/OxidClient.php:471-483`, `examples/governed_write.php`).

```php
use OxidDb\Client\Model\AssertTypedRequest;

$verdict = $oxid->assertTyped(new AssertTypedRequest('Heineken', 'Wine'));  // Beer⊓Wine=⊥
if (!$verdict->committed) {
    foreach ($verdict->violations ?? [] as $v) {
        printf("veto: %s disjoint (%s / %s), %s\n", $v->individual, $v->classA, $v->classB, $v->reason);
    }
}
```
