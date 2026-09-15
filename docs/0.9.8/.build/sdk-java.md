# Oxid-DB Java SDK: verified usage snippets

All snippets below are extracted from the real source of `sdk/oxiddb-java-sdk`
(client class, builders, transaction handle, and immutable Jackson record models).
Method signatures are cited to their file. Beverage data (Beer / Pilsner / Stout /
Wine, 4-dim vectors) and base URL `https://85cfad134a4a.oxid-db.com` are used throughout.

Snippets assume you are inside a method; the client is constructed once (see
`client-init`). Package roots: `db.oxid.client`, `db.oxid.client.model`,
`db.oxid.client.oxql`.

## install

Maven coordinate (from `pom.xml`, `groupId` `db.oxid`, `artifactId`
`oxid-client`, `version` `0.9.4`). Requires Java 17+.

```xml
<dependency>
  <groupId>db.oxid</groupId>
  <artifactId>oxid-client</artifactId>
  <version>0.9.4</version>
</dependency>
```

Gradle one-liner:

```groovy
implementation 'db.oxid:oxid-client:0.9.4'
```

> Coordinates are provisional / unpublished (README + `TODO.md`): the `db.oxid`
> Maven Central namespace and license are resolved at publish time; nothing is
> pushed to a repository yet. Only runtime dependency is Jackson
> (`jackson-databind`); transport is the JDK built-in `java.net.http.HttpClient`.

## client-init

`method: static OxidClientBuilder OxidClient.builder()` (OxidClient.java:44)
`method: OxidClient OxidClientBuilder.build()` (OxidClientBuilder.java:110)

The client is immutable and thread-safe; build one and share it as a singleton.
`baseUrl` defaults to `https://85cfad134a4a.oxid-db.com` (or `$OXID_ENDPOINT`); the bearer
token defaults to `$OXID_TOKEN` and is optional on loopback.

```java
import db.oxid.client.*;
import db.oxid.client.model.*;
import db.oxid.client.oxql.Oxql;
import java.time.Duration;

OxidClient oxid = OxidClient.builder()
        .baseUrl("https://85cfad134a4a.oxid-db.com")            // or $OXID_ENDPOINT
        .bearerToken(System.getenv("OXID_TOKEN"))    // optional on loopback
        .requestTimeout(Duration.ofSeconds(30))
        .build();
```

### connect

There is no separate `connect` call, the client is lazy and pooled; the first
request opens the connection. Use `health()` to prove reachability.

`method: Health.HealthResponse health()` (OxidClient.java:55), `GET /health`, always 200.

```java
Health.HealthResponse h = oxid.health();   // record HealthResponse(String status)
System.out.println(h.status());            // "ok"
```

### ready

`method: Health.ReadyResponse ready()` (OxidClient.java:60), `GET /ready`; returns
the body for both 200 (ready) and 503 (not-yet-classified). Branch on `status()`.

```java
Health.ReadyResponse r = oxid.ready();
if (!"ready".equals(r.status())) {
    // r.checks() carries databaseLoaded / classificationCurrent / consistent
    oxid.classify();   // e.g. classify to become ready
}
```

### add_subclass

`method: void addSubclass(Mutation.SubclassRequest req)` (OxidClient.java:221), `POST /subclass`.
Record: `Mutation.SubclassRequest(String sub, String sup)` (Mutation.java:77).

```java
// Pilsner ⊑ Beer  (sub, sup)
oxid.addSubclass(new Mutation.SubclassRequest("Pilsner", "Beer"));
oxid.addSubclass(new Mutation.SubclassRequest("Stout", "Beer"));
```

### add_disjoint

`method: void addDisjoint(Mutation.DisjointRequest req)` (OxidClient.java:225), `POST /disjoint`.
Record: `Mutation.DisjointRequest(String a, String b)` (Mutation.java:81).

```java
// Beer and Wine are disjoint
oxid.addDisjoint(new Mutation.DisjointRequest("Beer", "Wine"));
```

### insert_individual

`method: Mutation.OkResponse insert(Mutation.InsertRequest req)` (OxidClient.java:193), `POST /insert`.
Record: `Mutation.InsertRequest(String individual, String iri, @JsonProperty("class") String className,
List<String> classes, String text, double[] vector, String collection)` (Mutation.java:20);
factory `InsertRequest.of(String individual, String className)` (Mutation.java:29).
Note the wire traps: the field is `class` (singular) or `classes` (plural), and the
subject field is `individual` (or its `iri` alias). Supply one form.

```java
// Simple: individual + single class (no vector)
oxid.insert(Mutation.InsertRequest.of("Heineken", "Pilsner"));

// Full form: individual + class + 4-dim vector into a named collection
oxid.insert(new Mutation.InsertRequest(
        "Guinness", null, "Stout", null, null,
        new double[] {0.1, 0.2, 0.3, 0.4}, "beverages"));
```

### classify

`method: Ops.ClassifyResponse classify()` (OxidClient.java:355), `POST /classify`.
Response: `Ops.ClassifyResponse(boolean ok, boolean consistent, boolean coherent,
int violations, List<ViolationWitness> violationWitnesses, List<String> unsatisfiable)`
(Ops.java:23).

```java
Ops.ClassifyResponse cl = oxid.classify();
if (cl.ok() && cl.consistent()) {
    // reasoner ran; inferred classes are now available on individuals
}
```

### query

`method: Query.QueryResponse query(Query.QueryRequest req)` (OxidClient.java:90), `POST /query`, one page.
Record: `Query.QueryRequest(String query, String cursor, Object hydrate)` (Query.java:15);
factory `QueryRequest.of(String query)` (Query.java:18). OxQL travels as an opaque
string, use `Oxql.quote(...)` for literals (Oxql.java:18).

```java
Query.QueryResponse page = oxid.query(
        Query.QueryRequest.of("FIND ?x WHERE ?x IS-A " + Oxql.quote("Beer")));
for (Query.QueryHit hit : page.results()) {   // QueryHit(iri, score, fields, dataProperties, objectProperties)
    System.out.println(hit.iri());
}
String next = page.nextCursor();              // null on the last page
```

Optional fluent OxQL assembly (`QueryBuilder`, string-only; feed `.toOxql()` into a request):

```java
// method: String QueryBuilder.toOxql()  (QueryBuilder.java:138)
String oxql = new QueryBuilder().find("x").isA("Beer").limit(5).toOxql();
// -> "FIND ?x WHERE ?x IS-A Beer LIMIT 5"
Query.QueryResponse p = oxid.query(Query.QueryRequest.of(oxql));
```

### query_all

`method: Iterable<Query.QueryHit> queryAll(Query.QueryRequest req)` (OxidClient.java:95).
Lazy cursor iterator: follows `next_cursor` across all pages to exhaustion.

```java
for (Query.QueryHit hit : oxid.queryAll(Query.QueryRequest.of("FIND ?x WHERE ?x IS-A Beer"))) {
    System.out.println(hit.iri());
}
```

### vector_search

No dedicated `vectorSearch` method exists. Nearest-neighbor is exposed two ways:

1) By reference IRI, `method: Individuals.IndividualSimilarResponse individualSimilar(String iri, int k, String collection)`
(OxidClient.java:155), and a `k`-less overload `individualSimilar(String iri)` (OxidClient.java:150).
`k <= 0` and `collection == null` use the server defaults. Response:
`IndividualSimilarResponse(String reference, String collection, List<SimilarHit> results)`
where `SimilarHit(String iri, double score)` (Individuals.java:23,27).

```java
// 3 nearest neighbours of Heineken in the default collection
Individuals.IndividualSimilarResponse sim = oxid.individualSimilar("Heineken", 3, null);
for (Individuals.SimilarHit hit : sim.results()) {
    System.out.println(hit.iri() + " " + hit.score());
}
```

2) By raw vector, via OxQL `NEAR` in a normal `query()`. `QueryBuilder.near(double[])`
(QueryBuilder.java:77) assembles the clause:

```java
String oxql = new QueryBuilder()
        .find("x").isA("Beer")
        .near(new double[] {0.9, 0.1, 0.5, 0.2})
        .limit(5)
        .toOxql();
// -> "FIND ?x WHERE ?x IS-A Beer AND NEAR ?x TO [0.9, 0.1, 0.5, 0.2] LIMIT 5"
Query.QueryResponse hits = oxid.query(Query.QueryRequest.of(oxql));
```

### create_collection

`method: void createCollection(Collections.CreateCollectionRequest req)` (OxidClient.java:229), `POST /collections`.
Record: `Collections.CreateCollectionRequest(String name, int dimensions, String metric,
String quantization, Boolean coldF32)` (Collections.java:23); factory
`CreateCollectionRequest.of(String name, int dimensions)` (Collections.java:30).
Note: the field is `dimensions`, not `dim`.

```java
// 4-dim vector collection for beverage embeddings
oxid.createCollection(Collections.CreateCollectionRequest.of("beverages", 4));
```

### insert_document

`method: Documents.InsertDocumentResponse insertDocument(String collection, Map<String, Object> doc)`
(OxidClient.java:429), `POST /documents/{collection}`. A document is a plain
`Map<String, Object>`. Response: `InsertDocumentResponse(boolean ok, String collection, String iri)`
(Documents.java:59).

```java
import java.util.Map;

Documents.InsertDocumentResponse res = oxid.insertDocument("beverages", Map.of(
        "id", "Heineken",
        "name", "Heineken",
        "style", "Pilsner",
        "abv", 5.0));
System.out.println(res.iri());
```

### bulk_import_documents

Two real methods cover this; both `POST /documents/{collection}/...`:

`method: Documents.BulkInsertDocumentsResponse bulkInsertDocuments(String collection, List<Map<String, Object>> docs)`
(OxidClient.java:433), `POST /documents/{collection}/bulk` (JSON array of docs).
Response: `BulkInsertDocumentsResponse(boolean ok, String collection, int inserted,
int upserts, int indexesBuilt, List<BulkInsertResult> results, Boolean resultsTruncated)`
(Documents.java:71).

```java
import java.util.List;
import java.util.Map;

Documents.BulkInsertDocumentsResponse res = oxid.bulkInsertDocuments("beverages", List.of(
        Map.of("id", "Pilsner-Urquell", "style", "Pilsner", "abv", 4.4),
        Map.of("id", "Guinness",        "style", "Stout",   "abv", 4.2),
        Map.of("id", "Cabernet",        "style", "Wine",    "abv", 13.5)));
System.out.println(res.inserted());
```

`method: Documents.ImportNdjsonResponse importDocumentsNdjson(String collection, String ndjson)`
(OxidClient.java:438), `POST /documents/{collection}/import` (`application/x-ndjson`,
one JSON doc per line). Response: `ImportNdjsonResponse(boolean ok, String collection,
int imported, int upserts)` (Documents.java:81).

```java
String ndjson = String.join("\n",
        "{\"id\":\"Pilsner-Urquell\",\"style\":\"Pilsner\"}",
        "{\"id\":\"Guinness\",\"style\":\"Stout\"}");
Documents.ImportNdjsonResponse res = oxid.importDocumentsNdjson("beverages", ndjson);
```

### map_collection_to_class

`method: Documents.RegisterMappingResponse registerMapping(Documents.RegisterMappingRequest req)`
(OxidClient.java:421), `POST /collections/map`. Record:
`RegisterMappingRequest(String collection, @JsonProperty("class") String className,
List<FieldMapping> fieldMappings, Boolean autoType, EmbedConfig embed)` (Documents.java:37);
factory `RegisterMappingRequest.of(String collection, String className, List<FieldMapping> fieldMappings)`
(Documents.java:44). `FieldMapping(String field, String property, MappingType type)`
with tagged `MappingType.dataProperty()` / `.objectProperty()` / `.vectorProperty(collection)`
(Documents.java:15-27).

```java
import java.util.List;

oxid.registerMapping(Documents.RegisterMappingRequest.of(
        "beverages", "Beer",
        List.of(
            new Documents.FieldMapping("style", "hasStyle", Documents.MappingType.dataProperty()),
            new Documents.FieldMapping("abv",   "hasAbv",   Documents.MappingType.dataProperty()))));
```

One-shot alternative, `method: Collections.ProvisionResponse provisionCollection(Collections.ProvisionRequest req)`
(OxidClient.java:239, `POST /collections/provision`) can create the vector
collection and/or bind a document collection to a class in a single call
(`Collections.ProvisionBinding.of("beverages", "Beer")`).

### transaction

Two forms. Closure form , 
`method: <T> T transaction(Function<Transaction, T> fn)` (OxidClient.java:476):
commits when `fn` returns, rolls back (best-effort) if it throws, re-raising the
original exception.

```java
oxid.transaction(tx -> {
    tx.insert(Txn.TxnInsertRequest.of("Duvel", "Beer"));                     // returns interned Term (int)
    tx.addSubclass(new Mutation.SubclassRequest("Tripel", "Beer"));
    return null;
});
```

Manual form, `method: Transaction beginTransaction()` (OxidClient.java:467, `POST /txn`)
with try-with-resources; `close()` rolls back if not committed.
`method: Txn.TxnCommitResponse Transaction.commit()` (Transaction.java:55),
`method: int Transaction.insert(Txn.TxnInsertRequest req)` (Transaction.java:106),
`Txn.TxnInsertRequest.of(String iri, String className)` (Txn.java:48).

```java
try (Transaction tx = oxid.beginTransaction()) {
    int term = tx.insert(Txn.TxnInsertRequest.of("Chimay", "Beer"));
    tx.addSubclass(new Mutation.SubclassRequest("Quadrupel", "Beer"));
    tx.commit();
}   // close() rolls back if commit() was not called
```

### predict_links

`method: Kge.PredictLinksResponse predictLinks(Kge.PredictLinksRequest req)` (OxidClient.java:394), `POST /predict-links`.
Record: `Kge.PredictLinksRequest(String head, String relation, String model, Integer topK,
Boolean onlyConsistent)` (Kge.java:11); factory `PredictLinksRequest.of(String head)`
(Kge.java:14). Note the wire field is `top_k`, not `k`. Response carries
`List<LinkCandidate>` where `LinkCandidate(String h, String r, String t, double score,
int rank, boolean consistent, String verdict)` (Kge.java:20,25). Requires a trained
KGE model first: `method: Ops.TrainResponse train(Ops.TrainRequest req)` (OxidClient.java:390, `POST /train`).

```java
// Optional: train a KGE model over the ABox first
oxid.train(Ops.TrainRequest.defaults());

// Predict tails for (Heineken, ?relation, ?)
Kge.PredictLinksRequest req =
        new Kge.PredictLinksRequest("Heineken", "similarTo", null, 5, true);
Kge.PredictLinksResponse pred = oxid.predictLinks(req);
for (Kge.LinkCandidate c : pred.candidates()) {
    System.out.println(c.h() + " -" + c.r() + "-> " + c.t()
            + " score=" + c.score() + " verdict=" + c.verdict());
}
```

### import_owl

`method: Ops.ImportResponse importOwl(String owl)` (OxidClient.java:349), `POST /import/owl`
(`application/rdf+xml`; the OWL is the raw request body string). Response:
`Ops.ImportResponse(boolean ok, int classesAdded, int individualsAdded, int axiomsAdded,
List<String> warnings)` (Ops.java:114).

```java
String owlRdfXml = """
    <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
             xmlns:owl="http://www.w3.org/2002/07/owl#">
      <owl:Class rdf:about="Beer"/>
      <owl:Class rdf:about="Pilsner"><rdfs:subClassOf rdf:resource="Beer"/></owl:Class>
    </rdf:RDF>
    """;
Ops.ImportResponse res = oxid.importOwl(owlRdfXml);
System.out.println(res.classesAdded() + " classes, " + res.axiomsAdded() + " axioms");
```

### import_csv

`method: Ops.ImportResponse importCsv(String csv)` (OxidClient.java:345), `POST /import/csv`
(`text/csv; charset=utf-8`; the CSV is the raw request body string). Same
`Ops.ImportResponse` shape as `importOwl` (Ops.java:114).

```java
String csv = String.join("\n",
        "individual,class,abv",
        "Heineken,Pilsner,5.0",
        "Guinness,Stout,4.2",
        "Cabernet,Wine,13.5");
Ops.ImportResponse res = oxid.importCsv(csv);
System.out.println(res.individualsAdded() + " individuals imported");
```

---

## Notes

- OxQL `SORT` is a no-op over HTTP; wire order is IRI, or score-then-IRI.
- Gated writes (`assertTyped`, `addAxiom`/`addEquivalent`, `upsertEntity` with
  `gate`) return HTTP 200 whether committed or vetoed, branch on the boolean
  (`committed()` / `ok()`), then inspect `violations()` / `unsatisfiable()`.
- Errors are an unchecked hierarchy under `OxidException` (`OxidHttpException` with
  `status()`/`code()`/`body()`, `OxidNetworkException`, `OxidDecodeException`,
  `OxidUsageException`).
