import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { normalizeAssetBase, rewritePublicAssetPaths } from "./src/asset-paths";

const base = normalizeAssetBase(process.env.APP_BASE_PATH || "/yuki-ro-boss-timers/");

export default defineConfig({
  base,
  plugins: [
    {
      name: "scoped-public-artwork",
      enforce: "pre",
      transform(source, identifier) {
        if (!/\.(?:[cm]?[jt]sx?|json)(?:\?|$)/.test(identifier) || identifier.includes("node_modules")) return null;
        const code = rewritePublicAssetPaths(source, base);
        return code === source ? null : { code, map: null };
      },
    },
    react(),
  ],
  build: { outDir: "dist", emptyOutDir: true, sourcemap: false },
});
