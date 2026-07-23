const TUDOU_ORIGIN = "https://api.ai-tudou.net";
const ALLOWED_METHODS = new Set(["GET", "HEAD", "OPTIONS", "POST"]);
const ALLOWED_PATH = /^\/(?:images|tasks|v1|v1beta)(?:\/|$)/;

export const config = {
    maxDuration: 300,
};

function jsonResponse(status, message) {
    return Response.json({ error: { message } }, {
        status,
        headers: { "Cache-Control": "no-store" },
    });
}

function upstreamTarget(requestUrl) {
    const path = requestUrl.searchParams.get("path") || "";
    requestUrl.searchParams.delete("path");

    const normalizedPath = `/${path.replace(/^\/+/, "")}`;
    let validationPath = normalizedPath;
    for (let pass = 0; pass < 4; pass += 1) {
        try {
            const decodedPath = decodeURIComponent(validationPath);
            if (decodedPath === validationPath) break;
            validationPath = decodedPath;
        } catch {
            return null;
        }
    }

    const target = new URL(normalizedPath, TUDOU_ORIGIN);
    const validationTarget = new URL(validationPath, TUDOU_ORIGIN);
    if (
        target.origin !== TUDOU_ORIGIN
        || validationTarget.origin !== TUDOU_ORIGIN
        || !ALLOWED_PATH.test(target.pathname)
        || !ALLOWED_PATH.test(validationTarget.pathname)
        || validationPath.split(/[\\/]/).includes("..")
    ) {
        return null;
    }

    requestUrl.searchParams.forEach((value, key) => target.searchParams.append(key, value));
    return target;
}

async function proxyTudou(request) {
    const method = request.method.toUpperCase();
    if (!ALLOWED_METHODS.has(method)) {
        return jsonResponse(405, "Method Not Allowed");
    }
    if (method === "OPTIONS") {
        return new Response(null, {
            status: 204,
            headers: { Allow: "GET, HEAD, OPTIONS, POST" },
        });
    }

    const target = upstreamTarget(new URL(request.url));
    if (!target) return jsonResponse(404, "Unsupported Tudou API path");

    const authorization = request.headers.get("authorization");
    if (!authorization) return jsonResponse(401, "Missing Authorization header");

    const headers = new Headers({
        Accept: request.headers.get("accept") || "application/json",
        "Accept-Encoding": "identity",
        Authorization: authorization,
    });
    const contentType = request.headers.get("content-type");
    if (contentType) headers.set("Content-Type", contentType);

    try {
        const body = method === "GET" || method === "HEAD"
            ? undefined
            : await request.arrayBuffer();
        const upstream = await fetch(target, {
            method,
            headers,
            body,
            redirect: "manual",
            signal: request.signal,
        });

        const responseHeaders = new Headers({
            "Cache-Control": "no-store",
            "Content-Type": upstream.headers.get("content-type") || "application/json; charset=utf-8",
            "X-Tudou-Proxy": "vercel-node-stream",
        });
        for (const name of ["retry-after", "x-oneapi-request-id", "x-request-id"]) {
            const value = upstream.headers.get(name);
            if (value) responseHeaders.set(name, value);
        }

        // Returning the upstream stream avoids Vercel's buffered response-size limit.
        return new Response(method === "HEAD" ? null : upstream.body, {
            status: upstream.status,
            statusText: upstream.statusText,
            headers: responseHeaders,
        });
    } catch (error) {
        if (request.signal.aborted) return jsonResponse(499, "Request cancelled");
        console.error("Tudou proxy request failed", error instanceof Error ? error.message : error);
        return jsonResponse(502, "Tudou API connection failed");
    }
}

export default {
    fetch: proxyTudou,
};
