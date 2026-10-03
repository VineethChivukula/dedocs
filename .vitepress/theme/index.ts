import type { Theme } from "vitepress";
import DefaultTheme from "vitepress/theme";
// @ts-expect-error Vite resolves this stylesheet at runtime.
import MermaidDiagram from "./MermaidDiagram.vue";
// @ts-expect-error Vite resolves this stylesheet at runtime.
import "./custom.css";

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component("MermaidDiagram", MermaidDiagram);
  },
} satisfies Theme;
