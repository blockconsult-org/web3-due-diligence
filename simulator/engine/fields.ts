/**
 * One spec per numeric input: its range, step, default and unit.
 *
 * This table is the single source for input ranges. The form controls read it
 * for min, max, step and display, and normaliseModel reads it to clamp
 * anything that arrives from a share link, browser storage or an imported
 * file. Values are stored the way the engine uses them, so a "percent" field
 * holds a fraction and the form shows it × 100.
 */

export type FieldUnit =
  | "tokens"
  | "usd"
  | "usdPerToken"
  | "percent"
  | "months"
  | "count"
  | "multiplier";

export interface FieldSpec {
  min: number;
  max: number;
  /** Step of the control, in stored units. */
  step: number;
  default: number;
  unit: FieldUnit;
  /** Whole numbers only. */
  integer?: boolean;
  /** The value spans orders of magnitude; a slider should be logarithmic. */
  log?: boolean;
  /** The input may be empty, stored as null. */
  nullable?: boolean;
}

const UINT32_MAX = 4294967295;

/** Specs for the fields of the model outside the allocation rows, keyed by
 *  dotted path. */
export const modelFields = {
  horizonMonths: { min: 12, max: 120, step: 1, default: 60, unit: "months", integer: true },

  "token.genesisSupply": { min: 1e3, max: 1e13, step: 1, default: 1e9, unit: "tokens", log: true },
  "token.tgePriceUsd": { min: 1e-8, max: 1e6, step: 0.0001, default: 0.25, unit: "usdPerToken", log: true },

  "emissions.annualInflationRate": { min: 0, max: 1, step: 0.001, default: 0.05, unit: "percent" },
  "emissions.tokensPerMonth": { min: 0, max: 1e13, step: 1, default: 0, unit: "tokens", log: true },
  "emissions.halvingEveryMonths": { min: 1, max: 120, step: 1, default: 24, unit: "months", integer: true },
  "emissions.annualDecayRate": { min: 0, max: 0.99, step: 0.01, default: 0.2, unit: "percent" },
  "emissions.maxSupply": { min: 1e3, max: 1e14, step: 1, default: 1e9, unit: "tokens", log: true, nullable: true },
  "emissions.sellRate": { min: 0, max: 1, step: 0.01, default: 0.5, unit: "percent" },
  "emissions.toStakersShare": { min: 0, max: 1, step: 0.01, default: 1, unit: "percent" },

  "staking.initialRatio": { min: 0, max: 0.95, step: 0.01, default: 0, unit: "percent" },
  "staking.targetRatio": { min: 0, max: 0.95, step: 0.01, default: 0.3, unit: "percent" },
  "staking.rampMonths": { min: 0, max: 60, step: 1, default: 12, unit: "months", integer: true },

  "utility.initialUsers": { min: 0, max: 1e9, step: 1, default: 5000, unit: "count", log: true },
  "utility.saturationUsers": { min: 0, max: 1e10, step: 1, default: 100000, unit: "count", log: true },
  "utility.monthlyGrowthRate": { min: 0, max: 1, step: 0.005, default: 0.1, unit: "percent" },
  "utility.spendPerUserUsd": { min: 0, max: 1e5, step: 0.01, default: 25, unit: "usd", log: true },
  "utility.holdingMonths": { min: 0, max: 12, step: 0.25, default: 0, unit: "months" },

  "revenueSplit.burnShare": { min: 0, max: 1, step: 0.01, default: 0.2, unit: "percent" },
  "revenueSplit.treasuryShare": { min: 0, max: 1, step: 0.01, default: 0.2, unit: "percent" },
  "revenueSplit.stakerShare": { min: 0, max: 1, step: 0.01, default: 0.3, unit: "percent" },

  "speculation.baseInflowUsd": { min: 0, max: 1e10, step: 1, default: 1.6e6, unit: "usd", log: true },
  "speculation.monthlyGrowth": { min: -0.2, max: 0.2, step: 0.001, default: 0.01, unit: "percent" },
  "speculation.scenarioMultipliers.bear": { min: 0, max: 10, step: 0.05, default: 0.5, unit: "multiplier" },
  "speculation.scenarioMultipliers.base": { min: 0, max: 10, step: 0.05, default: 1, unit: "multiplier" },
  "speculation.scenarioMultipliers.bull": { min: 0, max: 10, step: 0.05, default: 2, unit: "multiplier" },
  "speculation.momentum": { min: 0, max: 2, step: 0.05, default: 0.5, unit: "multiplier" },

  "market.depthRatio": { min: 0.02, max: 2, step: 0.01, default: 0.2, unit: "percent" },
  "market.minDepthUsd": { min: 1, max: 1e9, step: 1, default: 250000, unit: "usd", log: true },
  "market.holderSellRate": { min: 0, max: 0.25, step: 0.001, default: 0.02, unit: "percent" },

  "treasury.startingUsd": { min: 0, max: 1e11, step: 1, default: 12e6, unit: "usd", log: true },
  "treasury.monthlyCostUsd": { min: 0, max: 1e9, step: 1, default: 450000, unit: "usd", log: true },
  "treasury.annualCostGrowth": { min: -0.5, max: 1, step: 0.01, default: 0.05, unit: "percent" },
  "treasury.bufferMonths": { min: 0, max: 24, step: 1, default: 6, unit: "months" },
  "treasury.maxMonthlySaleShare": { min: 0, max: 0.05, step: 0.0005, default: 0.005, unit: "percent" },

  "monteCarlo.runs": { min: 50, max: 2000, step: 50, default: 500, unit: "count", integer: true },
  "monteCarlo.seed": { min: 0, max: UINT32_MAX, step: 1, default: 1, unit: "count", integer: true },
  "monteCarlo.marketVolatility": { min: 0, max: 0.6, step: 0.01, default: 0.25, unit: "percent" },
  "monteCarlo.growthVolatility": { min: 0, max: 1, step: 0.01, default: 0.3, unit: "percent" },
  "monteCarlo.sellPropensityVolatility": { min: 0, max: 2, step: 0.05, default: 0.5, unit: "multiplier" },
} as const satisfies Record<string, FieldSpec>;

export type ModelFieldPath = keyof typeof modelFields;

/** Specs for the numeric fields of one allocation row. */
export const allocationFields = {
  share: { min: 0, max: 1, step: 0.001, default: 0.1, unit: "percent" },
  tgeUnlock: { min: 0, max: 1, step: 0.01, default: 0, unit: "percent" },
  cliffMonths: { min: 0, max: 120, step: 1, default: 0, unit: "months", integer: true },
  vestingMonths: { min: 0, max: 120, step: 1, default: 0, unit: "months", integer: true },
  vestingStepMonths: { min: 1, max: 12, step: 1, default: 1, unit: "months", integer: true },
  sellPropensity: { min: 0, max: 1, step: 0.01, default: 0.5, unit: "percent" },
  purchasePriceUsd: { min: 1e-10, max: 1e6, step: 0.0001, default: 0.1, unit: "usdPerToken", log: true, nullable: true },
} as const satisfies Record<string, FieldSpec>;

export type AllocationFieldKey = keyof typeof allocationFields;

/** Range of one entry of `outcomeMonths`. */
export const outcomeMonthField: FieldSpec = {
  min: 1,
  max: 120,
  step: 1,
  default: 12,
  unit: "months",
  integer: true,
};

/** Clamp a stored value to its spec, rounding integer fields. A non-finite
 *  value falls back to the default. */
export function clampToSpec(spec: FieldSpec, value: number): number {
  if (!Number.isFinite(value)) return spec.default;
  const bounded = Math.min(spec.max, Math.max(spec.min, value));
  return spec.integer ? Math.round(bounded) : bounded;
}
