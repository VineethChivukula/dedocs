import type { Theme } from "vitepress";
import DefaultTheme from "vitepress/theme";
// @ts-expect-error Vite resolves this stylesheet at runtime.
import "./custom.css";

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    // You can register global Vue components here if needed
  },
} satisfies Theme;
