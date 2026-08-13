import { inlineTudouGeminiReferences, isTudouGeminiImageTarget } from "../tudou-reference-images.js";

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

function errorMessage(error, fallback = "Tudou API connection failed") {
    return error instanceof Error && error.message ? error.message : fallback;
}

function sseData(value) {
    return `data: ${JSON.stringify(value)}\n\n`;
}

function streamTudouGemini(request, target, headers, payload) {
    const encoder = new TextEncoder();
    const abortController = new AbortController();
    const abort = () => abortController.abort(request.signal.reason);
    request.signal.addEventListener("abort", abort, { once: true });

    const body = new ReadableStream({
        start(controller) {
            let closed = false;
            let heartbeat;
            const enqueue = (chunk) => {
                if (!closed && !abortController.signal.aborted) {
                    controller.enqueue(typeof chunk === "string" ? encoder.encode(chunk) : chunk);
                }
            };
            const finish = () => {
                if (closed) return;
                closed = true;
                clearInterval(heartbeat);
                request.signal.removeEventListener("abort", abort);
                if (!abortController.signal.aborted) controller.close();
            };
            heartbeat = setInterval(() => enqueue(": tudou-proxy\n\n"), 5_000);
            enqueue(": tudou-proxy\n\n");

            void (async () => {
                try {
                    const normalized = await inlineTudouGeminiReferences(target, payload, {
                        signal: abortController.signal,
                    });
                    const upstream = await fetch(target, {
                        method: "POST",
                        headers,
                        body: JSON.stringify(normalized.payload),
                        redirect: "manual",
                        signal: abortController.signal,
                    });
                    clearInterval(heartbeat);

                    if (!upstream.ok) {
                        const raw = await upstream.text();
                        let message = raw || `Tudou request failed (${upstream.status})`;
                        try {
                            const parsed = JSON.parse(raw);
                            message = parsed?.error?.message || parsed?.message || message;
                        } catch {
                            // Keep the upstream text when it is not JSON.
                        }
                        enqueue(sseData({ error: { message } }));
                        return;
                    }

                    const contentType = String(upstream.headers.get("content-type") || "");
                    if (!contentType.includes("text/event-stream")) {
                        const raw = await upstream.text();
                        try {
                            enqueue(sseData(JSON.parse(raw)));
                        } catch {
                            enqueue(sseData({ error: { message: raw || "Tudou returned an empty response" } }));
                        }
                        return;
                    }

                    if (!upstream.body) {
                        enqueue(sseData({ error: { message: "Tudou stream returned no body" } }));
                        return;
                    }
                    const reader = upstream.body.getReader();
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        enqueue(value);
                    }
                } catch (error) {
                    if (!abortController.signal.aborted) {
                        console.error("Tudou streaming proxy request failed", errorMessage(error));
                        enqueue(sseData({ error: { message: errorMessage(error) } }));
                    }
                } finally {
                    finish();
                }
            })();
        },
        cancel(reason) {
            abortController.abort(reason);
            request.signal.removeEventListener("abort", abort);
        },
    });

    return new Response(body, {
        status: 200,
        headers: {
            "Cache-Control": "no-store",
            "Content-Type": "text/event-stream; charset=utf-8",
            "X-Accel-Buffering": "no",
            "X-Tudou-Proxy": "vercel-node-stream",
            "X-Tudou-References-Inlined": "pending",
        },
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
        let convertedReferences = 0;
        let body;
        if (method !== "GET" && method !== "HEAD") {
            const rawBody = await request.arrayBuffer();
            if (isTudouGeminiImageTarget(target) && contentType?.includes("application/json")) {
                const payload = JSON.parse(new TextDecoder().decode(rawBody));
                return streamTudouGemini(request, target, headers, payload);
            } else {
                body = rawBody;
            }
        }
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
            "X-Tudou-References-Inlined": String(convertedReferences),
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
