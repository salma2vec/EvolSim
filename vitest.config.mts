import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    clearMocks: true,
    coverage: {
      provider: "v8",
      include: ["lib/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "app/**/*.{ts,tsx}"],
      exclude: ["**/*.d.ts"],
    },
  },
});
