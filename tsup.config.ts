import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "es2020",
  clean: true,
  dts: false,
  sourcemap: false,
  banner: {
    js: "#!/usr/bin/env node",
  },
});
