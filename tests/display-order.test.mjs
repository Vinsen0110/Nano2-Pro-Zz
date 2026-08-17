import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
    SITE_DISPLAY_ORDER,
    orderModelReferences,
    orderRatioPresets,
    orderSiteChannels,
} from "../display-order.js";

const bundle = await readFile(new URL("../assets/index-B2KJ37fm.js", import.meta.url), "utf8");

test("site displays use RH, Apilio, Tudou order without mutating stored channels", () => {
    const channels = [
        { id: "default", name: "Apilio" },
        { id: "tudou", name: "Tudou" },
        { id: "runninghub", name: "RH" },
    ];

    assert.deepEqual(SITE_DISPLAY_ORDER, ["runninghub", "default", "tudou"]);
    assert.deepEqual(orderSiteChannels(channels).map(({ name }) => name), ["RH", "Apilio", "Tudou"]);
    assert.deepEqual(channels.map(({ name }) => name), ["Apilio", "Tudou", "RH"]);
    assert.deepEqual(
        orderModelReferences([
            "tudou::gpt-image-2",
            "default::nano-banana-pro",
            "runninghub::gpt-image-2",
            "runninghub::nano-banana-pro",
        ]),
        [
            "runninghub::gpt-image-2",
            "runninghub::nano-banana-pro",
            "default::nano-banana-pro",
            "tudou::gpt-image-2",
        ],
    );
});

test("ratio displays keep Auto first and sort by numerator then denominator", () => {
    const values = ["auto", "1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9", "2:1", "1:2", "3:1", "1:3", "9:21"];
    assert.deepEqual(
        orderRatioPresets(values.map((value) => ({ value }))).map(({ value }) => value),
        ["auto", "1:1", "1:2", "1:3", "2:1", "2:3", "3:1", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "9:21", "16:9", "21:9"],
    );
});

test("all site and ratio selectors use the shared display order", () => {
    assert.match(bundle, /from"\.\.\/display-order\.js"/);
    assert.match(bundle, /orderSiteChannels\(a\.channels\)\.map/);
    assert.match(bundle, /orderSiteChannels\(siteConfig\.channels\|\|\[\]\)\.map/);
    assert.match(bundle, /orderModelReferences\(Array\.from\(new Set/);
    assert.match(bundle, /orderModelReferences\(CS\(e,"image"\)\.filter\(mke\)\)/);
    assert.match(bundle, /options:orderRatioPresets\(isGptImageConfig\?/);
    assert.match(bundle, /ratioPresets=orderRatioPresets\(isGptImageModel\?/);
    assert.match(bundle, /items:orderRatioPresets\(v\?/);
});
