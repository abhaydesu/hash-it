import { defineConfig } from "vitest/config";
import path from "path";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  esbuild: {
    jsxInject: `import React from 'react'`,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
      "next/server": path.resolve(__dirname, "./node_modules/next/server.js"),
    },
  },
  test: {
    projects: [
      {
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/unit/**/*.test.ts", "tests/scheduler.test.ts", "tests/import-csv.test.ts"],
          setupFiles: ["tests/setup/unit.ts"],
        },
        resolve: {
          alias: {
            "@": path.resolve(__dirname, "./"),
            "next/server": path.resolve(__dirname, "./node_modules/next/server.js"),
          },
        },
      },
      {
        test: {
          name: "component",
          environment: "jsdom",
          include: ["tests/component/**/*.test.{ts,tsx}", "components/**/*.test.{ts,tsx}"],
          setupFiles: ["tests/setup/component.ts"],
        },
        resolve: {
          alias: {
            "@": path.resolve(__dirname, "./"),
            "next/server": path.resolve(__dirname, "./node_modules/next/server.js"),
          },
        },
      },
      {
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts", "tests/auth.test.ts"],
          setupFiles: ["tests/setup/integration.ts"],
          testTimeout: 25000,
          hookTimeout: 25000,
        },
        resolve: {
          alias: {
            "@": path.resolve(__dirname, "./"),
            "next/server": path.resolve(__dirname, "./node_modules/next/server.js"),
          },
        },
      },
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["lib/**/*.ts", "app/actions/**/*.ts", "components/**/*.{ts,tsx}", "middleware.ts"],
      exclude: [
        "**/*.test.{ts,tsx}",
        "**/types.ts",
        "lib/prisma.ts",
        "node_modules/**",
        ".next/**",
      ],
      thresholds: {
        "lib/scheduler.ts": {
          statements: 90,
          branches: 90,
          functions: 90,
          lines: 90,
        },
        global: {
          statements: 70,
          branches: 70,
          functions: 70,
          lines: 70,
        },
      },
    },
  },
});
