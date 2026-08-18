export const USD_CNY_CACHE_KEY = "old-house:usd-cny-rate:v1";
export const USD_CNY_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function positiveNumber(value, label) {
    const number = Number.parseFloat(String(value ?? ""));
    if (!Number.isFinite(number) || number < 0) throw new Error(`${label} is invalid`);
    return number;
}

function positiveRate(value) {
    const rate = positiveNumber(value, "USD/CNY rate");
    if (rate === 0) throw new Error("USD/CNY rate is invalid");
    return rate;
}

function rateApiOrigin() {
    if (typeof location === "undefined") return "";
    const hostedFallback = Boolean(globalThis.oldHouseDesktop)
        || location.hostname === "127.0.0.1"
        || location.hostname === "localhost"
        || location.hostname === "vinsen0110.github.io";
    return hostedFallback ? "https://www.vinsen.top" : "";
}

function readCachedRate(storage, now) {
    if (!storage) return null;
    try {
        const cached = JSON.parse(storage.getItem(USD_CNY_CACHE_KEY) || "null");
        const cachedAt = Number(cached?.cachedAt);
        if (!Number.isFinite(cachedAt) || now - cachedAt > USD_CNY_CACHE_MAX_AGE_MS) return null;
        return {
            base: "USD",
            quote: "CNY",
            rate: positiveRate(cached.rate),
            source: String(cached.source || "cached"),
            updatedAt: String(cached.updatedAt || new Date(cachedAt).toISOString()),
            fetchedAt: String(cached.fetchedAt || new Date(cachedAt).toISOString()),
            stale: true,
        };
    } catch {
        return null;
    }
}

function writeCachedRate(storage, quote, now) {
    if (!storage) return;
    try {
        storage.setItem(USD_CNY_CACHE_KEY, JSON.stringify({ ...quote, cachedAt: now }));
    } catch {}
}

export async function fetchUsdCnyRate(options = {}) {
    const fetchImpl = options.fetchImpl || fetch;
    const storage = options.storage === undefined
        ? (typeof localStorage === "undefined" ? null : localStorage)
        : options.storage;
    const now = options.now ? options.now() : Date.now();
    const endpoint = options.endpoint || `${rateApiOrigin()}/api/exchange-rate`;

    try {
        const response = await fetchImpl(endpoint, {
            method: "GET",
            headers: { Accept: "application/json" },
            cache: "no-store",
            signal: options.signal,
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload?.success === false) {
            throw new Error(String(payload?.message || `Exchange-rate query failed with ${response.status}`));
        }
        const quote = {
            base: "USD",
            quote: "CNY",
            rate: positiveRate(payload?.rate),
            source: String(payload?.source || "exchange-rate-api"),
            updatedAt: String(payload?.updatedAt || payload?.fetchedAt || new Date(now).toISOString()),
            fetchedAt: String(payload?.fetchedAt || new Date(now).toISOString()),
            stale: false,
        };
        writeCachedRate(storage, quote, now);
        return quote;
    } catch (error) {
        const cached = readCachedRate(storage, now);
        if (cached) return cached;
        throw error;
    }
}

export function convertUsdToCny(usd, rate) {
    return Number((positiveNumber(usd, "USD balance") * positiveRate(rate)).toFixed(4));
}

function fixed(value, digits) {
    return Number(value).toLocaleString("zh-CN", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    });
}

export function formatUsdCnyDetail({ usd, rate, updatedAt, stale = false }) {
    const time = updatedAt
        ? new Date(updatedAt).toLocaleString("zh-CN", { hour12: false })
        : "";
    return `RH 原始余额 US$${fixed(usd, 2)} · 汇率 1 USD = ${fixed(rate, 4)} CNY${stale ? " · 缓存汇率" : ""}${time ? ` · 更新 ${time}` : ""}`;
}

export function formatUsdFallbackDetail(usd) {
    return `RH 原始余额 US$${fixed(usd, 2)} · 汇率暂不可用，当前显示美元余额`;
}
