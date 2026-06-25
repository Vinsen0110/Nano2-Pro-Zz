const TARGETS = (process.env.ACCOUNT_BALANCE_TARGETS || 'https://api.apilio.ai,https://gpt-best.com')
    .split(',')
    .map((item) => item.trim().replace(/\/+$/, ''))
    .filter(Boolean);

function sendJson(res, status, payload) {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.end(JSON.stringify(payload));
}

async function fetchAccountBalance(target, token, userId) {
    const response = await fetch(`${target}/api/user/self?_t=${Date.now()}`, {
        headers: {
            Authorization: `Bearer ${token}`,
            'New-API-User': userId
        },
        cache: 'no-store'
    });

    const text = await response.text();
    let data;
    try {
        data = text ? JSON.parse(text) : {};
    } catch {
        data = { message: text || response.statusText };
    }

    return {
        ok: response.ok,
        status: response.status,
        target,
        data
    };
}

module.exports = async function handler(req, res) {
    if (req.method === 'OPTIONS') {
        sendJson(res, 204, {});
        return;
    }

    if (req.method !== 'POST') {
        sendJson(res, 405, { success: false, message: 'Method not allowed' });
        return;
    }

    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
        const token = String(body.token || '').trim();
        const userId = String(body.userId || '').trim();

        if (!token || !userId) {
            sendJson(res, 400, { success: false, message: '缺少系统令牌或用户 ID' });
            return;
        }

        const failures = [];
        for (const target of TARGETS) {
            try {
                const result = await fetchAccountBalance(target, token, userId);
                if (result.ok && result.data?.success !== false) {
                    sendJson(res, 200, result.data);
                    return;
                }
                failures.push(`${target}: ${result.data?.message || result.data?.error || result.status}`);
            } catch (error) {
                failures.push(`${target}: ${error.message}`);
            }
        }

        sendJson(res, 502, {
            success: false,
            message: failures.join('；') || '账户余额接口请求失败'
        });
    } catch (error) {
        sendJson(res, 500, { success: false, message: error.message });
    }
};
