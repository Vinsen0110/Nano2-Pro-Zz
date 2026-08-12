import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("the browser bundle parses as an ES module", () => {
    const bundleUrl = new URL("../assets/index-B2KJ37fm.js", import.meta.url);
    const result = spawnSync(
        process.execPath,
        [
            "--experimental-vm-modules",
            "--input-type=module",
            "--eval",
            `import { readFile } from "node:fs/promises";
             import vm from "node:vm";
             const source = await readFile(new URL(${JSON.stringify(bundleUrl.href)}), "utf8");
             new vm.SourceTextModule(source);`,
        ],
        { encoding: "utf8" },
    );
    assert.equal(result.status, 0, result.stderr || result.stdout);
});
