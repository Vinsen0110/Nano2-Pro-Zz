import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const bundle = await readFile(new URL("../assets/index-B2KJ37fm.js", import.meta.url), "utf8");

test("each site exposes exactly one supported text model", () => {
    assert.match(bundle, /APOLLO_TEXT_MODELS=\["gemini-3\.6-flash"\]/);
    assert.match(bundle, /TUDOU_TEXT_MODELS=\["gpt-5\.6-sol"\]/);
    assert.match(
        bundle,
        /function siteTextModelNames\(e\)\{return e===TUDOU_SITE_ID\?TUDOU_TEXT_MODELS:APOLLO_TEXT_MODELS\}/,
    );
    assert.match(bundle, /textModels:siteModelRefs\(t,siteTextModelNames\(t\)\)/);
    assert.match(
        bundle,
        /const f=Array\.from\(new Set\(e\.textModels\|\|\[\]\)\),m=f\.includes\(e\.model\)/,
    );
    assert.doesNotMatch(bundle, /gpt-5\.5/);
    assert.doesNotMatch(bundle, /filter\(g=>!pr\(g\)\.toLowerCase\(\)\.includes\("gemini"\)\)/);
});

test("settings expose the active site's global default text model", () => {
    assert.match(bundle, /\\u5168\\u5C40\\u751F\\u6210\\u9ED8\\u8BA4\\u503C/);
    assert.match(
        bundle,
        /label:`\\u5168\\u5C40\\u9ED8\\u8BA4\\u6587\\u672C\\u6A21\\u578B\\uFF08\$\{activeSiteChannel\(a\)\?\.name/,
    );
    assert.match(
        bundle,
        /value:a\.textModel\|\|ES\(a\.activeSiteId\|\|DP,defaultTextModelName\(a\.activeSiteId\|\|DP\)\),capability:"text"/,
    );
    assert.match(bundle, /onChange:\$=>h\(\{textModel:\$\}\)/);
});

test("text requests reject a stale model from another site", () => {
    assert.match(
        bundle,
        /model:n==="image"\|\|n==="text"\?ODe\(e,n,t\?\.metadata\?\.model\|\|r\)/,
    );
    assert.match(
        bundle,
        /function ODe\(e,t,n\)\{const r=yx\(n,e\.channels,e\.activeSiteId\);return r&&CS\(e,t\)\.includes\(r\)\?r:IDe\(e,t\)\}/,
    );
});

test("native clipboard images are handled before internal canvas clipboard data", () => {
    const start = bundle.indexOf("K.clipboardData?.files");
    const end = bundle.indexOf('window.addEventListener("paste",O)', start);
    assert.ok(start >= 0 && end > start, "native paste handler should exist");

    const handler = bundle.slice(start, end);
    assert.match(handler, /K\.clipboardData\?\.items/);
    assert.match(handler, /Ea\(Ee,Ji\(\)\)/);
    assert.match(handler, /if\(Cf\(\)\)/);
    assert.ok(
        handler.indexOf("Ea(Ee,Ji())") < handler.indexOf("if(Cf())"),
        "external clipboard images must take priority over stale copied canvas nodes",
    );
    assert.match(bundle, /if\(le&&!K\.altKey&&Q==="v"\)return;if\(!le/);
    assert.doesNotMatch(bundle, /returnif/);
});
