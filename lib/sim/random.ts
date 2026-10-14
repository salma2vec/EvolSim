/**
 * Seeded random number generator for reproducibility
 */

export class SeededRNG {
  private seed: number;

  constructor(seed: number = Date.now()) {
    if (!Number.isSafeInteger(seed)) throw new Error("seed must be a safe integer");
    this.seed = ((seed % 233280) + 233280) % 233280;
  }

  /**
   * Generate a random number between 0 and 1
   */
  random(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  /**
   * Generate a random integer between min (inclusive) and max (exclusive)
   */
  randomInt(min: number, max: number): number {
    return Math.floor(this.random() * (max - min)) + min;
  }

  /**
   * Generate a random float between min (inclusive) and max (exclusive)
   */
  randomFloat(min: number, max: number): number {
    return this.random() * (max - min) + min;
  }

  /**
   * Sample from a normal distribution using Box-Muller transform
   */
  normal(mean: number = 0, stdDev: number = 1): number {
    const u1 = Math.max(Number.EPSILON, this.random());
    const u2 = this.random();
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return z0 * stdDev + mean;
  }

  /**
   * Choose a random element from an array
   */
  choice<T>(array: T[]): T {
    return array[this.randomInt(0, array.length)];
  }

  /**
   * Shuffle an array in place
   */
  shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.randomInt(0, i + 1);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  /**
   * Get current seed
   */
  getSeed(): number {
    return this.seed;
  }

  /**
   * Set seed
   */
  setSeed(seed: number): void {
    if (!Number.isSafeInteger(seed)) throw new Error("seed must be a safe integer");
    this.seed = ((seed % 233280) + 233280) % 233280;
  }
}

/** Optional experiment-only keyed stream; legacy trajectories keep SeededRNG. */
class KeyedRNG extends SeededRNG {
  private word: number;
  constructor(seed: number) { super(seed); this.word = seed >>> 0; }
  getSeed(): number { return this.word; }
  setSeed(seed: number): void {
    if (!Number.isSafeInteger(seed)) throw new Error("seed must be a safe integer");
    this.word = seed >>> 0;
  }
  random(): number {
    // Mulberry32: a deterministic 32-bit generator, not cryptographic randomness.
    this.word = (this.word + 0x6D2B79F5) >>> 0;
    let value = this.word;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }
}

/** Stable keys prevent unrelated draws or branch choices from shifting noise. */
export function getExogenousRNG(
  config: { useIndependentRandomStreams?: boolean; rngSeed?: number },
  namespace: "observation-resource" | "observation-species" | "physical-harvest" | "physical-shock",
  key: readonly (string | number)[]
): SeededRNG {
  if (!config.useIndependentRandomStreams) return getRNG();
  if (!Number.isSafeInteger(config.rngSeed)) throw new Error("Keyed experiment streams require an explicit world seed");
  const label = JSON.stringify(["exogenous-v1", config.rngSeed, namespace, key]);
  let hash = 2166136261;
  for (let i = 0; i < label.length; i++) hash = Math.imul(hash ^ label.charCodeAt(i), 16777619) >>> 0;
  return new KeyedRNG(hash);
}

let contextProvider: (() => SeededRNG | undefined) | undefined;
export function setRandomContextProvider(provider: () => SeededRNG | undefined): void {
  contextProvider = provider;
}

// Browser fallback; server experiments install an AsyncLocalStorage provider.
let globalRNG: SeededRNG | null = null;
let currentSeed: number | null = null;

export function getRNG(seed?: number): SeededRNG {
  const contextual = contextProvider?.();
  if (contextual) {
    if (seed !== undefined) contextual.setSeed(seed);
    return contextual;
  }
  // If seed is provided, always create a new RNG
  if (seed !== undefined) {
    globalRNG = new SeededRNG(seed);
    currentSeed = seed;
    return globalRNG;
  }
  
  // If no global RNG exists, create one with current time
  if (globalRNG === null) {
    const defaultSeed = Date.now();
    globalRNG = new SeededRNG(defaultSeed);
    currentSeed = defaultSeed;
  }
  
  return globalRNG;
}

export function setRNGSeed(seed: number): void {
  const contextual = contextProvider?.();
  if (contextual) { contextual.setSeed(seed); return; }
  globalRNG = new SeededRNG(seed);
  currentSeed = seed;
}

export function getCurrentSeed(): number | null {
  return currentSeed;
}

export function resetRNG(): void {
  globalRNG = null;
  currentSeed = null;
}
