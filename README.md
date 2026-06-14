# Ascended Packs

An installable, mobile-first fan simulator for opening **Mega Evolution—Ascended Heroes**
packs. It includes the complete 295-card catalog, rarity-aware pack collation, swipe-to-tear
and swipe-through interactions, collection tracking, pack history, sound, haptics, and offline
app-shell support.

## Run it

```bash
npm run dev
```

Open `http://127.0.0.1:4173`.

## Card data and images

Card metadata and image endpoints come from the public [TCGdex API](https://tcgdex.dev/).
The booster-wrapper product image is adapted from a
[Collector Store product listing](https://collectorstore.com/products/pokemon-ascended-heroes-booster-pack).
Card artwork, names, set marks, and Pokémon-related trademarks belong to their respective
owners. The app is an unofficial, non-commercial prototype and is not affiliated with,
endorsed by, or sponsored by Nintendo, Creatures, GAME FREAK, or The Pokémon Company.

Before commercial distribution or App Store release, obtain the necessary licenses for card
art, trade dress, names, logos, and other protected assets.

## Pull rates

The Pokémon Company does not publish official booster odds. The simulator labels its odds as
a community-estimate profile and exposes the modeled category rates inside the app. The rate
table can be adjusted in `app.js` as larger opening datasets become available.
