# Sorcery: Contested Realm — Complete Rules Reference

> Source: Official Rulebook, December 2025

---

## Table of Contents

1. [Golden Rule](#golden-rule)
2. [How to Win](#how-to-win)
3. [The Four Elements](#the-four-elements)
4. [Card Types](#card-types)
5. [Game Zones](#game-zones)
6. [Setup](#setup)
7. [The Realm — Navigation](#the-realm--navigation)
8. [Turn Sequence](#turn-sequence)
9. [Casting Spells — Mana & Threshold](#casting-spells--mana--threshold)
10. [Casting Each Spell Type](#casting-each-spell-type)
11. [Activating Abilities](#activating-abilities)
12. [Basic Abilities (All Units)](#basic-abilities-all-units)
13. [Combat in Detail](#combat-in-detail)
14. [Death's Door & Death Blow](#deaths-door--death-blow)
15. [Artifacts — Carrying & Control](#artifacts--carrying--control)
16. [Advanced Concepts](#advanced-concepts)
17. [Keyword Glossary](#keyword-glossary)
18. [Deck Building Rules](#deck-building-rules)

---

## Golden Rule

> Card text takes precedence over the rulebook when they conflict. Some text is intentionally informal. Use common sense and be cool.

---

## How to Win

- Reduce the opposing Avatar's **life** to 0, placing them at **death's door**.
- Then deal **any damage** to that Avatar on a subsequent moment → **death blow** → you win.
- **Alternative loss:** If either player must draw from an empty deck, they immediately lose.

---

## The Four Elements


| Element   | Symbol     | Theme                                               |
| --------- | ---------- | --------------------------------------------------- |
| **Air**   | △ (purple) | Knowledge & Power — teleportation, tactical options |
| **Earth** | ▽ (gold)   | Enduring Strength — martial forces, teamwork        |
| **Fire**  | △ (red)    | Desire & Destruction — explosions, burst speed      |
| **Water** | ▽ (blue)   | Charm & Trickery — disruption, positioning          |


---

## Card Types

### Units (collective term: Avatars + Minions)

#### Avatars

- Represent the player. Everything done in the realm is through the Avatar.
- Have: **name**, **starting life** (= maximum life), **attack power**, **game text box**.
- All Avatars are **Spellcasters** — they can cast spells from hand.
- Avatars can **never** enter the **void** region.
- Avatars ignore many negative effects.
- Life is tracked throughout the game; Avatars do **not** automatically heal at end of turn.

#### Minions

- Have: **name**, **mana cost**, **elemental threshold**, **power rating**, **type line** (subtypes + rarity), **game text box**.
- Power = how much damage they deal when striking, AND how much damage they can take before dying.
- A minion dies instantly when it accumulates damage **≥ its power**.
- Exception: units with 0 power need at least 1 damage to die.
- **Split Power** (written as Attack/Defense, e.g. 4|5): use Attack Power when striking, Defense Power when receiving allocated damage.
- Tokens are minions that are never part of a deck. If a token would leave the realm for any reason, it is removed from the game entirely.

### Sites

- Placed on the realm grid (one per square).
- Have: **name**, **type line** (rarity), **elemental threshold icons** (= affinity they grant), **game text box**.
- Sites have **two levels**: **surface** (above) and **subsurface** (below).
- Provide **mana** each turn.
- When a site is destroyed → placed in owner's cemetery → replaced by **Rubble** (a neutral land site, no mana, no threshold, no controller).

### Spells (in hand/played from hand)

#### Minion spells → summon a minion onto the realm.

#### Artifact spells

- No elemental threshold required (most artifacts).
- Subtypes: armor, weapon, relic, device, document, **automaton**, **monument**.
- **Automatons**: artifacts that are also minions — have power, same basic abilities as minions, cannot be carried.
- **Monuments**: cannot be carried. Controlled by the player who conjured them.

#### Aura spells

- Have: mana cost, elemental threshold, type line, game text box.
- Placed at the intersection of four squares (2×2 area), or sometimes between two squares or on a single square.
- Occupy the **surface** of those squares (and any void squares in that area).
- Persist in the realm; they are not transient.

#### Magic spells

- Transient: do not enter play. Resolve immediately, then go to cemetery.
- Have: mana cost, elemental threshold.

---

## Game Zones


| Zone               | Notes                                                                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **The Realm**      | 5×4 grid of 20 squares, shared by both players. Squares begin as void.                                                                     |
| **Atlas deck**     | ≥ 30 site cards. Searched → must shuffle after.                                                                                            |
| **Spellbook deck** | ≥ 60 spell cards. Searched → must shuffle after.                                                                                           |
| **Cemetery**       | Face-up discard pile. Order irrelevant. Freely examined at any time.                                                                       |
| **Hand**           | Cards drawn from atlas or spellbook. No maximum size. Hidden, but count of atlas vs. spellbook cards is observable (different card backs). |


---

## Setup

1. **Set up the Realm** — clear the 5×4 grid area.
2. **Place Avatars** — each player places their Avatar on the middle square of their own bottom row.
3. **Prepare Decks** — shuffle and place atlas and spellbook nearby; leave space for cemetery.
4. **Determine First Player** — mutual agreement or random.
5. **Draw Starting Hand** — each player draws **3 cards from atlas** + **3 cards from spellbook**.
  - If unsatisfied, take one **mulligan**: return up to 3 cards (to the bottom of their respective decks, in any order), then redraw that many from each deck.

---

## The Realm — Navigation

### Regions (4 total)


| Region          | Where                                                                                                                |
| --------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Void**        | Any square without a site. Avatars cannot enter. Minions are banished (removed from game) unless they have Voidwalk. |
| **Surface**     | The upper level of all sites. Where units typically move and fight.                                                  |
| **Underground** | The subsurface of **land sites**. Extremely hazardous — minions that enter die unless they have Burrowing.           |
| **Underwater**  | The subsurface of **water sites**. Extremely hazardous — minions that enter die unless they have Submerge.           |


### Site Types

- **Water sites**: identified by the water (▽ blue) threshold icon. Their subsurface = **underwater** region.
- **Land sites**: everything else (including rubble, sites with no threshold icons). Subsurface = **underground**.
- **Rubble**: neutral land site. No mana, no threshold, no controller.

### Bodies of Water & Spans of Land

- A contiguous cluster of **adjacent** (not diagonal) water sites = **body of water**.
- A contiguous cluster of adjacent land sites = **span of land**.

### Squares, Locations, and Regions

- **Square**: one grid cell. Includes all cards present there.
- **Location**: one region in one square (e.g., "the surface of square 12").
- **Here / There**: the location(s) a card occupies. For avatars/minions/artifacts = 1 location. For auras = the 2×2 area. For sites = 2 locations (surface + subsurface).
- **Adjacent**: a card's own square + squares sharing a **border** (4 directions, no diagonals).
- **Nearby**: a card's own square + all 8 surrounding squares (including diagonals).
- **Adjacent/Nearby Locations**: only locations **in the same region** as the referencing card (or its Spellcaster) count.
- **Step**: minimum unit of distance between two adjacent locations.
- **Target**: spells and abilities can only target things within the Spellcaster's (or referencing card's) same **region**.

### Placing Cards (Atop / Under)

- **Atop** a site = on the surface level.
- **Under** a site = in the subsurface (underground or underwater).

---

## Turn Sequence

### Start Phase

1. All "until next turn" effects end.
2. All of your tapped cards **untap**.
3. All of your sites provide their **mana** for this turn.
4. Trigger abilities that activate at the start of turn.
5. Draw **one card** from either your spellbook **or** atlas (your choice).

> **First Player Exception:** The first player skips step 5 (no draw) on their very first turn.

> **First Turn Requirement:** During your first Main Phase, your Avatar **must** use their ability to play a site to their own square to establish their domain.

### Main Phase

- Units can act as many times as you have resources, in any order.
- Each unit can do one (or both) of:
  - **Cast a spell** from hand (if the unit is a Spellcaster).
  - **Activate one of its abilities**.

### End Phase

1. Trigger abilities that activate at end of turn.
2. Remove all **damage** from minions in the realm (damage resets).
3. Effects lasting "for your turn" now end.
4. Lose any unspent **mana**.
5. Your turn ends; opponent's turn begins.

> **Note:** Avatars do NOT automatically heal at end of turn. Only minion damage resets.

---

## Casting Spells — Mana & Threshold

### Mana

- **Gaining mana**: At Start Phase step 3, each site you control provides 1 mana. When a new site enters the realm under your control, it immediately provides 1 mana (even mid-turn).
- **Lost sites**: If you lose a site, the mana it already provided this turn stays in your pool.
- **Captured sites**: If you gain an enemy's site mid-turn, it does not provide mana until your next turn.
- **Spending mana**: Pay the mana cost shown in the card's top-left corner. You cannot pay more than you have.
- **End of turn**: All unspent mana is lost.

### Elemental Threshold

- Most spells and some abilities require a minimum **elemental affinity** to play/activate.
- Affinity = total number of matching elemental symbols on sites you control (plus any granted by spells/abilities).
- Threshold is **not spent** — it is a minimum check, not a resource.
- Artifacts and most abilities have **no threshold**.
- A spell with multiple element symbols requires meeting each one independently.
- A card with multiple element symbols counts as a spell of all those elements simultaneously.

---

## Casting Each Spell Type

### Casting Minions

- Identify a **Spellcaster** you control.
- Pay mana cost + meet threshold.
- Place the minion **atop any site you control** (surface level). No limit on how many occupy one site.
- **Summoning Sickness**: A minion that entered the realm this turn cannot tap, or be tapped, for ability costs. This includes any abilities granted by spells or artifacts. However, the minion enters **untapped** and can be used to **defend** on the opponent's turn.

### Casting Artifacts

- Conjured atop any site you control, **or** directly into the hands of one of your units (they carry it immediately).

### Casting Auras

- Placed at the intersection of four squares (the 2×2 area they affect), unless the card specifies otherwise.
- Occupy the surface of those squares (and any void among them).

### Casting Magics

- Resolve immediately, then go to the cemetery. No lasting presence in the realm.

---

## Activating Abilities

- Only the controller of a card can use its activated abilities.
- Only during the **main phase** of their own turn, when nothing else is already happening.
- Cost types include: tapping, paying mana, paying life, sacrificing a minion, discarding cards, etc.

### Tapping a Card

- Rotate the card 90° to the right (untapped → tapped).
- Only **untapped** cards can be tapped; only tapped cards can be untapped.
- Cards untap automatically at the start of your turn.
- Minions with Summoning Sickness **cannot** be tapped to pay for ability costs.

### Playing Sites (Avatar Ability)

- The standard Avatar ability: "Tap → Play or draw a site."
- **Play** = place a site card from hand onto the realm.
- **Draw** = take the top card of your atlas into your hand.
- Placement rules for a site:
  - Must be placed on a **void** square or a **rubble** square (replacing rubble entirely).
  - Must be **adjacent** to another site you control, OR as close as possible to your Avatar if you control no sites.
  - Only one site per square.

---

## Basic Abilities (All Units)

All units (Avatars and minions) have these five basic abilities. They are not printed on cards.

### 1. Move and Attack (Activated — your turn)

**Declaration phase:**

- Tap the unit.
- Declare the intended path (each step, in order).
- A step may not revisit a location already declared in the same path.

**Resolution phase:**

- Resolve each step in order. Confirm each step is legal at the moment of resolution.
- Default: 1 step (from the surface of one site to the surface of an adjacent site).
- Movement abilities (Airborne, Burrowing, Submerge, Voidwalk, Movement +X) can modify steps.

**After all movement:**

- Optionally attack something at the unit's current location (see Combat).
- If unit took at least one step → it has **moved**.
- If unit took zero steps → it has **not moved** (but can still attack if it tapped).

> **"Take a step" vs "X steps away"** — critical distinction:
>
> - **"Take a step"** (used in Move & Attack, Defend): the unit *may* apply movement abilities (Airborne, Burrowing, Submerge, Voidwalk) to modify that step.
> - **"X steps away"** (used in targeting/range text): simply count one adjacent square per step, with no region changes and no movement ability modifiers. Units that cannot move by activating their own abilities cannot carry out steps granted by these effects.

### 2. Defend (Triggered — opponent's turn)

- **Trigger**: An enemy uses Move and Attack against one of your units or sites.
- **Response**: Tap any of your untapped units that are within their "range of motion" from the attack's location (i.e., the unit could reach that square in one step using its movement abilities).
- The defending unit moves to the attack's location and joins the fight.
- The defending unit **may** use movement abilities (Airborne, Burrowing, etc.) during this movement.
- Any number of your units may defend against a single attacker.
- If the original target was a **unit**, the defender's controller may decide whether that unit stays in the fight or is removed.
- If the original target was a **site**, it is automatically removed from the fight (units then fight each other).
- Only "attacks" can be defended (Move and Attack basic ability, or specific card text saying "attack").

### 3. Intercept (Triggered — opponent's turn)

- **Trigger**: An enemy uses Move and Attack, finishes their movement, and then **chooses NOT to attack**.
- **Response**: Any of your units **already at that location** (they cannot move) may tap to **intercept** and force a fight.

### 4. Pick Up (Activated — your turn)

- Each unit can activate **once per turn**.
- Pick up any number of artifacts at its current location that are not currently carried by another unit.

### 5. Drop (Activated — your turn)

- Each unit can activate **once per turn**, as long as it has not yet **interacted** with the realm this turn.
- Drop any number of artifacts the unit is currently carrying.

---

## Combat in Detail

### Attacking Enemy Units

- You may only attack enemy units or enemy sites **at your unit's current location** (after movement).
- When attacking an enemy unit: both units **fight** → they **strike each other simultaneously**.
- **Strike** = deal damage equal to power.

### Striking First

- Some units strike first: their strikes resolve before the opponent's strikes.
- If multiple units on one side strike first, they all strike simultaneously, then surviving non-first-strikers strike.

### Multiple Combatants

- If more than two units are in a fight (due to defending or intercepting), each side's controller allocates damage among the enemy as they wish.

### Damage to Minions

- Damage persists until the **end of the turn**, then resets.
- A minion that accumulates damage **≥ its power** immediately **dies** → placed in owner's cemetery.
- Damage from multiple sources in the same turn is cumulative.
- Zero damage is not damage — a 0-power minion needs at least 1 damage to die.

### Attacking Enemy Sites

- Strike the site → the site takes damage equal to attacker's power.
- The controller of the site **loses life** equal to the damage dealt.
- **Important**: this is **life loss**, not damage. It cannot deliver a death blow by itself. You can still attack enemy sites even when the Avatar is at death's door, but it will not usually affect them (life loss while at death's door has no effect that turn).
- If the opponent does not defend, the attack resolves automatically.

### Damage to Avatars

- Damage dealt to an Avatar (e.g., from a fight) reduces their **life**.
- Avatars do not accumulate damage tokens like minions — their life total just decreases.

---

## Death's Door & Death Blow

### Death's Door

- When an Avatar's life is reduced to **0**, they are placed at **death's door**.
- At that moment:
  - They can **no longer gain life**.
  - They become **immune to all damage** for the **rest of that turn** (the turn they entered death's door). This means they cannot lose life, cannot take damage, and cannot lose the game during that same turn.
- Life does not go below 0; it stays at 0.

### Death Blow

- On **any subsequent moment** (after the turn they entered death's door), **any damage** dealt to an Avatar at death's door is a **death blow**.
- A death blow severs the Avatar's connection to the realm → that player loses.
- Note: attacking a site causes **life loss**, not damage, so site attacks cannot deliver a death blow.

---

## Artifacts — Carrying & Control

### Carrying

- A unit can carry **any number** of artifacts.
- Carried artifacts move with the unit.
- If a unit leaves the realm, its carried artifacts are dropped at its last location.
- If a unit and a carried artifact stop sharing a location (due to some effect), the artifact is no longer carried.

### Control of Artifacts

- Artifacts **carried** by a unit are controlled by the carrier's controller.
- Artifacts **not being carried** (but carryable) are **uncontrolled**.
- Automatons and Monuments (non-carryable): controlled by the player who conjured them.

---

## Advanced Concepts

### Types of Abilities


| Type          | Description                                                                                                  |
| ------------- | ------------------------------------------------------------------------------------------------------------ |
| **Passive**   | Always active while the card is in the relevant zone (usually the realm).                                    |
| **Activated** | Declared and paid for. Only during your main phase, when nothing else is happening.                          |
| **Triggered** | Automatically fires when a specified condition is met (keywords: "when," "whenever," "at the start/end of"). |
| **Keyword**   | Shorthand for a longer rules passage. See Keyword Glossary.                                                  |


### Storyline (Stack / Timing)

- When a unit casts a spell or activates an ability, a **Storyline** begins.
- Events are placed on the Storyline and resolved one at a time in order.
- If a resolving event **triggers** another ability → that new event is inserted at the current moment (interrupting remaining events).
- When multiple events are added at the same moment:
  - **Non-active player** places their events first.
  - **Active player** places their events after.
  - Each player orders their own events however they like.
- If a card leaves the realm, its events remain on the Storyline but cannot resolve → simply skip them.

### Static/Ongoing Effects

- Passive abilities and auras have ongoing effects.
- These apply at **all times**, even while other effects or actions are resolving.
- They take precedence over triggered abilities.

### Projectiles

- Flight begins at the shooting unit's location, travels in the **same region**, in a **cardinal direction** (front/back/left/right).
- Continues until it reaches the edge of the region, or hits the **first unit** (enemy or ally) in its path.
- Ignores allies at the projectile's starting location.
- If multiple valid targets at the same spot: the player who fired chooses.

### Damage Grids

- Some cards show a grid to illustrate area-of-effect damage.
- A bold square = center of effect; a dot = Spellcaster's location.
- By default, damages each unit at locations within the area in the **same region**.

### Oversized Units (Occupying Multiple Sites)

- Some minions occupy a 2×2 area. Place the card at the intersection of four squares.
- Summoned atop a site you control; the 2×2 area chosen must include that summoning site.
- The unit is considered to be at **each** of those squares simultaneously.
- If grid damage hits multiple occupied squares, the unit takes the **sum** of all damage values from those locations.
- Movement: choose a direction; all parts must be able to move that direction, or none can.
- Attacks: oversized units still target a single enemy or site.

### Teleportation

- Moves a unit directly to a location without taking steps.
- Forced movement (push/pull/teleport) is **not modified** by Airborne, Burrowing, Submerge, or Voidwalk.
- A unit forcibly moved does **not tap** and **cannot be intercepted**.

### Moving Freely

- Some effects allow "move freely." When using Move & Attack or Defend, the unit spends no steps as long as starting and ending locations satisfy the moves-freely condition.

### Entering a Location, Site, or Void

A unit is said to have **entered** a location, site, or void if it was not previously occupying that spot and now it is — even momentarily (e.g., due to Movement +X passing through) — or when it was summoned/conjured there.

### Carrying Units

- Some units can carry **other units**. They pick up and drop them exactly like artifacts (Pick Up / Drop basic abilities, once per turn).
- Units with **Airborne, Burrowing, Submerge, or Voidwalk** confer those movement abilities to any units they are carrying while carried.
- A carried unit can still cast spells and activate abilities normally.
- If the carried unit moves to a location the carrying unit does not occupy, the unit ceases to be carried.

### When Sites Move

- If a site moves to another square, everything atop and under it moves with it.
- Cards on the site are not considered to have moved themselves.
- A site can only move to a void square (no other site there).

### Ownership vs. Control

- **Owner**: the player who brought the card. Does not change during the game.
- **Control**: can change during the game (spells, abilities).
- "Your minions / your sites" = those you **control**, not those you own.
- When a card leaves play, it goes to the **owner's** cemetery/hand/deck regardless of who controlled it.

---

## Keyword Glossary

### Ally / Allied

- A unit that you **control**, including your own Avatar.

### Airborne

- May move **diagonally** when taking a step.
- Cannot be targeted by attacks unless the attacker also has Airborne.
- Can only be intercepted by units with Airborne or Ranged.

### Banish

- Remove from the game entirely.

### Broken

- Broken cards are **artifacts** that can be found in any cemetery (zone state, not a keyword ability).

### Burrowing

- Can be summoned to, exist in, and act normally in the **underground** region.
- When taking a step, may move between the surface of a land site and the underground level of the same square, or vice versa.

### Can't Be Modified

- This card cannot be disabled, silenced, immobilized, or transformed.
- Cannot gain or lose abilities.
- Its characteristics (such as power) cannot be changed.

### Cardinal Directions

- When a card refers to a cardinal direction, it includes **all squares** in that direction (front, rear, left, or right) from the card's position — not just one step.

### Charge

- This unit can tap, or be tapped, to pay for costs associated with any ability on the turn it is summoned. (Bypasses Summoning Sickness for tapping.)

### Dead

- Dead cards are **minions** that can be found in any cemetery (zone state, not a keyword ability).

### Deathrite

- When this unit dies, do what is stated before placing it in the cemetery.

### Disable

- Minion loses ALL abilities (including basic Move & Attack, Defend, Intercept).
- Does not strike in fights.
- Cannot cast spells, cannot take actions granted by other cards.
- Can still be forcibly moved or tapped by external effects.

### Enemy

- A unit (including Avatars) that is controlled by an **opponent**.

### Evil

- A minion is Evil if it is a **demon**, **undead**, or **monster**. Evil minions cannot be warded.

### Flooded

- A flooded site has a minimum of one **water affinity (▽)**, in addition to any other affinities it already provides. Therefore it is always a **water site**.

### Genesis

- "When this card enters the realm, do what is stated."

### Ground Movement

- Any step a unit takes **between the surface of two sites**. Airborne steps and teleportation are NOT ground movement.

### Immobile

- This unit cannot take steps.

### Interact

- A unit **interacts** with the realm when it: strikes, deals damage, casts a spell, or activates a special ability.
- Relevant for the **Drop** basic ability: a unit can only Drop artifacts if it has not yet interacted with the realm this turn.

### Lance

- Minion enters play carrying a lance artifact token.
- First time this unit strikes while carrying a lance: deals +1 extra damage **and** strikes first.
- Then the lance breaks (removed from game as a token).
- Lance tokens can be picked up and dropped like other artifacts.

### Lethal

- Any strictly positive amount of damage this card deals to a minion is enough to kill it.

### Movement +X

- May move up to X additional steps when using Move and Attack or Defend.
- Declare full destination and path, then traverse one step at a time.

### Moves Freely

- When using Move & Attack or Defend, spends no steps, as long as start/end locations satisfy the condition.

### Range of Motion

- Every **location** a unit can reach if it used the Move and Attack basic ability. Used to determine whether a unit can Defend.

### Ranged X

- "Tap → Shoot a projectile that stops after 1 (or X) steps. Strike the impacted unit."
- Can also intercept Airborne units.

### Sacrifice

- Remove something you control from the realm and place it directly in its owner's cemetery.
- A player may be forced to sacrifice if a card effect instructs them to.
- When a **minion** is sacrificed: it **dies** (Deathrites trigger). If sacrificed to pay for an ability cost, it goes to the cemetery only **after** that ability resolves.
- A **dying** unit cannot be sacrificed.
- When a **site** is sacrificed: it is replaced by rubble (not a void).
- Even **indestructible** things can be sacrificed if a cost or effect specifically calls for it.

### Silence

- Loses all printed and granted abilities. Avatars cannot be silenced.

### Spellcaster

- This card may cast spells. Some Spellcasters are limited to specific elements.

### Stealth

- Cannot be targeted by opponent's spells or abilities (including attacks).
- Cannot be intercepted.
- Attacks cannot be defended.
- Projectiles cannot hit this unit.
- Tracked with a stealth token. Lost when the minion **interacts** with the realm.
- Artifacts carried by a Stealth minion gain the same protection.

### Strike First

- This unit's strike resolves before the opponent's in a fight. If multiple strike-first units are on one side, they all go simultaneously.

### Stronger / Strongest / Weaker / Weakest

- **Stronger**: strictly more power than another unit.
- **Strongest**: strictly the highest power among a group.
- **Weaker**: strictly less power.
- **Weakest**: strictly the lowest power.
- In the case of ties: the **active player** chooses.
- For units with **split power**: use the **average** of the two values, rounding **down**.

### Submerge

- Can be summoned to, exist in, and act normally in the **underwater** region.
- When taking a step, may move between the surface of a water site and the underwater level, or vice versa.

### Summon / Conjure

- **Summon** / **Conjure**: put the card directly into play.

### Transform

- The transformed card is the same game object as the previous version (same controller, does not get Summoning Sickness).
- Original card is removed from the game after transformation.

### Voidwalk

- Can be summoned to any void location and operate normally there.
- When taking a step, can move into an adjacent void, or out of void onto the surface of an adjacent site (or subsurface if applicable).

### Ward

- If a warded site or unit would be damaged, destroyed, or targeted by an opponent's spell or special ability → the Ward breaks instead (absorbs the effect).
- A unit or site cannot have multiple Wards.
- Evil minions cannot be warded.

### [X]bound (e.g. Waterbound)

- This minion is **disabled** while not occupying a specific type of location (e.g., Waterbound = disabled when not on a water location).

---

## Deck Building Rules


| Requirement | Rule                                                   |
| ----------- | ------------------------------------------------------ |
| Avatar      | Exactly **1** Avatar card (not counted in deck totals) |
| Atlas       | At least **30** site cards                             |
| Spellbook   | At least **60** spell cards                            |
| Max size    | As large as you can reasonably shuffle                 |


### Rarity Copy Limits


| Rarity (type line keyword) | Max copies per deck |
| -------------------------- | ------------------- |
| Ordinary                   | 4                   |
| Exceptional                | 3                   |
| Elite                      | 2                   |
| Unique                     | 1                   |


The Avatar does not count toward these copy limits.

---

## Key Rules That Are Commonly Missed

1. **Minion damage resets at end of turn; Avatar life does not.**
2. **Attacking a site = life loss to controller, NOT damage. Cannot deliver a death blow.**
3. **Death's Door turn immunity**: The turn an Avatar reaches death's door, they are completely immune to damage and life loss for the rest of that turn.
4. **First player skips the draw step on turn 1.**
5. **First player's first Main Phase**: Avatar MUST play a site to their own square.
6. **Summoning Sickness**: a newly summoned minion cannot tap for costs, but can defend on opponent's turn (it enters untapped).
7. **Searching a deck always requires a shuffle afterward.**
8. **Only untapped cards can be tapped; only tapped cards can be untapped.**
9. **Defend and Intercept are triggered, not activated** — they occur on the opponent's turn and do not require the main phase.
10. **Adjacent ≠ nearby**: adjacent is 4 squares (shared border only); nearby is all 8 surrounding squares.
11. **Only locations in the same region count as adjacent/nearby.**
12. **Void squares**: Avatars cannot enter. Minions entering void are banished unless they have Voidwalk.
13. **Mana is lost at end of turn; affinity/threshold is not spent.**
14. **Non-active player's triggered events go on the Storyline before the active player's.**
15. **Forced movement (push/pull/teleport) does not tap the unit and cannot be intercepted.**
16. **"Take a step" ≠ "X steps away"**: "take a step" allows movement ability modifiers (Airborne, Burrowing, etc.); "X steps away" is a plain square count with no region changes.
17. **Interact**: a unit that strikes, deals damage, casts a spell, or activates a special ability has interacted — it can no longer Drop artifacts that turn.
18. **Sacrifice ≠ destroy**: a sacrificed minion dies (Deathrites trigger); a sacrificed site becomes rubble. A dying unit cannot be sacrificed.
19. **Carrying units**: some units can carry other units, conferring their movement keywords (Airborne, Burrowing, etc.) to the carried unit.
20. **Flooded site**: gains at least 1 water affinity — it becomes a water site regardless of its other icons.
21. **Stronger/Weakest with split power**: use the average of Attack and Defense power, rounding down.
22. **Stealth is lost the moment the minion interacts with the realm** (strikes, deals damage, casts, activates an ability).
23. **Defend range = Range of Motion**: a unit can only defend if the attack location is within the reach of its Move and Attack ability (accounting for its movement keywords).