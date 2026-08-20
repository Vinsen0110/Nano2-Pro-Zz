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
    assert.match(statusComponent, /a=null/);
    assert.doesNotMatch(statusComponent, /a=normalizeImageTaskProgress\(n\)/);

    assert.match(bundle, /function createGenerationProgressUpdater\(/);
    assert.match(bundle, /function createRemoteImageProgressUpdater\(/);
});

test("canvas distinguishes reference upload from image generation", () => {
    const statusStart = bundle.indexOf("function uX(");
    const statusEnd = bundle.indexOf("function dX(", statusStart);
    const statusComponent = bundle.slice(statusStart, statusEnd);

    assert.match(statusComponent, /stage:r/);
    assert.match(statusComponent, /r==="uploading"\?"\\u4E0A\\u4F20\\u4E2D":"\\u751F\\u6210\\u4E2D"/);
    assert.match(bundle, /stage:e\.node\.metadata\?\.generationStage/);
    assert.match(bundle, /generationStage:[a-z],generationProgress:[a-z]/);
});
