import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const server = await readFile(new URL("../local-preview-server.mjs", import.meta.url), "utf8");

test("local preview keeps model SVG icons in the browser cache", () => {
    assert.ok(server.includes('const isIconAsset = pathname === "/icons" || pathname.startsWith("/icons/");'));
    assert.match(
        server,
        /"Cache-Control": isIconAsset\s*\?\s*"public, max-age=31536000, immutable"\s*:\s*"no-store"/,
    );
});
