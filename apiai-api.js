export const APIAI_SITE_ID = "apiai";
export const APIAI_SITE_NAME = "ApiAI";
export const APIAI_BASE_URL = "";
export const APIAI_SITE_MODELS = ["nano-banana-pro"];
export const APIAI_IMAGE_MODELS = ["nano-banana-pro"];
export const APIAI_TEXT_MODELS = [];

const TASK_TIMEOUT_MS = 5 * 60 * 1000;

export function isApiAiSite(config) {
    return config?.provider === "apiai"
        || String(config?.baseUrl || "").includes("apiai");
}

export function apiAiResolution(config) {
    const value = String(config?.quality || "auto").trim().toLowerCase();
    if (["1k", "2k", "4k"].includes(value)) return value;
    if (["low", "standard", "auto"].includes(value)) return "1k";
    if (["medium", "hd"].includes(value)) return "2k";
    if (value === "high") return "4k";
    return "1k";
}

export function apiAiBackendModel(config) {
    const resolution = apiAiResolution(config);
    return resolution === "4k"
        ? "gemini-3-pro-image-preview-4k"
        : resolution === "2k"
            ? "gemini-3-pro-image-preview-2k"
            : "gemini-3-pro-image-preview";
}

// The provider docs do not publish a stable per-image price, so the UI keeps this as unknown.
export function apiAiImagePrice() {
    return null;
}

function apiAiRoot(baseUrl) {
    return String(baseUrl || "").trim().replace(/\/+$/, "").replace(/\/v1$/i, "");
}

export function apiAiUrl(baseUrl, path) {
    const root = apiAiRoot(baseUrl);
    if (!root) throw new Error("请先在 API 设置中填写 ApiAI API Base URL");
    return `${root}${String(path || "").startsWith("/") ? path : `/${path}`}`;
}

function ratioSize(config) {
    const resolution = apiAiResolution(config);
    const max = resolution === "4k" ? 4096 : resolution === "2k" ? 2048 : 1024;
    const raw = String(config?.size || "auto").trim().toLowerCase();
    if (/^\d+x\d+$/.test(raw)) return raw;
    const match = raw.match(/^(\d+)\s*:\s*(\d+)$/);
    if (!match) return `${max}x${max}`;
    const widthRatio = Number(match[1]);
    const heightRatio = Number(match[2]);
    if (!(widthRatio > 0 && heightRatio > 0)) return `${max}x${max}`;
    const scale = max / Math.max(widthRatio, heightRatio);
    const width = Math.max(16, Math.round((widthRatio * scale) / 16) * 16);
    const height = Math.max(16, Math.round((heightRatio * scale) / 16) * 16);
    return `${width}x${height}`;
}

export function apiAiImageRequestSpec(config, prompt, hasReferences = false) {
    return {
        endpoint: hasReferences ? "/v1/images/edits" : "/v1/images/generations",
        model: apiAiBackendModel(config),
        body: {
            prompt: String(prompt || "").trim(),
            n: 1,
            model: apiAiBackendModel(config),
            size: ratioSize(config),
        },
    };
}

function responseMessage(payload, fallback) {
    return String(
        payload?.error?.message
        || payload?.message
        || payload?.msg
        || fallback,
    ).trim();
}

async function readJson(response) {
    const text = await response.text();
    let payload = {};
    try { payload = text ? JSON.parse(text) : {}; } catch { payload = { message: text }; }
    if (!response.ok) {
        const error = new Error(responseMessage(payload, `ApiAI 请求失败（HTTP ${response.status}）`));
        error.status = response.status;
        throw error;
    }
    return payload;
}

function imageUrls(payload) {
    const candidates = [payload?.data, payload?.result, payload?.output, payload];
    return candidates.flatMap((value) => Array.isArray(value) ? value : [])
        .map((item) => String(item?.url || item?.image_url || item?.b64_json || "").trim())
        .filter(Boolean)
        .map((value) => value.startsWith("data:") ? value : value);
}

function taskId(payload) {
    for (const value of [payload, payload?.data, payload?.result]) {
        const id = value?.task_id ?? value?.taskId ?? value?.id;
        if (typeof id === "string" || typeof id === "number") return String(id);
    }
    return "";
}

function taskStatus(payload) {
    return String(payload?.status || payload?.data?.status || payload?.result?.status || "").toLowerCase();
}

async function pollApiAiTask(config, id, signal, onProgress, fetchImpl) {
    const started = Date.now();
    while (Date.now() - started < TASK_TIMEOUT_MS) {
        if (signal?.aborted) throw signal.reason || new DOMException("Aborted", "AbortError");
        const payload = await readJson(await fetchImpl(apiAiUrl(config.baseUrl, `/v1/images/tasks/${encodeURIComponent(id)}`), {
            headers: { Authorization: `Bearer ${String(config.apiKey || "").trim()}`, Accept: "application/json" },
            signal,
        }));
        const urls = imageUrls(payload);
        const status = taskStatus(payload);
        if (urls.length) {
            onProgress?.({ progress: 100, stage: "completed" });
            return urls;
        }
        if (["failed", "error", "cancelled", "canceled"].includes(status)) {
            throw new Error(responseMessage(payload, "ApiAI 图像任务失败"));
        }
        onProgress?.({ progress: Math.min(95, 10 + Math.floor((Date.now() - started) / 3000)), stage: "generating" });
        await new Promise((resolve, reject) => {
            const timer = setTimeout(resolve, 2000);
            signal?.addEventListener("abort", () => { clearTimeout(timer); reject(signal.reason || new DOMException("Aborted", "AbortError")); }, { once: true });
        });
    }
    throw new Error("ApiAI 图像生成超时，请稍后重试");
}

async function blobFromReference(reference, fetchImpl) {
    if (reference instanceof Blob) return reference;
    const response = await fetchImpl(String(reference), { cache: "no-store" });
    if (!response.ok) throw new Error(`ApiAI 参考图读取失败（HTTP ${response.status}）`);
    return response.blob();
}

export async function runApiAiImageGeneration(config, prompt, referenceUrls = [], options = {}) {
    const fetchImpl = options.fetchImpl || fetch;
    const signal = options.signal;
    const hasReferences = referenceUrls.length > 0;
    const spec = apiAiImageRequestSpec(config, prompt, hasReferences);
    const headers = { Authorization: `Bearer ${String(config.apiKey || "").trim()}`, Accept: "application/json" };
    let body;
    if (hasReferences) {
        const form = new FormData();
        form.set("prompt", spec.body.prompt);
        form.set("n", String(spec.body.n));
        form.set("model", spec.body.model);
        form.set("size", spec.body.size);
        for (let index = 0; index < referenceUrls.length; index += 1) {
            const blob = await blobFromReference(referenceUrls[index], fetchImpl);
            form.append("image", blob, `reference-${index + 1}.png`);
        }
        body = form;
    } else {
        headers["Content-Type"] = "application/json";
        body = JSON.stringify(spec.body);
    }
    options.onProgress?.({ progress: 10, stage: "generating" });
    const response = await fetchImpl(`${apiAiUrl(config.baseUrl, spec.endpoint)}?async=true`, {
        method: "POST",
        headers,
        body,
        signal,
    });
    const payload = await readJson(response);
    const id = taskId(payload);
    if (id) return pollApiAiTask(config, id, signal, options.onProgress, fetchImpl);
    const urls = imageUrls(payload);
    if (!urls.length) throw new Error("ApiAI 返回成功但没有图片地址");
    options.onProgress?.({ progress: 100, stage: "completed" });
    return urls;
}

export function apiAiQuotaToBalance(quota) {
    const value = Number(quota);
    return Number.isFinite(value) ? value / 500000 : null;
}

export async function fetchApiAiKeyBalance(config, userId, fetchImpl = fetch) {
    const response = await fetchImpl(apiAiUrl(config.baseUrl, `/api/token/key/${encodeURIComponent(config.apiKey || "")}`), {
        headers: { "Rix-Api-User": String(userId || "").trim(), Accept: "application/json" },
        cache: "no-store",
    });
    const payload = await readJson(response);
    return apiAiQuotaToBalance(payload?.quota ?? payload?.data?.quota);
}

export async function fetchApiAiAccountBalance(config, userId, token, fetchImpl = fetch) {
    const response = await fetchImpl(apiAiUrl(config.baseUrl, "/api/user/self"), {
        headers: {
            "Rix-Api-User": String(userId || "").trim(),
            Authorization: `Bearer ${String(token || "").trim()}`,
            Accept: "application/json",
        },
        cache: "no-store",
    });
    const payload = await readJson(response);
    return apiAiQuotaToBalance(payload?.quota ?? payload?.data?.quota);
}
