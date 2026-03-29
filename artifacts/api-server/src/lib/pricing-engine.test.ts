import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { calculatePricing } from "./pricing-engine.js";

const base = {
  hasGarage: false,
  hasOutdoorFurniture: false,
  hasStairs: false,
  hasHeavyItems: false,
  isFullyFurnished: true,
  inventory: {},
  smallBoxes: 0,
  mediumBoxes: 0,
  needsPackingMaterials: false,
};

describe("Crew/rate tiers (bedrooms + livingRooms = totalRooms)", () => {
  test("1 bed + 1 LR = 2 total rooms → 2 movers $165/hr 5hr", () => {
    const r = calculatePricing({ ...base, numberOfBedrooms: 1, numberOfLivingRooms: 1 });
    assert.equal(r.crewSize, 2);
    assert.equal(r.hourlyRate, 165);
    assert.equal(r.estimatedHours, 5);
    assert.equal(r.laborSubtotal, 825);
  });

  test("2 bed + 1 LR = 3 total rooms → 3 movers $200/hr 6hr", () => {
    const r = calculatePricing({ ...base, numberOfBedrooms: 2, numberOfLivingRooms: 1 });
    assert.equal(r.crewSize, 3);
    assert.equal(r.hourlyRate, 200);
    assert.equal(r.estimatedHours, 6);
    assert.equal(r.laborSubtotal, 1200);
  });

  test("3 bed + 1 LR = 4 total rooms → 3 movers $200/hr 8hr", () => {
    const r = calculatePricing({ ...base, numberOfBedrooms: 3, numberOfLivingRooms: 1 });
    assert.equal(r.crewSize, 3);
    assert.equal(r.hourlyRate, 200);
    assert.equal(r.estimatedHours, 8);
    assert.equal(r.laborSubtotal, 1600);
  });

  test("4 bed + 1 LR = 5 total rooms → 4 movers $300/hr 8hr", () => {
    const r = calculatePricing({ ...base, numberOfBedrooms: 4, numberOfLivingRooms: 1 });
    assert.equal(r.crewSize, 4);
    assert.equal(r.hourlyRate, 300);
    assert.equal(r.estimatedHours, 8);
    assert.equal(r.laborSubtotal, 2400);
  });

  test("Extra living rooms push to next tier: 1 bed + 2 LR = 3 total rooms → 3 movers $200", () => {
    const r = calculatePricing({ ...base, numberOfBedrooms: 1, numberOfLivingRooms: 2 });
    assert.equal(r.crewSize, 3);
    assert.equal(r.hourlyRate, 200);
  });
});

describe("Garage/outdoor furniture mover bump", () => {
  test("1-bed + garage → +1 mover = 3 movers $200/hr", () => {
    const r = calculatePricing({ ...base, numberOfBedrooms: 1, numberOfLivingRooms: 1, hasGarage: true });
    assert.equal(r.crewSize, 3);
    assert.equal(r.hourlyRate, 200);
  });

  test("4-bed + 1LR + outdoor furniture → 5 movers $300/hr", () => {
    const r = calculatePricing({ ...base, numberOfBedrooms: 4, numberOfLivingRooms: 1, hasOutdoorFurniture: true });
    assert.equal(r.crewSize, 5);
    assert.equal(r.hourlyRate, 300);
  });
});

describe("Deposit thresholds", () => {
  test("Total < $1000 → flat $50 deposit", () => {
    const r = calculatePricing({ ...base, numberOfBedrooms: 1, numberOfLivingRooms: 1, needsPackingMaterials: false });
    assert.equal(r.totalEstimate, 825);
    assert.equal(r.depositAmount, 50);
  });

  test("Total >= $1000 → 50% deposit", () => {
    const r = calculatePricing({ ...base, numberOfBedrooms: 2, numberOfLivingRooms: 1, needsPackingMaterials: false });
    assert.equal(r.totalEstimate, 1200);
    assert.equal(r.depositAmount, 600);
  });

  test("Borderline exactly $1000 → 50% deposit = $500", () => {
    // 3 bed + 1 LR = $200/hr × 5hr = $1000
    const r = calculatePricing({
      ...base,
      numberOfBedrooms: 3,
      numberOfLivingRooms: 1,
      isFullyFurnished: false,
      inventory: {},
    });
    assert.ok(r.totalEstimate >= 1000, `Expected >= 1000, got ${r.totalEstimate}`);
    assert.equal(r.depositAmount, Math.round(r.totalEstimate * 0.5));
  });
});

describe("Materials pricing", () => {
  test("Stretch wrap: 1 roll/bed when lightly furnished × $55 — exact cents", () => {
    const r = calculatePricing({
      ...base,
      numberOfBedrooms: 2,
      numberOfLivingRooms: 1,
      isFullyFurnished: false,
      needsPackingMaterials: true,
    });
    assert.equal(r.breakdown.stretchWrapCost, 110);
  });

  test("Stretch wrap: 2 rolls/bed when fully furnished × $55 — exact cents", () => {
    const r = calculatePricing({
      ...base,
      numberOfBedrooms: 2,
      numberOfLivingRooms: 1,
      isFullyFurnished: true,
      needsPackingMaterials: true,
    });
    assert.equal(r.breakdown.stretchWrapCost, 220);
  });

  test("Studio (0 bedrooms) with materials → 1 roll minimum (not 0)", () => {
    const r = calculatePricing({
      ...base,
      numberOfBedrooms: 0,
      numberOfLivingRooms: 1,
      isFullyFurnished: true,
      needsPackingMaterials: true,
    });
    assert.ok(r.breakdown.stretchWrapCost > 0, "Studio should not charge $0 for stretch wrap");
    assert.equal(r.breakdown.stretchWrapCost, 110);
  });

  test("Tape $13.50/bedroom preserves cents — 1 bedroom = $13.50 exactly", () => {
    const r = calculatePricing({
      ...base,
      numberOfBedrooms: 1,
      numberOfLivingRooms: 1,
      isFullyFurnished: false,
      needsPackingMaterials: true,
      smallBoxes: 0,
      mediumBoxes: 0,
    });
    assert.equal(r.breakdown.tapeCost, 13.5);
  });

  test("No packing materials → $0 materials", () => {
    const r = calculatePricing({
      ...base,
      numberOfBedrooms: 2,
      numberOfLivingRooms: 1,
      needsPackingMaterials: false,
    });
    assert.equal(r.materialsSubtotal, 0);
  });

  test("Small boxes $3.50 each — exact cents", () => {
    const r = calculatePricing({
      ...base,
      numberOfBedrooms: 1,
      numberOfLivingRooms: 1,
      smallBoxes: 3,
      mediumBoxes: 0,
      needsPackingMaterials: false,
    });
    assert.equal(r.breakdown.smallBoxCost, 10.5);
  });

  test("Medium boxes $6.50 each — exact cents", () => {
    const r = calculatePricing({
      ...base,
      numberOfBedrooms: 1,
      numberOfLivingRooms: 1,
      smallBoxes: 0,
      mediumBoxes: 3,
      needsPackingMaterials: false,
    });
    assert.equal(r.breakdown.mediumBoxCost, 19.5);
  });

  test("materialsSubtotal is accurate to 2 decimal places", () => {
    const r = calculatePricing({
      ...base,
      numberOfBedrooms: 1,
      numberOfLivingRooms: 1,
      isFullyFurnished: false,
      needsPackingMaterials: true,
      smallBoxes: 1,
      mediumBoxes: 1,
    });
    const expected = 55 + 13.5 + 3.5 + 6.5;
    assert.equal(r.materialsSubtotal, Math.round(expected * 100) / 100);
  });
});

describe("Hours clamping and adjustments", () => {
  test("Hours are clamped to max 10", () => {
    const r = calculatePricing({
      ...base,
      numberOfBedrooms: 4,
      numberOfLivingRooms: 2,
      hasHeavyItems: true,
      hasStairs: true,
      inventory: Object.fromEntries(Array.from({ length: 25 }, (_, i) => [`item${i}`, 2])),
    });
    assert.ok(r.estimatedHours <= 10, `Hours should be ≤10, got ${r.estimatedHours}`);
  });

  test("Hours are clamped to min 4", () => {
    const r = calculatePricing({ ...base, numberOfBedrooms: 1, numberOfLivingRooms: 1 });
    assert.ok(r.estimatedHours >= 4, `Hours should be ≥4, got ${r.estimatedHours}`);
  });

  test("Stairs add 0.5 hours", () => {
    const without = calculatePricing({ ...base, numberOfBedrooms: 1, numberOfLivingRooms: 1, hasStairs: false });
    const with_ = calculatePricing({ ...base, numberOfBedrooms: 1, numberOfLivingRooms: 1, hasStairs: true });
    assert.equal(with_.estimatedHours - without.estimatedHours, 0.5);
  });
});
