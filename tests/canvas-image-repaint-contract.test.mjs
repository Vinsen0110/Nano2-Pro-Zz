import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const bundle = await readFile(new URL("../assets/index-B2KJ37fm.js", import.meta.url), "utf8");

test("canvas images repaint as soon as a new source finishes decoding", () => {
    assert.match(bundle, /function forceCanvasImageRepaint\(e\)/);
    assert.match(bundle, /onLoad:f=>\{const m=f\.currentTarget/);
    assert.match(bundle, /typeof m\.decode==="function"\?m\.decode\(\)\.catch\(\(\)=>\{\}\)\.finally\(h\)/);
    assert.match(bundle, /requestAnimationFrame\(\(\)=>\{t\.style\.transform=n\}\)/);
    assert.match(bundle, /style:\{objectFit:[^}]+\}\},l\):y\.jsx\("div"/);
});
