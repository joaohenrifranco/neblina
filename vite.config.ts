import { fileURLToPath, URL } from "node:url";

import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";
import VueDevTools from "vite-plugin-vue-devtools";

export default defineConfig({
	plugins: [vue(), VueDevTools()],
	base: '/',
	resolve: {
		alias: {
			"@": fileURLToPath(new URL("./src", import.meta.url)),
		},
		extensions: [".ts", ".vue", ".js", ".mjs", ".json"],
	},
	server: {
		headers: {

		},
	},
	optimizeDeps: {
		exclude: ["@/infrastructure/services/RcloneWasmWorker.ts"],
	},
});
