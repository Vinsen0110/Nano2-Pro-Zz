import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const bundle = await readFile(new URL("../assets/index-B2KJ37fm.js", import.meta.url), "utf8");

test("canvas generation status hides percentages without disabling task progress", () => {
    const statusStart = bundle.indexOf("function uX(");
    const statusEnd = bundle.indexOf("function dX(", statusStart);
    assert.notEqual(statusStart, -1);
    assert.notEqual(statusEnd, -1);

    const statusComponent = bundle.slice(statusStart, statusEnd);
    assert.match(statusComponent, /o=null/);
    assert.doesNotMatch(statusComponent, /o=normalizeImageTaskProgress\(n\)/);

    assert.match(bundle, /function createGenerationProgressUpdater\(/);
    assert.match(bundle, /function createRemoteImageProgressUpdater\(/);
});
