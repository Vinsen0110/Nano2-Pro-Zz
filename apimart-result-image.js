const APIMART_RESULT_HOSTS = ["getapib.org", "upload.apimart.ai"];

export function isApiMartResultImageUrl(value) {
    try {
        const url = new URL(String(value || ""));
        return url.protocol === "https:"
            && APIMART_RESULT_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
    } catch {
        return false;
    }
}

export async function fetchApiMartResultImage(value, options = {}) {
    if (!isApiMartResultImageUrl(value)) {
        throw new Error("Unsupported APIMart result image URL");
    }
    const response = await (options.fetchImpl || fetch)(String(value), {
        headers: {
            Accept: "image/*",
            "Accept-Encoding": "identity",
        },
        redirect: "manual",
        signal: options.signal,
    });
    if (!response.ok) {
        throw new Error(`APIMart result image request failed (${response.status})`);
    }
    const contentType = String(response.headers.get("content-type") || "").toLowerCase();
    if (contentType && !contentType.startsWith("image/")) {
        throw new Error("APIMart result URL did not return an image");
    }
    return response;
}
