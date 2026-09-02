import { Readable } from "node:stream";

import { fetchApiMartResultImage } from "../apimart-result-image.js";

export default async function handler(request, response) {
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader("Cache-Control", "no-store");

    if (request.method === "OPTIONS") {
        response.setHeader("Access-Control-Allow-Methods", "GET,HEAD,OPTIONS");
        response.status(204).end();
        return;
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
        response.status(405).json({ error: { message: "Method Not Allowed" } });
        return;
    }

    try {
        const upstream = await fetchApiMartResultImage(request.query?.url);
        response.status(upstream.status);
        response.setHeader("Content-Type", upstream.headers.get("content-type") || "image/png");
        const contentLength = upstream.headers.get("content-length");
        if (contentLength) response.setHeader("Content-Length", contentLength);
        if (request.method === "HEAD" || !upstream.body) {
            response.end();
            return;
        }
        await new Promise((resolve, reject) => {
            const stream = Readable.fromWeb(upstream.body);
            stream.on("error", reject);
            response.on("finish", resolve);
            response.on("error", reject);
            stream.pipe(response);
        });
    } catch (error) {
        response.status(502).json({
            error: { message: error instanceof Error ? error.message : "APIMart image proxy failed" },
        });
    }
}
