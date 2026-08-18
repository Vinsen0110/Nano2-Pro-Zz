const COINBASE_RATE_URL = "https://api.coinbase.com/v2/exchange-rates?currency=USD";
const OPEN_RATE_URL = "https://open.er-api.com/v6/latest/USD";

function positiveRate(value) {
    const rate = Number.parseFloat(String(value ?? ""));
    if (!Number.isFinite(rate) || rate <= 0) throw new Error("Invalid USD/CNY exchange rate");
    return rate;
}

async function fetchJson(url, fetchImpl) {
    const upstream = await fetchImpl(url, {
        headers: { Accept: "application/json" },
        cache: "no-store",
    });
    if (!upstream.ok) throw new Error(`Exchange-rate provider failed with ${upstream.status}`);
    return upstream.json();
}

export function parseCoinbaseUsdCny(payload, fetchedAt = new Date().toISOString()) {
    return {
        base: "USD",
        quote: "CNY",
        rate: positiveRate(payload?.data?.rates?.CNY),
        source: "coinbase",
        updatedAt: fetchedAt,
    };
}

export function parseOpenRateUsdCny(payload, fetchedAt = new Date().toISOString()) {
    const timestamp = Number(payload?.time_last_update_unix);
    return {
        base: "USD",
        quote: "CNY",
        rate: positiveRate(payload?.rates?.CNY),
        source: "open-er-api",
        updatedAt: Number.isFinite(timestamp) && timestamp > 0
            ? new Date(timestamp * 1000).toISOString()
            : fetchedAt,
    };
}

export async function fetchLatestUsdCnyRate(options = {}) {
    const fetchImpl = options.fetchImpl || fetch;
    const fetchedAt = new Date().toISOString();
    try {
        return parseCoinbaseUsdCny(await fetchJson(COINBASE_RATE_URL, fetchImpl), fetchedAt);
    } catch (primaryError) {
        try {
            return parseOpenRateUsdCny(await fetchJson(OPEN_RATE_URL, fetchImpl), fetchedAt);
        } catch (fallbackError) {
            throw new AggregateError([primaryError, fallbackError], "USD/CNY exchange rate is unavailable");
        }
    }
}

export default async function handler(request, response) {
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader("Cache-Control", "public, s-maxage=600, stale-while-revalidate=86400");

    if (request.method === "OPTIONS") {
        response.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
        response.status(204).end();
        return;
    }
    if (request.method !== "GET") {
        response.status(405).json({ success: false, message: "Method Not Allowed" });
        return;
    }

    try {
        response.status(200).json({
            success: true,
            ...(await fetchLatestUsdCnyRate()),
            fetchedAt: new Date().toISOString(),
        });
    } catch (error) {
        response.setHeader("Cache-Control", "no-store");
        response.status(502).json({
            success: false,
            message: error instanceof Error ? error.message : "Exchange-rate query failed",
        });
    }
}
