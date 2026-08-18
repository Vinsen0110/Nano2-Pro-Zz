import assert from "node:assert/strict";
import test from "node:test";

import {
    APOLLO_BILLING_GROUP_DEFAULT,
    APOLLO_BILLING_GROUP_OFFICIAL_MIX,
    APOLLO_BILLING_GROUP_UNKNOWN,
    apolloBillingDetectionLabel,
    apolloBillingGroupFromLabel,
    apolloBillingGroupLabel,
    apolloGptImagePrice,
    detectApolloKeyBillingGroup,
    effectiveApolloBillingGroup,
} from "../apollo-billing.js";

function jsonResponse(payload, status = 200) {
    return new Response(JSON.stringify(payload), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}

test("Apollo prices GPT Image 2 by the effective key group only", () => {
    assert.equal(apolloGptImagePrice({ billingGroup: "default" }), 0.06);
    assert.equal(apolloGptImagePrice({ billingGroup: "official-mix" }), 0.3);
    assert.equal(
        apolloGptImagePrice({ billingGroup: "auto", detectedBillingGroup: "official-mix" }),
        0.3,
    );
    assert.equal(apolloGptImagePrice({ billingGroup: "auto", detectedBillingGroup: "unknown" }), null);
    assert.equal(
        effectiveApolloBillingGroup({ billingGroup: "default", detectedBillingGroup: "official-mix" }),
        APOLLO_BILLING_GROUP_DEFAULT,
        "a manual choice must override an automatic detection",
    );
    assert.equal(
        effectiveApolloBillingGroup({
            billingGroup: "auto",
            detectedBillingGroup: "official-mix",
            billingDetectionSource: "models-capability",
        }),
        APOLLO_BILLING_GROUP_UNKNOWN,
        "legacy model-list guesses must not keep affecting prices",
    );
    assert.equal(apolloBillingGroupLabel({ billingGroup: "official-mix" }), "Gemini 优质");
    assert.equal(apolloBillingDetectionLabel("models-capability"), "旧版推断，请重新检测");
});

test("Apollo key names can identify billing without exposing the key value", () => {
    assert.equal(apolloBillingGroupFromLabel("普通-主用"), APOLLO_BILLING_GROUP_DEFAULT);
    assert.equal(apolloBillingGroupFromLabel("Default backup"), APOLLO_BILLING_GROUP_DEFAULT);
    assert.equal(apolloBillingGroupFromLabel("优质-主用"), APOLLO_BILLING_GROUP_OFFICIAL_MIX);
    assert.equal(apolloBillingGroupFromLabel("Premium image"), APOLLO_BILLING_GROUP_OFFICIAL_MIX);
    assert.equal(apolloBillingGroupFromLabel("Key 1"), APOLLO_BILLING_GROUP_UNKNOWN);
    assert.equal(apolloBillingGroupFromLabel("普通优质"), APOLLO_BILLING_GROUP_UNKNOWN);
    assert.equal(apolloGptImagePrice({ billingGroup: "auto", label: "普通" }), 0.06);
    assert.equal(apolloGptImagePrice({ billingGroup: "auto", label: "优质" }), 0.3);
    assert.equal(apolloBillingDetectionLabel("label"), "密钥名称");
});

test("Apollo detection prefers an explicit quota group without billable requests", async () => {
    const calls = [];
    const result = await detectApolloKeyBillingGroup({
        baseUrl: "https://api.apilio.ai",
        apiKey: "premium-key",
        fetchImpl: async (url, init) => {
            calls.push({ url: String(url), init });
            if (String(url).endsWith("/token/quota")) {
                return jsonResponse({ data: { group: "gpt-image-2-official-mix", remain: 123 } });
            }
            return jsonResponse({ data: [{ id: "gpt-image-2" }] });
        },
    });

    assert.equal(result.group, APOLLO_BILLING_GROUP_OFFICIAL_MIX);
    assert.equal(result.source, "quota-group");
    assert.equal(calls.length, 2);
    assert.deepEqual(
        calls.map(({ url }) => url).sort(),
        ["https://api.apilio.ai/v1/models", "https://api.apilio.ai/v1/token/quota"],
    );
    assert.ok(calls.every(({ init }) => init.method === "GET"));
    assert.ok(calls.every(({ init }) => init.headers.Authorization === "Bearer premium-key"));
    assert.ok(calls.every(({ url }) => !/images\/(generations|edits)/.test(url)));
});

test("Apollo detection does not infer a billing group from GPT Image 2 visibility", async () => {
    const result = await detectApolloKeyBillingGroup({
        baseUrl: "https://api.apilio.ai/v1",
        apiKey: "default-key",
        fetchImpl: async (url) =>
            String(url).endsWith("/models")
                ? jsonResponse({ data: [{ id: "gpt-image-2" }] })
                : jsonResponse({ data: { remain: 20 } }),
    });

    assert.equal(result.group, APOLLO_BILLING_GROUP_UNKNOWN);
    assert.equal(result.source, "unknown");
});

test("Apollo detection does not infer premium billing from a shared model catalog", async () => {
    const premium = await detectApolloKeyBillingGroup({
        baseUrl: "https://api.apilio.ai",
        apiKey: "premium-key",
        fetchImpl: async (url) =>
            String(url).endsWith("/models")
                ? jsonResponse({ data: [{ id: "nano-banana-pro" }, { id: "gpt-image-2" }] })
                : jsonResponse({ data: {} }),
    });
    assert.equal(premium.group, APOLLO_BILLING_GROUP_UNKNOWN);
    assert.equal(premium.source, "unknown");

    const unknown = await detectApolloKeyBillingGroup({
        baseUrl: "https://api.apilio.ai",
        apiKey: "unknown-key",
        fetchImpl: async () => jsonResponse({ data: {} }),
    });
    assert.equal(unknown.group, APOLLO_BILLING_GROUP_UNKNOWN);
    assert.equal(unknown.source, "unknown");
});

test("Apollo detection reports authentication failures without exposing the key", async () => {
    await assert.rejects(
        detectApolloKeyBillingGroup({
            baseUrl: "https://api.apilio.ai",
            apiKey: "secret-key-value",
            fetchImpl: async () => jsonResponse({ error: { message: "invalid token" } }, 401),
        }),
        (error) => {
            assert.match(error.message, /invalid token/);
            assert.doesNotMatch(error.message, /secret-key-value/);
            return true;
        },
    );

    await assert.rejects(
        detectApolloKeyBillingGroup({
            baseUrl: "https://api.apilio.ai",
            apiKey: "invalid-key",
            fetchImpl: async (url) =>
                String(url).endsWith("/token/quota")
                    ? jsonResponse({ error: { message: "token disabled" } }, 401)
                    : jsonResponse({ data: [{ id: "gpt-image-2" }] }),
        }),
        /token disabled/,
        "a public models response must not hide a quota authentication failure",
    );
});
