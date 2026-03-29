export interface PricingInput {
  numberOfBedrooms: number;
  numberOfLivingRooms: number;
  hasGarage: boolean;
  hasOutdoorFurniture: boolean;
  hasStairs: boolean;
  hasHeavyItems: boolean;
  isFullyFurnished: boolean;
  inventory: Record<string, number>;
  smallBoxes: number;
  mediumBoxes: number;
  needsPackingMaterials: boolean;
}

export interface PricingResult {
  crewSize: number;
  hourlyRate: number;
  estimatedHours: number;
  laborSubtotal: number;
  materialsSubtotal: number;
  totalEstimate: number;
  depositAmount: number;
  breakdown: {
    stretchWrapCost: number;
    tapeCost: number;
    smallBoxCost: number;
    mediumBoxCost: number;
  };
}

// Crew configuration: { bedrooms, livingRooms } → { movers, rate, baseHours }
// Rules per business spec:
//   1 bed + 1 living  → 2 movers, $165/hr, 5 hrs
//   2 bed + 1 living  → 3 movers, $200/hr, 6 hrs
//   3 bed + 1 living  → 3 movers, $200/hr, 8 hrs
//   4 bed + 1 living  → 4 movers, $300/hr, 8 hrs
function getBaseConfig(bedrooms: number): {
  movers: number;
  rate: number;
  baseHours: number;
} {
  if (bedrooms <= 1) return { movers: 2, rate: 165, baseHours: 5 };
  if (bedrooms === 2) return { movers: 3, rate: 200, baseHours: 6 };
  if (bedrooms === 3) return { movers: 3, rate: 200, baseHours: 8 };
  return { movers: 4, rate: 300, baseHours: 8 }; // 4+
}

// Map crew size → hourly rate
function rateForCrew(movers: number): number {
  if (movers <= 2) return 165;
  if (movers === 3) return 200;
  return 300; // 4+
}

// Count total inventory items
function totalInventoryItems(inventory: Record<string, number>): number {
  return Object.values(inventory).reduce((sum, qty) => sum + Math.max(0, qty), 0);
}

// Heavy / large item names that warrant extra time
const HEAVY_ITEMS = new Set([
  "sectional sofa",
  "king bed",
  "armoire",
  "wardrobe",
  "china cabinet",
  "entertainment center",
  "refrigerator",
  "oven / stove",
  "dishwasher",
  "generator",
  "snow blower",
  "lawn mower",
  "safe",
  "piano",
  "pool table",
]);

function heavyInventoryCount(inventory: Record<string, number>): number {
  let count = 0;
  for (const [item, qty] of Object.entries(inventory)) {
    if (HEAVY_ITEMS.has(item.toLowerCase())) {
      count += Math.max(0, qty);
    }
  }
  return count;
}

export function calculatePricing(input: PricingInput): PricingResult {
  const bedrooms = Math.max(0, Math.round(input.numberOfBedrooms));
  const config = getBaseConfig(bedrooms);

  // Apply garage / outdoor furniture rule: +1 mover
  let movers = config.movers;
  if (input.hasGarage || input.hasOutdoorFurniture) {
    movers += 1;
  }

  const hourlyRate = rateForCrew(movers);

  // Start with base hours from config
  let hours = config.baseHours;

  // Adjust hours based on inventory weight
  const totalItems = totalInventoryItems(input.inventory ?? {});
  const heavyCount = heavyInventoryCount(input.inventory ?? {});

  // Medium load: >30 total items → +1 hr
  if (totalItems > 30) hours += 1;
  // Heavy load: >50 total items → +1 more hr
  if (totalItems > 50) hours += 1;
  // Heavy/bulky items flag
  if (input.hasHeavyItems) hours += 1;
  // Explicit heavy inventory items
  if (heavyCount >= 3) hours += 1;
  if (heavyCount >= 6) hours += 1;
  // Stairs add time
  if (input.hasStairs) hours += 0.5;
  // Extra living rooms
  const extraLivingRooms = Math.max(0, input.numberOfLivingRooms - 1);
  hours += extraLivingRooms * 0.5;

  // Clamp: 4 hour minimum, 10 hour maximum
  hours = Math.max(4, Math.min(10, hours));

  // Materials pricing
  const effectiveBedrooms = Math.max(1, bedrooms);
  const stretchWrapQty = Math.min(effectiveBedrooms * 2, 6); // 1–2 per bedroom, max 6
  const stretchWrapCost = input.needsPackingMaterials ? stretchWrapQty * 55 : 0;
  const tapeCost = input.needsPackingMaterials ? effectiveBedrooms * 13.5 : 0;
  const smallBoxCost = (input.smallBoxes ?? 0) * 3.5;
  const mediumBoxCost = (input.mediumBoxes ?? 0) * 6.5;

  const laborSubtotal = Math.round(movers === config.movers
    ? hourlyRate * hours
    : hourlyRate * hours);

  const materialsSubtotal = Math.round(
    stretchWrapCost + tapeCost + smallBoxCost + mediumBoxCost
  );

  const totalEstimate = laborSubtotal + materialsSubtotal;

  // Deposit rule
  const depositAmount = totalEstimate < 1000 ? 50 : Math.round(totalEstimate * 0.5);

  return {
    crewSize: movers,
    hourlyRate,
    estimatedHours: Math.round(hours * 2) / 2, // round to nearest 0.5
    laborSubtotal,
    materialsSubtotal,
    totalEstimate,
    depositAmount,
    breakdown: {
      stretchWrapCost: Math.round(stretchWrapCost),
      tapeCost: Math.round(tapeCost),
      smallBoxCost: Math.round(smallBoxCost),
      mediumBoxCost: Math.round(mediumBoxCost),
    },
  };
}
