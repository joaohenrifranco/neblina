import { createApp } from "vue";

import App from "@/presentation/App.vue";
import router from "@/presentation/router";
import "./style.css";

const app = createApp(App);

app.use(router);

app.mount("#app");
