// ── ITEM LIBRARY ────────────────────────────────────────────────────────────
// Edit this file to add, remove, or modify items.
//
// Fields:
//   name          (required) string
//   bulk          (required) Bulk.PACKABLE | Bulk.STOCK | Bulk.BULKY | Bulk.VERYBULKY
//   description   (optional) HTML string shown in the inspector
//   cost          (optional) string shown in the inspector, e.g. "50 gp"
//   dmOnly        (optional) true → hidden from players' autocomplete
//   noCarry       (optional) true → doesn't count toward carry capacity
//   containerRows (optional) number → item acts as a container with this many rows
//   variables     (optional) { key: { value, control, min, max } } → tracked counters

window.Bulk = {
  PACKABLE:  { id: 'packable'  },
  STOCK:     { id: 'stock'     },
  BULKY:     { id: 'bulky'     },
  VERYBULKY: { id: 'verybulky' },
};

// Weapon list used by magical weapon items — update here to add new weapon types
window.WEAPON_OPTIONS = [
  "Club","Dagger","Greatclub","Handaxe","Javelin","Light Hammer","Mace",
  "Quarterstaff","Sickle","Spear","Dart","Light Crossbow","Shortbow","Sling",
  "Battleaxe","Flail","Glaive","Greataxe","Greatsword","Halberd","Lance",
  "Longsword","Maul","Morningstar","Pike","Rapier","Scimitar","Shortsword",
  "Trident","Warhammer","War Pick","Whip","Blowgun","Hand Crossbow",
  "Heavy Crossbow","Longbow",
];

window.ITEM_LIBRARY = [

  // ── SIMPLE MELEE — LIGHT THROWN (2 gp, Packable) ────────────────────────
  { name: "Dagger",       bulk: Bulk.PACKABLE, cost: "2 gp",  description: `<i>Simple Melee Weapon</i><br>1d4 Piercing &mdash; Finesse, Light, Thrown (20/60) &bull; Mastery: Nick` },
  { name: "Handaxe",      bulk: Bulk.PACKABLE, cost: "2 gp",  description: `<i>Simple Melee Weapon</i><br>1d6 Slashing &mdash; Light, Thrown (20/60) &bull; Mastery: Vex` },
  { name: "Light Hammer", bulk: Bulk.PACKABLE, cost: "2 gp",  description: `<i>Simple Melee Weapon</i><br>1d4 Bludgeoning &mdash; Light, Thrown (20/60) &bull; Mastery: Nick` },

  // ── SIMPLE MELEE — LIGHT (5 gp, Stock) ──────────────────────────────────
  { name: "Club",         bulk: Bulk.STOCK,    cost: "5 gp",  description: `<i>Simple Melee Weapon</i><br>1d4 Bludgeoning &mdash; Light &bull; Mastery: Slow` },
  { name: "Sickle",       bulk: Bulk.STOCK,    cost: "5 gp",  description: `<i>Simple Melee Weapon</i><br>1d4 Slashing &mdash; Light &bull; Mastery: Nick` },

  // ── SIMPLE MELEE — STANDARD (10 gp, Stock) ──────────────────────────────
  { name: "Javelin",      bulk: Bulk.STOCK,    cost: "10 gp", description: `<i>Simple Melee Weapon</i><br>1d6 Piercing &mdash; Thrown (30/120) &bull; Mastery: Slow` },
  { name: "Mace",         bulk: Bulk.STOCK,    cost: "10 gp", description: `<i>Simple Melee Weapon</i><br>1d6 Bludgeoning &bull; Mastery: Sap` },
  { name: "Quarterstaff", bulk: Bulk.STOCK,    cost: "10 gp", description: `<i>Simple Melee Weapon</i><br>1d6 Bludgeoning &mdash; Versatile (1d8) &bull; Mastery: Topple` },
  { name: "Spear",        bulk: Bulk.STOCK,    cost: "10 gp", description: `<i>Simple Melee Weapon</i><br>1d6 Piercing &mdash; Thrown (20/60), Versatile (1d8) &bull; Mastery: Sap` },

  // ── SIMPLE MELEE — TWO-HANDED (15 gp, Stock) ────────────────────────────
  { name: "Greatclub",    bulk: Bulk.STOCK,    cost: "15 gp", description: `<i>Simple Melee Weapon</i><br>1d8 Bludgeoning &mdash; Two-Handed &bull; Mastery: Push` },

  // ── SIMPLE RANGED (15 gp, Stock) ────────────────────────────────────────
  { name: "Dart",          bulk: Bulk.STOCK,   cost: "15 gp", description: `<i>Simple Ranged Weapon</i><br>1d4 Piercing &mdash; Finesse, Thrown (20/60) &bull; Mastery: Vex` },
  { name: "Light Crossbow",bulk: Bulk.STOCK,   cost: "15 gp", description: `<i>Simple Ranged Weapon</i><br>1d8 Piercing &mdash; Ammunition (80/320), Loading, Two-Handed &bull; Mastery: Slow` },
  { name: "Shortbow",      bulk: Bulk.STOCK,   cost: "15 gp", description: `<i>Simple Ranged Weapon</i><br>1d6 Piercing &mdash; Ammunition (80/320), Two-Handed &bull; Mastery: Vex` },
  { name: "Sling",         bulk: Bulk.STOCK,   cost: "15 gp", description: `<i>Simple Ranged Weapon</i><br>1d4 Bludgeoning &mdash; Ammunition (30/120) &bull; Mastery: Slow` },

  // ── MARTIAL MELEE — LIGHT (20 gp, Stock) ────────────────────────────────
  { name: "Scimitar",     bulk: Bulk.STOCK,    cost: "20 gp", description: `<i>Martial Melee Weapon</i><br>1d6 Slashing &mdash; Finesse, Light &bull; Mastery: Nick` },
  { name: "Shortsword",   bulk: Bulk.STOCK,    cost: "20 gp", description: `<i>Martial Melee Weapon</i><br>1d6 Piercing &mdash; Finesse, Light &bull; Mastery: Vex` },

  // ── MARTIAL MELEE — STANDARD (25 gp, Stock) ─────────────────────────────
  { name: "Battleaxe",    bulk: Bulk.STOCK,    cost: "25 gp", description: `<i>Martial Melee Weapon</i><br>1d8 Slashing &mdash; Versatile (1d10) &bull; Mastery: Topple` },
  { name: "Flail",        bulk: Bulk.STOCK,    cost: "25 gp", description: `<i>Martial Melee Weapon</i><br>1d8 Bludgeoning &bull; Mastery: Sap` },
  { name: "Longsword",    bulk: Bulk.STOCK,    cost: "25 gp", description: `<i>Martial Melee Weapon</i><br>1d8 Slashing &mdash; Versatile (1d10) &bull; Mastery: Sap` },
  { name: "Morningstar",  bulk: Bulk.STOCK,    cost: "25 gp", description: `<i>Martial Melee Weapon</i><br>1d8 Piercing &bull; Mastery: Sap` },
  { name: "Rapier",       bulk: Bulk.STOCK,    cost: "25 gp", description: `<i>Martial Melee Weapon</i><br>1d8 Piercing &mdash; Finesse &bull; Mastery: Vex` },
  { name: "Trident",      bulk: Bulk.STOCK,    cost: "25 gp", description: `<i>Martial Melee Weapon</i><br>1d8 Piercing &mdash; Thrown (20/60), Versatile (1d10) &bull; Mastery: Topple` },
  { name: "Warhammer",    bulk: Bulk.STOCK,    cost: "25 gp", description: `<i>Martial Melee Weapon</i><br>1d8 Bludgeoning &mdash; Versatile (1d10) &bull; Mastery: Push` },
  { name: "War Pick",     bulk: Bulk.STOCK,    cost: "25 gp", description: `<i>Martial Melee Weapon</i><br>1d8 Piercing &mdash; Versatile (1d10) &bull; Mastery: Sap` },
  { name: "Whip",         bulk: Bulk.STOCK,    cost: "25 gp", description: `<i>Martial Melee Weapon</i><br>1d4 Slashing &mdash; Finesse, Reach &bull; Mastery: Slow` },

  // ── MARTIAL MELEE — TWO-HANDED (40 gp, Stock) ───────────────────────────
  { name: "Glaive",       bulk: Bulk.STOCK,    cost: "40 gp", description: `<i>Martial Melee Weapon</i><br>1d10 Slashing &mdash; Heavy, Reach, Two-Handed &bull; Mastery: Graze` },
  { name: "Greataxe",     bulk: Bulk.STOCK,    cost: "40 gp", description: `<i>Martial Melee Weapon</i><br>1d12 Slashing &mdash; Heavy, Two-Handed &bull; Mastery: Cleave` },
  { name: "Greatsword",   bulk: Bulk.STOCK,    cost: "40 gp", description: `<i>Martial Melee Weapon</i><br>2d6 Slashing &mdash; Heavy, Two-Handed &bull; Mastery: Graze` },
  { name: "Halberd",      bulk: Bulk.STOCK,    cost: "40 gp", description: `<i>Martial Melee Weapon</i><br>1d10 Slashing &mdash; Heavy, Reach, Two-Handed &bull; Mastery: Cleave` },
  { name: "Lance",        bulk: Bulk.STOCK,    cost: "40 gp", description: `<i>Martial Melee Weapon</i><br>1d10 Piercing &mdash; Heavy, Reach, Two-Handed (unless mounted) &bull; Mastery: Topple` },
  { name: "Maul",         bulk: Bulk.STOCK,    cost: "40 gp", description: `<i>Martial Melee Weapon</i><br>2d6 Bludgeoning &mdash; Heavy, Two-Handed &bull; Mastery: Topple` },
  { name: "Pike",         bulk: Bulk.STOCK,    cost: "40 gp", description: `<i>Martial Melee Weapon</i><br>1d10 Piercing &mdash; Heavy, Reach, Two-Handed &bull; Mastery: Push` },

  // ── MARTIAL RANGED (40 gp, Stock) ───────────────────────────────────────
  { name: "Blowgun",        bulk: Bulk.STOCK,  cost: "40 gp", description: `<i>Martial Ranged Weapon</i><br>1 Piercing &mdash; Ammunition (25/100), Loading &bull; Mastery: Vex` },
  { name: "Hand Crossbow",  bulk: Bulk.STOCK,  cost: "40 gp", description: `<i>Martial Ranged Weapon</i><br>1d6 Piercing &mdash; Ammunition (30/120), Light, Loading &bull; Mastery: Vex` },
  { name: "Heavy Crossbow", bulk: Bulk.STOCK,  cost: "40 gp", description: `<i>Martial Ranged Weapon</i><br>1d10 Piercing &mdash; Ammunition (100/400), Heavy, Loading, Two-Handed &bull; Mastery: Push` },
  { name: "Longbow",        bulk: Bulk.STOCK,  cost: "40 gp", description: `<i>Martial Ranged Weapon</i><br>1d8 Piercing &mdash; Ammunition (150/600), Heavy, Two-Handed &bull; Mastery: Slow` },

  // ── ARMOUR ───────────────────────────────────────────────────────────────
  { name: "Shield",       bulk: Bulk.STOCK,    cost: "10 gp",   description: `+2 AC. You gain the Armor Class benefit of a Shield only if you have training with it.` },
  { name: "Light Armor",  bulk: Bulk.STOCK,    cost: "25 gp",   description: `<i>Light Armor (1 min to don or doff)</i><br>AC 11–12 + Dex modifier. Includes padded, leather, and studded leather.` },
  { name: "Medium Armor", bulk: Bulk.STOCK,    cost: "50 gp",   description: `<i>Medium Armor (5 min to don, 1 min to doff)</i><br>AC 12–14 + Dex modifier (max 2). Includes hide, chain shirt, and scale mail.` },
  { name: "Heavy Armor",  bulk: Bulk.STOCK,    cost: "100 gp",  description: `<i>Heavy Armor (10 min to don, 5 min to doff)</i><br>AC 14–16. Includes ring mail and chain mail. Str 13 required for chain mail. Stealth Disadvantage.` },
  { name: "Splint Armor", bulk: Bulk.STOCK,    cost: "250 gp",  description: `<i>Heavy Armor (10 min to don, 5 min to doff)</i><br>AC 17. Str 15 required. Stealth Disadvantage.` },
  { name: "Breastplate",  bulk: Bulk.STOCK,    cost: "500 gp",  description: `<i>Medium Armor (5 min to don, 1 min to doff)</i><br>AC 14 + Dex modifier (max 2).` },
  { name: "Half Plate",   bulk: Bulk.STOCK,    cost: "500 gp",  description: `<i>Medium Armor (5 min to don, 1 min to doff)</i><br>AC 15 + Dex modifier (max 2). Stealth Disadvantage.` },
  { name: "Full Plate",   bulk: Bulk.BULKY,    cost: "1000 gp", description: `<i>Heavy Armor (10 min to don, 5 min to doff)</i><br>AC 18. Str 15 required. Stealth Disadvantage.` },

  // ── CURRENCY ─────────────────────────────────────────────────────────────
  // Stacks up to 50 per packable slot. Use the counter to track quantity.
  { name: "Copper Pieces (CP)",   bulk: Bulk.PACKABLE, description: `1 cp = 1/10 sp = 1/100 gp`, variables: { coins: { value: 50, control: "both", min: 0, max: 50 } } },
  { name: "Silver Pieces (SP)",   bulk: Bulk.PACKABLE, description: `1 sp = 10 cp = 1/10 gp`,    variables: { coins: { value: 50, control: "both", min: 0, max: 50 } } },
  { name: "Gold Pieces (GP)",     bulk: Bulk.PACKABLE, description: `1 gp = 10 sp = 100 cp`,     variables: { coins: { value: 50, control: "both", min: 0, max: 50 } } },
  { name: "Platinum Pieces (PP)", bulk: Bulk.PACKABLE, description: `1 pp = 10 gp = 100 sp`,     variables: { coins: { value: 50, control: "both", min: 0, max: 50 } } },

  // ── ADVENTURING GEAR ─────────────────────────────────────────────────────
  { name: "Rations (1 day)",     bulk: Bulk.PACKABLE, cost: "1 gp",  description: `Travel-ready food — jerky, dried fruit, hardtack, and nuts.` },
  { name: "Waterskin",           bulk: Bulk.STOCK,    cost: "1 gp",  description: `Holds up to 4 pints. If you don't drink sufficient water, you risk dehydration.` },
  { name: "Tinderbox",           bulk: Bulk.PACKABLE, cost: "5 sp",  description: `Contains flint, fire steel, and tinder. Bonus action to light a candle, lamp, lantern, or torch. Lighting any other fire takes 1 minute.` },
  { name: "Mirror",              bulk: Bulk.PACKABLE, cost: "5 sp",  description: `A handheld steel mirror — useful for personal cosmetics, peeking around corners, or reflecting light as a signal.` },
  { name: "Bell",                bulk: Bulk.PACKABLE, cost: "5 sp",  description: `When rung as a Utilize action, produces a sound heard up to 60 feet away.` },
  { name: "Chalk (5 pieces)",    bulk: Bulk.PACKABLE, cost: "5 sp",  description: `Used to mark surfaces. Expend a piece to leave a visible mark.`, variables: { pieces: { value: 5, control: "plusminus", min: 0, max: 5 } } },
  { name: "Parchment (5 sheets)",bulk: Bulk.PACKABLE, cost: "5 sp",  description: `Each sheet holds about 250 handwritten words.`, variables: { sheets: { value: 5, control: "plusminus", min: 0, max: 5 } } },
  { name: "Ink and Pen",         bulk: Bulk.PACKABLE, cost: "5 sp",  description: `An ink pen and a 1-ounce bottle of ink — enough to write about 500 pages.` },
  { name: "Torch",               bulk: Bulk.PACKABLE, cost: "5 sp",  description: `Burns for 1 hour, casting Bright Light in a 20-foot radius and Dim Light for an additional 20 feet. Can be used as a simple melee weapon (1 Fire damage on a hit).`, variables: { torches: { value: 6, control: "plusminus", min: 0, max: 6 } } },
  { name: "Whistle / Horn",      bulk: Bulk.PACKABLE, cost: "1 gp",  description: `Produces a sound that can be heard up to 600 feet away (whistle) or across great distances (horn). Utilize action to blow.` },
  { name: "Shovel",              bulk: Bulk.STOCK,    cost: "1 gp",  description: `Working for 1 hour, you can use a Shovel to dig a hole 5 feet on each side in soil or similar material.` },
  { name: "Rope (50ft)",         bulk: Bulk.STOCK,    cost: "1 gp",  description: `As a Utilize action, tie a knot with a DC Dexterity (Sleight of Hand) check. Burst with a successful Strength (Athletics) check. Can bind a Grappled, Incapacitated, or Restrained creature.` },
  { name: "Oil Flask",           bulk: Bulk.PACKABLE, cost: "2 gp",  description: `Fuel for lanterns. Bonus action to douse a creature or object; on a hit, target takes 5 Fire damage if ignited before the start of your next turn. One flask fuels a lantern for 6 hours.`, variables: { flasks: { value: 5, control: "plusminus", min: 0, max: 5 } } },
  { name: "Manacles",            bulk: Bulk.STOCK,    cost: "2 gp",  description: `As a Utilize action, bind a Grappled, Incapacitated, or Restrained creature within 5 feet (DC Dexterity (Sleight of Hand) check). While bound, the creature has Disadvantage on attack rolls and can't cast spells with somatic components. DC 20 Strength (Athletics) or DC 15 Dexterity (Sleight of Hand) to escape.` },
  { name: "Grappling Hook",      bulk: Bulk.PACKABLE, cost: "2 gp",  description: `As a Utilize action, throw up to 50 feet to catch on a railing, ledge, or similar (DC Dexterity (Acrobatics) check). Attach a rope to climb.` },
  { name: "Crowbar",             bulk: Bulk.STOCK,    cost: "2 gp",  description: `Using a Crowbar gives you Advantage on Strength checks where its leverage can be applied.` },
  { name: "Lantern, Hooded",     bulk: Bulk.STOCK,    cost: "5 gp",  description: `Burns oil as fuel. Casts Bright Light in a 30-foot radius and Dim Light for an additional 30 feet. Bonus action to lower the hood (Dim Light in a 5-foot radius) or raise it again.` },
  { name: "Satchel",             bulk: Bulk.STOCK,    cost: "2 gp",  description: `Holds gear. Does not count toward carry capacity.`, noCarry: true, containerRows: 1 },
  { name: "Backpack",            bulk: Bulk.STOCK,    cost: "5 gp",  description: `Holds up to 30 pounds within 1 cubic foot. Does not count toward carry capacity.`, noCarry: true, containerRows: 4 },
  { name: "Saddlebag",           bulk: Bulk.STOCK,    cost: "5 gp",  description: `Attaches to a mount. Holds gear and does not count toward your carry capacity.`, noCarry: true, containerRows: 2 },
  { name: "Ammunition Cache",    bulk: Bulk.STOCK,    cost: "15 gp", description: `One cache per ammunition type. Represents a full, regularly resupplied supply — no need to track individual rounds. Must be worn to access. Thrown, magical, or otherwise unique ammunition must still be tracked separately; a cache of their kind holds up to 8.`, variables: { count: { value: 8, control: "plusminus", min: 0, max: 8 } } },
  { name: "Ball Bearings",       bulk: Bulk.PACKABLE, cost: "1 gp",  description: `As a Utilize action, spill to cover a level 10-foot-square area within 10 feet. Creatures entering the area must succeed on a DC 10 Dexterity saving throw or fall Prone. Takes 10 minutes to collect.` },
  { name: "Caltrops",            bulk: Bulk.PACKABLE, cost: "1 gp",  description: `As a Utilize action, spread to cover a 5-foot-square area within 5 feet. Creatures entering must succeed on a DC 10 Dexterity saving throw or take 1 Piercing damage and have Speed reduced to 0 until the start of their next turn.` },
  { name: "Basic Poison",        bulk: Bulk.PACKABLE, cost: "5 gp",  description: `As a Bonus Action, coat one weapon or up to three pieces of ammunition. A creature that takes Piercing or Slashing damage from the poisoned weapon takes an extra 1d4 Poison damage. Retains potency for 1 minute or until its first hit.` },
  { name: "Holy Water",          bulk: Bulk.PACKABLE, cost: "5 gp",  description: `When you take the Attack action, you can replace one attack with throwing this flask at a creature within 20 feet. Target makes a DC Dexterity saving throw or takes 2d8 Radiant damage if it is a Fiend or Undead.` },
  { name: "Acid",                bulk: Bulk.PACKABLE, cost: "8 gp",  description: `When you take the Attack action, replace one attack with throwing this vial at a target within 20 feet. Target makes a DC Dexterity saving throw or takes 2d6 Acid damage.` },
  { name: "Alchemist's Fire",    bulk: Bulk.PACKABLE, cost: "8 gp",  description: `When you take the Attack action, replace one attack with throwing this flask at a target within 20 feet. Target makes a DC Dexterity saving throw or takes 1d4 Fire damage and starts burning. A burning creature takes 1d4 Fire damage at the start of each of its turns; a Utilize action ends the burning.` },
  { name: "Bottled Lightning",   bulk: Bulk.PACKABLE, cost: "8 gp",  description: `*` },
  { name: "Flask of Floods",     bulk: Bulk.PACKABLE, cost: "8 gp",  description: `*` },
  { name: "Smoke Bomb",          bulk: Bulk.PACKABLE, cost: "8 gp",  description: `*` },
  { name: "Winter's Breath",     bulk: Bulk.PACKABLE, cost: "8 gp",  description: `*` },
  { name: "Oil of Elemental Damage", bulk: Bulk.PACKABLE, cost: "8 gp", description: `*` },
  { name: "Healing Potion",      bulk: Bulk.PACKABLE, cost: "8 gp",  description: `As a Bonus Action, drink or administer to a creature within 5 feet. The creature regains 2d4 + 2 Hit Points.` },


  // ── CONSUMABLE MAGICAL CURIOS ────────────────────────────────────────────
  // Common
  { name: "Gem of False Value",      bulk: Bulk.PACKABLE, cost: "1 cp",   description: `Appears to be a valuable gemstone worth 100 gp or more, but is magically worthless. A creature that examines it must succeed on a DC 15 Intelligence (Arcana) check to identify the ruse.` },
  { name: "Identifying Scroll",      bulk: Bulk.PACKABLE, cost: "15 gp",  description: `A scroll inscribed with the Identify spell. Cast it without requiring a spell slot or material components to learn the properties of one magic item or one spell affecting a creature.` },
  { name: "Sticky Finger",           bulk: Bulk.PACKABLE, cost: "15 gp",  description: `*` },
  { name: "Raven Charm",             bulk: Bulk.PACKABLE, cost: "30 gp",  description: `*` },
  { name: "Ammunition of Capture",   bulk: Bulk.PACKABLE, cost: "30 gp",  description: `*` },
  { name: "Ammunition of Tracking",  bulk: Bulk.PACKABLE, cost: "30 gp",  description: `*` },
  { name: "Ammunition of Grappling", bulk: Bulk.PACKABLE, cost: "30 gp",  description: `*` },
  { name: "Bubble Token",            bulk: Bulk.PACKABLE, cost: "60 gp",  description: `*` },
  { name: "Feather Token",           bulk: Bulk.PACKABLE, cost: "60 gp",  description: `A tiny magical feather. When released as a Free action while falling, it casts Feather Fall on you until you land.` },
  { name: "Balm of Disguise",        bulk: Bulk.PACKABLE, cost: "60 gp",  description: `*` },
  { name: "Shield Wall",             bulk: Bulk.PACKABLE, cost: "60 gp",  description: `*` },
  { name: "Seed of Climbing",        bulk: Bulk.PACKABLE, cost: "60 gp",  description: `*` },

  // Uncommon — Waning Wands (60 gp/charge; individual named wands, cannot be recharged)
  { name: "Waning Wand of Magic Missile", bulk: Bulk.PACKABLE, cost: "60 gp/charge", description: `<i>Waning wand — cannot be recharged</i><br>Expend a charge to cast Magic Missile (3 darts). Each charge spent increases the level by 1 (max 5th level).`, variables: { charges: { value: 3, control: "plusminus", min: 0, max: 3 } } },
  { name: "Waning Wand of Web",           bulk: Bulk.PACKABLE, cost: "60 gp/charge", description: `<i>Waning wand — cannot be recharged</i><br>Expend a charge to cast Web (DC 13).`, variables: { charges: { value: 3, control: "plusminus", min: 0, max: 3 } } },
  { name: "Waning Wand of Darkness",      bulk: Bulk.PACKABLE, cost: "60 gp/charge", description: `<i>Waning wand — cannot be recharged</i><br>Expend a charge to cast Darkness.`, variables: { charges: { value: 3, control: "plusminus", min: 0, max: 3 } } },
  { name: "Waning Wand of Paralysis",     bulk: Bulk.PACKABLE, cost: "60 gp/charge", description: `<i>Waning wand — cannot be recharged</i><br>Expend a charge to cast Hold Person (DC 13).`, variables: { charges: { value: 3, control: "plusminus", min: 0, max: 3 } } },
  { name: "Waning Wand of Wonder",        bulk: Bulk.PACKABLE, cost: "60 gp/charge", description: `<i>Waning wand — cannot be recharged</i><br>Expend a charge to trigger a random magical effect (roll on the Wand of Wonder table).`, variables: { charges: { value: 3, control: "plusminus", min: 0, max: 3 } } },

  // Uncommon — other
  { name: "Gem of Recall",         bulk: Bulk.PACKABLE, cost: "120 gp", description: `*` },
  { name: "Deathrite Coins",       bulk: Bulk.PACKABLE, cost: "120 gp", description: `*` },
  { name: "Dust of Revealing",     bulk: Bulk.PACKABLE, cost: "120 gp", description: `*` },
  { name: "Dust of Disappearance", bulk: Bulk.PACKABLE, cost: "120 gp", description: `When thrown into the air, the dust covers all creatures and objects within 10 feet, rendering them Invisible for 2d4 minutes. Attacking or casting a spell ends the invisibility for that creature.` },
  { name: "Salt of Binding",       bulk: Bulk.PACKABLE, cost: "120 gp", description: `*` },
  { name: "Tonic of Potency",      bulk: Bulk.PACKABLE, cost: "120 gp", description: `*` },
  { name: "Cloudy Hag Eye",        bulk: Bulk.PACKABLE, cost: "120 gp", description: `*` },
  { name: "Flicker Dagger",        bulk: Bulk.STOCK,    cost: "120 gp", description: `*` },
  { name: "Deep-Haul Harpoon",     bulk: Bulk.STOCK,    cost: "60 gp/charge", description: `*`, variables: { charges: { value: 3, control: "plusminus", min: 0, max: 3 } } },
  { name: "Weapon of Silence",     bulk: Bulk.PACKABLE, cost: "60 gp/charge", description: `*`, variables: { weapon: { control: "select", value: "Longsword", options: WEAPON_OPTIONS }, charges: { value: 3, control: "plusminus", min: 0, max: 3 } } },
  { name: "Luster Weapon",         bulk: Bulk.STOCK,    cost: "60 gp/charge", description: `*`, hidden: true, variables: { weapon: { control: "select", value: "Longsword", options: WEAPON_OPTIONS }, charges: { value: 3, control: "plusminus", min: 0, max: 3 } } },

  // Rare — all hidden
  { name: "Waning Wand of Lightning Bolt", bulk: Bulk.PACKABLE, cost: "120 gp/charge", description: `<i>Waning wand — cannot be recharged</i><br>Expend a charge to cast Lightning Bolt (DC 15, 8d6).`, variables: { charges: { value: 3, control: "plusminus", min: 0, max: 3 } } },
  { name: "Waning Wand of Fireball",       bulk: Bulk.PACKABLE, cost: "120 gp/charge", description: `<i>Waning wand — cannot be recharged</i><br>Expend a charge to cast Fireball (DC 15, 8d6).`, variables: { charges: { value: 3, control: "plusminus", min: 0, max: 3 } } },
  { name: "Waning Wand of Polymorph",      bulk: Bulk.PACKABLE, cost: "120 gp/charge", description: `<i>Waning wand — cannot be recharged</i><br>Expend a charge to cast Polymorph (DC 15).`, variables: { charges: { value: 3, control: "plusminus", min: 0, max: 3 } } },
  { name: "Ammunition of Spell Storing",   bulk: Bulk.PACKABLE, cost: "+60 gp",        description: `*`, hidden: true },
  { name: "Undead Paw",                    bulk: Bulk.PACKABLE, cost: "120 gp/charge", description: `*`, hidden: true, variables: { charges: { value: 3, control: "plusminus", min: 0, max: 3 } } },
  { name: "Ammunition of Slaying",         bulk: Bulk.PACKABLE, cost: "120 gp",        description: `*`, hidden: true },
  { name: "Spear of Lightning",            bulk: Bulk.STOCK,    cost: "120 gp",        description: `*`, hidden: true },
  { name: "Glyph Scroll",                  bulk: Bulk.PACKABLE, cost: "240 gp",        description: `*`, hidden: true },
  { name: "Witch's Ladder",                bulk: Bulk.PACKABLE, cost: "240 gp",        description: `*`, hidden: true },
  { name: "Death-Knell Weapon",            bulk: Bulk.PACKABLE, cost: "120 gp/charge", description: `*`, hidden: true, variables: { weapon: { control: "select", value: "Longsword", options: WEAPON_OPTIONS }, charges: { value: 3, control: "plusminus", min: 0, max: 3 } } },

  // Very Rare — all hidden
  { name: "Elemental Gem (Air)",    bulk: Bulk.PACKABLE, cost: "500 gp",  description: `Crush to summon an Air Elemental that serves you for 1 hour or until reduced to 0 HP.`, hidden: true },
  { name: "Elemental Gem (Water)",  bulk: Bulk.PACKABLE, cost: "500 gp",  description: `Crush to summon a Water Elemental that serves you for 1 hour or until reduced to 0 HP.`, hidden: true },
  { name: "Elemental Gem (Fire)",   bulk: Bulk.PACKABLE, cost: "500 gp",  description: `Crush to summon a Fire Elemental that serves you for 1 hour or until reduced to 0 HP.`, hidden: true },
  { name: "Elemental Gem (Earth)",  bulk: Bulk.PACKABLE, cost: "500 gp",  description: `Crush to summon an Earth Elemental that serves you for 1 hour or until reduced to 0 HP.`, hidden: true },
  { name: "Chalk of Passwall",      bulk: Bulk.PACKABLE, cost: "500 gp",  description: `*`, hidden: true },
  { name: "Tears of Celestia",      bulk: Bulk.PACKABLE, cost: "500 gp",  description: `*`, hidden: true },
  { name: "Deck of Wonder",         bulk: Bulk.PACKABLE, cost: "1800 gp", description: `*`, hidden: true },

  // ── GEMS OF ENCHANTMENT ──────────────────────────────────────────────────
  // Uncommon (500 gp) — applied to a weapon; use the weapon dropdown to specify
  { name: "Gem of Elemental Resistance", bulk: Bulk.PACKABLE, cost: "500 gp", description: `*` },
  { name: "Gem of Returning Weapon",     bulk: Bulk.PACKABLE, cost: "500 gp", description: `*`, variables: { weapon: { control: "select", value: "Longsword", options: WEAPON_OPTIONS } } },
  { name: "Gem of Shifting Weapon",      bulk: Bulk.PACKABLE, cost: "500 gp", description: `*`, variables: { weapon: { control: "select", value: "Longsword", options: WEAPON_OPTIONS } } },
  { name: "Gem of Elemental Weapon",     bulk: Bulk.PACKABLE, cost: "500 gp", description: `*`, variables: { weapon: { control: "select", value: "Longsword", options: WEAPON_OPTIONS } } },
  { name: "Gem of Ghost-Strike",         bulk: Bulk.PACKABLE, cost: "500 gp", description: `*`, variables: { weapon: { control: "select", value: "Longsword", options: WEAPON_OPTIONS } } },
  { name: "Gem of Aquatic Weapon",       bulk: Bulk.PACKABLE, cost: "500 gp", description: `*`, variables: { weapon: { control: "select", value: "Longsword", options: WEAPON_OPTIONS } } },
  { name: "Gem of Accuracy",             bulk: Bulk.PACKABLE, cost: "500 gp", description: `*`, variables: { weapon: { control: "select", value: "Longsword", options: WEAPON_OPTIONS } } },
  { name: "Gem of Mastery",              bulk: Bulk.PACKABLE, cost: "500 gp", description: `*`, variables: { weapon: { control: "select", value: "Longsword", options: WEAPON_OPTIONS } } },

  // Rare (800 gp) — hidden
  { name: "Gem of Resilience",    bulk: Bulk.PACKABLE, cost: "800 gp", description: `*`, hidden: true },
  { name: "Gem of Warning",       bulk: Bulk.PACKABLE, cost: "800 gp", description: `*`, hidden: true },
  { name: "Gem of Excess",        bulk: Bulk.PACKABLE, cost: "800 gp", description: `*`, hidden: true },
  { name: "Gem of Spell Storing", bulk: Bulk.PACKABLE, cost: "800 gp", description: `*`, hidden: true },

  // ── TOOLKITS ─────────────────────────────────────────────────────────────
  { name: "Camp Supplies",         bulk: Bulk.STOCK, cost: "10 gp", description: `Tent, bedroll, fire-starting supplies, and cooking gear for one person. Provides a comfortable long rest in the wilderness.` },
  { name: "Climber's Tools",       bulk: Bulk.STOCK, cost: "15 gp", description: `<i>Ability: Strength</i><br>Boot tips, gloves, pitons, and a harness. As a Utilize action, anchor yourself so you can't fall more than 25 feet from the anchor point or move more than 25 feet from it without undoing the anchor as a Bonus Action.` },
  { name: "Smith's Tools",         bulk: Bulk.STOCK, cost: "15 gp", description: `<i>Ability: Strength</i><br>Utilize: Pry open a door or container (DC 20). Craft: melee weapons, medium/heavy armor, metal adventuring gear.` },
  { name: "Mason's Tools",         bulk: Bulk.STOCK, cost: "15 gp", description: `<i>Ability: Strength</i><br>Utilize: Chisel a symbol or hole in stone (DC 10). Craft: Block and Tackle.` },
  { name: "Woodcarver's Tools",    bulk: Bulk.STOCK, cost: "15 gp", description: `<i>Ability: Dexterity</i><br>Utilize: Carve a pattern in wood (DC 10). Craft: clubs, ranged weapons, ammunition, arcane/druidic focuses, ink pen.` },
  { name: "Leatherworker's Tools", bulk: Bulk.STOCK, cost: "15 gp", description: `<i>Ability: Dexterity</i><br>Utilize: Add a design to a leather item (DC 10). Craft: sling, whip, leather armors, backpack, pouch, quiver, waterskin.` },
  { name: "Weaver's Tools",        bulk: Bulk.STOCK, cost: "15 gp", description: `<i>Ability: Dexterity</i><br>Utilize: Mend a tear in clothing (DC 10), or sew a Tiny design (DC 10). Craft: padded armor, bedroll, blanket, clothes, net, rope, tent.` },
  { name: "Scribe's Supplies",     bulk: Bulk.STOCK, cost: "15 gp", description: `<i>Ability: Intelligence</i><br>Ink, pens, and fine parchment for copying texts and scribing scrolls. Utilize: Produce a convincing written document (DC 10). Craft: written materials and spell scrolls.` },
  { name: "Painter's Supplies",    bulk: Bulk.STOCK, cost: "15 gp", description: `<i>Ability: Wisdom</i><br>Utilize: Paint a recognizable image of something you've seen (DC 10). Craft: Druidic Focus, Holy Symbol.` },
  { name: "Jeweler's Tools",       bulk: Bulk.STOCK, cost: "15 gp", description: `<i>Ability: Intelligence</i><br>Utilize: Discern a gem's value (DC 15). Craft: Arcane Focus, Holy Symbol.` },
  { name: "Cook's Utensils",       bulk: Bulk.STOCK, cost: "15 gp", description: `<i>Ability: Wisdom</i><br>Utilize: Improve food's flavor (DC 10), or detect spoiled or poisoned food (DC 15). Craft: Rations.` },
  { name: "Healer's Kit",          bulk: Bulk.STOCK, cost: "15 gp", description: `<i>Ability: Wisdom</i><br>10 uses. As a Utilize action, expend one use to stabilize an Unconscious creature at 0 Hit Points without a Medicine check.`, variables: { uses: { value: 10, control: "plusminus", min: 0, max: 10 } } },
  { name: "Poisoner's Kit",        bulk: Bulk.STOCK, cost: "15 gp", description: `<i>Ability: Intelligence</i><br>Utilize: Detect a poisoned object (DC 10). Craft: Basic Poison.` },
  { name: "Herbalism Kit",         bulk: Bulk.STOCK, cost: "15 gp", description: `<i>Ability: Intelligence</i><br>Utilize: Identify a plant (DC 10). Craft: Antitoxin, Candle, Healer's Kit, Potion of Healing.` },
  { name: "Glassblower's Tools",   bulk: Bulk.STOCK, cost: "15 gp", description: `<i>Ability: Intelligence</i><br>Utilize: Discern what a glass object held in the past 24 hours (DC 15). Craft: Glass Bottle, Magnifying Glass, Spyglass, Vial.` },
  { name: "Potter's Tools",        bulk: Bulk.STOCK, cost: "15 gp", description: `<i>Ability: Intelligence</i><br>Utilize: Discern what a ceramic object held in the past 24 hours (DC 15). Craft: Jug, Lamp.` },
  { name: "Thieves' Tools",        bulk: Bulk.STOCK, cost: "25 gp", description: `<i>Ability: Dexterity</i><br>Utilize: Pick a lock (DC 15), or disarm a trap (DC 15).` },
  { name: "Tinker's Tools",        bulk: Bulk.STOCK, cost: "25 gp", description: `<i>Ability: Dexterity</i><br>Utilize: Assemble a Tiny item from scrap that falls apart in 1 minute (DC 20). Craft: Bell, Lanterns, Hunting Trap, Lock, Manacles, Mirror, Shovel, Signal Whistle, Tinderbox.` },
  { name: "Alchemist's Supplies",  bulk: Bulk.STOCK, cost: "25 gp", description: `<i>Ability: Intelligence</i><br>Utilize: Identify a substance (DC 15), or start a fire (DC 15). Craft: Acid, Alchemist's Fire, Oil, Paper, Perfume.` },
  { name: "Disguise Kit",          bulk: Bulk.STOCK, cost: "25 gp", description: `<i>Ability: Charisma</i><br>Utilize: Apply makeup (DC 10). Craft: Costume. While wearing a costume crafted with this kit, you have Advantage on checks to impersonate the person or type of person it represents.` },
  { name: "Navigator's Tools",     bulk: Bulk.STOCK, cost: "75 gp", description: `<i>Ability: Wisdom</i><br>Utilize: Plot a course (DC 10), or determine your position by stargazing (DC 15).` },


  // ── MOUNTS ───────────────────────────────────────────────────────────────
  { name: "Donkey / Mule",  bulk: Bulk.BULKY, cost: "20 gp",  description: `A sturdy beast of burden. Can carry heavy loads over long distances. Speed 40 ft.` },
  { name: "Draft Horse",    bulk: Bulk.BULKY, cost: "50 gp",  description: `A large, powerful horse bred for hauling. Speed 40 ft. Can pull a wagon or plow.` },
  { name: "Riding Horse",   bulk: Bulk.BULKY, cost: "75 gp",  description: `A well-trained horse suitable for travel and combat. Speed 60 ft.` },
  { name: "Warhorse",       bulk: Bulk.BULKY, cost: "400 gp", description: `A combat-trained horse. Speed 60 ft. Can be used as a mount in battle without being spooked.` },
  { name: "Sled Dog",       bulk: Bulk.BULKY, cost: "50 gp",  description: `<i>Exotic Mount</i><br>A trained sled dog. Four sled dogs are required to pilot a Sled. Speed 40 ft.` },
  { name: "Camel",          bulk: Bulk.BULKY, cost: "50 gp",  description: `<i>Exotic Mount</i><br>A desert-adapted mount. Speed 50 ft. Can go without water for up to two weeks.` },
  { name: "Axe Beak",       bulk: Bulk.BULKY, cost: "100 gp", description: `<i>Exotic Mount</i><br>A large flightless bird with a heavy bill. Speed 50 ft. Can be trained as a mount.` },
  { name: "Elephant",       bulk: Bulk.BULKY, cost: "600 gp", description: `<i>Exotic Mount</i><br>A massive, intelligent beast. Speed 40 ft. Can carry enormous loads and serve in battle.` },

  // ── CARRIAGES ────────────────────────────────────────────────────────────
  { name: "Sled",           bulk: Bulk.BULKY, cost: "20 gp",  description: `24 item slots. Requires 4 sled dogs to pilot. Encumbrance limit is 10× the mounts' carry capacity.` },
  { name: "Wagon (Small)",  bulk: Bulk.BULKY, cost: "75 gp",  description: `200 item slots. Requires 1 large mount to pilot. Encumbrance limit is 10× the mount's carry capacity.` },
  { name: "Wagon (Large)",  bulk: Bulk.BULKY, cost: "100 gp", description: `400 item slots. Requires 2 large mounts to pilot. Encumbrance limit is 10× the mounts' carry capacity.` },

  // ── MISC ITEMS ────────────────────────────────────────────────────────────
  // Gems and Jewelry: use the value counter to track worth in gp
  { name: "Gems",    bulk: Bulk.PACKABLE, description: `Precious or semi-precious stones. Use the value counter to track their total worth in gp.`, variables: { "gp value": { value: 0, control: "both", min: 0, max: 9999 } } },
  { name: "Jewelry", bulk: Bulk.PACKABLE, description: `Rings, necklaces, bracelets, or other ornaments. Use the value counter to track their total worth in gp.`, variables: { "gp value": { value: 0, control: "both", min: 0, max: 9999 } } },

  // ── POTIONS ───────────────────────────────────────────────────────────────
  // Common (60 gp)
  { name: "Potion of Darkvision",       bulk: Bulk.PACKABLE, cost: "60 gp",  description: `<i>Common potion</i><br>Bonus Action to drink. Gain Darkvision out to 60 feet for 1 hour (if you already have Darkvision, its range extends by 60 feet).` },
  { name: "Potion of Water Breathing",  bulk: Bulk.PACKABLE, cost: "60 gp",  description: `<i>Common potion</i><br>Bonus Action to drink. Breathe underwater for 1 hour.` },
  { name: "Potion of Climbing",         bulk: Bulk.PACKABLE, cost: "60 gp",  description: `<i>Common potion</i><br>Bonus Action to drink. Gain a Climb Speed equal to your Speed and Advantage on Strength (Athletics) checks for 1 hour.` },
  { name: "Potion of Animal Friendship",bulk: Bulk.PACKABLE, cost: "60 gp",  description: `<i>Common potion</i><br>Bonus Action to drink. Casts Animal Friendship (no save) on up to three Beasts for 1 hour.` },
  // Uncommon (60 gp)
  { name: "Potion of Elemental Breath (Fire)",      bulk: Bulk.PACKABLE, cost: "60 gp", description: `<i>Uncommon potion</i><br>Bonus Action to drink. For 1 minute, use an Action to exhale a 30-foot cone dealing 4d6 Fire damage (DC 13 Dex save for half).` },
  { name: "Potion of Elemental Breath (Acid)",      bulk: Bulk.PACKABLE, cost: "60 gp", description: `<i>Uncommon potion</i><br>Bonus Action to drink. For 1 minute, use an Action to exhale a 30-foot cone dealing 4d6 Acid damage (DC 13 Dex save for half).` },
  { name: "Potion of Elemental Breath (Poison)",    bulk: Bulk.PACKABLE, cost: "60 gp", description: `<i>Uncommon potion</i><br>Bonus Action to drink. For 1 minute, use an Action to exhale a 30-foot cone dealing 4d6 Poison damage (DC 13 Dex save for half).` },
  { name: "Potion of Elemental Breath (Lightning)", bulk: Bulk.PACKABLE, cost: "60 gp", description: `<i>Uncommon potion</i><br>Bonus Action to drink. For 1 minute, use an Action to exhale a 30-foot cone dealing 4d6 Lightning damage (DC 13 Dex save for half).` },
  { name: "Potion of Elemental Breath (Cold)",      bulk: Bulk.PACKABLE, cost: "60 gp", description: `<i>Uncommon potion</i><br>Bonus Action to drink. For 1 minute, use an Action to exhale a 30-foot cone dealing 4d6 Cold damage (DC 13 Dex save for half).` },
  { name: "Philter of Love",            bulk: Bulk.PACKABLE, cost: "60 gp",  description: `<i>Uncommon potion</i><br>Bonus Action to drink. The next time you see a creature within 10 minutes, you have the Charmed condition toward that creature for 1 hour.` },
  { name: "Potion of Resistance (Fire)",      bulk: Bulk.PACKABLE, cost: "60 gp", description: `<i>Uncommon potion</i><br>Bonus Action to drink. Resistance to Fire damage for 1 hour.` },
  { name: "Potion of Resistance (Cold)",      bulk: Bulk.PACKABLE, cost: "60 gp", description: `<i>Uncommon potion</i><br>Bonus Action to drink. Resistance to Cold damage for 1 hour.` },
  { name: "Potion of Resistance (Acid)",      bulk: Bulk.PACKABLE, cost: "60 gp", description: `<i>Uncommon potion</i><br>Bonus Action to drink. Resistance to Acid damage for 1 hour.` },
  { name: "Potion of Resistance (Poison)",    bulk: Bulk.PACKABLE, cost: "60 gp", description: `<i>Uncommon potion</i><br>Bonus Action to drink. Resistance to Poison damage for 1 hour.` },
  { name: "Potion of Resistance (Lightning)", bulk: Bulk.PACKABLE, cost: "60 gp", description: `<i>Uncommon potion</i><br>Bonus Action to drink. Resistance to Lightning damage for 1 hour.` },
  { name: "Potion of Resistance (Necrotic)",  bulk: Bulk.PACKABLE, cost: "60 gp", description: `<i>Uncommon potion</i><br>Bonus Action to drink. Resistance to Necrotic damage for 1 hour.` },
  { name: "Potion of Greater Healing",  bulk: Bulk.PACKABLE, cost: "60 gp",  description: `<i>Uncommon potion</i><br>Bonus Action to drink. Regain 4d4 + 4 Hit Points.` },
  // Rare (120 gp)
  { name: "Potion of Mind Reading",     bulk: Bulk.PACKABLE, cost: "120 gp", description: `<i>Rare potion</i><br>Bonus Action to drink. Gain the effect of the Detect Thoughts spell (DC 13) for 10 minutes, no Concentration required.` },
  { name: "Potion of Growth",           bulk: Bulk.PACKABLE, cost: "120 gp", description: `<i>Rare potion</i><br>Bonus Action to drink. You are enlarged as per the Enlarge/Reduce spell for 1 minute (no concentration). Your size doubles, Strength checks and saves have Advantage, and your weapons deal an extra 1d4 damage.` },
  { name: "Elixir of Health",           bulk: Bulk.PACKABLE, cost: "120 gp", description: `<i>Rare potion</i><br>Bonus Action to drink. Cures all diseases and neutralizes all poisons. Ends the Blinded, Deafened, Paralyzed, and Poisoned conditions.` },
  { name: "Potion of Superior Healing", bulk: Bulk.PACKABLE, cost: "120 gp", description: `<i>Rare potion</i><br>Bonus Action to drink. Regain 8d4 + 8 Hit Points.` },
  // Very Rare (180–240 gp)
  { name: "Potion of Invisibility",     bulk: Bulk.PACKABLE, cost: "180 gp", description: `<i>Very Rare potion</i><br>Bonus Action to drink. Become Invisible for 1 hour. The effect ends early if you make an attack roll or cast a spell.` },
  { name: "Potion of Gaseous Form",     bulk: Bulk.PACKABLE, cost: "180 gp", description: `<i>Very Rare potion</i><br>Bonus Action to drink. You transform into a misty cloud as per the Gaseous Form spell for 1 hour (no concentration).` },
  { name: "Potion of Speed",            bulk: Bulk.PACKABLE, cost: "240 gp", description: `<i>Very Rare potion</i><br>Bonus Action to drink. The Haste spell is cast on you for 1 minute (no concentration).` },
  { name: "Potion of Heroism",          bulk: Bulk.PACKABLE, cost: "240 gp", description: `<i>Very Rare potion</i><br>Bonus Action to drink. Gain 10 Temporary Hit Points and the Frightened condition cannot be imposed on you for 1 hour.` },
  { name: "Potion of Flying",           bulk: Bulk.PACKABLE, cost: "240 gp", description: `<i>Very Rare potion</i><br>Bonus Action to drink. Gain a Fly Speed equal to your Speed for 1 hour. If you're aloft when the effect ends, you fall.` },
  { name: "Potion of Giant Strength",   bulk: Bulk.PACKABLE, cost: "240 gp", description: `<i>Very Rare potion</i><br>Bonus Action to drink. Strength score becomes 21 for 1 hour (higher if already greater).` },
  { name: "Oil of Etherealness",        bulk: Bulk.PACKABLE, cost: "240 gp", description: `<i>Very Rare oil</i><br>Action to apply. You and your equipment become Ethereal for 1 hour, able to pass through solid matter and see into the Material Plane but not be seen or affected by it.` },
  { name: "Potion of Vitality",         bulk: Bulk.PACKABLE, cost: "240 gp", description: `<i>Very Rare potion</i><br>Bonus Action to drink. Remove all levels of Exhaustion and cure all diseases and poisons. For the next 24 hours, whenever you roll a Hit Die to recover Hit Points, use the maximum value.` },

  // Ingots — fixed value, Stock
  { name: "Copper Ingot",      bulk: Bulk.STOCK, cost: "125 gp",  description: `A refined copper ingot worth 125 gp.` },
  { name: "Iron / Silver Ingot", bulk: Bulk.STOCK, cost: "250 gp", description: `A refined iron or silver ingot worth 250 gp.` },
  { name: "Gold Ingot",        bulk: Bulk.STOCK, cost: "500 gp",  description: `A refined gold ingot worth 500 gp.` },

  // Nuggets — variable value range, Bulky
  { name: "Copper Nugget",       bulk: Bulk.BULKY, cost: "50–125 gp",   description: `A raw copper nugget. Worth 50–125 gp depending on size and purity.` },
  { name: "Iron / Silver Nugget",bulk: Bulk.BULKY, cost: "100–250 gp",  description: `A raw iron or silver nugget. Worth 100–250 gp depending on size and purity.` },
  { name: "Gold Nugget",         bulk: Bulk.BULKY, cost: "200–500 gp",  description: `A raw gold nugget. Worth 200–500 gp depending on size and purity.` },

];
