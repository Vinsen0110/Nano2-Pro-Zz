import assert from "node:assert/strict";
import test from "node:test";

import {
    inlineTudouGeminiReferences,
    isImgBbImageUrl,
    isTudouGeminiImageTarget,
} from "../tudou-reference-images.js";
import tudouProxy from "../api/tudou-proxy.js";

const target = new URL(
    "https://api.ai-tudou.net/v1beta/models/gemini-3-pro-image-preview:streamGenerateContent?alt=sse",
);

test("recognizes Tudou Gemini image endpoints and ImgBB URLs", () => {
    assert.equal(isTudouGeminiImageTarget(target), true);
    assert.equal(isImgBbImageUrl("https://i.ibb.co/example/reference.jpg"), true);
    assert.equal(isImgBbImageUrl("https://example.com/reference.jpg"), false);
});

test("converts ImgBB fileData references to inlineData before forwarding", async () => {
    const payload = {
        contents: [{
            role: "user",
            parts: [
                { fileData: { fileUri: "https://i.ibb.co/example/reference.jpg", mimeType: "image/png" } },
                { text: "keep the same composition" },
            ],
        }],
    };
    const fetchImpl = async (url) => {
        assert.equal(url, "https://i.ibb.co/example/reference.jpg");
        return new Response(Uint8Array.from([1, 2, 3, 4]), {
            headers: {
                "Content-Length": "4",
                "Content-Type": "image/jpeg",
            },
        });
    };

    const result = await inlineTudouGeminiReferences(target, payload, { fetchImpl });

    assert.equal(result.converted, 1);
    assert.deepEqual(result.payload.contents[0].parts[0], {
        inlineData: { mimeType: "image/jpeg", data: "AQIDBA==" },
    });
    assert.equal(result.payload.contents[0].parts[1].text, "keep the same composition");
});

test("does not fetch or rewrite non-ImgBB fileData references", async () => {
    const payload = {
        contents: [{ parts: [{ fileData: { fileUri: "https://example.com/reference.jpg" } }] }],
    };
    const result = await inlineTudouGeminiReferences(target, payload, {
        fetchImpl: async () => assert.fail("unexpected fetch"),
    });

    assert.equal(result.converted, 0);
    assert.equal(result.payload.contents[0].parts[0].fileData.fileUri, "https://example.com/reference.jpg");
});

test("Vercel proxy inlines one reference and submits exactly one Tudou request", async () => {
    const originalFetch = globalThis.fetch;
    let tudouRequests = 0;
    globalThis.fetch = async (url, init) => {
        const value = String(url);
        if (value.startsWith("https://i.ibb.co/")) {
            return new Response(Uint8Array.from([5, 6, 7]), {
                headers: { "Content-Type": "image/png" },
            });
        }

        tudouRequests += 1;
        assert.match(value, /api\.ai-tudou\.net\/v1beta\/models\/gemini-3-pro-image-preview:streamGenerateContent/);
        const forwarded = JSON.parse(String(init.body));
        assert.deepEqual(forwarded.contents[0].parts[0], {
            inlineData: { mimeType: "image/png", data: "BQYH" },
        });
        return new Response("data: {\"candidates\":[]}\n\n", {
            headers: { "Content-Type": "text/event-stream" },
        });
    };

    try {
        const request = new Request(
            "https://www.vinsen.top/api/tudou-proxy?path=v1beta/models/gemini-3-pro-image-preview:streamGenerateContent&alt=sse",
            {
                method: "POST",
                headers: {
                    Authorization: "Bearer test-key",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    contents: [{
                        role: "user",
                        parts: [
                            { fileData: { fileUri: "https://i.ibb.co/example/reference.png" } },
                            { text: "keep the cat and replace only its accessories" },
                        ],
                    }],
                    generationConfig: {
                        responseModalities: ["TEXT", "IMAGE"],
                        imageConfig: { aspectRatio: "3:2", imageSize: "4K" },
                    },
                }),
            },
        );

        const response = await tudouProxy.fetch(request);
        assert.equal(response.status, 200);
        assert.equal(response.headers.get("x-tudou-references-inlined"), "1");
        assert.equal(tudouRequests, 1);
    } finally {
        globalThis.fetch = originalFetch;
    }
});
