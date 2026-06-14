import { generatePack, getBestPull, RARITY_RANK } from "./pack-engine.js";

const appUrl = (path) => new URL(path, import.meta.url);
const DATA_URL = appUrl("data/cards.json");
const PACK_ART_URL = appUrl("assets/ascended-heroes-pack.png");
const STORAGE_KEY = "ascended-packs-v1";
const screen = document.querySelector("#screen");
const bottomNav = document.querySelector(".bottom-nav");
const topbar = document.querySelector(".topbar");
const soundToggle = document.querySelector("#sound-toggle");
const toast = document.querySelector("#toast");

const defaultSave = {
  packsOpened: 0,
  cardsPulled: 0,
  owned: {},
  history: [],
  sound: true,
};

const state = {
  cards: [],
  route: "home",
  pendingPack: null,
  currentPack: null,
  openingPhase: "sealed",
  revealIndex: 0,
  collectionQuery: "",
  collectionFilter: "All",
  save: loadSave(),
};

let audioContext;
let toastTimer;

function loadSave() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return { ...defaultSave, ...stored, owned: stored?.owned || {}, history: stored?.history || [] };
  } catch {
    return { ...defaultSave };
  }
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.save));
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function rarityClass(rarity) {
  return String(rarity).toLowerCase().replaceAll(" ", "-");
}

function imageUrl(card, quality = "high") {
  return `${card.image}/${quality}.webp`;
}

function ownedUniqueCount() {
  return Object.values(state.save.owned).filter((count) => count > 0).length;
}

function completionPercent() {
  return state.cards.length ? Math.round((ownedUniqueCount() / state.cards.length) * 100) : 0;
}

function vibrate(pattern) {
  if ("vibrate" in navigator) navigator.vibrate(pattern);
}

function getAudioContext() {
  if (!state.save.sound) return null;
  if (!audioContext) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) audioContext = new AudioContext();
  }
  if (audioContext?.state === "suspended") audioContext.resume();
  return audioContext;
}

function tone(frequency, duration = 0.1, type = "sine", gain = 0.04, delay = 0) {
  const context = getAudioContext();
  if (!context) return;
  const oscillator = context.createOscillator();
  const volume = context.createGain();
  const start = context.currentTime + delay;
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  volume.gain.setValueAtTime(gain, start);
  volume.gain.exponentialRampToValueAtTime(0.001, start + duration);
  oscillator.connect(volume).connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration);
}

function playReveal(rarity) {
  const rank = RARITY_RANK[rarity] ?? 0;
  tone(220 + rank * 50, 0.08, "triangle", 0.025);
  if (rank >= 4) {
    tone(520 + rank * 35, 0.45, "sine", 0.035, 0.05);
    tone(780 + rank * 30, 0.55, "sine", 0.02, 0.12);
  }
}

function playRip() {
  tone(125, 0.14, "sawtooth", 0.025);
  tone(74, 0.24, "triangle", 0.03, 0.08);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 1800);
}

function packMarkup() {
  return `
    <div class="pack-visual" aria-label="Ascended Heroes booster pack">
      <div class="pack-ridge top"></div>
      <div class="pack-body">
        <img class="pack-art" src="${PACK_ART_URL}" alt="Ascended Heroes Mega Dragonite booster wrapper" draggable="false" />
        <div class="pack-sheen"></div>
      </div>
      <div class="pack-ridge bottom"></div>
    </div>
  `;
}

function setRoute(route) {
  state.route = route;
  const immersive = ["opening", "reveal", "summary"].includes(route);
  screen.classList.toggle("fullscreen", immersive);
  bottomNav.classList.toggle("hidden", immersive);
  topbar.classList.toggle("hidden", immersive);
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.route === route);
  });
  window.scrollTo({ top: 0, behavior: "instant" });
  render();
}

function render() {
  if (state.route === "collection") renderCollection();
  else if (state.route === "stats") renderStats();
  else if (state.route === "opening") renderOpening();
  else if (state.route === "reveal") renderReveal();
  else if (state.route === "summary") renderSummary();
  else renderHome();
}

function renderHome() {
  const unique = ownedUniqueCount();
  screen.innerHTML = `
    <section class="home-screen">
      <span class="eyebrow">MEGA EVOLUTION</span>
      <h1 class="hero-heading">Your next pull<br />could be <em>legendary.</em></h1>
      <p class="hero-copy">A tactile Ascended Heroes opening simulator built around the complete 295-card set.</p>

      <div class="stats-strip">
        <div class="stat-cell"><strong>${state.save.packsOpened}</strong><span>Packs</span></div>
        <div class="stat-cell"><strong>${unique}</strong><span>Collected</span></div>
        <div class="stat-cell"><strong>${completionPercent()}%</strong><span>Complete</span></div>
      </div>

      <div class="pack-stage">${packMarkup()}</div>

      <button class="primary-button" type="button" data-action="start-pack">
        <span class="spark">✦</span> Open a Pack
      </button>
      <button class="sub-action" type="button" data-open-dialog="odds-dialog">View pull rates and pack collation</button>
      <div class="set-facts"><span>295 cards</span><i></i><span>10 cards per pack</span><i></i><span>Fan simulator</span></div>
    </section>
  `;
}

function startPack() {
  getAudioContext();
  state.pendingPack = generatePack(state.cards);
  state.currentPack = null;
  state.openingPhase = "sealed";
  state.revealIndex = 0;

  state.pendingPack.forEach((card) => {
    const image = new Image();
    image.src = imageUrl(card);
  });

  setRoute("opening");
}

function renderOpening() {
  screen.innerHTML = `
    <section class="opening-screen">
      <div class="opening-topline">
        <button type="button" data-action="cancel-opening">Cancel</button>
        <strong>ASCENDED HEROES</strong>
        <button type="button" data-open-dialog="odds-dialog">Odds</button>
      </div>
      <div class="burst"></div>
      <div class="tear-area" style="--tear: 0">
        ${packMarkup()}
        <div class="tear-top">${packMarkup()}</div>
        <div class="tear-line"></div>
        <div class="tear-thumb" aria-hidden="true">›</div>
      </div>
      <div class="tear-instruction">
        <strong>Swipe to tear</strong>
        <span>Drag across the seal from left to right</span>
      </div>
      <button class="tear-fallback" type="button" data-action="tear-pack">Tap here instead</button>
    </section>
  `;
  bindTearGesture();
}

function bindTearGesture() {
  const area = screen.querySelector(".tear-area");
  if (!area) return;
  let dragging = false;
  let progress = 0;

  const update = (clientX) => {
    const rect = area.getBoundingClientRect();
    progress = Math.max(0, Math.min(1, (clientX - rect.left - 20) / (rect.width - 65)));
    area.style.setProperty("--tear", progress.toFixed(3));
    if (progress >= 0.96) finishTear();
  };

  area.addEventListener("pointerdown", (event) => {
    dragging = true;
    area.setPointerCapture(event.pointerId);
    getAudioContext();
    update(event.clientX);
  });
  area.addEventListener("pointermove", (event) => {
    if (dragging) update(event.clientX);
  });
  area.addEventListener("pointerup", () => {
    dragging = false;
    if (progress < 0.96) {
      progress = 0;
      area.style.setProperty("--tear", "0");
    }
  });
  area.addEventListener("pointercancel", () => {
    dragging = false;
    progress = 0;
    area.style.setProperty("--tear", "0");
  });
}

function finishTear() {
  const opening = screen.querySelector(".opening-screen");
  if (!opening || opening.classList.contains("ripping")) return;
  opening.classList.add("ripping");
  playRip();
  vibrate([18, 25, 45]);
  commitPack(state.pendingPack);
  state.currentPack = state.pendingPack;
  state.pendingPack = null;

  setTimeout(() => {
    state.route = "reveal";
    state.revealIndex = 0;
    renderReveal();
  }, 930);
}

function commitPack(pack) {
  state.save.packsOpened += 1;
  state.save.cardsPulled += pack.length;
  pack.forEach((card) => {
    state.save.owned[card.id] = (state.save.owned[card.id] || 0) + 1;
  });
  const best = getBestPull(pack);
  state.save.history.unshift({
    id: `${Date.now()}-${best.id}`,
    cardId: best.id,
    name: best.name,
    rarity: best.rarity,
    image: best.image,
    openedAt: new Date().toISOString(),
  });
  state.save.history = state.save.history.slice(0, 20);
  persist();
}

function renderReveal() {
  const card = state.currentPack[state.revealIndex];
  const nextCard = state.currentPack[state.revealIndex + 1];
  const isPremium = (RARITY_RANK[card.rarity] ?? 0) >= 4;
  const isLastCard = state.revealIndex === state.currentPack.length - 1;
  screen.innerHTML = `
    <section class="reveal-screen" style="--reveal-glow: ${rarityGlow(card.rarity)}">
      <div class="reveal-progress">
        <strong>CARD ${state.revealIndex + 1} OF ${state.currentPack.length}</strong>
        <div class="reveal-dots">
          ${state.currentPack
            .map((_, index) => `<span class="reveal-dot ${index < state.revealIndex ? "done" : ""}"></span>`)
            .join("")}
        </div>
      </div>

      <div class="reveal-stack" style="--swipe-progress: 0">
        ${
          nextCard
            ? `<div class="next-card-preview">
                <img src="${imageUrl(nextCard)}" alt="" draggable="false" />
              </div>`
            : `<div class="pack-finish-preview"><span>10/10</span><strong>Pack complete</strong></div>`
        }
        <div class="interactive-card" role="button" tabindex="0" aria-label="${isLastCard ? "Swipe up to finish pack" : "Swipe up for next card"}">
          <div class="card-face card-front ${card.foil ? "foil" : ""} ${isPremium ? "premium-foil" : ""}">
            <img src="${imageUrl(card)}" alt="${escapeHtml(card.name)}" />
            <div class="image-fallback"><strong>${escapeHtml(card.name)}</strong><span>#${card.localId} · ${escapeHtml(card.rarity)}</span></div>
            <div class="foil-layer"></div>
            <div class="shine-layer"></div>
          </div>
        </div>
      </div>

      <div class="reveal-caption" id="reveal-caption">
        <span class="rarity-label rarity-${rarityClass(card.rarity)}">${escapeHtml(card.rarity)}</span>
        <h2>${escapeHtml(card.name)}</h2>
        <p>#${card.localId} · ${escapeHtml(card.slot)}${card.foil ? " · Foil" : ""}</p>
      </div>
      <div class="swipe-instruction">
        <span class="swipe-arrow" aria-hidden="true">↑</span>
        <strong>${isLastCard ? "Swipe up to finish" : "Swipe up for next card"}</strong>
      </div>
    </section>
  `;
  playReveal(card.rarity);
  vibrate((RARITY_RANK[card.rarity] ?? 0) >= 4 ? [18, 24, 32] : 10);
  bindCardSwipe();
  bindCardTilt();
}

function bindCardSwipe() {
  const interactiveCard = screen.querySelector(".interactive-card");
  const stack = screen.querySelector(".reveal-stack");
  const nextPreview = screen.querySelector(".next-card-preview, .pack-finish-preview");
  if (!interactiveCard || !stack) return;

  let dragging = false;
  let committed = false;
  let startX = 0;
  let startY = 0;
  let startTime = 0;
  let deltaX = 0;
  let deltaY = 0;

  const updatePosition = (clientX, clientY) => {
    const rawX = clientX - startX;
    const rawY = clientY - startY;
    deltaX = rawX * 0.24;
    deltaY = rawY < 0 ? rawY : rawY * 0.12;
    const progress = Math.min(1, Math.max(0, -deltaY / 150));
    interactiveCard.style.setProperty("--swipe-x", `${deltaX}px`);
    interactiveCard.style.setProperty("--swipe-y", `${deltaY}px`);
    interactiveCard.style.setProperty("--swipe-rotate", `${deltaX * 0.055}deg`);
    stack.style.setProperty("--swipe-progress", progress.toFixed(3));
    if (nextPreview) nextPreview.style.transform = `scale(${0.96 + progress * 0.04})`;
  };

  const settle = () => {
    interactiveCard.classList.remove("dragging");
    interactiveCard.classList.add("settling");
    interactiveCard.style.setProperty("--swipe-x", "0px");
    interactiveCard.style.setProperty("--swipe-y", "0px");
    interactiveCard.style.setProperty("--swipe-rotate", "0deg");
    stack.style.setProperty("--swipe-progress", "0");
    if (nextPreview) nextPreview.style.transform = "scale(0.96)";
    setTimeout(() => interactiveCard.classList.remove("settling"), 280);
  };

  const commit = () => {
    if (committed) return;
    committed = true;
    interactiveCard.classList.remove("dragging");
    interactiveCard.classList.add("swiping-away");
    interactiveCard.style.setProperty("--swipe-x", `${deltaX * 2.2}px`);
    interactiveCard.style.setProperty("--swipe-y", "-115vh");
    interactiveCard.style.setProperty("--swipe-rotate", `${deltaX < 0 ? -9 : 9}deg`);
    stack.style.setProperty("--swipe-progress", "1");
    if (nextPreview) nextPreview.style.transform = "scale(1)";
    vibrate(14);
    tone(180, 0.08, "triangle", 0.018);
    setTimeout(nextCard, 320);
  };

  interactiveCard.addEventListener("pointerdown", (event) => {
    if (committed) return;
    dragging = true;
    startX = event.clientX;
    startY = event.clientY;
    startTime = performance.now();
    deltaX = 0;
    deltaY = 0;
    interactiveCard.classList.add("dragging");
    interactiveCard.setPointerCapture(event.pointerId);
    getAudioContext();
  });

  interactiveCard.addEventListener("pointermove", (event) => {
    if (!dragging || committed) return;
    updatePosition(event.clientX, event.clientY);
  });

  interactiveCard.addEventListener("pointerup", () => {
    if (!dragging || committed) return;
    dragging = false;
    const elapsed = Math.max(1, performance.now() - startTime);
    const upwardVelocity = -deltaY / elapsed;
    if (deltaY < -88 || (deltaY < -42 && upwardVelocity > 0.48)) commit();
    else settle();
  });

  interactiveCard.addEventListener("pointercancel", () => {
    dragging = false;
    if (!committed) settle();
  });

  interactiveCard.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    deltaX = 8;
    commit();
  });
}

function bindCardTilt() {
  const card = screen.querySelector(".interactive-card");
  const shine = screen.querySelector(".shine-layer");
  if (!card || !shine) return;

  card.addEventListener("pointermove", (event) => {
    const rect = card.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    shine.style.setProperty("--shine-x", `${x}%`);
    shine.style.setProperty("--shine-y", `${y}%`);
  });
}

function nextCard() {
  if (state.revealIndex >= state.currentPack.length - 1) {
    setRoute("summary");
    return;
  }
  state.revealIndex += 1;
  renderReveal();
}

function rarityGlow(rarity) {
  const glows = {
    "Double rare": "rgba(73, 154, 235, 0.30)",
    "Illustration rare": "rgba(78, 205, 137, 0.28)",
    "Ultra Rare": "rgba(224, 164, 76, 0.32)",
    "Special illustration rare": "rgba(199, 84, 255, 0.38)",
    "Mega Hyper Rare": "rgba(255, 221, 109, 0.42)",
  };
  return glows[rarity] || "rgba(114, 78, 187, 0.25)";
}

function renderSummary() {
  const best = getBestPull(state.currentPack);
  screen.innerHTML = `
    <section class="summary-screen">
      <div class="summary-heading">
        <span class="eyebrow">PACK COMPLETE</span>
        <h1>Your pulls</h1>
        <p>${state.currentPack.filter((card) => (RARITY_RANK[card.rarity] ?? 0) >= 3).length} hits added to your collection</p>
      </div>

      <div class="summary-grid">
        ${state.currentPack
          .map(
            (card, index) => `
              <button class="summary-card ${(RARITY_RANK[card.rarity] ?? 0) >= 3 ? "hit" : ""}" type="button" data-card-id="${card.id}" style="animation-delay: ${index * 35}ms">
                <img src="${imageUrl(card, "low")}" alt="${escapeHtml(card.name)}" />
              </button>
            `,
          )
          .join("")}
      </div>

      <div class="best-pull">
        <img src="${imageUrl(best, "low")}" alt="" />
        <div>
          <span>BEST PULL</span>
          <strong>${escapeHtml(best.name)}</strong>
          <em class="rarity-label rarity-${rarityClass(best.rarity)}">${escapeHtml(best.rarity)}</em>
        </div>
      </div>

      <div class="summary-actions">
        <button class="primary-button" type="button" data-action="start-pack"><span class="spark">✦</span> Open Another</button>
        <button class="secondary-button" type="button" data-route="collection">View Collection</button>
      </div>
    </section>
  `;
}

function renderCollection() {
  const filters = [
    ["All", "All"],
    ["Owned", "Owned"],
    ["Double rare", "Double Rare"],
    ["Illustration rare", "Illustration Rare"],
    ["Ultra Rare", "Ultra Rare"],
    ["Special illustration rare", "SIR"],
    ["Mega Hyper Rare", "MHR"],
  ];
  const query = state.collectionQuery.trim().toLowerCase();
  const filtered = state.cards.filter((card) => {
    const matchesQuery =
      !query || card.name.toLowerCase().includes(query) || card.localId.includes(query);
    const matchesFilter =
      state.collectionFilter === "All" ||
      (state.collectionFilter === "Owned" && state.save.owned[card.id]) ||
      card.rarity === state.collectionFilter;
    return matchesQuery && matchesFilter;
  });

  screen.innerHTML = `
    <section class="collection-screen">
      <div class="page-heading">
        <div>
          <span class="eyebrow">ASCENDED HEROES</span>
          <h1>Collection</h1>
          <p>${ownedUniqueCount()} of ${state.cards.length} discovered</p>
        </div>
        <div class="progress-ring" style="--progress: ${completionPercent()}%"><span>${completionPercent()}%</span></div>
      </div>

      <div class="collection-toolbar">
        <label class="search-field">
          <input id="collection-search" type="search" value="${escapeHtml(state.collectionQuery)}" placeholder="Search name or card number" autocomplete="off" />
        </label>
        <div class="filter-row">
          ${filters
            .map(
              ([value, label]) =>
                `<button class="filter-chip ${state.collectionFilter === value ? "active" : ""}" type="button" data-filter="${value}">${label}</button>`,
            )
            .join("")}
        </div>
      </div>

      ${
        filtered.length
          ? `<div class="collection-grid">${filtered.map(collectionCardMarkup).join("")}</div>`
          : `<div class="empty-state"><strong>No cards found</strong><span>Try a different search or filter.</span></div>`
      }
    </section>
  `;

  const search = screen.querySelector("#collection-search");
  search?.addEventListener("input", (event) => {
    state.collectionQuery = event.target.value;
    renderCollection();
    const nextSearch = screen.querySelector("#collection-search");
    nextSearch?.focus();
    nextSearch?.setSelectionRange(state.collectionQuery.length, state.collectionQuery.length);
  });
}

function collectionCardMarkup(card) {
  const count = state.save.owned[card.id] || 0;
  return `
    <button class="collection-card ${count ? "owned" : ""}" type="button" data-card-id="${card.id}">
      <div class="collection-card-art">
        ${count ? `<span class="owned-badge">×${count}</span>` : ""}
        <img src="${imageUrl(card, "low")}" alt="${escapeHtml(card.name)}" loading="lazy" />
      </div>
      <div class="collection-card-meta">
        <strong>${escapeHtml(card.name)}</strong>
        <span>#${card.localId} · ${escapeHtml(card.rarity)}</span>
      </div>
    </button>
  `;
}

function renderStats() {
  const unique = ownedUniqueCount();
  const hitCount = Object.entries(state.save.owned).reduce((total, [id, count]) => {
    const card = state.cards.find((item) => item.id === id);
    return total + ((RARITY_RANK[card?.rarity] ?? 0) >= 3 ? count : 0);
  }, 0);
  const rarestOwned = [...state.cards]
    .filter((card) => state.save.owned[card.id])
    .sort((left, right) => (RARITY_RANK[right.rarity] ?? 0) - (RARITY_RANK[left.rarity] ?? 0))[0];

  screen.innerHTML = `
    <section class="stats-screen">
      <div class="page-heading">
        <div>
          <span class="eyebrow">YOUR JOURNEY</span>
          <h1>Opening stats</h1>
        </div>
      </div>

      <div class="stat-hero">
        <span class="eyebrow">TOTAL PACKS OPENED</span>
        <div class="stat-hero-number">${state.save.packsOpened}</div>
        <div class="stat-hero-label">No purchases. No limits. Just the ritual.</div>
      </div>

      <div class="metric-grid">
        <div class="metric-card"><strong>${unique}</strong><span>Unique cards</span></div>
        <div class="metric-card"><strong>${state.save.cardsPulled}</strong><span>Total cards</span></div>
        <div class="metric-card"><strong>${hitCount}</strong><span>Hits pulled</span></div>
        <div class="metric-card"><strong>${completionPercent()}%</strong><span>Set complete</span></div>
      </div>

      ${
        rarestOwned
          ? `<div class="section-title"><h2>Rarest discovery</h2></div>
             <button class="history-row" type="button" data-card-id="${rarestOwned.id}">
               <div class="history-art"><img src="${imageUrl(rarestOwned, "low")}" alt="" /></div>
               <div class="history-info"><strong>${escapeHtml(rarestOwned.name)}</strong><span>#${rarestOwned.localId}</span></div>
               <em class="rarity-label rarity-${rarityClass(rarestOwned.rarity)}">${escapeHtml(rarestOwned.rarity)}</em>
             </button>`
          : ""
      }

      <div class="section-title"><h2>Recent packs</h2><span>Best pull from each</span></div>
      ${
        state.save.history.length
          ? `<div class="history-list">${state.save.history.map(historyMarkup).join("")}</div>`
          : `<div class="empty-state"><strong>No packs opened yet</strong><span>Your best pulls will appear here.</span></div>`
      }
    </section>
  `;
}

function historyMarkup(item) {
  const card = state.cards.find((candidate) => candidate.id === item.cardId) || item;
  const date = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(
    new Date(item.openedAt),
  );
  return `
    <button class="history-row" type="button" data-card-id="${item.cardId}">
      <div class="history-art"><img src="${imageUrl(card, "low")}" alt="" loading="lazy" /></div>
      <div class="history-info"><strong>${escapeHtml(item.name)}</strong><span>${date}</span></div>
      <em class="rarity-label rarity-${rarityClass(item.rarity)}">${escapeHtml(item.rarity)}</em>
    </button>
  `;
}

function openCardDetail(cardId) {
  const card = state.cards.find((item) => item.id === cardId);
  if (!card) return;
  const count = state.save.owned[card.id] || 0;
  const dialog = document.querySelector("#card-dialog");
  document.querySelector("#card-dialog-content").innerHTML = `
    <div class="detail-card-art">
      <img src="${imageUrl(card)}" alt="${escapeHtml(card.name)}" />
      ${(RARITY_RANK[card.rarity] ?? 0) >= 4 ? '<div class="foil-layer" style="opacity:.2"></div>' : ""}
    </div>
    <div class="detail-meta">
      <span class="rarity-label rarity-${rarityClass(card.rarity)}">${escapeHtml(card.rarity)}</span>
      <h2>${escapeHtml(card.name)}</h2>
      <p>Ascended Heroes #${card.localId} · ${count ? `${count} owned` : "Not yet pulled"}</p>
    </div>
  `;
  dialog.showModal();
}

function closeDialog(button) {
  button.closest("dialog")?.close();
}

document.addEventListener("click", (event) => {
  const routeButton = event.target.closest("[data-route]");
  if (routeButton) {
    setRoute(routeButton.dataset.route);
    return;
  }

  const openDialogButton = event.target.closest("[data-open-dialog]");
  if (openDialogButton) {
    document.querySelector(`#${openDialogButton.dataset.openDialog}`)?.showModal();
    return;
  }

  const closeButton = event.target.closest("[data-close-dialog]");
  if (closeButton) {
    closeDialog(closeButton);
    return;
  }

  const cardButton = event.target.closest("[data-card-id]");
  if (cardButton) {
    openCardDetail(cardButton.dataset.cardId);
    return;
  }

  const filter = event.target.closest("[data-filter]");
  if (filter) {
    state.collectionFilter = filter.dataset.filter;
    renderCollection();
    return;
  }

  const action = event.target.closest("[data-action]")?.dataset.action;
  if (action === "start-pack") startPack();
  else if (action === "cancel-opening") {
    state.pendingPack = null;
    setRoute("home");
  } else if (action === "tear-pack") finishTear();
});

document.querySelectorAll("dialog").forEach((dialog) => {
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
});

soundToggle.addEventListener("click", () => {
  state.save.sound = !state.save.sound;
  persist();
  updateSoundButton();
  if (state.save.sound) {
    tone(440, 0.08, "sine", 0.025);
    showToast("Sound on");
  } else {
    showToast("Sound off");
  }
});

function updateSoundButton() {
  soundToggle.classList.toggle("muted", !state.save.sound);
  soundToggle.setAttribute("aria-label", state.save.sound ? "Turn sound off" : "Turn sound on");
  soundToggle.querySelector(".sound-on").textContent = state.save.sound ? "◖))" : "◖×";
}

document.addEventListener(
  "error",
  (event) => {
    const image = event.target;
    if (!(image instanceof HTMLImageElement)) return;
    if (image.closest(".card-front")) {
      image.style.display = "none";
      const fallback = image.nextElementSibling;
      if (fallback) fallback.style.display = "grid";
    }
  },
  true,
);

async function init() {
  updateSoundButton();
  try {
    const response = await fetch(DATA_URL);
    if (!response.ok) throw new Error(`Card catalog returned ${response.status}`);
    state.cards = await response.json();
    renderHome();
  } catch (error) {
    screen.innerHTML = `
      <div class="empty-state">
        <strong>Could not load the card catalog</strong>
        <span>${escapeHtml(error.message)}</span>
        <button class="secondary-button" type="button" onclick="location.reload()">Try again</button>
      </div>
    `;
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register(appUrl("sw.js"), { scope: "./" }).catch(() => {});
  }
}

init();
