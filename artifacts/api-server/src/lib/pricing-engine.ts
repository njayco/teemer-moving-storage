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

// Business rule: bedrooms + living rooms together determine crew/rate/base hours.
// Spec examples all use "N bedrooms + 1 living room" as the canonical tier definition.
// Additional living rooms contribute to the total room count.
function getCrewConfig(totalRooms: number): {
  movers: number;
  rate: number;
  baseHours: number;
} {
  if (totalRooms <= 2) return { movers: 2, rate: 165, baseHours: 5 };   // 1 bed + 1 LR
  if (totalRooms === 3) return { movers: 3, rate: 200, baseHours: 6 };  // 2 bed + 1 LR
  if (totalRooms === 4) return { movers: 3, rate: 200, baseHours: 8 };  // 3 bed + 1 LR
  return { movers: 4, rate: 300, baseHours: 8 };                         // 4+ bed + 1 LR
}

// Crew size maps to a specific hourly rate.
function rateForCrewSize(movers: number): number {
  if (movers <= 2) return 165;
  if (movers === 3) return 200;
  return 300;
}

// Count total inventory items (sum of all quantities).
function totalInventoryItems(inventory: Record<string, number>): number {
  return Object.values(inventory).reduce((sum, qty) => sum + Math.max(0, qty), 0);
}

// Heavy or bulky items that are known to add move time.
const HEAVY_ITEM_NAMES = new Set([
  "sectional sofa", "king bed", "armoire", "wardrobe",
  "china cabinet", "entertainment center", "refrigerator",
  "oven / stove", "dishwasher", "generator", "snow blower",
  "lawn mower", "safe", "piano", "pool table",
]);

function heavyInventoryCount(inventory: Record<string, number>): number {
  let count = 0;
  for (const [item, qty] of Object.entries(inventory)) {
    if (HEAVY_ITEM_NAMES.has(item.toLowerCase())) {
      count += Math.max(0, qty);
    }
  }
  return count;
}

export function calculatePricing(input: PricingInput): PricingResult {
  const bedrooms = Math.max(0, Math.round(input.numberOfBedrooms));
  const livingRooms = Math.max(0, Math.round(input.numberOfLivingRooms));
  const totalRooms = bedrooms + livingRooms;

  const config = getCrewConfig(totalRooms);

  // Garage or outdoor furniture adds +1 mover; rate adjusts accordingly.
  let movers = config.movers;
  if (input.hasGarage || input.hasOutdoorFurniture) {
    movers += 1;
  }
  const hourlyRate = rateForCrewSize(movers);

  let hours = config.baseHours;

  const totalItems = totalInventoryItems(input.inventory ?? {});
  const heavyCount = heavyInventoryCount(input.inventory ?? {});

  // Inventory volume adjustments.
  if (totalItems > 30) hours += 1;
  if (totalItems > 50) hours += 1;
  // Explicit heavy-item flags and counts.
  if (input.hasHeavyItems) hours += 1;
  if (heavyCount >= 3) hours += 1;
  if (heavyCount >= 6) hours += 1;
  // Structural factors.
  if (input.hasStairs) hours += 0.5;
  // Extra living rooms beyond the first add time.
  const extraLivingRooms = Math.max(0, livingRooms - 1);
  hours += extraLivingRooms * 0.5;

  // Clamp to business limits.
  hours = Math.max(4, Math.min(10, hours));

  // Materials: stretch wrap 1 roll per bedroom when lightly furnished,
  // 2 rolls per bedroom when fully furnished (per "1–2 per bedroom" rule).
  // Studio apartments (0 bedrooms) still need at least 1 roll for furniture
  // in the living area — treat as 1 bedroom for materials purposes.
  const effectiveBedrooms = bedrooms === 0 ? 1 : bedrooms;
  const stretchWrapPerBedroom = input.isFullyFurnished ? 2 : 1;
  const stretchWrapCost = input.needsPackingMaterials
    ? stretchWrapPerBedroom * effectiveBedrooms * 55
    : 0;
  const tapeCost = input.needsPackingMaterials ? effectiveBedrooms * 13.5 : 0;
  const smallBoxCost = (input.smallBoxes ?? 0) * 3.5;
  const mediumBoxCost = (input.mediumBoxes ?? 0) * 6.5;

  // All rate inputs (hourly rates, box prices, tape) are defined with full cent precision.
  // Do not round breakdown fields — preserve cents throughout.
  const laborSubtotal = hourlyRate * hours;
  const materialsSubtotal = stretchWrapCost + tapeCost + smallBoxCost + mediumBoxCost;
  const totalEstimate = laborSubtotal + materialsSubtotal;
  const depositAmount = totalEstimate < 1000 ? 50 : Math.round(totalEstimate * 0.5 * 100) / 100;

  return {
    crewSize: movers,
    hourlyRate,
    estimatedHours: Math.round(hours * 2) / 2,
    laborSubtotal,
    materialsSubtotal: Math.round(materialsSubtotal * 100) / 100,
    totalEstimate: Math.round(totalEstimate * 100) / 100,
    depositAmount,
    breakdown: {
      stretchWrapCost,
      tapeCost,
      smallBoxCost,
      mediumBoxCost,
    },
  };
}
