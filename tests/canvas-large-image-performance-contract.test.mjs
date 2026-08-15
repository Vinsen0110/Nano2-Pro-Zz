import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const bundle = await readFile(new URL("../assets/index-B2KJ37fm.js", import.meta.url), "utf8");

test("canvas images remain mounted while the viewport moves", () => {
    assert.doesNotMatch(bundle, /function useCanvasImageVisibility\(\)/);
    assert.doesNotMatch(bundle, /rootMargin:"640px"/);
    assert.match(bundle, /\[d,f\]=c\.useState\(\(\)=>n\)/);
    assert.match(bundle, /if\(!n\)return f\(""\)/);
    assert.match(bundle, /children:d\?y\.jsx\("img"/);
    assert.match(bundle, /return f\(n\),acquireCanvasPreview\(/);
});

test("large previews persist in IndexedDB and are reused after reload", () => {
    assert.match(bundle, /storeName:"canvas_previews"/);
    assert.match(bundle, /function canvasPreviewPersistentKey\(/);
    assert.match(bundle, /function loadOrCreateCanvasPreview\(/);
    assert.match(bundle, /await a\.getItem\(o\)/);
    assert.match(bundle, /await a\.setItem\(o,\{blob:i,lastUsed:Date\.now\(\)\}\)/);
});

test("preview generation stays queued and both caches stay bounded", () => {
    assert.match(bundle, /t\?canvasPreviewQueue\(\)\.pending\.unshift\(o\):canvasPreviewQueue\(\)\.pending\.push\(o\)/);
    assert.match(bundle, /Date\.now\(\)-new Date\(t\.generatedAt\|\|0\)\.getTime\(\)<6e4/);
    assert.match(bundle, /for\(;e\.active<2&&e\.pending\.length;\)/);
    assert.match(bundle, /if\(e\.size<=96\)return/);
    assert.match(bundle, /setTimeout\(\(\)=>\{i\.refs===0[^}]+\},6e4\)/);
    assert.match(bundle, /t\.length>160/);
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
