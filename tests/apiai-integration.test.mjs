import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
    APIAI_IMAGE_MODELS,
    APIAI_SITE_ID,
    APIAI_SITE_MODELS,
    apiAiBackendModel,
    apiAiImageRequestSpec,
    apiAiQuotaToBalance,
    fetchApiAiAccountBalance,
    fetchApiAiKeyBalance,
    isApiAiSite,
    runApiAiImageGeneration,
} from "../apiai-api.js";

const bundle = await readFile(new URL("../assets/index-B2KJ37fm.js", import.meta.url), "utf8");

function jsonResponse(payload, status = 200) {
    return new Response(JSON.stringify(payload), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}

test("ApiAI exposes nano-banana-pro and maps Auto/1K/2K/4K to provider model ids", () => {
    assert.equal(APIAI_SITE_ID, "apiai");
    assert.deepEqual(APIAI_SITE_MODELS, ["nano-banana-pro"]);
    assert.deepEqual(APIAI_IMAGE_MODELS, ["nano-banana-pro"]);
    assert.equal(apiAiBackendModel({ quality: "auto" }), "gemini-3-pro-image-preview");
    assert.equal(apiAiBackendModel({ quality: "1k" }), "gemini-3-pro-image-preview");
    assert.equal(apiAiBackendModel({ quality: "2k" }), "gemini-3-pro-image-preview-2k");
    assert.equal(apiAiBackendModel({ quality: "4k" }), "gemini-3-pro-image-preview-4k");
});

test("ApiAI keeps the display model while sending the mapped backend model", () => {
    const spec = apiAiImageRequestSpec({ model: "nano-banana-pro", quality: "4k", size: "16:9" }, "draw");
    assert.equal(spec.endpoint, "/v1/images/generations");
    assert.equal(spec.model, "gemini-3-pro-image-preview-4k");
    assert.deepEqual(spec.body, {
        prompt: "draw",
        n: 1,
        model: "gemini-3-pro-image-preview-4k",
        size: "4096x2304",
    });
    assert.equal(isApiAiSite({ provider: "apiai" }), true);
});

test("ApiAI async image generation polls the returned task and resolves image URLs", async () => {
    const requests = [];
    const fetchImpl = async (url, init = {}) => {
        requests.push({ url: String(url), init });
        if (requests.length === 1) return jsonResponse({ data: { task_id: "task-1", status: "queued" } });
        return jsonResponse({ data: [{ url: "https://cdn.example.test/image.png" }], status: "completed" });
    };
    const urls = await runApiAiImageGeneration({
        baseUrl: "https://api.example.test",
        apiKey: "key",
        quality: "2k",
        size: "auto",
    }, "draw", [], { fetchImpl });
    assert.deepEqual(urls, ["https://cdn.example.test/image.png"]);
    assert.equal(requests[0].url, "https://api.example.test/v1/images/generations?async=true");
    assert.equal(JSON.parse(requests[0].init.body).model, "gemini-3-pro-image-preview-2k");
    assert.equal(requests[1].url, "https://api.example.test/v1/images/tasks/task-1");
});

test("ApiAI image edits submit ImgBB references as multipart image files", async () => {
    const requests = [];
    const fetchImpl = async (url, init = {}) => {
        requests.push({ url: String(url), init });
        if (String(url).endsWith("reference.png")) return new Response(new Blob(["png"], { type: "image/png" }));
        return jsonResponse({ data: [{ url: "https://cdn.example.test/edited.png" }] });
    };
    const urls = await runApiAiImageGeneration({
        baseUrl: "https://api.example.test",
        apiKey: "key",
        quality: "1k",
        size: "1:1",
    }, "edit", ["https://i.ibb.co/reference.png"], { fetchImpl });
    assert.deepEqual(urls, ["https://cdn.example.test/edited.png"]);
    const request = requests.at(-1);
    assert.equal(request.url, "https://api.example.test/v1/images/edits?async=true");
    assert.equal(request.init.headers["Content-Type"], undefined);
    assert.equal(request.init.body instanceof FormData, true);
    assert.equal(request.init.body.get("model"), "gemini-3-pro-image-preview");
    assert.equal(request.init.body.get("image") instanceof Blob, true);
});

test("ApiAI quota uses the documented quota / 500000 conversion for both balance endpoints", async () => {
    assert.equal(apiAiQuotaToBalance(500000), 1);
    const seen = [];
    const fetchImpl = async (url, init = {}) => {
        seen.push({ url: String(url), init });
        return jsonResponse({ quota: 1250000 });
    };
    assert.equal(await fetchApiAiKeyBalance({ baseUrl: "https://api.example.test", apiKey: "key" }, "user", fetchImpl), 2.5);
    assert.equal(await fetchApiAiAccountBalance({ baseUrl: "https://api.example.test", apiKey: "key" }, "user", "system", fetchImpl), 2.5);
    assert.equal(seen[0].url, "https://api.example.test/api/token/key/key");
    assert.equal(seen[0].init.headers["Rix-Api-User"], "user");
    assert.equal(seen[1].url, "https://api.example.test/api/user/self");
    assert.equal(seen[1].init.headers.Authorization, "Bearer system");
});

test("compiled canvas bundle includes the isolated ApiAI channel and image branches", () => {
    assert.match(bundle, /provider:"apiai",models:APIAI_SITE_MODELS/);
    assert.match(bundle, /function siteImageModelNames\(e\).*APIAI_IMAGE_MODELS/);
    assert.match(bundle, /if\(isApiAiSite\(r\)\).*runApiAiImageGeneration/);
    assert.match(bundle, /if\(isApiAiSite\(a\)\).*imgbbReferenceSource/);
    assert.match(bundle, /fetchApiAiKeyBalance/);
});
