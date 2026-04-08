# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Proactive Skill Usage

Invoke these installed skills automatically when the context matches — don't wait for the user to ask:

- **`frontend-design`** — When building new UI components, pages, or visual features (styled-components work, new layouts, redesigns)
- **`feature-dev`** — When developing a new feature end-to-end (guided architecture + implementation)
- **`simplify`** — After completing code changes, review for reuse, quality, and simplification
- **`code-review`** — When reviewing a pull request or when asked to review code
- **`context7`** — When needing current docs for any library/framework (React, Next.js, mongoose, styled-components, etc.) — prefer this over guessing from training data
- **`claude-md-management:revise-claude-md`** — At end of sessions where significant learnings emerged
- **`figma:figma-implement-design`** — When the user provides a Figma URL to implement
- **`playwright-cli`** — When automating browser testing beyond simple Playwright MCP calls

These are in addition to the superpowers skills (brainstorming, debugging, writing-plans, etc.) which are already part of the workflow.

## Coding Standards

- **TypeScript**: Never use `any` — always use proper types
- **Styling**: styled-components with theme from `~/features/ui/theme/` (`colors`, `fontSizes`, `font`, `typography`)
- **Forms**: react-hook-form + zod (`zodResolver`)
- **Toasts**: `import { toast } from 'react-toastify'`
- **Naming**: camelCase for variables/functions, PascalCase for components/types, UPPER_SNAKE_CASE for enum values
- **Effects**: Follow React's "You Might Not Need an Effect" guidelines
- **DRY**: Reuse existing components/functions before creating new ones
- **Problem solving**: Create at least 3 solutions, analyze and rate them 1-5, then recommend one
