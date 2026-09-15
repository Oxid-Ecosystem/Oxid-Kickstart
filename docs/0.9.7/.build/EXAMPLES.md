# Oxid-DB 0.9.7: multi-SDK code-tab examples (paste-ready)

Assembled from the per-language snippet files in `.build/` (Python, TypeScript, Go,
Java, PHP, C#) plus the cURL requests in `.build/api-oxql.md`. Every HTML block below
follows the tab-group markup + escaping rules in `_AUTHORING.md`. Code is copied from
the source snippets, nothing is invented. A language's tab is omitted for an operation
only when that SDK genuinely does not implement it.

Base URL throughout: `https://85cfad134a4a.oxid-db.com`.

## install-matrix

| Language | Package | Install command | Import / using |
|---|---|---|---|
| Python | `oxiddb-client` (import `oxiddb_client`) | `pip install oxiddb-client` | `from oxiddb_client import OxidDB` |
| TypeScript | `@oxiddb/node` | `npm i @oxiddb/node` | `import { OxidClient } from "@oxiddb/node";` |
| Go | `github.com/moonlight-array/oxid-go` | `go get github.com/moonlight-array/oxid-go` | `import oxid "github.com/moonlight-array/oxid-go"` |
| Java | `db.oxid:oxid-client:0.9.4` | `implementation 'db.oxid:oxid-client:0.9.4'` (Maven `<dependency>` also) | `import db.oxid.client.*;` |
| PHP | `oxiddb/client` (ns `OxidDb\Client`) | `composer require oxiddb/client guzzlehttp/guzzle` | `use OxidDb\Client\OxidClient;` |
| C# | `OxidDb.Client` | `dotnet add package OxidDb.Client --version 0.9.4` | `using OxidDb.Client;` |

## sdk-parity

`✅` = a first-class SDK method (or, for `connect` / `vector_search`, the idiomatic
construct the SDK ships). `HTTP only` = no dedicated method; call the raw endpoint.

| Operation | cURL | Python | TypeScript | Go | Java | PHP | C# |
|---|---|---|---|---|---|---|---|
| connect | n/a | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ready | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| add_subclass | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| add_disjoint | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| insert_individual | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| classify | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| query | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| query_all | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| vector_search | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| create_collection | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| insert_document | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| bulk_import_documents | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| map_collection_to_class | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| transaction | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| predict_links | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| import_owl | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| import_csv | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

> Notes: `vector_search` has no method by that name in any SDK, every language
> expresses it as OxQL `NEAR ?x TO [...]` via `query()` and/or a reference-vector
> `individualSimilar()` call, so it is marked `✅` for the idiomatic path. `connect`
> likewise has no method: each SDK constructs a client then probes with `health()`.

## connect

<div class="code-tabs" data-tabs>
  <div class="code-tabs-bar" role="tablist">
    <button class="code-tab" data-lang="python">Python</button>
    <button class="code-tab" data-lang="typescript">TypeScript</button>
    <button class="code-tab" data-lang="go">Go</button>
    <button class="code-tab" data-lang="java">Java</button>
    <button class="code-tab" data-lang="php">PHP</button>
    <button class="code-tab" data-lang="csharp">C#</button>
  </div>
  <div class="code-panel" data-lang="python">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>from oxiddb_client import OxidDB

# No connect() factory: construct directly; the client is lazy.
with OxidDB("https://85cfad134a4a.oxid-db.com", auth="my-token", timeout=30.0) as db:
    print(db.health())   # {"status": "ok"}</code></pre>
  </div>
  <div class="code-panel" data-lang="typescript">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>import { OxidClient } from "@oxiddb/node";

// No connect(), construct then probe with a liveness ping.
const db = new OxidClient({ baseUrl: "https://85cfad134a4a.oxid-db.com" });
const h = await db.health(); // { status: "ok" }
console.log(h.status);</code></pre>
  </div>
  <div class="code-panel" data-lang="go">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>package main

import (
	"context"
	"log"
	"time"

	oxid "github.com/moonlight-array/oxid-go"
)

func main() {
	client, err := oxid.New("https://85cfad134a4a.oxid-db.com",
		oxid.WithBearerToken(""),         // auth off by default on loopback
		oxid.WithTimeout(30*time.Second),
	)
	if err != nil {
		log.Fatal(err)
	}
	defer client.Close()

	h, err := client.Health(context.Background())
	if err != nil {
		log.Fatalf("health: %v", err)
	}
	log.Println("status:", h.Status)
}</code></pre>
  </div>
  <div class="code-panel" data-lang="java">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>import db.oxid.client.*;
import db.oxid.client.model.*;
import java.time.Duration;

OxidClient oxid = OxidClient.builder()
        .baseUrl("https://85cfad134a4a.oxid-db.com")            // or $OXID_ENDPOINT
        .bearerToken(System.getenv("OXID_TOKEN"))    // optional on loopback
        .requestTimeout(Duration.ofSeconds(30))
        .build();

Health.HealthResponse h = oxid.health();
System.out.println(h.status());                      // "ok"</code></pre>
  </div>
  <div class="code-panel" data-lang="php">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>&lt;?php

require __DIR__ . '/vendor/autoload.php';

use OxidDb\Client\OxidClient;
use OxidDb\Client\OxidClientOptions;

$oxid = new OxidClient(new OxidClientOptions(
    endpoint: 'https://85cfad134a4a.oxid-db.com',        // or env OXID_ENDPOINT
    token: getenv('OXID_TOKEN') ?: null,      // optional bearer; off by default
));

$health = $oxid-&gt;health();          // GET /health
echo $health-&gt;status, "\n";          // "ok"</code></pre>
  </div>
  <div class="code-panel" data-lang="csharp">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>using OxidDb.Client;

using var oxid = OxidClient.Create(o =&gt;
{
    o.Endpoint = new Uri("https://85cfad134a4a.oxid-db.com");
    o.Auth     = Environment.GetEnvironmentVariable("OXID_TOKEN");
    o.Timeout  = TimeSpan.FromSeconds(30);
});

HealthResponse health = await oxid.HealthAsync();
Console.WriteLine(health.Status); // "ok"</code></pre>
  </div>
</div>

## ready

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
    <pre><code>curl -s https://85cfad134a4a.oxid-db.com/ready</code></pre>
  </div>
  <div class="code-panel" data-lang="python">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>with OxidDB("https://85cfad134a4a.oxid-db.com") as db:
    status = db.ready()
    print(status.get("ready"))</code></pre>
  </div>
  <div class="code-panel" data-lang="typescript">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>const r = await db.ready();
if (r.status === "ready") {
  console.log(`up ${r.uptime_seconds}s, ${r.checks.individuals} individuals`);
} else {
  console.warn("not ready yet, run classify() first");
}</code></pre>
  </div>
  <div class="code-panel" data-lang="go">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>r, err := client.Ready(ctx)
if err != nil {
	log.Fatalf("ready: %v", err)
}
// r.Status is "ready" (200) or "not_ready" (503).
if r.Status != "ready" {
	log.Printf("not ready yet: classified=%v consistent=%v",
		r.Checks.ClassificationCurrent, r.Checks.Consistent)
}</code></pre>
  </div>
  <div class="code-panel" data-lang="java">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>Health.ReadyResponse r = oxid.ready();
if (!"ready".equals(r.status())) {
    // r.checks() carries databaseLoaded / classificationCurrent / consistent
    oxid.classify();   // e.g. classify to become ready
}</code></pre>
  </div>
  <div class="code-panel" data-lang="php">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>$ready = $oxid-&gt;ready();                         // GET /ready (200 or 503 both parsed)
echo $ready-&gt;status, "\n";                       // "ready" | "not_ready"
echo $ready-&gt;version, "\n";
printf("uptime: %.1fs\n", $ready-&gt;uptimeSeconds);</code></pre>
  </div>
  <div class="code-panel" data-lang="csharp">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>ReadyResponse ready = await oxid.ReadyAsync();
Console.WriteLine($"{ready.Status}, {ready.Checks.Classes} classes, " +
                  $"{ready.Checks.Individuals} individuals, classified={ready.Checks.ClassificationCurrent}");</code></pre>
  </div>
</div>

## add_subclass

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
    <pre><code>curl -s -X POST https://85cfad134a4a.oxid-db.com/subclass \
  -H 'Content-Type: application/json' \
  -d '{"sub":"Pilsner","sup":"Beer"}'</code></pre>
  </div>
  <div class="code-panel" data-lang="python">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>with OxidDB("https://85cfad134a4a.oxid-db.com") as db:
    db.add_subclass("Pilsner", "Beer")
    db.add_subclass("Stout", "Beer")</code></pre>
  </div>
  <div class="code-panel" data-lang="typescript">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>// Pilsner ⊑ Beer, Stout ⊑ Beer  (sub is the child, sup the parent)
await db.addSubclass({ sub: "Pilsner", sup: "Beer" });
await db.addSubclass({ sub: "Stout", sup: "Beer" });</code></pre>
  </div>
  <div class="code-panel" data-lang="go">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>for _, sc := range []oxid.SubclassRequest{
	{Sub: "Pilsner", Sup: "Beer"},
	{Sub: "Stout", Sup: "Beer"},
} {
	if err := client.AddSubclass(ctx, sc); err != nil {
		log.Fatalf("subclass %s ⊑ %s: %v", sc.Sub, sc.Sup, err)
	}
}</code></pre>
  </div>
  <div class="code-panel" data-lang="java">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>// Pilsner ⊑ Beer  (sub, sup)
oxid.addSubclass(new Mutation.SubclassRequest("Pilsner", "Beer"));
oxid.addSubclass(new Mutation.SubclassRequest("Stout", "Beer"));</code></pre>
  </div>
  <div class="code-panel" data-lang="php">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>use OxidDb\Client\Model\SubclassRequest;

$oxid-&gt;addSubclass(new SubclassRequest('Beer', 'Beverage'));    // Beer ⊑ Beverage
$oxid-&gt;addSubclass(new SubclassRequest('Pilsner', 'Beer'));     // Pilsner ⊑ Beer</code></pre>
  </div>
  <div class="code-panel" data-lang="csharp">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>// Pilsner ⊑ Beer, Stout ⊑ Beer
await oxid.AddSubclassAsync(new SubclassRequest("Pilsner", "Beer"));
await oxid.AddSubclassAsync(new SubclassRequest("Stout", "Beer"));</code></pre>
  </div>
</div>

## add_disjoint

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
    <pre><code>curl -s -X POST https://85cfad134a4a.oxid-db.com/disjoint \
  -H 'Content-Type: application/json' \
  -d '{"a":"Beer","b":"Wine"}'</code></pre>
  </div>
  <div class="code-panel" data-lang="python">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>with OxidDB("https://85cfad134a4a.oxid-db.com") as db:
    db.add_disjoint("Beer", "Wine")</code></pre>
  </div>
  <div class="code-panel" data-lang="typescript">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>// Nothing is both a Beer and a Wine.
await db.addDisjoint({ a: "Beer", b: "Wine" });</code></pre>
  </div>
  <div class="code-panel" data-lang="go">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>// Beer and Wine are disjoint: nothing can be both.
if err := client.AddDisjoint(ctx, oxid.DisjointRequest{A: "Beer", B: "Wine"}); err != nil {
	log.Fatalf("disjoint: %v", err)
}</code></pre>
  </div>
  <div class="code-panel" data-lang="java">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>// Beer and Wine are disjoint
oxid.addDisjoint(new Mutation.DisjointRequest("Beer", "Wine"));</code></pre>
  </div>
  <div class="code-panel" data-lang="php">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>use OxidDb\Client\Model\DisjointRequest;

$oxid-&gt;addDisjoint(new DisjointRequest('Beer', 'Wine'));   // POST /disjoint, Beer ⊓ Wine = ⊥</code></pre>
  </div>
  <div class="code-panel" data-lang="csharp">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>// A beverage cannot be both a Beer and a Wine.
await oxid.AddDisjointAsync(new DisjointRequest("Beer", "Wine"));</code></pre>
  </div>
</div>

## insert_individual

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
    <pre><code>curl -s -X POST https://85cfad134a4a.oxid-db.com/insert \
  -H 'Content-Type: application/json' \
  -d '{"iri":"Heineken","class":"Lager","vector":[0.6,0.3,0.1,0.6]}'</code></pre>
  </div>
  <div class="code-panel" data-lang="python">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>with OxidDB("https://85cfad134a4a.oxid-db.com") as db:
    res = db.insert("Heineken", "Pilsner", vector=[0.4, 0.2, 0.1, 0.4])
    # res: {"iri": "Heineken", ...}</code></pre>
  </div>
  <div class="code-panel" data-lang="typescript">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>// Identity is `individual` (or alias `iri`); membership is `class` (or `classes[]`).
await db.insert({ individual: "Heineken", class: "Pilsner", vector: [0.4, 0.2, 0.1, 0.4] });
await db.insert({ iri: "Guinness", class: "Stout", vector: [0.9, 0.3, 0.0, 0.7] });</code></pre>
  </div>
  <div class="code-panel" data-lang="go">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>res, err := client.Insert(ctx, oxid.InsertRequest{
	Individual: "PilsnerUrquell",
	Class:      "Pilsner",
	Vector:     []float64{0.9, 0.1, 0.0, 0.2}, // 4-dim
})
if err != nil {
	log.Fatalf("insert: %v", err)
}
_ = res</code></pre>
  </div>
  <div class="code-panel" data-lang="java">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>// Simple: individual + single class (no vector)
oxid.insert(Mutation.InsertRequest.of("Heineken", "Pilsner"));

// Full form: individual + class + 4-dim vector into a named collection
oxid.insert(new Mutation.InsertRequest(
        "Guinness", null, "Stout", null, null,
        new double[] {0.1, 0.2, 0.3, 0.4}, "beverages"));</code></pre>
  </div>
  <div class="code-panel" data-lang="php">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>use OxidDb\Client\Model\InsertRequest;

$res = $oxid-&gt;insert(new InsertRequest(
    'Heineken',
    'Pilsner',
    vector: [0.6, 0.3, 0.1, 0.6],
    collection: 'demo_beers',
));
echo $res-&gt;ok ? "inserted\n" : "failed\n";</code></pre>
  </div>
  <div class="code-panel" data-lang="csharp">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>// Positional (single class), emits {"individual","class",...}
OkResponse ok = await oxid.InsertAsync(new InsertRequest(
    "Heineken", "Pilsner",
    Vector: new[] { 0.9, 0.1, 0.5, 0.2 }));

// Multi-class via the aliases, emits {"iri","classes":[...]}
await oxid.InsertAsync(new InsertRequest(
    Individual: null, Class: null,
    Iri: "Guinness", Classes: new List&lt;string&gt; { "Stout" },
    Vector: new[] { 0.1, 0.8, 0.3, 0.4 }));</code></pre>
  </div>
</div>

## classify

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
    <pre><code>curl -s -X POST https://85cfad134a4a.oxid-db.com/classify</code></pre>
  </div>
  <div class="code-panel" data-lang="python">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>with OxidDB("https://85cfad134a4a.oxid-db.com") as db:
    result = db.classify()
    print("consistent:", result.get("consistent"))</code></pre>
  </div>
  <div class="code-panel" data-lang="typescript">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>const c = await db.classify();
if (!c.consistent) {
  console.error(`inconsistent: ${c.violations} violation(s)`, c.violation_witnesses);
} else {
  console.log("consistent", c.coherent ? "and coherent" : "");
}</code></pre>
  </div>
  <div class="code-panel" data-lang="go">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>cls, err := client.Classify(ctx)
if err != nil {
	log.Fatalf("classify: %v", err)
}
log.Printf("consistent=%v coherent=%v violations=%d",
	cls.Consistent, cls.Coherent, cls.Violations)</code></pre>
  </div>
  <div class="code-panel" data-lang="java">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>Ops.ClassifyResponse cl = oxid.classify();
if (cl.ok() &amp;&amp; cl.consistent()) {
    // reasoner ran; inferred classes are now available on individuals
}</code></pre>
  </div>
  <div class="code-panel" data-lang="php">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>$classify = $oxid-&gt;classify();                       // POST /classify
printf("consistent=%s coherent=%s violations=%d\n",
    $classify-&gt;consistent ? 'true' : 'false',
    $classify-&gt;coherent   ? 'true' : 'false',
    $classify-&gt;violations,
);</code></pre>
  </div>
  <div class="code-panel" data-lang="csharp">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>ClassifyResponse res = await oxid.ClassifyAsync();
Console.WriteLine($"ok={res.Ok} consistent={res.Consistent} " +
                  $"coherent={res.Coherent} violations={res.Violations}");</code></pre>
  </div>
</div>

## query

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
  -d '{"query":"FIND ?x WHERE ?x IS-A Lager LIMIT 20"}'</code></pre>
  </div>
  <div class="code-panel" data-lang="python">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>with OxidDB("https://85cfad134a4a.oxid-db.com") as db:
    page = db.query("FIND ?x WHERE ?x IS-A Beer LIMIT 20")
    for hit in page.get("results", []):
        print(hit["iri"])</code></pre>
  </div>
  <div class="code-panel" data-lang="typescript">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>const page = await db.query({ query: "FIND ?x WHERE ?x IS-A Beer LIMIT 20" });
console.log(page.results.map((r) =&gt; r.iri));
console.log(page.total_count);</code></pre>
  </div>
  <div class="code-panel" data-lang="go">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>res, err := client.Query(ctx, oxid.QueryRequest{
	Query: "FIND ?x WHERE ?x IS-A " + oxid.Quote("Beer"),
})
if err != nil {
	log.Fatalf("query: %v", err)
}
log.Printf("matched %d (showing %d)", res.TotalCount, len(res.Results))
for _, hit := range res.Results {
	log.Println(" -", hit.IRI)
}</code></pre>
  </div>
  <div class="code-panel" data-lang="java">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>Query.QueryResponse page = oxid.query(
        Query.QueryRequest.of("FIND ?x WHERE ?x IS-A " + Oxql.quote("Beer")));
for (Query.QueryHit hit : page.results()) {
    System.out.println(hit.iri());
}
String next = page.nextCursor();              // null on the last page</code></pre>
  </div>
  <div class="code-panel" data-lang="php">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>use OxidDb\Client\Model\QueryRequest;

$page = $oxid-&gt;query(new QueryRequest('FIND ?x WHERE ?x IS-A Beverage'));
echo "total: {$page-&gt;totalCount}\n";
foreach ($page-&gt;results as $hit) {
    echo "  {$hit-&gt;iri}", $hit-&gt;score !== null ? " ({$hit-&gt;score})" : "", "\n";
}</code></pre>
  </div>
  <div class="code-panel" data-lang="csharp">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>QueryResponse page = await oxid.QueryAsync(
    new QueryRequest("FIND ?x WHERE ?x IS-A " + Oxql.Quote("Beer") + " LIMIT 20"));
Console.WriteLine($"{page.Results.Count} of {page.TotalCount} hit(s)");
foreach (QueryHit hit in page.Results)
{
    Console.WriteLine($"  {hit.Iri} (score={hit.Score})");
}</code></pre>
  </div>
</div>

## query_all

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
    <pre><code># Page by incrementing OFFSET by LIMIT until results is empty.
curl -s -X POST https://85cfad134a4a.oxid-db.com/query \
  -H 'Content-Type: application/json' \
  -d '{"query":"FIND ?x WHERE ?x IS-A Beer LIMIT 100 OFFSET 0"}'
# then resend with the returned next_cursor:
curl -s -X POST https://85cfad134a4a.oxid-db.com/query \
  -H 'Content-Type: application/json' \
  -d '{"query":"FIND ?x WHERE ?x IS-A Beer LIMIT 100","cursor":"eyJ0ZXJtIjoi..."}'</code></pre>
  </div>
  <div class="code-panel" data-lang="python">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>with OxidDB("https://85cfad134a4a.oxid-db.com") as db:
    for hit in db.query_all("FIND ?x WHERE ?x IS-A Beer"):
        print(hit["iri"])</code></pre>
  </div>
  <div class="code-panel" data-lang="typescript">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>const iris: string[] = [];
for await (const hit of db.queryAll({ query: "FIND ?x WHERE ?x IS-A Beer LIMIT 1000" })) {
  iris.push(hit.iri);
}
console.log(iris.length);</code></pre>
  </div>
  <div class="code-panel" data-lang="go">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>count := 0
for hit, err := range client.QueryAll(ctx, oxid.QueryRequest{Query: "FIND ?x WHERE ?x IS-A Beverage"}) {
	if err != nil {
		log.Fatalf("query-all: %v", err) // first error is terminal
	}
	count++
	log.Println(hit.IRI)
}
log.Printf("streamed %d hits across all pages", count)</code></pre>
  </div>
  <div class="code-panel" data-lang="java">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>for (Query.QueryHit hit : oxid.queryAll(Query.QueryRequest.of("FIND ?x WHERE ?x IS-A Beer"))) {
    System.out.println(hit.iri());
}</code></pre>
  </div>
  <div class="code-panel" data-lang="php">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>use OxidDb\Client\Model\QueryRequest;

foreach ($oxid-&gt;queryAll(new QueryRequest('FIND ?x WHERE ?x IS-A Beer')) as $hit) {
    echo $hit-&gt;iri, "\n";
}</code></pre>
  </div>
  <div class="code-panel" data-lang="csharp">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>var total = 0;
await foreach (QueryHit hit in oxid.QueryAllAsync(
    new QueryRequest("FIND ?x WHERE ?x IS-A Beverage")))
{
    total++;
    Console.WriteLine(hit.Iri);
}
Console.WriteLine($"drained {total} hit(s) across all pages");</code></pre>
  </div>
</div>

## vector_search

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
  -d '{"query":"FIND ?x WHERE ?x IS-A Beer AND NEAR ?x TO [0.9,0.1,0.5] LIMIT 5"}'</code></pre>
  </div>
  <div class="code-panel" data-lang="python">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>with OxidDB("https://85cfad134a4a.oxid-db.com") as db:
    # (1) literal query vector (dims must match the collection)
    hits = db.query("FIND ?x WHERE NEAR ?x TO [0.4, 0.2, 0.1, 0.4] LIMIT 5")
    for h in hits.get("results", []):
        print(h["iri"], h.get("score"))

    # (2) nearest neighbours of an existing individual
    sim = db.individual_similar("Heineken", k=3, collection="default")
    print([h["iri"] for h in sim.get("results", [])])</code></pre>
  </div>
  <div class="code-panel" data-lang="typescript">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>// 1) OxQL NEAR over /query, hybrid-capable (combine with IS-A). Rows carry `score`.
const near = await db.query({
  query: "FIND ?x WHERE ?x IS-A Beer AND NEAR ?x TO [0.9, 0.1, 0.5, 0.7] LIMIT 5",
});
for (const hit of near.results) console.log(hit.iri, hit.score);

// 2) By reference individual, top-k neighbors of an existing IRI.
const sim = await db.individualSimilar("Guinness", { k: 3, collection: "default" });
for (const hit of sim.results) console.log(hit.iri, hit.score);</code></pre>
  </div>
  <div class="code-panel" data-lang="go">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>// Hybrid: Beers nearest a 4-dim probe vector, top 5.
oxql := oxid.NewQueryBuilder().
	Find("x").
	IsA("Beer").
	Near([]float64{0.9, 0.1, 0.0, 0.2}).
	Limit(5).
	ToOxql()
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
	&amp;oxid.SimilarOpts{K: 5, Collection: "default"})
_, _ = sim, err</code></pre>
  </div>
  <div class="code-panel" data-lang="java">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>// 1) By reference IRI, 3 nearest neighbours of Heineken in the default collection
Individuals.IndividualSimilarResponse sim = oxid.individualSimilar("Heineken", 3, null);
for (Individuals.SimilarHit hit : sim.results()) {
    System.out.println(hit.iri() + " " + hit.score());
}

// 2) By raw vector, via OxQL NEAR
String oxql = new QueryBuilder()
        .find("x").isA("Beer")
        .near(new double[] {0.9, 0.1, 0.5, 0.2})
        .limit(5)
        .toOxql();
Query.QueryResponse hits = oxid.query(Query.QueryRequest.of(oxql));</code></pre>
  </div>
  <div class="code-panel" data-lang="php">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>use OxidDb\Client\Model\QueryRequest;

// 1) OxQL NEAR over POST /query, literal query vector, hybrid-capable.
$near = $oxid-&gt;query(new QueryRequest(
    'FIND ?x WHERE ?x IS-A Beer AND NEAR ?x TO [0.9, 0.1, 0.5, 0.2] LIMIT 5'
));
foreach ($near-&gt;results as $hit) {
    printf("  %s  score=%s\n", $hit-&gt;iri, $hit-&gt;score);
}

// 2) By-reference nearest neighbours: GET /individuals/{iri}/similar
$similar = $oxid-&gt;individualSimilar('Heineken', k: 3, collection: 'demo_beers');
echo "reference={$similar-&gt;reference} collection={$similar-&gt;collection}\n";</code></pre>
  </div>
  <div class="code-panel" data-lang="csharp">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>// Hybrid: a Beer near this 4-dim probe vector, top 5.
string oxql = new QueryBuilder()
    .Find("x").IsA("Beer").Near(new[] { 0.9, 0.1, 0.5, 0.2 }).Limit(5)
    .ToOxql();
QueryResponse hits = await oxid.QueryAsync(new QueryRequest(oxql));
foreach (QueryHit hit in hits.Results)
{
    Console.WriteLine($"{hit.Iri}  score={hit.Score}");
}

// Nearest neighbours of an existing individual.
IndividualSimilarResponse sim = await oxid.IndividualSimilarAsync("Heineken", k: 3);
foreach (SimilarHit s in sim.Results)
{
    Console.WriteLine($"{s.Iri}  {s.Score}");
}</code></pre>
  </div>
</div>

## create_collection

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
    <pre><code>curl -s -X POST https://85cfad134a4a.oxid-db.com/collections \
  -H 'Content-Type: application/json' \
  -d '{"name":"beers","dimensions":384,"metric":"cosine","quantization":"none"}'</code></pre>
  </div>
  <div class="code-panel" data-lang="python">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>with OxidDB("https://85cfad134a4a.oxid-db.com") as db:
    db.create_collection("beers", dim=4, metric="cosine")
    # creating the same shape again returns 409: catch OxidHttpError, ignore 409</code></pre>
  </div>
  <div class="code-panel" data-lang="typescript">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>// Field is `dimensions` (not `dim`).
await db.createCollection({ name: "beers", dimensions: 4, metric: "cosine" });

const list = await db.collections();
console.log(list.collections.map((c) =&gt; `${c.name}/${c.dimensions}`));</code></pre>
  </div>
  <div class="code-panel" data-lang="go">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>// The field is `Dimensions` (not `dim`). Metric: cosine | l2 | ip | manhattan.
if err := client.CreateCollection(ctx, oxid.CreateCollectionRequest{
	Name:       "beverages",
	Dimensions: 4,        // 4-dim vectors
	Metric:     "cosine",
}); err != nil {
	log.Fatalf("create collection: %v", err)
}</code></pre>
  </div>
  <div class="code-panel" data-lang="java">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>// 4-dim vector collection for beverage embeddings (field is `dimensions`, not `dim`)
oxid.createCollection(Collections.CreateCollectionRequest.of("beverages", 4));</code></pre>
  </div>
  <div class="code-panel" data-lang="php">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>use OxidDb\Client\Model\CreateCollectionRequest;

// The field is `dimensions`, not `dim`.
$oxid-&gt;createCollection(new CreateCollectionRequest('demo_beers', 4, 'cosine'));</code></pre>
  </div>
  <div class="code-panel" data-lang="csharp">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>// A 4-dim collection for beverage vectors (wire key is `dimensions`, not `dim`).
await oxid.CreateCollectionAsync(new CreateCollectionRequest("beers", 4));

// With an explicit metric:
await oxid.CreateCollectionAsync(new CreateCollectionRequest("beers", 4, Metric: "cosine"));</code></pre>
  </div>
</div>

## insert_document

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
    <pre><code>curl -s -X POST https://85cfad134a4a.oxid-db.com/documents/people \
  -H 'Content-Type: application/json' \
  -d '{"_iri":"Dave","name":"Dave","score":3}'</code></pre>
  </div>
  <div class="code-panel" data-lang="python">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>with OxidDB("https://85cfad134a4a.oxid-db.com") as db:
    res = db.insert_document("beers", {"name": "Heineken", "abv": 5.0}, iri="Heineken")
    # res: {"ok": true, "collection": "beers", "iri": "Heineken"}</code></pre>
  </div>
  <div class="code-panel" data-lang="typescript">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>const res = await db.insertDocument("beers", {
  _iri: "Heineken",
  name: "Heineken",
  style: "Pilsner",
  abv: 5.0,
});
console.log(res.ok, res.iri); // true "Heineken"</code></pre>
  </div>
  <div class="code-panel" data-lang="go">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>res, err := client.InsertDocument(ctx, "beverages", oxid.Document{
	"_iri":  "PilsnerUrquell",
	"name":  "Pilsner Urquell",
	"style": "Pilsner",
	"abv":   4.4,
})
if err != nil {
	log.Fatalf("insert document: %v", err)
}
log.Printf("ok=%v iri=%s", res.Ok, res.IRI)</code></pre>
  </div>
  <div class="code-panel" data-lang="java">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>import java.util.Map;

Documents.InsertDocumentResponse res = oxid.insertDocument("beverages", Map.of(
        "id", "Heineken",
        "name", "Heineken",
        "style", "Pilsner",
        "abv", 5.0));
System.out.println(res.iri());</code></pre>
  </div>
  <div class="code-panel" data-lang="php">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>$res = $oxid-&gt;insertDocument('beer_catalog', [
    '_iri'  =&gt; 'Heineken',
    'name'  =&gt; 'Heineken',
    'style' =&gt; 'Pilsner',
    'abv'   =&gt; 5.0,
]);
print_r($res);</code></pre>
  </div>
  <div class="code-panel" data-lang="csharp">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>InsertDocumentResponse res = await oxid.InsertDocumentAsync("beers",
    new Dictionary&lt;string, object?&gt;
    {
        ["name"]  = "Pilsner Urquell",
        ["style"] = "Pilsner",
        ["abv"]   = 4.4,
    });
Console.WriteLine($"inserted {res.Iri} into {res.Collection} (ok={res.Ok})");</code></pre>
  </div>
</div>

## bulk_import_documents

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
    <pre><code># JSON array to /bulk:
curl -s -X POST https://85cfad134a4a.oxid-db.com/documents/beers/bulk \
  -H 'Content-Type: application/json' \
  -d '[{"_iri":"Heineken","name":"Heineken"},{"_iri":"Guinness","name":"Guinness"}]'

# Raw NDJSON to /import ($id per line):
curl -s -X POST https://85cfad134a4a.oxid-db.com/documents/beers/import \
  --data-binary $'{"$id":"Heineken","name":"Heineken"}\n{"$id":"Guinness","name":"Guinness"}\n'</code></pre>
  </div>
  <div class="code-panel" data-lang="python">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>with OxidDB("https://85cfad134a4a.oxid-db.com") as db:
    res = db.bulk_insert_documents("beers", [
        {"_iri": "Heineken", "name": "Heineken", "abv": 5.0},
        {"_iri": "Guinness", "name": "Guinness", "abv": 4.2},
    ])
    # res: {"ok": true, "inserted": 2, "upserts": 0, ...}

    # raw-NDJSON alternative:
    ndjson = '{"$id":"Heineken","name":"Heineken"}\n{"$id":"Guinness","name":"Guinness"}\n'
    db.import_documents_ndjson("beers", ndjson)</code></pre>
  </div>
  <div class="code-panel" data-lang="typescript">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>// A) JSON array, deferred indexing.
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
console.log(imp.ok, imp.imported); // true 2</code></pre>
  </div>
  <div class="code-panel" data-lang="go">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>docs := []oxid.Document{
	{"_iri": "Guinness", "name": "Guinness", "style": "Stout", "abv": 4.2},
	{"_iri": "Chardonnay", "name": "Chardonnay", "style": "Wine", "abv": 13.5},
}
res, err := client.BulkInsertDocuments(ctx, "beverages", docs)
if err != nil {
	log.Fatalf("bulk import: %v", err)
}
log.Printf("inserted=%d upserts=%d indexes_built=%d", res.Inserted, res.Upserts, res.IndexesBuilt)

// Raw NDJSON alternative:
ndjson := `{"_iri":"Weissbier","name":"Weissbier","style":"Beer"}` + "\n" +
	`{"_iri":"Merlot","name":"Merlot","style":"Wine"}`
_, _ = client.ImportDocumentsNdjson(ctx, "beverages", ndjson)</code></pre>
  </div>
  <div class="code-panel" data-lang="java">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>import java.util.List;
import java.util.Map;

Documents.BulkInsertDocumentsResponse res = oxid.bulkInsertDocuments("beverages", List.of(
        Map.of("id", "Pilsner-Urquell", "style", "Pilsner", "abv", 4.4),
        Map.of("id", "Guinness",        "style", "Stout",   "abv", 4.2),
        Map.of("id", "Cabernet",        "style", "Wine",    "abv", 13.5)));
System.out.println(res.inserted());

// Raw NDJSON alternative:
String ndjson = String.join("\n",
        "{\"id\":\"Pilsner-Urquell\",\"style\":\"Pilsner\"}",
        "{\"id\":\"Guinness\",\"style\":\"Stout\"}");
oxid.importDocumentsNdjson("beverages", ndjson);</code></pre>
  </div>
  <div class="code-panel" data-lang="php">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>$bulk = $oxid-&gt;bulkInsertDocuments('beer_catalog', [
    ['_iri' =&gt; 'Heineken', 'name' =&gt; 'Heineken', 'style' =&gt; 'Pilsner', 'abv' =&gt; 5.0],
    ['_iri' =&gt; 'Guinness', 'name' =&gt; 'Guinness', 'style' =&gt; 'Stout',   'abv' =&gt; 4.2],
]);
printf("ok=%s inserted=%d upserts=%d\n",
    $bulk-&gt;ok ? 'true' : 'false', $bulk-&gt;inserted, $bulk-&gt;upserts);

// Raw NDJSON alternative:
$ndjson = implode("\n", [
    json_encode(['_iri' =&gt; 'Pils',  'name' =&gt; 'Pils',  'style' =&gt; 'Pilsner']),
    json_encode(['_iri' =&gt; 'Stout', 'name' =&gt; 'Stout', 'style' =&gt; 'Stout']),
]);
$oxid-&gt;importDocumentsNdjson('beer_catalog', $ndjson);</code></pre>
  </div>
  <div class="code-panel" data-lang="csharp">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>// JSON array of documents in one POST.
BulkInsertDocumentsResponse bulk = await oxid.BulkInsertDocumentsAsync("beers", new[]
{
    new Dictionary&lt;string, object?&gt; { ["name"] = "Guinness", ["style"] = "Stout" },
    new Dictionary&lt;string, object?&gt; { ["name"] = "Chimay",   ["style"] = "Ale"   },
});
Console.WriteLine($"inserted={bulk.Inserted} upserts={bulk.Upserts}");

// Line-delimited JSON (NDJSON) upload.
string ndjson =
    "{\"name\":\"Weihenstephaner\",\"style\":\"WheatBeer\"}\n" +
    "{\"name\":\"Duvel\",\"style\":\"Ale\"}\n";
ImportNdjsonResponse imp = await oxid.ImportDocumentsNdjsonAsync("beers", ndjson);
Console.WriteLine($"imported={imp.Imported} upserts={imp.Upserts}");</code></pre>
  </div>
</div>

## map_collection_to_class

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
    <pre><code>curl -s -X POST https://85cfad134a4a.oxid-db.com/collections/map \
  -H 'Content-Type: application/json' \
  -d '{"collection":"people","class":"Person","field_mappings":[{"field":"name","property":"name","type":{"kind":"data_property"}}],"auto_type":true}'</code></pre>
  </div>
  <div class="code-panel" data-lang="python">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>with OxidDB("https://85cfad134a4a.oxid-db.com") as db:
    db.register_mapping(
        "beers",
        "Beer",
        [{"field": "name", "property": "name", "type": {"kind": "data_property"}}],
        auto_type=True,
    )</code></pre>
  </div>
  <div class="code-panel" data-lang="typescript">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>const res = await db.registerMapping({
  collection: "beers",
  class: "Beer",
  field_mappings: [
    { field: "name", property: "name", type: { kind: "data_property" } },
    { field: "abv", property: "abv", type: { kind: "data_property" } },
  ],
  auto_type: true,
});
console.log(res.ok, res.collection, res.auto_type);</code></pre>
  </div>
  <div class="code-panel" data-lang="go">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>autoType := true
res, err := client.RegisterMapping(ctx, oxid.RegisterMappingRequest{
	Collection: "beverages",
	Class:      "Beverage",
	AutoType:   &amp;autoType,
	FieldMappings: []oxid.FieldMapping{
		{Field: "name", Property: "label", Type: oxid.MappingType{Kind: "data_property"}},
		{Field: "abv", Property: "abv", Type: oxid.MappingType{Kind: "data_property"}},
	},
})
if err != nil {
	log.Fatalf("register mapping: %v", err)
}
log.Printf("ok=%v collection=%s auto_type=%v", res.Ok, res.Collection, res.AutoType)</code></pre>
  </div>
  <div class="code-panel" data-lang="java">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>import java.util.List;

oxid.registerMapping(Documents.RegisterMappingRequest.of(
        "beverages", "Beer",
        List.of(
            new Documents.FieldMapping("style", "hasStyle", Documents.MappingType.dataProperty()),
            new Documents.FieldMapping("abv",   "hasAbv",   Documents.MappingType.dataProperty()))));</code></pre>
  </div>
  <div class="code-panel" data-lang="php">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>use OxidDb\Client\Model\RegisterMappingRequest;
use OxidDb\Client\Model\FieldMapping;
use OxidDb\Client\Model\MappingType;

$oxid-&gt;registerMapping(new RegisterMappingRequest(
    collection: 'beer_catalog',
    class: 'Beer',
    fieldMappings: [
        new FieldMapping('abv',  'hasAbv',   new MappingType('data_property')),
        new FieldMapping('vec',  'hasVector', new MappingType('vector_property', 'demo_beers')),
    ],
    autoType: true,
));</code></pre>
  </div>
  <div class="code-panel" data-lang="csharp">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>RegisterMappingResponse map = await oxid.RegisterMappingAsync(
    new RegisterMappingRequest(
        Collection: "beers",
        Class: "Beer",
        FieldMappings: new List&lt;FieldMapping&gt;
        {
            new("name",  "hasName",  MappingType.DataProperty()),
            new("style", "hasStyle", MappingType.DataProperty()),
            new("vec",   "hasVec",   MappingType.VectorProperty("beers")),
        },
        AutoType: true));
Console.WriteLine($"mapped {map.Collection} → autoType={map.AutoType} (ok={map.Ok})");</code></pre>
  </div>
</div>

## transaction

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
    <pre><code># 1. Begin, capture txn_id from the response.
curl -s -X POST https://85cfad134a4a.oxid-db.com/txn
# =&gt; {"txn_id": 1}

# 2. Mutate inside the txn (interpolate the id).
curl -s -X POST https://85cfad134a4a.oxid-db.com/txn/1/insert \
  -H 'Content-Type: application/json' \
  -d '{"iri":"Heineken","class":"Pilsner","vector":[0.4,0.2,0.1,0.4]}'

# 3. Commit.
curl -s -X POST https://85cfad134a4a.oxid-db.com/txn/1/commit</code></pre>
  </div>
  <div class="code-panel" data-lang="python">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>with OxidDB("https://85cfad134a4a.oxid-db.com") as db:
    with db.transaction() as txn:
        term = txn.insert("Heineken", "Pilsner", vector=[0.4, 0.2, 0.1, 0.4])
        txn.add_subclass("Pilsner", "Beer")
        sp = txn.savepoint()
        txn.insert_document("beers", {"name": "Heineken"})
        txn.rollback_to(sp)     # undo just the document
    # committed here on clean exit</code></pre>
  </div>
  <div class="code-panel" data-lang="typescript">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>// Auto commit/rollback.
await db.transaction(async (txn) =&gt; {
  await txn.addSubclass({ sub: "Pilsner", sup: "Beer" });
  const term = await txn.insert({ iri: "Corona", class: "Pilsner", vector: [0.2, 0.2, 0.1, 0.3] });
  await txn.addObjectProperty({ subject: "Corona", property: "brewedBy", object: "GrupoModelo" });
  return term; // resolve → commit; throw → rollback
});</code></pre>
  </div>
  <div class="code-panel" data-lang="go">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>err := client.Transaction(ctx, func(tx *oxid.Txn) error {
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
log.Println("transaction committed")</code></pre>
  </div>
  <div class="code-panel" data-lang="java">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>// Closure form, commits on return, rolls back on throw.
oxid.transaction(tx -&gt; {
    tx.insert(Txn.TxnInsertRequest.of("Duvel", "Beer"));   // returns interned Term (int)
    tx.addSubclass(new Mutation.SubclassRequest("Tripel", "Beer"));
    return null;
});

// Manual form, try-with-resources; close() rolls back if not committed.
try (Transaction tx = oxid.beginTransaction()) {
    int term = tx.insert(Txn.TxnInsertRequest.of("Chimay", "Beer"));
    tx.addSubclass(new Mutation.SubclassRequest("Quadrupel", "Beer"));
    tx.commit();
}</code></pre>
  </div>
  <div class="code-panel" data-lang="php">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>use OxidDb\Client\Transaction;
use OxidDb\Client\Model\TxnInsertRequest;

// Scope helper, commits on success, rolls back on throw.
$oxid-&gt;transaction(function (Transaction $tx): void {
    $tx-&gt;insert(new TxnInsertRequest('Duvel', 'Beer', vector: [0.2, 0.4, 0.1, 0.3], collection: 'demo_beers'));
    $tx-&gt;insert(new TxnInsertRequest('Chimay', 'Beer'));
});

// Manual control, begin / rollback explicitly.
$tx = $oxid-&gt;begin();
$term = $tx-&gt;insert(new TxnInsertRequest('Ghost', 'Beer'));  // returns interned Term id
$rollback = $tx-&gt;rollback();                                 // Ghost discarded</code></pre>
  </div>
  <div class="code-panel" data-lang="csharp">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>// Callback form, auto commit/rollback.
await oxid.TransactionAsync(async tx =&gt;
{
    await tx.InsertAsync(new TxnInsertRequest("Corona", "Pilsner",
        Vector: new[] { 0.7, 0.2, 0.4, 0.1 }, Collection: "beers"));
    await tx.AddSubclassAsync(new SubclassRequest("Pilsner", "Beer"));
    await tx.AddObjectPropertyAsync("Corona", "brewedBy", "GrupoModelo");
    // returns → COMMIT ; throws → ROLLBACK (exception re-raised)
});

// Manual form with a savepoint.
await using Transaction tx = await oxid.BeginTransactionAsync();
await tx.InsertAsync(new TxnInsertRequest("Maybe", "Stout"));
int sp = await tx.SavepointAsync();
await tx.InsertAsync(new TxnInsertRequest("Discarded", "Stout"));
await tx.RollbackToAsync(sp);   // drop "Discarded", keep "Maybe"
await tx.CommitAsync();</code></pre>
  </div>
</div>

## predict_links

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
    <pre><code># Train first (collection name = model name), then predict.
# The field is top_k, NOT k (a stray "k" is silently ignored).
curl -s -X POST https://85cfad134a4a.oxid-db.com/predict-links \
  -H 'Content-Type: application/json' \
  -d '{"head":"Heineken","relation":"brewedBy","model":"default","top_k":5}'</code></pre>
  </div>
  <div class="code-panel" data-lang="python">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>with OxidDB("https://85cfad134a4a.oxid-db.com") as db:
    db.train(model="default", dim=4, epochs=50)   # collection == model name
    preds = db.predict_links("Heineken", relation="similarTo", k=5)
    for p in preds.get("results", []):
        print(p)</code></pre>
  </div>
  <div class="code-panel" data-lang="typescript">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>const pred = await db.predictLinks({
  head: "Guinness",
  relation: "pairsWith",
  top_k: 5,
  only_consistent: true, // veto inconsistent tails
});
for (const c of pred.candidates) {
  console.log(`${c.t}  score=${c.score.toFixed(3)}  consistent=${c.consistent}`);
}</code></pre>
  </div>
  <div class="code-panel" data-lang="go">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>res, err := client.PredictLinks(ctx, oxid.PredictLinksRequest{
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
}</code></pre>
  </div>
  <div class="code-panel" data-lang="java">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>// Optional: train a KGE model over the ABox first
oxid.train(Ops.TrainRequest.defaults());

// Predict tails for (Heineken, ?relation, ?), wire field is top_k, not k.
Kge.PredictLinksRequest req =
        new Kge.PredictLinksRequest("Heineken", "similarTo", null, 5, true);
Kge.PredictLinksResponse pred = oxid.predictLinks(req);
for (Kge.LinkCandidate c : pred.candidates()) {
    System.out.println(c.h() + " -" + c.r() + "-&gt; " + c.t()
            + " score=" + c.score() + " verdict=" + c.verdict());
}</code></pre>
  </div>
  <div class="code-panel" data-lang="php">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>use OxidDb\Client\Model\TrainRequest;
use OxidDb\Client\Model\PredictLinksRequest;

$oxid-&gt;train(new TrainRequest());                    // POST /train (defaults)

$pred = $oxid-&gt;predictLinks(new PredictLinksRequest(
    head: 'Heineken',
    relation: 'pairsWith',
    topK: 5,
    onlyConsistent: true,
));
printf("model=%s tier=%s stale=%s\n", $pred-&gt;model, $pred-&gt;tier, $pred-&gt;stale ? 'true' : 'false');
foreach ($pred-&gt;candidates as $c) {
    printf("  %s -%s-&gt; %s  score=%.4f verdict=%s\n", $c-&gt;h, $c-&gt;r, $c-&gt;t, $c-&gt;score, $c-&gt;verdict);
}</code></pre>
  </div>
  <div class="code-panel" data-lang="csharp">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>PredictLinksResponse pred = await oxid.PredictLinksAsync(
    new PredictLinksRequest("Heineken", Relation: "similarTo", TopK: 5, OnlyConsistent: true));

Console.WriteLine($"tier={pred.Tier} model={pred.Model} stale={pred.Stale}");
foreach (LinkCandidate c in pred.Candidates)
{
    Console.WriteLine($"  {c.H} -{c.R}-&gt; {c.T}  score={c.Score} rank={c.Rank} " +
                      $"consistent={c.Consistent} verdict={c.Verdict}");
}</code></pre>
  </div>
</div>

## import_owl

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
    <pre><code># Raw OWL bytes as the body. RDF/XML is NOT accepted, use owx/ofn/obo/omn/ttl/nt.
curl -s -X POST 'https://85cfad134a4a.oxid-db.com/import/owl?format=owx' \
  -H 'Content-Type: application/octet-stream' \
  --data-binary @beverages.owx</code></pre>
  </div>
  <div class="code-panel" data-lang="python">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>with OxidDB("https://85cfad134a4a.oxid-db.com") as db:
    owl = open("beverages.owx").read()
    res = db.import_owl(owl)
    # res: {"ok": true, "classes_added": .., "individuals_added": .., ...}</code></pre>
  </div>
  <div class="code-panel" data-lang="typescript">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>import { readFile } from "node:fs/promises";

const owl = await readFile("beverages.owl", "utf8");
const res = await db.importOwl(owl);
console.log(res.ok, res.classes_added, res.axioms_added);</code></pre>
  </div>
  <div class="code-panel" data-lang="go">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>owl := `&lt;?xml version="1.0"?&gt;
&lt;rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
         xmlns:owl="http://www.w3.org/2002/07/owl#"&gt;
  &lt;owl:Class rdf:about="Beer"/&gt;
  &lt;owl:Class rdf:about="Pilsner"&gt;
    &lt;rdfs:subClassOf rdf:resource="Beer"/&gt;
  &lt;/owl:Class&gt;
&lt;/rdf:RDF&gt;`

res, err := client.ImportOWL(ctx, owl)
if err != nil {
	log.Fatalf("import owl: %v", err)
}
log.Printf("ok=%v classes_added=%d axioms_added=%d warnings=%v",
	res.Ok, res.ClassesAdded, res.AxiomsAdded, res.Warnings)</code></pre>
  </div>
  <div class="code-panel" data-lang="java">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>String owlRdfXml = """
    &lt;rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
             xmlns:owl="http://www.w3.org/2002/07/owl#"&gt;
      &lt;owl:Class rdf:about="Beer"/&gt;
      &lt;owl:Class rdf:about="Pilsner"&gt;&lt;rdfs:subClassOf rdf:resource="Beer"/&gt;&lt;/owl:Class&gt;
    &lt;/rdf:RDF&gt;
    """;
Ops.ImportResponse res = oxid.importOwl(owlRdfXml);
System.out.println(res.classesAdded() + " classes, " + res.axiomsAdded() + " axioms");</code></pre>
  </div>
  <div class="code-panel" data-lang="php">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>$owl = file_get_contents('beverages.owl');       // raw RDF/XML string
$res = $oxid-&gt;importOwl($owl);
printf("ok=%s classes=%d individuals=%d axioms=%d\n",
    $res-&gt;ok ? 'true' : 'false',
    $res-&gt;classesAdded, $res-&gt;individualsAdded, $res-&gt;axiomsAdded);</code></pre>
  </div>
  <div class="code-panel" data-lang="csharp">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>string owl = await File.ReadAllTextAsync("beverages.owl"); // RDF/XML
ImportResponse res = await oxid.ImportOwlAsync(owl);
Console.WriteLine($"classes+={res.ClassesAdded} individuals+={res.IndividualsAdded} " +
                  $"axioms+={res.AxiomsAdded}");</code></pre>
  </div>
</div>

## import_csv

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
    <pre><code>curl -s -X POST https://85cfad134a4a.oxid-db.com/import/csv \
  -H 'Content-Type: text/csv; charset=utf-8' \
  --data-binary $'iri,class\nHeineken,Pilsner\nGuinness,Stout\n'</code></pre>
  </div>
  <div class="code-panel" data-lang="python">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>with OxidDB("https://85cfad134a4a.oxid-db.com") as db:
    csv = "iri,class\nHeineken,Pilsner\nGuinness,Stout\n"
    res = db.import_csv(csv)
    # res: {"ok": true, "classes_added": .., "individuals_added": .., ...}</code></pre>
  </div>
  <div class="code-panel" data-lang="typescript">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>const csv =
  "subject,predicate,object\n" +
  "Pilsner,subClassOf,Beer\n" +
  "Stout,subClassOf,Beer\n";
const res = await db.importCsv(csv);
console.log(res.ok, res.classes_added, res.axioms_added);</code></pre>
  </div>
  <div class="code-panel" data-lang="go">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>csv := "individual,class,abv\n" +
	"PilsnerUrquell,Pilsner,4.4\n" +
	"Guinness,Stout,4.2\n" +
	"Chardonnay,Wine,13.5\n"

res, err := client.ImportCSV(ctx, csv)
if err != nil {
	log.Fatalf("import csv: %v", err)
}
log.Printf("ok=%v classes_added=%d individuals_added=%d",
	res.Ok, res.ClassesAdded, res.IndividualsAdded)</code></pre>
  </div>
  <div class="code-panel" data-lang="java">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>String csv = String.join("\n",
        "individual,class,abv",
        "Heineken,Pilsner,5.0",
        "Guinness,Stout,4.2",
        "Cabernet,Wine,13.5");
Ops.ImportResponse res = oxid.importCsv(csv);
System.out.println(res.individualsAdded() + " individuals imported");</code></pre>
  </div>
  <div class="code-panel" data-lang="php">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>$csv = &lt;&lt;&lt;CSV
individual,class
Heineken,Pilsner
Guinness,Stout
Merlot,Wine
CSV;

$res = $oxid-&gt;importCsv($csv);
printf("ok=%s classes=%d individuals=%d axioms=%d\n",
    $res-&gt;ok ? 'true' : 'false',
    $res-&gt;classesAdded, $res-&gt;individualsAdded, $res-&gt;axiomsAdded);</code></pre>
  </div>
  <div class="code-panel" data-lang="csharp">
    <button class="copy-btn tab-copy">Copy</button>
    <pre><code>string csv =
    "individual,class\n" +
    "Heineken,Pilsner\n" +
    "Guinness,Stout\n";
ImportResponse res = await oxid.ImportCsvAsync(csv);
Console.WriteLine($"individuals+={res.IndividualsAdded} axioms+={res.AxiomsAdded}");</code></pre>
  </div>
</div>
