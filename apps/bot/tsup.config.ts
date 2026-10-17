import { defineConfig } from "tsup";

// Bundles workspace packages (shipped as TypeScript source) into one file.
export default defineConfig({
  entry: ["src/index.ts", "src/register.ts"],
  format: ["esm"],
  platform: "node",
  target: "node20",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  noExternal: [/^@integris\//],
  external: ["@prisma/client", ".prisma/client"],
  // Workspace deps (pino, zod) are bundled; give their CommonJS code a require().
  banner: { js: "import { createRequire } from \"node:module\"; const require = createRequire(import.meta.url);" },
});
