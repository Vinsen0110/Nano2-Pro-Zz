const APOLLO_ORIGIN = "https://api.apilio.ai";

export default async function handler(request, response) {
    if (request.method === "OPTIONS") {
        response.setHeader("Access-Control-Allow-Origin", "*");
        response.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
        response.setHeader("Access-Control-Allow-Headers", "Content-Type");
        response.status(204).end();
        return;
    }

    if (request.method !== "POST") {
        response.status(405).json({ success: false, message: "Method Not Allowed" });
        return;
    }

    try {
        const body = typeof request.body === "string" ? JSON.parse(request.body || "{}") : request.body || {};
        const userId = String(body.userId || "").trim();
        const token = String(body.token || "").trim();
        const baseUrl = String(body.baseUrl || "").trim();
        if (!userId || !token || !baseUrl) {
            response.status(400).json({ success: false, message: "Missing userId, token or baseUrl" });
            return;
        }

        let configuredOrigin;
        try {
            configuredOrigin = new URL(baseUrl).origin;
        } catch {
            response.status(400).json({ success: false, message: "Invalid Apollo baseUrl" });
            return;
        }
        if (configuredOrigin !== APOLLO_ORIGIN) {
            response.status(400).json({ success: false, message: "Unsupported balance provider" });
            return;
        }

        const upstream = await fetch(`${APOLLO_ORIGIN}/api/user/self`, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
                "New-API-User": userId,
            },
        });
        const text = await upstream.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch {
            data = { success: false, message: text || "Invalid upstream response" };
        }

        response.setHeader("Access-Control-Allow-Origin", "*");
        response.status(upstream.status).json(data);
    } catch (error) {
        response.status(500).json({ success: false, message: error instanceof Error ? error.message : "Balance proxy failed" });
    }
}
