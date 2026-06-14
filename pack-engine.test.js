import test from "node:test";
import assert from "node:assert/strict";
import { buildPools, generatePack, getBestPull, weightedChoice } from "./pack-engine.js";

const rarities = [
  ["Common", 12],
  ["Uncommon", 12],
  ["Rare", 12],
  ["Double rare", 5],
  ["Illustration rare", 5],
  ["Ultra Rare", 5],
  ["Special illustration rare", 5],
  ["Mega Hyper Rare", 2],
];

const cards = rarities.flatMap(([rarity, count]) =>
  Array.from({ length: count }, (_, index) => ({
    id: `${rarity}-${index}`,
    localId: String(index + 1),
    name: `${rarity} ${index + 1}`,
    rarity,
  })),
);

test("buildPools groups the complete catalog by rarity", () => {
  const pools = buildPools(cards);
  assert.equal(pools.Common.length, 12);
  assert.equal(pools["Mega Hyper Rare"].length, 2);
});

test("weightedChoice respects deterministic random values", () => {
  const entries = [
    ["first", 50],
    ["second", 50],
  ];
  assert.equal(weightedChoice(entries, () => 0.1), "first");
  assert.equal(weightedChoice(entries, () => 0.9), "second");
});

test("generatePack creates the intended ten-card collation", () => {
  const pack = generatePack(cards, () => 0.25);
  assert.equal(pack.length, 10);
  assert.equal(pack.filter((card) => card.slot === "Common").length, 4);
  assert.equal(pack.filter((card) => card.slot === "Uncommon").length, 3);
  assert.equal(pack.filter((card) => card.foil).length, 3);
  assert.equal(new Set(pack.map((card) => card.id)).size, 10);
});

test("getBestPull returns the highest-rarity card", () => {
  const best = getBestPull([
    { rarity: "Common", name: "A" },
    { rarity: "Special illustration rare", name: "B" },
    { rarity: "Double rare", name: "C" },
  ]);
  assert.equal(best.name, "B");
});
