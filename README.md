# YogaFlow Lite

A minimalist and aesthetic web application designed for browsing yoga poses (asanas) and creating personal, reusable practice sequences. The project focuses on simplicity, a calming user experience, and providing a tool that allows users to build their own personalized flows.

![Version](https://img.shields.io/badge/version-0.0.1-blue)
![Node](https://img.shields.io/badge/node-22.14.0-green)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

## Table of Contents

- [Project Description](#project-description)
- [Tech Stack](#tech-stack)
- [Getting Started Locally](#getting-started-locally)
- [Available Scripts](#available-scripts)
- [Project Scope](#project-scope)
- [Project Status](#project-status)
- [License](#license)

## Project Description

YogaFlow Lite is a minimalist and aesthetic web application designed for browsing yoga poses (asanas) and creating personal, reusable practice sequences. The project focuses on simplicity, a calming user experience, and providing a tool that allows users to build their own personalized flows.

## Tech Stack

### Core Technologies

- **[Astro](https://astro.build/)** v5.13.7 - Modern web framework for building fast, content-focused websites
- **[React](https://react.dev/)** v19.1.1 - UI library for building interactive components
- **[TypeScript](https://www.typescriptlang.org/)** v5 - Type-safe JavaScript
- **[Tailwind CSS](https://tailwindcss.com/)** v4.1.13 - Utility-first CSS framework
- **[Shadcn/ui](https://ui.shadcn.com/)** - Beautiful, accessible React components built with Radix UI and Tailwind CSS

### Backend & Database (Planned)

- **[Supabase](https://supabase.com/)** - Open source Firebase alternative for authentication and database (planned integration)
  - Note: `@supabase/supabase-js` is not yet installed but the project is configured for it

### Additional Tools

- **[Lucide React](https://lucide.dev/)** - Icon library
- **[ESLint](https://eslint.org/)** - Code linting
- **[Prettier](https://prettier.io/)** - Code formatting
- **[Husky](https://typicode.github.io/husky/)** - Git hooks
- **[lint-staged](https://github.com/okonet/lint-staged)** - Run linters on staged files

## Getting Started Locally

### Prerequisites

- **Node.js** v22.14.0 (as specified in `.nvmrc`)
- **npm** (comes with Node.js)

### Installation Steps

1. **Clone the repository:**

```bash
git clone <repository-url>
cd yogaflow-lite
```

2. **Install dependencies:**

```bash
npm install
```

3. **Set up environment variables:**

Create a `.env` file in the root directory:

```env
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_anon_key
```

> **Note:** Supabase integration is planned but not yet implemented. You'll need to set up a Supabase project and obtain these credentials when ready.

4. **Run the development server:**

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

5. **Build for production:**

```bash
npm run build
```

6. **Preview production build:**

```bash
npm run preview
```

## Available Scripts

| Command            | Description                                             |
| ------------------ | ------------------------------------------------------- |
| `npm run dev`      | Start the development server on `http://localhost:3000` |
| `npm run build`    | Build the application for production                    |
| `npm run preview`  | Preview the production build locally                    |
| `npm run lint`     | Run ESLint to check for code issues                     |
| `npm run lint:fix` | Automatically fix ESLint issues                         |
| `npm run format`   | Format code using Prettier                              |
| `npm run astro`    | Run Astro CLI commands                                  |

### Code Quality

The project uses:

- **ESLint** for linting TypeScript, React, and Astro files
- **Prettier** for formatting JSON, CSS, and Markdown files
- **lint-staged** with Husky to run linters on staged files before commits

## Additional Documentation

- **[Product Requirements Document (PRD)](./ai/prd.md)** - Detailed product requirements and user stories
- **[Tech Stack Analysis](./ai/tech-stack.md)** - Critical analysis of the technology choices

## Project Structure

```
.
├── src/
│   ├── components/      # UI components (Astro & React)
│   │   └── ui/         # Shadcn/ui components
│   ├── layouts/         # Astro layouts
│   ├── pages/           # Astro pages
│   │   └── api/         # API endpoints (when implemented)
│   ├── lib/             # Services and helpers
│   ├── db/              # Supabase clients and types (when implemented)
│   ├── middleware/      # Astro middleware
│   └── assets/          # Static internal assets
├── public/              # Public assets
├── ai/                  # Project documentation (PRD, tech stack analysis)
└── .cursor/rules/       # AI development rules for Cursor IDE
```

## Contributing

When contributing to this project:

1. Follow the coding practices defined in `.cursor/rules/`
2. Ensure all code passes ESLint checks
3. Format code using Prettier
4. Write clear commit messages
5. Follow the Rules of Hooks for React components
6. Maintain accessibility standards (WCAG)

## License

MIT

---

**Note:** This project is in active development. Features and documentation may change frequently.
