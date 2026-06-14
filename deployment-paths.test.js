import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const deploymentFiles = [
  "index.html",
  "app.js",
  "manifest.webmanifest",
  "sw.js",
];

test("static assets do not assume the site is hosted at the domain root", async () => {
  for (const file of deploymentFiles) {
    const source = await readFile(new URL(file, import.meta.url), "utf8");
    assert.doesNotMatch(source, /(?:src|href)="\/(?!\/)/, `${file} has a root-relative asset`);
    assert.doesNotMatch(source, /(?:fetch|register)\("\/(?!\/)/, `${file} has a root-relative request`);
  }
});
