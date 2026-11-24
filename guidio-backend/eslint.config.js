import js from "@eslint/js";
import globals from "globals";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores(["node_modules", "src/generated"]),

  {
    files: ["**/*.js"],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.node,
    },
    rules: {
      // "warn" so the first run shows problems without blocking you.
      // Change to "error" once the output is clean.
      "no-unused-vars": [
        "warn",
        {
          args: "after-used",
          argsIgnorePattern: "^_",
          caughtErrors: "none",
        },
      ],
    },
  },

  // Test fakes: some fake AI providers are generators that throw an error
  // before sending any text on purpose, so they have no "yield".
  {
    files: ["tests/**/*.js"],
    rules: {
      "require-yield": "off",
    },
  },
]);