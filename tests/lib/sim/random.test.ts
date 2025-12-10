/**
 * Unit tests for random number generator
 */

import { SeededRNG, setRNGSeed, getRNG, resetRNG } from "@/lib/sim/random";

describe("SeededRNG", () => {
  it("should generate reproducible sequences", () => {
    const rng1 = new SeededRNG(12345);
    const rng2 = new SeededRNG(12345);

    const values1 = Array.from({ length: 10 }, () => rng1.random());
    const values2 = Array.from({ length: 10 }, () => rng2.random());

    expect(values1).toEqual(values2);
  });

  it("should generate different sequences for different seeds", () => {
    const rng1 = new SeededRNG(12345);
    const rng2 = new SeededRNG(67890);

    const value1 = rng1.random();
    const value2 = rng2.random();

    expect(value1).not.toBe(value2);
  });

  it("should generate numbers in [0, 1) range", () => {
    const rng = new SeededRNG(12345);
    const values = Array.from({ length: 100 }, () => rng.random());

    values.forEach(value => {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    });
  });

  it("should generate integers in correct range", () => {
    const rng = new SeededRNG(12345);
    const values = Array.from({ length: 100 }, () => rng.randomInt(5, 10));

    values.forEach(value => {
      expect(value).toBeGreaterThanOrEqual(5);
      expect(value).toBeLessThan(10);
    });
  });

  it("should generate normal distribution", () => {
    const rng = new SeededRNG(12345);
    const values = Array.from({ length: 1000 }, () => rng.normal(0, 1));

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    expect(mean).toBeCloseTo(0, 1);
  });
});

describe("Global RNG", () => {
  beforeEach(() => {
    resetRNG();
  });

  it("should use seed when provided", () => {
    setRNGSeed(12345);
    const rng1 = getRNG();
    const value1 = rng1.random();

    setRNGSeed(12345);
    const rng2 = getRNG();
    const value2 = rng2.random();

    expect(value1).toBe(value2);
  });

  it("should create new RNG with seed parameter", () => {
    const rng1 = getRNG(11111);
    const value1 = rng1.random();

    const rng2 = getRNG(11111);
    const value2 = rng2.random();

    expect(value1).toBe(value2);
  });
});

