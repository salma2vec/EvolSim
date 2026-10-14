import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST as simulate } from "@/app/api/simulate/route";
import { POST as batch } from "@/app/api/batch/route";
import { runSimulation } from "@/lib/server/simulation";
import { runBatchExperiments } from "@/lib/utils/batch";

vi.mock("@/lib/server/simulation", () => ({ runSimulation: vi.fn(async () => ({ history: [] })) }));
vi.mock("@/lib/utils/batch", () => ({ runBatchExperiments: vi.fn(async () => []) }));

beforeEach(() => {
  vi.stubEnv("EVOLSIM_API_TOKEN", undefined);
  vi.stubEnv("EVOLSIM_PUBLIC_ORIGIN", undefined);
  vi.stubEnv("PORTLESS_URL", undefined);
});
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

function request(path: string, headers: Record<string, string> = {}) {
  return new NextRequest(`http://localhost:3000/api/${path}`, {
    method: "POST", headers,
    body: JSON.stringify({ presetId: "two_species_simple_lake", numSteps: 1, runs: 1 }),
  });
}

it.each(["https://untrusted.example", "null"])("rejects cross-origin baseline compute before execution: %s", async origin => {
  const response = await simulate(request("simulate", { origin, "content-type": "text/plain" }));
  expect(response.status).toBe(403);
  expect(runSimulation).not.toHaveBeenCalled();
});

it("rejects browser cross-site batch requests without parsing or running the experiment", async () => {
  const response = await batch(request("batch", { "sec-fetch-site": "cross-site" }));
  expect(response.status).toBe(403);
  expect(runBatchExperiments).not.toHaveBeenCalled();
});

const allowedHeaders: Record<string, string>[] = [{}, { origin: "http://localhost:3000", "sec-fetch-site": "same-origin" }];
it.each(allowedHeaders)(
  "preserves non-browser and same-origin baseline clients", async headers => {
    expect((await simulate(request("simulate", headers))).status).toBe(200);
    expect(runSimulation).toHaveBeenCalledOnce();
  },
);

it("does not accept a cross-origin browser request merely because it supplies a token", async () => {
  vi.stubEnv("EVOLSIM_API_TOKEN", "t".repeat(32));
  const response = await simulate(request("simulate", {
    origin: "https://untrusted.example", authorization: `Bearer ${"t".repeat(32)}`,
  }));
  expect(response.status).toBe(403);
  expect(runSimulation).not.toHaveBeenCalled();
});

it.each(["PORTLESS_URL", "EVOLSIM_PUBLIC_ORIGIN"])("uses the server's public origin behind a proxy: %s", async setting => {
  vi.stubEnv(setting, "http://evolsim.localhost:1355");
  const response = await simulate(request("simulate", {
    origin: "http://evolsim.localhost:1355", "sec-fetch-site": "same-origin",
  }));
  expect(response.status).toBe(200);
  expect(runSimulation).toHaveBeenCalledOnce();
});

it("does not trust forwarded headers supplied by a request", async () => {
  const response = await simulate(request("simulate", {
    origin: "https://untrusted.example", "x-forwarded-host": "untrusted.example",
    "x-forwarded-proto": "https", forwarded: "host=untrusted.example;proto=https",
  }));
  expect(response.status).toBe(403);
  expect(runSimulation).not.toHaveBeenCalled();
});
