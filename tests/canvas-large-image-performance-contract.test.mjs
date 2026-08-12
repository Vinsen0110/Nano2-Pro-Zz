import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const bundle = await readFile(new URL("../assets/index-B2KJ37fm.js", import.meta.url), "utf8");

test("large canvas images render immediately and optimize in the background", () => {
    assert.match(bundle, /function useCanvasImageVisibility\(\)/);
    assert.match(bundle, /rootMargin:"640px"/);
    assert.match(bundle, /\[d,f\]=c\.useState\(\(\)=>n\)/);
    assert.match(bundle, /return f\(n\),acquireCanvasPreview\(/);
    assert.doesNotMatch(bundle, /\[l,d\]=c\.useState\(\(\)=>a\?"":n\)/);
});

test("recent images get preview priority and the preview cache stays bounded", () => {
    assert.match(bundle, /t\?canvasPreviewQueue\(\)\.pending\.unshift\(o\):canvasPreviewQueue\(\)\.pending\.push\(o\)/);
    assert.match(bundle, /Date\.now\(\)-new Date\(t\.generatedAt\|\|0\)\.getTime\(\)<6e4/);
    assert.match(bundle, /if\(e\.size<=24\)return/);
});

test("all generated image results are displayed before browser cache persistence", () => {
    assert.match(bundle, /function queueCanvasGeneratedImageCache\(/);
    assert.match(bundle, /function cacheCanvasGeneratedImage\(/);
    assert.equal(
        (bundle.match(/queueCanvasGeneratedImageCache\(\{source:(?:nt|Er|bn)\.dataUrl/g) || []).length,
        4,
    );
    assert.doesNotMatch(bundle, /if\(isRemoteImageUrl\((?:nt|Er|bn)\.dataUrl\)\)/);
});
