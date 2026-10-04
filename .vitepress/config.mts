import { defineConfig } from "vitepress";

export default defineConfig({
  srcDir: "content",
  markdown: {
    config(md) {
      const defaultFence = md.renderer.rules.fence;

      md.renderer.rules.fence = (tokens, index, options, env, self) => {
        const token = tokens[index];
        const language = token.info.trim().split(/\s+/, 1)[0];

        if (language === "mermaid") {
          const code = JSON.stringify(token.content).replaceAll("'", "&#39;");
          return `<MermaidDiagram :code='${code}' />`;
        }

        return defaultFence
          ? defaultFence(tokens, index, options, env, self)
          : self.renderToken(tokens, index, options);
      };
    },
  },

  title: "Data Engineering Docs",
  description:
    "Comprehensive guide to modern data engineering concepts and systems",
  head: [["link", { rel: "icon", type: "image/svg+xml", href: "/logo.svg" }]],
  themeConfig: {
    siteTitle: "DE Docs",
    logo: "/logo.svg",
    nav: [
      { text: "SQL", link: "/sql/relational-model-concepts" },
      { text: "Syllabus", link: "/syllabus" },
    ],

    sidebar: {
      "/sql/": [
        {
          text: "SQL",
          items: [
            {
              text: "Relational model concepts",
              link: "/sql/relational-model-concepts",
            },
            {
              text: "Basic querying and filtering",
              link: "/sql/basic-querying-and-filtering",
            },
            {
              text: "Basic aggregations and grouping",
              link: "/sql/basic-aggregations-and-grouping",
            },
            {
              text: "Fundamental joins",
              link: "/sql/fundamental-joins",
            },
            {
              text: "Conditional logic and null handling",
              link: "/sql/conditional-logic-and-null-handling",
            },
            {
              text: "Subqueries and set operations",
              link: "/sql/subqueries-and-set-operations",
            },
            {
              text: "Analytical and window functions",
              link: "/sql/analytical-and-window-functions",
            },
            {
              text: "Value and frame navigation",
              link: "/sql/value-and-frame-navigation",
            },
            {
              text: "Common table expressions",
              link: "/sql/common-table-expressions",
            },
            {
              text: "Recursive queries and graph traversals",
              link: "/sql/recursive-queries-and-graph-traversals",
            },
            {
              text: "Multidimensional aggregation",
              link: "/sql/multidimensional-aggregation",
            },
            {
              text: "Database storage engine internals",
              link: "/sql/database-storage-engine-internals",
            },
            {
              text: "Indexing internals",
              link: "/sql/indexing-internals",
            },
            {
              text: "Query execution engine",
              link: "/sql/query-execution-engine",
            },
          ],
        },
      ],

      //   "/modeling/": [
      //     {
      //       text: "Data Modeling Fundamentals",
      //       items: [
      //         {
      //           text: "ER Diagrams & Normalization",
      //           link: "/modeling/er-normalization",
      //         },
      //         {
      //           text: "Dimensional Modeling (Kimball vs Inmon)",
      //           link: "/modeling/dimensional-modeling",
      //         },
      //       ],
      //     },
      //     {
      //       text: "Warehouse & Lakehouse",
      //       items: [
      //         {
      //           text: "Fact & Dimension Patterns",
      //           link: "/modeling/facts-and-dimensions",
      //         },
      //         {
      //           text: "Slowly Changing Dimensions (SCD)",
      //           link: "/modeling/scd-patterns",
      //         },
      //         { text: "Lakehouse Architectures", link: "/modeling/lakehouse" },
      //       ],
      //     },
      //   ],

      //   "/spark/": [
      //     {
      //       text: "Spark & Distributed Computing",
      //       items: [
      //         {
      //           text: "Driver, Executors & Architecture",
      //           link: "/spark/architecture",
      //         },
      //         { text: "DataFrames & Catalyst Engine", link: "/spark/dataframes" },
      //         {
      //           text: "Join Strategies & Optimization",
      //           link: "/spark/joins-partitioning",
      //         },
      //       ],
      //     },
      //   ],

      //   "/pipelines/": [
      //     {
      //       text: "Pipelines & Streaming",
      //       items: [
      //         {
      //           text: "ETL/ELT & Medallion Architecture",
      //           link: "/pipelines/medallion",
      //         },
      //         {
      //           text: "Airflow & Workflow Orchestration",
      //           link: "/pipelines/airflow",
      //         },
      //         { text: "Kafka & Event Streaming", link: "/pipelines/kafka" },
      //         {
      //           text: "Distributed Systems Patterns",
      //           link: "/pipelines/distributed-systems",
      //         },
      //       ],
      //     },
      //   ],

      //   "/dsa/": [
      //     {
      //       text: "Data Structures & Algorithms",
      //       items: [
      //         {
      //           text: "Complexity & Built-in Mechanics",
      //           link: "/dsa/complexity-and-builtins",
      //         },
      //         {
      //           text: "Arrays, Strings & Sliding Window",
      //           link: "/dsa/pointers-and-window",
      //         },
      //         { text: "Trees, Heaps & Graphs", link: "/dsa/trees-heaps-graphs" },
      //         { text: "DE System Design Patterns", link: "/dsa/system-design" },
      //       ],
      //     },
      //   ],
    },

    socialLinks: [
      { icon: "github", link: "https://github.com/vineethchivukula/dedocs" },
      {
        icon: "ic:baseline-account-circle",
        link: "https://vineethchivukula.vercel.app",
        ariaLabel: "Vineeth Chivukula's Portfolio",
      },
    ],

    search: {
      provider: "local", // Built-in client-side full-text search
    },
  },
});
