<!-- vale off -->

# Data Engineering Docs

Data Engineering Docs is a VitePress site for learning core data engineering
concepts and preparing for data engineering interviews. The current content
focuses on SQL, with a syllabus that covers data modeling, distributed
computing, data pipelines, system design, and algorithms.

## Features

- SQL reference and learning guides with examples, common pitfalls, and
  key takeaways.
- A tabular syllabus for the Absolute Data Engineering interview preparation
  programme.
- Mermaid diagrams rendered from `mermaid` code fences.
- Local full-text search powered by VitePress.
- Light and dark themes with project-specific styling.
- Vale and Google style checks for Markdown documentation.

## Prerequisites

- Node.js and npm

The project does not pin a Node.js version. Use a currently supported
even-numbered Node.js release for the best compatibility with VitePress.

## Getting started

Install the dependencies from the project root:

```bash
npm install
```

Start the local documentation server:

```bash
npm run docs:dev
```

VitePress prints the local URL in the terminal. Open that URL in a browser;
changes to content and theme files are reflected during development.

## Available commands

| Command | Description |
| --- | --- |
| `npm install` | Install project dependencies. |
| `npm run docs:dev` | Start the VitePress development server. |
| `npm run docs:build` | Build the production site in `.vitepress/dist`. |
| `npm run docs:preview` | Preview the production build locally. |

To preview a production build:

```bash
npm run docs:build
npm run docs:preview
```

## Project structure

```text
.
├── content/                 # Markdown source files
│   ├── index.md             # Home page
│   ├── syllabus.md          # Course syllabus
│   ├── sql/                 # SQL learning guides
│   └── public/              # Static assets served from the site root
├── .vitepress/
│   ├── config.mts           # VitePress site and navigation configuration
│   └── theme/               # Theme entry point and custom CSS
├── .vale.ini                # Vale configuration
└── package.json             # Scripts and dependencies
```

The `srcDir` setting in [.vitepress/config.mts](.vitepress/config.mts) makes
`content/` the documentation source directory. Add new Markdown pages there,
then add them to the navigation or sidebar when appropriate.

## Writing content

Use Markdown headings, fenced code blocks, tables, and links consistently.
Use `mermaid` code fences for diagrams that should render in the published site.
SQL examples should include enough context to explain the expected result.
For longer pages, use the existing structure where it fits:

1. Overview
2. Core concepts
3. Complete example
4. Common pitfalls
5. Key takeaways

The syllabus page is intentionally presented as tables so that topics, source
books, chapter references, and page ranges are easy to scan.

## Documentation linting

Vale is configured in [.vale.ini](.vale.ini) with the Vale and Google style
packages. If the syllabus should be excluded from linting, add
`IgnoredFiles = content/syllabus.md` to the `[*.md]` section.

If Vale is installed on your system, run it from the project root:

```bash
vale content
```

## Build and deployment

Create the production output with:

```bash
npm run docs:build
```

The generated static site is written to `.vitepress/dist`. Deploy that
directory to a static hosting service such as GitHub Pages, Netlify, or
Vercel. Configure the host to serve `.vitepress/dist` as the publish
directory.

## Related links

- [VitePress documentation](https://vitepress.dev/)
- [Vale documentation](https://docs.vale.sh/)
- [Project GitHub repository](https://github.com/vineethchivukula/dedocs)
