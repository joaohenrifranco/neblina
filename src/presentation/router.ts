import { createRouter, createWebHistory } from "vue-router";

const router = createRouter({
	history: createWebHistory(import.meta.env.BASE_URL),
	routes: [
		{
			path: "/",
			name: "explorer",
			component: () => import("@/presentation/views/ExplorerView.vue"),
		},
		{
			path: "/privacy",
			name: "privacy",
			redirect: "/PRIVACY.md",
		},
	],
});

export default router;
