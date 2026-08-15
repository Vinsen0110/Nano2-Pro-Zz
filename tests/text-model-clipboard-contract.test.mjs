import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const bundle = await readFile(new URL("../assets/index-B2KJ37fm.js", import.meta.url), "utf8");

test("each site exposes exactly one supported text model", () => {
    assert.match(bundle, /APOLLO_TEXT_MODELS=\["gemini-3\.6-flash"\]/);
    assert.match(bundle, /TUDOU_TEXT_MODELS=\["gpt-5\.5"\]/);
    assert.match(
        bundle,
        /function siteTextModelNames\(e\)\{return e===TUDOU_SITE_ID\?TUDOU_TEXT_MODELS:APOLLO_TEXT_MODELS\}/,
    );
    assert.match(bundle, /textModels:siteModelRefs\(t,siteTextModelNames\(t\)\)/);
    assert.match(
        bundle,
        /const f=Array\.from\(new Set\(e\.textModels\|\|\[\]\)\),m=f\.includes\(e\.model\)/,
    );
    assert.doesNotMatch(bundle, /gpt-5\.6-sol/);
    assert.doesNotMatch(bundle, /filter\(g=>!pr\(g\)\.toLowerCase\(\)\.includes\("gemini"\)\)/);
});

test("settings expose the active site's global default text model", () => {
    assert.match(bundle, /className:"generation-settings-sections"/);
    assert.match(bundle, /children:"\\u751F\\u56FE\\u6A21\\u578B\\u8BBE\\u7F6E"/);
    assert.match(bundle, /children:"\\u6587\\u672C\\u6A21\\u578B\\u8BBE\\u7F6E"/);
    assert.match(
        bundle,
        /label:"\\u9ED8\\u8BA4\\u6587\\u672C\\u6A21\\u578B\\uFF08"\+\(activeSiteChannel\(a\)\?\.name/,
    );
    assert.match(
        bundle,
        /value:a\.textModel\|\|ES\(a\.activeSiteId\|\|DP,defaultTextModelName\(a\.activeSiteId\|\|DP\)\),capability:"text"/,
    );
    assert.match(bundle, /onChange:\$=>h\(\{textModel:\$\}\)/);
});

test("Apilio text generation uses Chat Completions messages", async () => {
    const start = bundle.indexOf("function chatCompletionMessages");
    const end = bundle.indexOf("async function iW", start);
    assert.ok(start >= 0 && end > start, "Apilio Chat Completions adapter should exist");

    const adapter = bundle.slice(start, end);
    const requests = [];
    const makeRequest = new Function(
        "fetch",
        "Gy",
        "wA",
        "aW",
        "AL",
        `${adapter};return requestChatCompletions;`,
    );
    const request = makeRequest(
        async (url, init) => {
            requests.push({ url, init });
            return new Response(JSON.stringify({
                choices: [{ message: { content: "反推结果" } }],
            }), { status: 200, headers: { "Content-Type": "application/json" } });
        },
        (baseUrl, path) => `${baseUrl.replace(/\/$/, "")}/v1${path}`,
        () => ({ Authorization: "Bearer test-key", "Content-Type": "application/json" }),
        async () => "request failed",
        (payload) => {
            if (payload?.error?.message) throw new Error(payload.error.message);
        },
    );

    const progress = [];
    const result = await request(
        { baseUrl: "https://api.apilio.ai", apiKey: "test-key", model: "gemini-3.6-flash" },
        [{
            role: "user",
            content: [
                { type: "text", text: "反推这张图" },
                { type: "image_url", image_url: { url: "data:image/png;base64,dGVzdA==" } },
            ],
        }],
        (value) => progress.push(value),
    );

    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, "https://api.apilio.ai/v1/chat/completions");
    const body = JSON.parse(requests[0].init.body);
    assert.equal(body.model, "gemini-3.6-flash");
    assert.deepEqual(body.messages, [{
        role: "user",
        content: [
            { type: "text", text: "反推这张图" },
            { type: "image_url", image_url: { url: "data:image/png;base64,dGVzdA==" } },
        ],
    }]);
    assert.equal(body.stream, false);
    assert.equal("input" in body, false);
    assert.equal(result.content, "反推结果");
    assert.deepEqual(progress, ["反推结果"]);
});

test("text routing keeps Tudou on Responses while Apilio uses Chat Completions", () => {
    assert.match(bundle, /isApilioSite\(o\)\?requestChatCompletions\(o,tW\(o,t\),n,r\):iW\(o,/);
    assert.match(bundle, /fetch\(xA\(e,"\/responses"\)/);
});

test("text requests reject a stale model from another site", () => {
    assert.match(
        bundle,
        /model:n==="image"\|\|n==="text"\?ODe\(e,n,t\?\.metadata\?\.model\|\|r\)/,
    );
    assert.match(
        bundle,
        /function ODe\(e,t,n\)\{const r=CS\(e,t\)\|\|\[\],o=yx\(n,e\.channels,e\.activeSiteId\);if\(o&&r\.includes\(o\)\)return o;const a=yx\(IDe\(e,t\),e\.channels,e\.activeSiteId\);return a&&r\.includes\(a\)\?a:r\[0\]\|\|""\}/,
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
