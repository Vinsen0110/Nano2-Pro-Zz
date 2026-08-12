const MAX_REFERENCE_BYTES = 14 * 1024 * 1024;
const TUDOU_GEMINI_IMAGE_PATH = /^\/v1beta\/models\/[^/]+:(?:generateContent|streamGenerateContent)$/;

export function isImgBbImageUrl(value) {
    try {
        const url = new URL(String(value || ""));
        return url.protocol === "https:"
            && (url.hostname === "ibb.co" || url.hostname.endsWith(".ibb.co"));
    } catch {
        return false;
    }
}

export function isTudouGeminiImageTarget(target) {
    const url = target instanceof URL ? target : new URL(String(target));
    return TUDOU_GEMINI_IMAGE_PATH.test(url.pathname);
}

function imageMimeType(response) {
    const type = String(response.headers.get("content-type") || "")
        .split(";", 1)[0]
        .trim()
        .toLowerCase();
    return type.startsWith("image/") ? type : "";
}

async function inlineImgBbImage(fileUri, signal, fetchImpl) {
    const response = await fetchImpl(fileUri, {
        headers: { Accept: "image/*", "Accept-Encoding": "identity" },
        redirect: "follow",
        signal,
    });
    if (!response.ok) throw new Error(`ImgBB reference download failed (${response.status})`);
    if (!isImgBbImageUrl(response.url || fileUri)) {
        throw new Error("ImgBB reference redirected to an unsupported host");
    }

    const mimeType = imageMimeType(response);
    if (!mimeType) throw new Error("ImgBB reference did not return an image");
    const declaredBytes = Number(response.headers.get("content-length")) || 0;
    if (declaredBytes > MAX_REFERENCE_BYTES) {
        throw new Error("ImgBB reference exceeds the 14 MB limit");
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > MAX_REFERENCE_BYTES) {
        throw new Error("ImgBB reference exceeds the 14 MB limit");
    }
    return { mimeType, data: Buffer.from(bytes).toString("base64") };
}

export async function inlineTudouGeminiReferences(target, payload, options = {}) {
    if (!isTudouGeminiImageTarget(target) || !payload || typeof payload !== "object") {
        return { payload, converted: 0 };
    }

    const fetchImpl = options.fetchImpl || fetch;
    let converted = 0;
    for (const content of Array.isArray(payload.contents) ? payload.contents : []) {
        for (const part of Array.isArray(content?.parts) ? content.parts : []) {
            const fileData = part?.fileData || part?.file_data;
            const fileUri = fileData?.fileUri || fileData?.file_uri;
            if (!isImgBbImageUrl(fileUri)) continue;

            part.inlineData = await inlineImgBbImage(fileUri, options.signal, fetchImpl);
            delete part.fileData;
            delete part.file_data;
            converted += 1;
        }
    }
    return { payload, converted };
}
