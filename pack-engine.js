export const RARITY_RANK = {
  Common: 0,
  Uncommon: 1,
  Rare: 2,
  "Double rare": 3,
  "Illustration rare": 4,
  "Ultra Rare": 5,
  "Special illustration rare": 6,
  "Mega Hyper Rare": 7,
};

export const SECOND_FOIL_PROFILE = [
  ["Common", 37],
  ["Uncommon", 35],
  ["Rare", 12.4],
  ["Illustration rare", 11.1],
  ["Ultra Rare", 3],
  ["Special illustration rare", 1],
  ["Mega Hyper Rare", 0.5],
];

export const RARE_SLOT_PROFILE = [
  ["Rare", 76.8],
  ["Double rare", 20],
  ["Ultra Rare", 2.5],
  ["Special illustration rare", 0.6],
  ["Mega Hyper Rare", 0.1],
];

export function buildPools(cards) {
  return cards.reduce((pools, card) => {
    if (!pools[card.rarity]) pools[card.rarity] = [];
    pools[card.rarity].push(card);
    return pools;
  }, {});
}

export function weightedChoice(entries, random = Math.random) {
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = random() * total;

  for (const [value, weight] of entries) {
    roll -= weight;
    if (roll < 0) return value;
  }

  return entries.at(-1)[0];
}

function pickCard(pool, used, random) {
  if (!pool?.length) throw new Error("A required rarity pool is empty.");
  const available = pool.filter((card) => !used.has(card.id));
  const candidates = available.length ? available : pool;
  const card = candidates[Math.floor(random() * candidates.length)];
  used.add(card.id);
  return card;
}

function pullFromProfile(pools, profile, used, random) {
  let rarity = weightedChoice(profile, random);
  if (!pools[rarity]?.length) {
    rarity = profile.find(([candidate]) => pools[candidate]?.length)?.[0];
  }
  return pickCard(pools[rarity], used, random);
}

export function generatePack(cards, random = Math.random) {
  const pools = buildPools(cards);
  const used = new Set();
  const pack = [];

  for (let index = 0; index < 4; index += 1) {
    pack.push({ ...pickCard(pools.Common, used, random), foil: false, slot: "Common" });
  }

  for (let index = 0; index < 3; index += 1) {
    pack.push({ ...pickCard(pools.Uncommon, used, random), foil: false, slot: "Uncommon" });
  }

  const firstFoilRarity = weightedChoice(
    [
      ["Common", 45],
      ["Uncommon", 40],
      ["Rare", 15],
    ],
    random,
  );
  pack.push({
    ...pickCard(pools[firstFoilRarity], used, random),
    foil: true,
    slot: "Reverse Foil",
  });

  pack.push({
    ...pullFromProfile(pools, SECOND_FOIL_PROFILE, used, random),
    foil: true,
    slot: "Second Foil",
  });

  pack.push({
    ...pullFromProfile(pools, RARE_SLOT_PROFILE, used, random),
    foil: true,
    slot: "Rare",
  });

  return pack;
}

export function getBestPull(pack) {
  return [...pack].sort(
    (left, right) => (RARITY_RANK[right.rarity] ?? 0) - (RARITY_RANK[left.rarity] ?? 0),
  )[0];
}
