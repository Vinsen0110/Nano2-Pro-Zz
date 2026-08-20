export const APILIO_FILE_MAX_BYTES = 20 * 1024 * 1024;
export const APILIO_REFERENCE_TARGET_BYTES = 18 * 1024 * 1024;
export const APILIO_UPLOAD_TIMEOUT_MS = 3 * 60 * 1000;

const APILIO_IMAGE_HOSTS = [
    "webstatic.aiproxy.vip",
    "files.closeai.fans",
    "cdn.gptbest.vip",
];

const REFERENCE_QUALITIES = [0.92, 0.84, 0.76, 0.68, 0.58, 0.48, 0.38, 0.3];
const REFERENCE_SCALES = [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.42, 0.35, 0.3, 0.25];

function abortError(signal) {
    return signal?.reason instanceof Error
        ? signal.reason
        : new DOMException("Aborted", "AbortError");
}

function throwIfAborted(signal) {
    if (signal?.aborted) throw abortError(signal);
}

export function apilioFilesEndpoint(baseUrl) {
    const root = String(baseUrl || "https://api.apilio.ai").trim().replace(/\/+$/, "");
    return `${root.replace(/\/v1$/i, "")}/v1/files`;
}

export function isApilioHostedImageUrl(value) {
    try {
        const url = new URL(String(value || ""));
        const hostname = url.hostname.toLowerCase();
        return url.protocol === "https:"
            && APILIO_IMAGE_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`));
    } catch {
        return false;
    }
}

export function apilioHostedReferenceUrl(reference) {
    const candidates = [reference?.remoteSourceUrl, reference?.url, reference?.dataUrl];
    return candidates.find(isApilioHostedImageUrl) || "";
}

async function decodeReferenceBlob(blob) {
    if (typeof createImageBitmap === "function") {
        try {
            const image = await createImageBitmap(blob, { imageOrientation: "from-image" });
            return {
                image,
                width: image.width,
                height: image.height,
                dispose: () => image.close?.(),
            };
        } catch {}
    }

    const objectUrl = URL.createObjectURL(blob);
    try {
        const image = await new Promise((resolve, reject) => {
            const element = new Image();
            element.onload = () => resolve(element);
            element.onerror = () => reject(new Error("Apilio 参考图解码失败"));
            element.src = objectUrl;
        });
        return {
            image,
            width: image.naturalWidth || image.width,
            height: image.naturalHeight || image.height,
            dispose: () => URL.revokeObjectURL(objectUrl),
        };
    } catch (error) {
        URL.revokeObjectURL(objectUrl);
        throw error;
    }
}

async function canvasBlob(canvas, type, quality) {
    if (typeof canvas.convertToBlob === "function") {
        return canvas.convertToBlob({ type, quality });
    }
    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => blob ? resolve(blob) : reject(new Error("Apilio 参考图编码失败")),
            type,
            quality,
        );
    });
}

async function encodeReferenceImage(image, width, height, quality) {
    const canvas = typeof OffscreenCanvas === "function"
        ? new OffscreenCanvas(width, height)
        : document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Apilio 参考图压缩失败");
    context.drawImage(image, 0, 0, width, height);

    const webp = await canvasBlob(canvas, "image/webp", quality);
    if (webp.type === "image/webp") return webp;
    const jpeg = await canvasBlob(canvas, "image/jpeg", quality);
    if (jpeg.type === "image/jpeg") return jpeg;
    throw new Error("当前浏览器不支持 Apilio 参考图压缩");
}

export async function prepareApilioReferenceBlob(blob, options = {}) {
    const targetBytes = options.targetBytes || APILIO_REFERENCE_TARGET_BYTES;
    const maxBytes = options.maxBytes || APILIO_FILE_MAX_BYTES;
    if (!blob?.size) throw new Error("Apilio 参考图为空");
    if (blob.size <= maxBytes) return blob;

    const decodeImage = options.decodeImage || decodeReferenceBlob;
    const encodeImage = options.encodeImage || encodeReferenceImage;
    const decoded = await decodeImage(blob);
    try {
        if (!decoded.width || !decoded.height) throw new Error("Apilio 参考图尺寸无效");
        let smallest = null;
        for (const scale of REFERENCE_SCALES) {
            const width = Math.max(1, Math.round(decoded.width * scale));
            const height = Math.max(1, Math.round(decoded.height * scale));
            for (const quality of REFERENCE_QUALITIES) {
                throwIfAborted(options.signal);
                const candidate = await encodeImage(decoded.image, width, height, quality);
                if (!smallest || candidate.size < smallest.size) smallest = candidate;
                if (candidate.size <= targetBytes) return candidate;
            }
        }
        if (smallest?.size <= maxBytes) return smallest;
        throw new Error("Apilio 临时参考图压缩后仍超过 20 MB");
    } finally {
        decoded.dispose?.();
    }
}

function uploadFilename(name, blob) {
    const requestedBase = String(name || "reference").replace(/\.[^.]+$/, "");
    const base = requestedBase
        .normalize("NFKD")
        .replace(/[^A-Za-z0-9_-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        || "reference";
    const extension = blob.type === "image/webp"
        ? "webp"
        : blob.type === "image/jpeg"
            ? "jpg"
            : blob.type === "image/png"
                ? "png"
                : "bin";
    return `${base}.${extension}`;
}

function responseError(payload, status) {
    return payload?.error?.message
        || payload?.message
        || `Apilio 文件上传失败（HTTP ${status}）`;
}

export async function uploadApilioReferenceBlob(config, originalBlob, options = {}) {
    const apiKey = String(config?.apiKey || "").trim();
    if (!apiKey) throw new Error("请先填写 Apilio API Key");

    const requestBlob = await prepareApilioReferenceBlob(originalBlob, options);
    if (requestBlob.size > APILIO_FILE_MAX_BYTES) {
        throw new Error("Apilio 临时参考图超过 20 MB");
    }

    const form = new FormData();
    form.set("file", requestBlob, uploadFilename(options.filename, requestBlob));
    options.onProgress?.({ progress: 2, stage: "uploading" });
    const fetchImpl = options.fetchImpl || fetch;
    const timeoutMs = options.timeoutMs || APILIO_UPLOAD_TIMEOUT_MS;
    const timeoutController = new AbortController();
    const timeout = setTimeout(() => timeoutController.abort(), timeoutMs);
    const signal = options.signal && typeof AbortSignal.any === "function"
        ? AbortSignal.any([options.signal, timeoutController.signal])
        : options.signal || timeoutController.signal;
    let response;
    try {
        response = await fetchImpl(apilioFilesEndpoint(config?.baseUrl), {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}` },
            body: form,
            signal,
        });
    } catch (error) {
        if (timeoutController.signal.aborted && !options.signal?.aborted) {
            throw new Error("Apilio 文件上传超时，请检查网络后重试");
        }
        throw error;
    } finally {
        clearTimeout(timeout);
    }
    const text = await response.text();
    let payload = {};
    try {
        payload = text ? JSON.parse(text) : {};
    } catch {
        payload = { message: text };
    }
    if (!response.ok) throw new Error(responseError(payload, response.status));
    const url = String(payload?.url || "").trim();
    if (!/^https?:\/\//i.test(url)) throw new Error("Apilio 文件上传成功但没有返回有效 URL");
    options.onProgress?.({ progress: 10, stage: "uploading" });
    return url;
}
