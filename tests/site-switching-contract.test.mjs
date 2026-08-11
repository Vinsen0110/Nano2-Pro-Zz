import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const bundle = await readFile(new URL("../assets/index-B2KJ37fm.js", import.meta.url), "utf8");
const indexHtml = await readFile(new URL("../index.html", import.meta.url), "utf8");

test("settings site tabs only change the site being edited", () => {
    assert.match(bundle, /\[configSiteId,setConfigSiteId\]=c\.useState\(null\)/);
    assert.match(
        bundle,
        /k=\$=>\{setEditingKeyId\(null\),setKeyMenuOpen\(!1\),setConfigSiteId\(\$\)\}/,
    );
    assert.doesNotMatch(
        bundle,
        /k=\$=>\{setEditingKeyId\(null\),setKeyMenuOpen\(!1\);const j=buildSiteConfigPatch/,
    );
    assert.match(
        bundle,
        /j!==void 0&&v===a\.activeSiteId\?\{apiKey:j\}:\{\}/,
        "editing an inactive site must not replace the active top-level API key",
    );
});

test("the bottom-left control exposes explicit site choices", () => {
    assert.match(bundle, /className:"canvas-site-menu",role:"menu"/);
    assert.match(bundle, /role:"menuitemradio","aria-checked":f\.id===activeSite\?\.id/);
    assert.match(bundle, /onClick:\(\)=>selectSite\(f\.id\)/);
    assert.match(
        bundle,
        /selectSite=f=>\{const m=buildSiteConfigPatch\(siteConfig,f\);m&&\(patchSiteConfig\(m\),setSiteMenuOpen\(!1\)\)\}/,
    );
    assert.doesNotMatch(bundle, /switchSite=\(\)=>/);
    assert.match(indexHtml, /\.canvas-site-menu-item\.is-active/);
});

test("the current canvas site name has stronger visual emphasis", () => {
    assert.match(
        bundle,
        /className:"canvas-site-current-label","aria-live":"polite",children:\["\\u5F53\\u524D\\uFF1A",y\.jsx\("strong"/,
    );
    assert.match(indexHtml, /\.canvas-site-current-label strong \{[^}]*font-weight: 800/s);
    assert.match(indexHtml, /index-B2KJ37fm\.js\?v=20260811-32/);
});
