# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Coding Standards

- **TypeScript**: Never use `any` — always use proper types
- **Styling**: styled-components with theme from `~/features/ui/theme/` (`colors`, `fontSizes`, `font`, `typography`)
- **Forms**: react-hook-form + zod (`zodResolver`)
- **Toasts**: `import { toast } from 'react-toastify'`
- **Naming**: camelCase for variables/functions, PascalCase for components/types, UPPER_SNAKE_CASE for enum values
- **Effects**: Follow React's "You Might Not Need an Effect" guidelines
- **DRY**: Reuse existing components/functions before creating new ones
- **Problem solving**: Create at least 3 solutions, analyze and rate them 1-5, then recommend one
