import { fileURLToPath, URL } from "node:url";

import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";
import VueDevTools from "vite-plugin-vue-devtools";

export default defineConfig({
	plugins: [vue(), VueDevTools()],
	base: process.env.NODE_ENV === 'production' ? '/neblina/' : '/',
	resolve: {
		alias: {
			"@": fileURLToPath(new URL("./src", import.meta.url)),
		},
		extensions: [".ts", ".vue", ".js", ".mjs", ".json"],
	},
	server: {
		headers: {
			"Cross-Origin-Embedder-Policy": "require-corp",
			"Cross-Origin-Opener-Policy": "same-origin-allow-popups",
			"Cross-Origin-Resource-Policy": "cross-origin",
		},
	},
	optimizeDeps: {
		exclude: ["@/infrastructure/services/RcloneWasmWorker.ts"],
	},
});
