/// <reference types="vite/client" />

declare module "@/presentation/App.vue" {
	import type { DefineComponent } from "vue";
	const component: DefineComponent<
		Record<string, never>,
		Record<string, never>,
		unknown
	>;
	export default component;
}
