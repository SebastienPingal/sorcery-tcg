# Savior Deck — Implementation Status

Tracks per-card implementation state of the `savior` precon deck defined in `src/data/cards.ts`.

Status legend:
- **✓** — fully implemented and wired into the engine
- **partial** — core rule works, edge cases/optional clauses deferred
- **✗** — not implemented (rules text has no engine effect yet)
- **vanilla** — no rules text; works by virtue of base combat/power

## Avatar

| Card | Status | Notes |
|---|---|---|
| Savior | ✓ | Base avatar ability (play or draw site) works. The `(1) → Ward a minion summoned this turn` mana ability is not wired yet. |

## Atlas (sites)

| Card | Count | Status | Mechanism | Notes |
|---|---|---|---|---|
| Algae Bloom | 1 | ✓ | trigger: `genesis` | Temp (A)(E)(F) via `temp_*` counters, cleared end of turn |
| Autumn Bloom | 2 | ✓ | trigger: `genesis` | Temp (A)(F)(W) via `temp_*` counters |
| Blessed Village | 2 | ✓ | trigger: `genesis` | Enters with `ward` token |
| Blessed Well | 1 | ✓ | trigger: `genesis` | Enters with `ward` token |
| Consecrated Ground | 1 | ✓ | aura power modifier | Evil minions at this site drop to 0 power |
| Fertile Earth | 1 | vanilla | — | Basic mana site |
| Forlorn Keep | 1 | ✗ | — | Cast Penitent Knight from collection — needs out-of-deck card fetching |
| Mudslide | 1 | ✓ | trigger: `genesis` | Slides units at land sites in the column one step left (right if col 0) |
| Stream | 2 | vanilla | — | Water site |
| Troubled Town | 2 | ✗ | — | Cast Townsfolk from collection — same out-of-deck fetching concern |
| Valley | 2 | vanilla | — | Basic site |

## Spellbook — Artifacts

| Card | Count | Status | Mechanism | Notes |
|---|---|---|---|---|
| Flame of the First Ones | 1 | ✓ | trigger: `on_move` | Carrier move → heal controller 1, opponent loses 1 |
| Makeshift Barricade | 1 | ✓ | damage prevention hook | Prevents damage to allies on its square; breaks if incoming ≥ 3 |

## Spellbook — Minions

| Card | Count | Status | Mechanism | Notes |
|---|---|---|---|---|
| Angel Ascendant | 1 | ✓ | power modifier + conditional keyword | +1 power & Airborne while Warded |
| Eltham Townsfolk | 1 | vanilla | — | No rules text |
| Faith Incarnate | 1 | ✓ | power modifier | +2 per Ward in realm |
| Guardian Angel | 1 | ✓ | trigger: `genesis` | Auto-flies to weakest ally, wards it |
| Malakhim | 1 | ✓ | trigger: `end_of_turn` | Untaps |
| Mayor of Milborne | 1 | ✓ | aura power modifier | Other nearby Mortals +1 |
| Monks of Kobalsa | 2 | ✗ | — | "Can't be modified, except by Wards" — needs modifier-source gating not yet in engine |
| Muddy Pigs | 2 | ✓ | trigger: `deathrite` | Controller heals 3 |
| Nightwatchmen | 1 | ✓ | trigger: `genesis` | Wards own site |
| Order of the White Wing | 1 | partial | keyword only | `Ward` granted; the "banish nearby non-hand summons" counter-effect is not wired |
| Revered Revenant | 2 | ✓ | power modifier | Power → 0 unless adjacent to an allied Ward |
| Rowdy Boys | 1 | ✓ | trigger: `on_strike` | Untaps after striking Undead |
| Search Party | 3 | ✓ | power modifier | +1 per Search Party in cemetery |
| Serava Townsfolk | 1 | vanilla | — | No rules text |
| Survivors of Serava | 2 | ✓ | trigger: `end_of_turn` | Gain Stealth if no enemies nearby |
| Town Priest | 1 | ✓ | trigger: `genesis` | Returns adjacent Evil enemy to its owner's hand |
| Virgin in Prayer | 2 | ✓ | trigger: `genesis` | Wards nearest un-warded ally |
| Weathered Trunks | 2 | ✓ | placement restriction | Must be summoned to an allied site occupied by an enemy |

## Spellbook — Magic

| Card | Count | Status | Mechanism | Notes |
|---|---|---|---|---|
| Baptize | 1 | ✓ | spell resolver | Wards each allied minion at target water site |
| Divine Lance | 1 | partial | spell resolver | Damages each minion at target site; auto-breaks **all** allied wards for bonus damage — the "choose any number" UI is not yet present |
| Enduring Faith | 1 | ✗ | — | Ward + redirect-damage-to-self — needs a damage redirection layer |
| Golden Dawn | 1 | ✗ | — | Deals top spells to back-row sites, summons minions — needs spellbook peeking/distribution |
| Holy Nova | 1 | partial | spell resolver | 2 damage to each enemy at caster's square + nearby (Wards absorb). The "break an allied Ward to recenter" clause is omitted pending UI |
| Smite | 2 | ✓ | spell resolver + caster eligibility override | Any ally can cast; banish Evil or strike non-Evil adjacent enemy |
| Wave of Eviction | 1 | ✗ | — | Cardinal flood + enemy carry — needs directional water propagation |

## Supporting engine work

Landed alongside the deck:

- **`src/engine/spellResolvers.ts`** — Boil, Baptize, Divine Lance, Smite, Holy Nova
- **`src/engine/triggerResolvers.ts`** — trigger types `genesis`, `deathrite`, `end_of_turn`, `on_strike`, `on_move`
- **`src/engine/powerModifiers.ts`** — self + aura power modifiers and conditional keywords
- **`src/data/cards.ts`** — `PLACEMENT_RESTRICTIONS` (Weathered Trunks) and `CASTER_ELIGIBILITY_OVERRIDES` (Smite) applied to `ALL_CARDS` at load time
- **`src/engine/core/applyAtomicAction.ts`** — fires triggers at the right moments (`playSite`, `castSpell`, `killUnit`, `advancePhase`, `resolveAttack`, `moveAndAttack`) and applies the barricade damage-prevention hook inside `dealDamage`

## Known gaps

Cards marked ✗ cluster around three engine capabilities that don't exist yet:

1. **Out-of-deck fetching** — Forlorn Keep, Troubled Town need to pull specific cards from the player's collection.
2. **Damage redirection** — Enduring Faith needs a redirection layer on top of `dealDamage` similar to the barricade hook but reusable.
3. **Directional site-propagation** — Wave of Eviction needs a flood direction picker and multi-step enemy carry.

Once those primitives land, the remaining Savior cards collapse into small resolvers on top of them.
