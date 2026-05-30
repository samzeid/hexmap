// ── ITEM LIBRARY ────────────────────────────────────────────────────────────
// Edit this file to add, remove, or modify items.
//
// Fields:
//   name        (required) string
//   bulk        (required) one of: Bulk.PACKABLE, Bulk.STOCK, Bulk.BULKY, Bulk.VERYBULKY
//   description (optional) HTML string shown in the inspector
//   cost        (optional) string shown in the inspector, e.g. "50 gp" or "2 sp"
//   dmOnly      (optional) true → hidden from players' autocomplete
//   noCarry     (optional) true → doesn't count toward carry capacity
//   containerRows (optional) number → item acts as a container with this many rows
//   variables   (optional) { key: { value, control, min, max } } → tracked counters

window.Bulk = {
  PACKABLE:  { id: 'packable'  },
  STOCK:     { id: 'stock'     },
  BULKY:     { id: 'bulky'     },
  VERYBULKY: { id: 'verybulky' },
};

window.ITEM_LIBRARY = [

  // ── CONTAINERS ─────────────────────────────────────────────────────────────
  { name: "Backpack", bulk: Bulk.STOCK,    cost: "2 gp",  description: `Holds gear. Does not count toward carry capacity.`, noCarry: true, containerRows: 4 },
  { name: "Satchel",  bulk: Bulk.STOCK,    cost: "1 gp",  description: `Holds gear. Does not count toward carry capacity.`, noCarry: true, containerRows: 1 },

  // ── CURRENCY ────────────────────────────────────────────────────────────────
  { name: "Platinum Coins", bulk: Bulk.PACKABLE, description: `1 platinum coin = 10 gold coins`, variables: { coins: { value: 50, control: "both", min: 0, max: 50 } } },
  { name: "Gold Coins",     bulk: Bulk.PACKABLE, description: `1 gold coin = 10 silver coins`,   variables: { coins: { value: 50, control: "both", min: 0, max: 50 } } },
  { name: "Silver Coins",   bulk: Bulk.PACKABLE, description: `1 silver coin = 10 copper coins`, variables: { coins: { value: 50, control: "both", min: 0, max: 50 } } },
  { name: "Copper Coins",   bulk: Bulk.PACKABLE, description: `Basic currency unit`,              variables: { coins: { value: 50, control: "both", min: 0, max: 50 } } },

  // ── MUSICAL INSTRUMENTS ─────────────────────────────────────────────────────
  { name: "Bagpipes",  bulk: Bulk.BULKY, cost: "30 gp",  description: `Play a known tune (DC 10), or improvise (DC 15)` },
  { name: "Drum",      bulk: Bulk.STOCK, cost: "6 gp",   description: `Play a known tune (DC 10), or improvise (DC 15)` },
  { name: "Dulcimer",  bulk: Bulk.BULKY, cost: "25 gp",  description: `Play a known tune (DC 10), or improvise (DC 15)` },
  { name: "Flute",     bulk: Bulk.STOCK, cost: "2 gp",   description: `Play a known tune (DC 10), or improvise (DC 15)` },
  { name: "Lute",      bulk: Bulk.BULKY, cost: "35 gp",  description: `Play a known tune (DC 10), or improvise (DC 15)` },
  { name: "Lyre",      bulk: Bulk.STOCK, cost: "30 gp",  description: `Play a known tune (DC 10), or improvise (DC 15)` },
  { name: "Pan Flute", bulk: Bulk.STOCK, cost: "12 gp",  description: `Play a known tune (DC 10), or improvise (DC 15)` },
  { name: "Shawm",     bulk: Bulk.STOCK, cost: "2 gp",   description: `Play a known tune (DC 10), or improvise (DC 15)` },
  { name: "Viol",      bulk: Bulk.BULKY, cost: "30 gp",  description: `Play a known tune (DC 10), or improvise (DC 15)` },

  // ── SIMPLE WEAPONS ──────────────────────────────────────────────────────────
  { name: "Club",           bulk: Bulk.STOCK, cost: "1 sp",  description: `<i>simple weapon</i><br>1d4 bludgeoning &mdash; light` },
  { name: "Dagger",         bulk: Bulk.STOCK, cost: "2 gp",  description: `<i>simple weapon</i><br>1d4 piercing &mdash; finesse, light, thrown (20/60)` },
  { name: "Greatclub",      bulk: Bulk.BULKY, cost: "2 sp",  description: `<i>simple weapon</i><br>1d8 bludgeoning &mdash; two-handed` },
  { name: "Handaxe",        bulk: Bulk.STOCK, cost: "5 gp",  description: `<i>simple weapon</i><br>1d6 slashing &mdash; light, thrown (20/60)` },
  { name: "Javelin",        bulk: Bulk.STOCK, cost: "5 sp",  description: `<i>simple weapon</i><br>1d6 piercing &mdash; thrown (30/120)` },
  { name: "Light Hammer",   bulk: Bulk.STOCK, cost: "2 gp",  description: `<i>simple weapon</i><br>1d4 bludgeoning &mdash; light, thrown (20/60)` },
  { name: "Mace",           bulk: Bulk.STOCK, cost: "5 gp",  description: `<i>simple weapon</i><br>1d6 bludgeoning` },
  { name: "Quarterstaff",   bulk: Bulk.BULKY, cost: "2 sp",  description: `<i>simple weapon</i><br>1d6 bludgeoning &mdash; versatile (1d8)` },
  { name: "Sickle",         bulk: Bulk.STOCK, cost: "1 gp",  description: `<i>simple weapon</i><br>1d4 slashing &mdash; light` },
  { name: "Spear",          bulk: Bulk.STOCK, cost: "1 gp",  description: `<i>simple weapon</i><br>1d6 piercing &mdash; thrown (20/60), versatile (1d8)` },
  { name: "Light Crossbow", bulk: Bulk.STOCK, cost: "25 gp", description: `<i>simple weapon</i><br>1d8 piercing &mdash; range 80/320, loading, two-handed` },
  { name: "Dart",           bulk: Bulk.STOCK, cost: "5 cp",  description: `<i>simple weapon</i><br>1d4 piercing &mdash; finesse, thrown (20/60)` },
  { name: "Shortbow",       bulk: Bulk.STOCK, cost: "25 gp", description: `<i>simple weapon</i><br>1d6 piercing &mdash; range 80/320, two-handed` },
  { name: "Sling",          bulk: Bulk.STOCK, cost: "1 sp",  description: `<i>simple weapon</i><br>1d4 bludgeoning &mdash; range 30/120` },

  // ── MARTIAL WEAPONS ─────────────────────────────────────────────────────────
  { name: "Battleaxe",      bulk: Bulk.STOCK, cost: "10 gp",  description: `<i>martial weapon</i><br>1d8 slashing &mdash; versatile (1d10)` },
  { name: "Flail",          bulk: Bulk.STOCK, cost: "10 gp",  description: `<i>martial weapon</i><br>1d8 bludgeoning` },
  { name: "Glaive",         bulk: Bulk.BULKY, cost: "20 gp",  description: `<i>martial weapon</i><br>1d10 slashing &mdash; heavy, reach, two-handed` },
  { name: "Greataxe",       bulk: Bulk.BULKY, cost: "30 gp",  description: `<i>martial weapon</i><br>1d12 slashing &mdash; heavy, two-handed` },
  { name: "Greatsword",     bulk: Bulk.BULKY, cost: "50 gp",  description: `<i>martial weapon</i><br>2d6 slashing &mdash; heavy, two-handed` },
  { name: "Halberd",        bulk: Bulk.BULKY, cost: "20 gp",  description: `<i>martial weapon</i><br>1d10 slashing &mdash; heavy, reach, two-handed` },
  { name: "Lance",          bulk: Bulk.BULKY, cost: "10 gp",  description: `<i>martial weapon</i><br>1d12 piercing &mdash; reach, special` },
  { name: "Longsword",      bulk: Bulk.STOCK, cost: "15 gp",  description: `<i>martial weapon</i><br>1d8 slashing &mdash; versatile (1d10)` },
  { name: "Maul",           bulk: Bulk.BULKY, cost: "10 gp",  description: `<i>martial weapon</i><br>2d6 bludgeoning &mdash; heavy, two-handed` },
  { name: "Morningstar",    bulk: Bulk.STOCK, cost: "15 gp",  description: `<i>martial weapon</i><br>1d8 piercing` },
  { name: "Pike",           bulk: Bulk.BULKY, cost: "5 gp",   description: `<i>martial weapon</i><br>1d10 piercing &mdash; heavy, reach, two-handed` },
  { name: "Rapier",         bulk: Bulk.STOCK, cost: "25 gp",  description: `<i>martial weapon</i><br>1d8 piercing &mdash; finesse` },
  { name: "Scimitar",       bulk: Bulk.STOCK, cost: "25 gp",  description: `<i>martial weapon</i><br>1d6 slashing &mdash; finesse, light` },
  { name: "Shortsword",     bulk: Bulk.STOCK, cost: "10 gp",  description: `<i>martial weapon</i><br>1d6 piercing &mdash; finesse, light` },
  { name: "Trident",        bulk: Bulk.STOCK, cost: "5 gp",   description: `<i>martial weapon</i><br>1d6 piercing &mdash; thrown (20/60), versatile (1d8)` },
  { name: "War Pick",       bulk: Bulk.STOCK, cost: "5 gp",   description: `<i>martial weapon</i><br>1d8 piercing` },
  { name: "Warhammer",      bulk: Bulk.STOCK, cost: "15 gp",  description: `<i>martial weapon</i><br>1d8 bludgeoning &mdash; versatile (1d10)` },
  { name: "Whip",           bulk: Bulk.STOCK, cost: "2 gp",   description: `<i>martial weapon</i><br>1d4 slashing &mdash; finesse, reach` },
  { name: "Blowgun",        bulk: Bulk.STOCK, cost: "10 gp",  description: `<i>martial weapon</i><br>1 piercing &mdash; range 25/100, loading` },
  { name: "Hand Crossbow",  bulk: Bulk.STOCK, cost: "75 gp",  description: `<i>martial weapon</i><br>1d6 piercing &mdash; range 30/120, light, loading` },
  { name: "Heavy Crossbow", bulk: Bulk.BULKY, cost: "50 gp",  description: `<i>martial weapon</i><br>1d10 piercing &mdash; range 100/400, heavy, loading, two-handed` },
  { name: "Longbow",        bulk: Bulk.BULKY, cost: "50 gp",  description: `<i>martial weapon</i><br>1d8 piercing &mdash; range 150/600, heavy, two-handed` },
  { name: "Net",            bulk: Bulk.STOCK, cost: "1 gp",   description: `<i>martial weapon</i><br>special, thrown (5/15)` },

  // ── ARMOUR ──────────────────────────────────────────────────────────────────
  { name: "Shield",       bulk: Bulk.BULKY,    cost: "10 gp",  description: `+2 AC` },
  { name: "Light Armor",  bulk: Bulk.STOCK,    cost: "45 gp",  description: `<i>light armor</i><br>AC 12 + Dex modifier` },
  { name: "Medium Armor", bulk: Bulk.BULKY,    cost: "400 gp", description: `<i>medium armor</i><br>AC 14 + max 2 Dex. Stealth disadvantage.` },
  { name: "Heavy Armor",  bulk: Bulk.BULKY,    cost: "200 gp", description: `<i>heavy armor</i><br>AC 16` },
  { name: "Half Plate",   bulk: Bulk.BULKY,    cost: "750 gp", description: `<i>medium armor</i><br>AC 15 + max 2 Dex. Stealth disadvantage.` },
  { name: "Splint Armor", bulk: Bulk.BULKY,    cost: "200 gp", description: `<i>heavy armor</i><br>AC 17` },
  { name: "Plate Armor",  bulk: Bulk.VERYBULKY, cost: "1500 gp", description: `<i>heavy armor</i><br>AC 18` },

  // ── ADVENTURING GEAR ────────────────────────────────────────────────────────
  { name: "Rations",         bulk: Bulk.PACKABLE, cost: "5 sp",  description: `A day's rations.` },
  { name: "Mirror",          bulk: Bulk.PACKABLE, cost: "5 gp",  description: `A steel mirror for grooming, peeking around corners, or signalling.` },
  { name: "Tinderbox",       bulk: Bulk.PACKABLE, cost: "5 sp",  description: `Bonus action to light exposed fuel; 1 minute for covered material.` },
  { name: "Waterskin",       bulk: Bulk.STOCK,    cost: "2 sp",  description: `Holds 4 pints of water.` },
  { name: "Chalk",           bulk: Bulk.PACKABLE, cost: "1 cp",  description: `Expend 1 charge to mark a surface.`, variables: { charges: { value: 5, control: "plusminus", min: 0, max: 5 } } },
  { name: "Rope",            bulk: Bulk.BULKY,    cost: "1 gp",  description: `50ft. DC 10 Sleight of Hand to tie. Bound creatures are Restrained (DC 15 Acrobatics or DC 20 Athletics to escape).` },
  { name: "Shovel",          bulk: Bulk.BULKY,    cost: "2 gp",  description: `1 hour to dig a 5-ft cube in dirt or loose material.` },
  { name: "Whistle",         bulk: Bulk.PACKABLE, cost: "5 cp",  description: `Audible up to 600 feet.` },
  { name: "Horn",            bulk: Bulk.STOCK,    cost: "3 gp",  description: `Audible up to 600 feet.` },
  { name: "Manacles",        bulk: Bulk.STOCK,    cost: "2 gp",  description: `Action to bind a Grappled/Incapacitated/Restrained creature (DC 13 Sleight of Hand). Restrained until DC 25 Dex/Str check or DC 15 lockpick.` },
  { name: "Grappling Hook",  bulk: Bulk.STOCK,    cost: "2 gp",  description: `Action, throw 50 ft. Catches on DC 13 check. If tied to rope, can be climbed.` },
  { name: "Crowbar",         bulk: Bulk.STOCK,    cost: "2 gp",  description: `Advantage on Strength checks where leverage applies.` },
  { name: "Lantern",         bulk: Bulk.STOCK,    cost: "5 gp",  description: `30-ft bright, 30-ft dim light. Bonus action to hood (5-ft dim). Burns 1 Oil Flask charge/hour.` },
  { name: "Oil Flask",       bulk: Bulk.PACKABLE, cost: "1 sp",  description: `Fuel for lanterns, or coats objects to make them flammable.`, variables: { charges: { value: 5, control: "plusminus", min: 0, max: 5 } } },
  { name: "Torch",           bulk: Bulk.PACKABLE, cost: "1 cp",  description: `10 min of 20-ft bright, 20-ft dim light. Can be used as a simple melee weapon (1d4 bludgeoning or fire when lit).`, variables: { charges: { value: 6, control: "plusminus", min: 0, max: 6 } } },
  { name: "Healing Potion",  bulk: Bulk.STOCK,    cost: "50 gp", description: `Action: regain 2d4 + 2 hit points.` },
  { name: "Basic Poison",    bulk: Bulk.PACKABLE, cost: "100 gp", description: `Bonus action to coat a weapon or 3 pieces of ammo. Hit target: DC 13 Con save or Poisoned for up to 1 minute.` },
  { name: "Antitoxin",       bulk: Bulk.PACKABLE, cost: "50 gp", description: `Bonus action: advantage on saves vs Poisoned for 1 hour.` },
  { name: "Acid",            bulk: Bulk.STOCK,    cost: "25 gp", description: `Replace an attack: throw 20 ft, DC 13 Dex save or 2d6 acid damage. Destroyed on use.` },
  { name: "Alchemist's Fire", bulk: Bulk.STOCK,   cost: "50 gp", description: `Replace an attack: throw 20 ft, DC 13 Dex save or 1d4 fire damage + burning. Destroyed on use.` },
  { name: "Hunting Trap",    bulk: Bulk.BULKY,    cost: "5 gp",  description: `10 min to set. Triggered creature: DC 13 Dex save or 2d10 piercing + Grappled (DC 13 Athletics to escape).` },
  { name: "Caltrops",        bulk: Bulk.STOCK,    cost: "1 gp",  description: `5-ft square. Entering creature: DC 13 Dex save or 1d4 damage + speed 0 until next turn.` },
  { name: "Ball Bearings",   bulk: Bulk.STOCK,    cost: "1 gp",  description: `10-ft square. Entering creature: DC 13 Dex save or fall Prone.` },
  { name: "Ammunition Cache", bulk: Bulk.STOCK,   cost: "1 gp",  description: `A single weapon's ammunition supply.` },

  // ── TOOLS ───────────────────────────────────────────────────────────────────
  { name: "Climber's Kit",         bulk: Bulk.BULKY, cost: "25 gp", description: `Advantage on relevant roll. Expend a charge to retrieve a component. Replenish after long rest.`, variables: { charges: { value: 3, control: "plusminus", min: 0, max: 3 } } },
  { name: "Smith's Tools",         bulk: Bulk.BULKY, cost: "20 gp", description: `Advantage on relevant roll. Expend a charge to retrieve a component. Replenish after long rest.`, variables: { charges: { value: 3, control: "plusminus", min: 0, max: 3 } } },
  { name: "Mason's Tools",         bulk: Bulk.STOCK, cost: "10 gp", description: `Advantage on relevant roll. Expend a charge to retrieve a component. Replenish after long rest.`, variables: { charges: { value: 3, control: "plusminus", min: 0, max: 3 } } },
  { name: "Woodcarver's Tools",    bulk: Bulk.STOCK, cost: "1 gp",  description: `Advantage on relevant roll. Expend a charge to retrieve a component. Replenish after long rest.`, variables: { charges: { value: 3, control: "plusminus", min: 0, max: 3 } } },
  { name: "Leatherworker's Tools", bulk: Bulk.STOCK, cost: "5 gp",  description: `Advantage on relevant roll. Expend a charge to retrieve a component. Replenish after long rest.`, variables: { charges: { value: 3, control: "plusminus", min: 0, max: 3 } } },
  { name: "Weaver's Tools",        bulk: Bulk.STOCK, cost: "1 gp",  description: `Advantage on relevant roll. Expend a charge to retrieve a component. Replenish after long rest.`, variables: { charges: { value: 3, control: "plusminus", min: 0, max: 3 } } },
  { name: "Scribe's Supplies",     bulk: Bulk.STOCK, cost: "15 gp", description: `Advantage on relevant roll. Expend a charge to retrieve a component. Replenish after long rest.`, variables: { charges: { value: 3, control: "plusminus", min: 0, max: 3 } } },
  { name: "Painter's Supplies",    bulk: Bulk.STOCK, cost: "10 gp", description: `Advantage on relevant roll. Expend a charge to retrieve a component. Replenish after long rest.`, variables: { charges: { value: 3, control: "plusminus", min: 0, max: 3 } } },
  { name: "Jeweler's Tools",       bulk: Bulk.STOCK, cost: "25 gp", description: `Advantage on relevant roll. Expend a charge to retrieve a component. Replenish after long rest.`, variables: { charges: { value: 3, control: "plusminus", min: 0, max: 3 } } },
  { name: "Cook's Utensils",       bulk: Bulk.STOCK, cost: "1 gp",  description: `Advantage on relevant roll. Expend a charge to retrieve a component. Replenish after long rest.`, variables: { charges: { value: 3, control: "plusminus", min: 0, max: 3 } } },
  { name: "Healer's Kit",          bulk: Bulk.STOCK, cost: "5 gp",  description: `Advantage on relevant roll. Expend a charge to retrieve a component. Replenish after long rest.`, variables: { charges: { value: 3, control: "plusminus", min: 0, max: 3 } } },
  { name: "Poisoner's Kit",        bulk: Bulk.STOCK, cost: "50 gp", description: `Advantage on relevant roll. Expend a charge to retrieve a component. Replenish after long rest.`, variables: { charges: { value: 3, control: "plusminus", min: 0, max: 3 } } },
  { name: "Herbalism Kit",         bulk: Bulk.STOCK, cost: "5 gp",  description: `Advantage on relevant roll. Expend a charge to retrieve a component. Replenish after long rest.`, variables: { charges: { value: 3, control: "plusminus", min: 0, max: 3 } } },
  { name: "Thieves' Tools",        bulk: Bulk.STOCK, cost: "25 gp", description: `Advantage on relevant roll. Expend a charge to retrieve a component. Replenish after long rest.`, variables: { charges: { value: 3, control: "plusminus", min: 0, max: 3 } } },
  { name: "Tinker's Tools",        bulk: Bulk.STOCK, cost: "50 gp", description: `Advantage on relevant roll. Expend a charge to retrieve a component. Replenish after long rest.`, variables: { charges: { value: 3, control: "plusminus", min: 0, max: 3 } } },
  { name: "Navigator's Tools",     bulk: Bulk.STOCK, cost: "25 gp", description: `Advantage on relevant roll. Expend a charge to retrieve a component. Replenish after long rest.`, variables: { charges: { value: 3, control: "plusminus", min: 0, max: 3 } } },
  { name: "Alchemist's Supplies",  bulk: Bulk.BULKY, cost: "50 gp", description: `Advantage on relevant roll. Expend a charge to retrieve a component. Replenish after long rest.`, variables: { charges: { value: 3, control: "plusminus", min: 0, max: 3 } } },
  { name: "Disguise Kit",          bulk: Bulk.BULKY, cost: "25 gp", description: `Advantage on relevant roll. Expend a charge to retrieve a component. Replenish after long rest.`, variables: { charges: { value: 3, control: "plusminus", min: 0, max: 3 } } },
  { name: "Glassblower's Tools",   bulk: Bulk.BULKY, cost: "30 gp", description: `Advantage on relevant roll. Expend a charge to retrieve a component. Replenish after long rest.`, variables: { charges: { value: 3, control: "plusminus", min: 0, max: 3 } } },
  { name: "Potter's Tools",        bulk: Bulk.BULKY, cost: "10 gp", description: `Advantage on relevant roll. Expend a charge to retrieve a component. Replenish after long rest.`, variables: { charges: { value: 3, control: "plusminus", min: 0, max: 3 } } },
  { name: "Brewer's Supplies",     bulk: Bulk.BULKY, cost: "20 gp", description: `Advantage on relevant roll. Expend a charge to retrieve a component. Replenish after long rest.`, variables: { charges: { value: 3, control: "plusminus", min: 0, max: 3 } } },
  { name: "Camp Supplies",         bulk: Bulk.BULKY, cost: "5 gp",  description: `Advantage on relevant roll. Expend a charge to retrieve a component. Replenish after long rest.`, variables: { charges: { value: 3, control: "plusminus", min: 0, max: 3 } } },

];
