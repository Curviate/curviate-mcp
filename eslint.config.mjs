// ESLint flat config for @curviate/mcp.
// Keeps TypeScript-strict hygiene while allowing console/stderr writes,
// the server logs diagnostics to stderr by design (stdout is reserved for
// the MCP JSON-RPC stream).

import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    files: ["src/**/*.ts", "test/**/*.ts"],
    extends: [tseslint.configs.recommended],
    rules: {
      "no-console": "off",
      "prefer-const": "error",
    },
  },
  {
    ignores: ["dist/", "node_modules/", "*.tsbuildinfo"],
  }
);
