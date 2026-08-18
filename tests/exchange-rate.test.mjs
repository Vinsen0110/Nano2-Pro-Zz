import assert from "node:assert/strict";
import test from "node:test";

import {
    fetchLatestUsdCnyRate,
    parseCoinbaseUsdCny,
    parseOpenRateUsdCny,
} from "../api/exchange-rate.js";
import {
    USD_CNY_CACHE_KEY,
    convertUsdToCny,
    fetchUsdCnyRate,
    formatUsdCnyDetail,
} from "../exchange-rate.js";

function jsonResponse(payload, status = 200) {
    return new Response(JSON.stringify(payload), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}

function memoryStorage() {
    const values = new Map();
    return {
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, String(value)),
    };
}

test("USD/CNY provider payloads are validated and normalized", () => {
    assert.equal(parseCoinbaseUsdCny({ data: { rates: { CNY: "7.1234" } } }).rate, 7.1234);
    assert.equal(parseOpenRateUsdCny({ rates: { CNY: 7.2 }, time_last_update_unix: 1_700_000_000 }).rate, 7.2);
    assert.throws(() => parseCoinbaseUsdCny({ data: { rates: { CNY: "0" } } }), /Invalid/);
});

test("the exchange-rate service falls back when the live provider fails", async () => {
    const calls = [];
    const quote = await fetchLatestUsdCnyRate({
        fetchImpl: async (url) => {
            calls.push(String(url));
            if (calls.length === 1) return jsonResponse({ message: "down" }, 503);
            return jsonResponse({ rates: { CNY: 7.18 }, time_last_update_unix: 1_700_000_000 });
        },
    });
    assert.equal(calls.length, 2);
    assert.equal(quote.rate, 7.18);
    assert.equal(quote.source, "open-er-api");
});

test("the browser rate client converts RH USD and caches the last good quote", async () => {
    const storage = memoryStorage();
    const quote = await fetchUsdCnyRate({
        endpoint: "https://example.com/api/exchange-rate",
        storage,
        now: () => 1_800_000_000_000,
        fetchImpl: async () => jsonResponse({
            success: true,
            rate: 7.2,
            source: "coinbase",
            updatedAt: "2026-08-18T00:00:00.000Z",
        }),
    });
    assert.equal(convertUsdToCny(12.5, quote.rate), 90);
    assert.equal(quote.stale, false);
    assert.ok(storage.getItem(USD_CNY_CACHE_KEY));
    assert.match(formatUsdCnyDetail({ usd: 12.5, ...quote }), /US\$12\.50/);
});

test("the browser rate client uses a recent cached quote when the network fails", async () => {
    const storage = memoryStorage();
    storage.setItem(USD_CNY_CACHE_KEY, JSON.stringify({
        rate: 7.1,
        source: "coinbase",
        updatedAt: "2026-08-18T00:00:00.000Z",
        cachedAt: 1_800_000_000_000,
    }));
    const quote = await fetchUsdCnyRate({
        storage,
        now: () => 1_800_000_001_000,
        fetchImpl: async () => { throw new Error("offline"); },
    });
    assert.equal(quote.rate, 7.1);
    assert.equal(quote.stale, true);
});
