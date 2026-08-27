// eslint.config.mjs
import tsparser from "@typescript-eslint/parser";
import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";

export default defineConfig([
  {
    ignores: ["main.js", "node_modules/**", "dist/**", "*.js", "scripts/**", ".ref/**"]
  },
  // obsidianmd recommended rules require type info, so only apply to TS files
  ...obsidianmd.configs.recommended.map((config) =>
    config.rules ? { ...config, files: config.files ?? ["**/*.ts"] } : config,
  ),
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        project: "./tsconfig.json",
        sourceType: "module"
      },
      globals: {
        ...globals.browser,
        DomElementInfo: "readonly",
        SvgElementInfo: "readonly",
        activeDocument: "readonly",
        activeWindow: "readonly",
        ajax: "readonly",
        ajaxPromise: "readonly",
        createDiv: "readonly",
        createEl: "readonly",
        createFragment: "readonly",
        createSpan: "readonly",
        createSvg: "readonly",
        fish: "readonly",
        fishAll: "readonly",
        isBoolean: "readonly",
        nextFrame: "readonly",
        ready: "readonly",
        sleep: "readonly"
      }
    },
    // Custom rule overrides
    rules: {
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-empty-function": "off",
      "no-prototype-builtins": "off",
      "@typescript-eslint/no-misused-promises": ["error",{"checksVoidReturn":{"attributes":false,"properties":false,"returns":false,"variables":false}}],
      // Disable sample code rules for template repository
      // These are intentional placeholder names and sample code that users should customize
      "obsidianmd/sample-names": "off",
      "obsidianmd/no-sample-code": "off",
      // Console rules: Match Obsidian bot requirements (only warn/error/debug allowed)
      "no-console": ["error", { "allow": ["warn", "error", "debug"] }],
      // Require await in async functions (matches Obsidian bot)
      "@typescript-eslint/require-await": "error",
    },
  },
  {
    files: ["**/*.mjs"],
    languageOptions: {
      globals: {
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
        __filename: "readonly"
      }
    },
    // Build tooling runs in Node, not inside the plugin sandbox, so the
    // mobile-compatibility and console restrictions that apply to plugin
    // source are not relevant here. The scorecard scans plugin source only.
    rules: {
      "obsidianmd/no-nodejs-modules": "off",
      "obsidianmd/rule-custom-message": "off",
      "no-console": "off"
    }
  },
]);
