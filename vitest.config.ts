import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    // RAM guardrail, same as curviate-sdk/curviate-cli: vitest defaults to one
    // worker per CPU core. Override via VITEST_MAX_WORKERS.
    pool: "forks",
    maxWorkers: Number(process.env["VITEST_MAX_WORKERS"] ?? 2),
    minWorkers: 1,
    poolOptions: {
      forks: {
        maxForks: Number(process.env["VITEST_MAX_WORKERS"] ?? 2),
        minForks: 1,
      },
    },
  },
});
