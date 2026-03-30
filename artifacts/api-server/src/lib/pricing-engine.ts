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
  pianoType?: "none" | "upright" | "grand";
  pianoFloor?: "ground" | "stairs";
  // Commercial fields
  isCommercial?: boolean;
  commercialBusinessType?: string;
  commercialSizeTier?: "small" | "medium" | "large" | "enterprise";
}

export interface PricingResult {
  crewSize: number;
  hourlyRate: number;
  estimatedHours: number;
  laborSubtotal: number;
  materialsSubtotal: number;
  pianoSurcharge: number;
  commercialAdjustment: number;
  totalEstimate: number;
  depositAmount: number;
  breakdown: {
    stretchWrapCost: number;
    tapeCost: number;
    smallBoxCost: number;
    mediumBoxCost: number;
  };
}

// Commercial tier minimums
const COMMERCIAL_TIER_MINIMUMS: Record<string, number> = {
  small: 1000,      // <500 sqft
  medium: 3000,     // 500–1,000 sqft
  large: 6000,      // 1,000–2,500 sqft
  enterprise: 10000, // 2,500+ sqft
};

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

function detectPianoFromInventory(inventory: Record<string, number>): "none" | "upright" | "grand" {
  for (const [item, qty] of Object.entries(inventory)) {
    if (qty > 0) {
      const lower = item.toLowerCase();
      if (lower.includes("piano") && lower.includes("grand")) return "grand";
      if (lower.includes("piano") && lower.includes("upright")) return "upright";
      if (lower === "piano") return "upright";
    }
  }
  return "none";
}

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

  let pianoSurcharge = 0;
  const pianoType = input.pianoType ?? detectPianoFromInventory(input.inventory ?? {});
  const pianoOnStairs = input.pianoFloor === "stairs" || (input.pianoFloor == null && input.hasStairs);
  if (pianoType === "upright") {
    pianoSurcharge = pianoOnStairs ? 500 : 350;
  } else if (pianoType === "grand") {
    pianoSurcharge = 800;
  }

  const laborSubtotal = hourlyRate * hours;
  const materialsSubtotal = stretchWrapCost + tapeCost + smallBoxCost + mediumBoxCost;
  const residentialTotal = laborSubtotal + materialsSubtotal + pianoSurcharge;

  // Commercial pricing: MAX(2x residential baseline, tier minimum)
  let commercialAdjustment = 0;
  let totalEstimate = residentialTotal;

  if (input.isCommercial) {
    const tierKey = input.commercialSizeTier ?? "small";
    const tierMinimum = COMMERCIAL_TIER_MINIMUMS[tierKey] ?? COMMERCIAL_TIER_MINIMUMS.small;
    const doubledResidential = residentialTotal * 2;
    const commercialTotal = Math.max(doubledResidential, tierMinimum);
    commercialAdjustment = Math.max(0, commercialTotal - residentialTotal);
    totalEstimate = commercialTotal;
  }

  totalEstimate = Math.round(totalEstimate * 100) / 100;
  const depositAmount = totalEstimate < 1000 ? 50 : Math.round(totalEstimate * 0.5 * 100) / 100;

  return {
    crewSize: movers,
    hourlyRate,
    estimatedHours: Math.round(hours * 2) / 2,
    laborSubtotal,
    materialsSubtotal: Math.round(materialsSubtotal * 100) / 100,
    pianoSurcharge,
    commercialAdjustment: Math.round(commercialAdjustment * 100) / 100,
    totalEstimate,
    depositAmount,
    breakdown: {
      stretchWrapCost,
      tapeCost,
      smallBoxCost,
      mediumBoxCost,
    },
  };
}
