<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";

const props = defineProps<{
  code: string;
}>();

const container = ref<HTMLElement | null>(null);
const errorMessage = ref("");
let mermaid: typeof import("mermaid").default | undefined;
let observer: MutationObserver | undefined;
let renderQueue: Promise<void> = Promise.resolve();

function addSvgBottomPadding(svg: SVGSVGElement) {
  const viewBox = svg.getAttribute("viewBox")?.trim().split(/\s+/).map(Number);

  if (!viewBox || viewBox.length !== 4 || viewBox.some(Number.isNaN)) {
    return;
  }

  const bottomPadding = 12;
  viewBox[3] += bottomPadding;
  svg.setAttribute("viewBox", viewBox.join(" "));
}

function renderDiagram() {
  renderQueue = renderQueue.then(async () => {
    if (!container.value) {
      return;
    }

    errorMessage.value = "";

    try {
      mermaid ??= (await import("mermaid")).default;
      await document.fonts.ready;
      const styles = getComputedStyle(document.documentElement);
      const themeVariables = {
        background: styles.getPropertyValue("--vp-c-bg").trim(),
        primaryColor: styles.getPropertyValue("--vp-c-bg-soft").trim(),
        primaryTextColor: styles.getPropertyValue("--vp-c-text-1").trim(),
        primaryBorderColor: styles.getPropertyValue("--vp-c-brand-1").trim(),
        lineColor: styles.getPropertyValue("--vp-c-brand-2").trim(),
        secondaryColor: styles.getPropertyValue("--vp-c-bg-alt").trim(),
        secondaryTextColor: styles.getPropertyValue("--vp-c-text-1").trim(),
        secondaryBorderColor: styles.getPropertyValue("--vp-c-divider").trim(),
        tertiaryColor: styles.getPropertyValue("--vp-c-brand-soft").trim(),
        tertiaryTextColor: styles.getPropertyValue("--vp-c-text-1").trim(),
        tertiaryBorderColor: styles.getPropertyValue("--vp-c-divider").trim(),
        clusterBkg: styles.getPropertyValue("--vp-c-bg-alt").trim(),
        clusterBorder: styles.getPropertyValue("--vp-c-divider").trim(),
        edgeLabelBackground: styles.getPropertyValue("--vp-c-bg").trim(),
        fontFamily: styles.getPropertyValue("--vp-font-family-base").trim(),
        darkMode: document.documentElement.classList.contains("dark"),
        textColor: styles.getPropertyValue("--vp-c-text-1").trim(),
        nodeTextColor: styles.getPropertyValue("--vp-c-text-1").trim(),
        mainBkg: styles.getPropertyValue("--vp-c-bg-soft").trim(),
        nodeBorder: styles.getPropertyValue("--vp-c-divider").trim(),
        rowOdd: styles.getPropertyValue("--vp-c-bg-alt").trim(),
        rowEven: styles.getPropertyValue("--vp-c-bg-soft").trim(),
        attributeBackgroundColorOdd: styles.getPropertyValue("--vp-c-bg-alt").trim(),
        attributeBackgroundColorEven: styles.getPropertyValue("--vp-c-bg-soft").trim(),
        dropShadow: "none",
      };

      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme: "base",
        flowchart: {
          htmlLabels: false,
          padding: 16,
          useMaxWidth: true,
          wrappingWidth: 320,
        },
        er: {
          useMaxWidth: true,
        },
        themeVariables,
      });

      const id = `mermaid-diagram-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}`;
      const { svg } = await mermaid.render(id, props.code);
      container.value.innerHTML = svg;
      const renderedSvg = container.value.querySelector("svg");
      if (renderedSvg) {
        renderedSvg.querySelectorAll("feDropShadow, filter[id*='drop-shadow']").forEach((el) => el.remove());
        renderedSvg.querySelectorAll("[filter]").forEach((el) => el.removeAttribute("filter"));
        addSvgBottomPadding(renderedSvg);
      }
    } catch (error) {
      errorMessage.value =
        error instanceof Error
          ? error.message
          : "Mermaid could not render this diagram.";
    }
  });

  return renderQueue;
}

onMounted(async () => {
  await nextTick();
  await renderDiagram();

  observer = new MutationObserver(() => {
    void renderDiagram();
  });
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
});

watch(() => props.code, () => void renderDiagram());

onBeforeUnmount(() => observer?.disconnect());
</script>

<template>
  <div ref="container" class="mermaid-diagram" role="img" aria-label="Mermaid diagram">
    <p v-if="errorMessage" class="mermaid-diagram__error">
      Unable to render this diagram: {{ errorMessage }}
    </p>
  </div>
</template>

<style scoped>
.mermaid-diagram {
  display: flex;
  justify-content: center;
  margin: 1.5rem 0;
  overflow-x: auto;
  text-align: center;
}

.mermaid-diagram :deep(svg) {
  height: auto;
  max-width: 100%;
  overflow: visible;
  width: 100%;
}

.mermaid-diagram :deep(foreignObject) {
  overflow: visible;
}

.mermaid-diagram :deep(foreignObject p) {
  margin: 0;
  padding-bottom: 0.2em;
}

.mermaid-diagram :deep(*),
.mermaid-diagram :deep(svg *),
.mermaid-diagram :deep(.node *),
.mermaid-diagram :deep(.cluster *),
.mermaid-diagram :deep(.outer-path),
.mermaid-diagram :deep(.label-container) {
  filter: none !important;
  box-shadow: none !important;
}

.mermaid-diagram :deep(.erDiagram .row-rect-odd path),
.mermaid-diagram :deep(.erDiagram .row-rect-odd rect) {
  fill: var(--vp-c-bg-alt) !important;
}

.mermaid-diagram :deep(.erDiagram .row-rect-even path),
.mermaid-diagram :deep(.erDiagram .row-rect-even rect) {
  fill: var(--vp-c-bg-soft) !important;
}

.mermaid-diagram :deep(.erDiagram .nodeLabel),
.mermaid-diagram :deep(.erDiagram .nodeLabel p),
.mermaid-diagram :deep(.erDiagram .nodeLabel span) {
  color: var(--vp-c-text-1) !important;
}

.mermaid-diagram :deep(.erDiagram .entityBox),
.mermaid-diagram :deep(.erDiagram .node .outer-path) {
  fill: var(--vp-c-bg-soft) !important;
  stroke: var(--vp-c-divider) !important;
}

.mermaid-diagram :deep(.erDiagram .divider path) {
  stroke: var(--vp-c-divider) !important;
}

.mermaid-diagram :deep(.erDiagram .relationshipLine) {
  stroke: var(--vp-c-brand-1) !important;
}

.mermaid-diagram :deep(.erDiagram .marker) {
  stroke: var(--vp-c-brand-1) !important;
}

.mermaid-diagram :deep(.erDiagram .edgeLabel text),
.mermaid-diagram :deep(.erDiagram .edgeLabel tspan) {
  fill: var(--vp-c-text-1) !important;
}

.mermaid-diagram__error {
  color: var(--vp-c-danger-1);
  text-align: left;
}

.mermaid-diagram svg {
  display: block !important;
  margin: 0 auto !important;
}
</style>
