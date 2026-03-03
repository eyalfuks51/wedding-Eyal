# Codebase Structure

**Analysis Date:** 2026-03-03

## Directory Layout

```
wedding-eyal/
├── src/                            # React application source
│   ├── main.jsx                    # Entry point: BrowserRouter + AuthProvider + App
│   ├── App.jsx                     # Route definitions
│   ├── pages/                      # Page components (one per route)
│   ├── components/                 # Reusable components
│   ├── contexts/                   # React context providers
│   ├── hooks/                      # Custom React hooks
│   ├── lib/                        # Utilities, Supabase client, data fetching
│   ├── templates/                  # Event invitation templates (pluggable)
│   ├── styles/                     # Global SCSS, fonts, Tailwind CSS
│   └── timeline/                   # SVG icon imports for schedule items
├── supabase/                       # Backend configuration
│   ├── functions/                  # Edge functions (TypeScript)
│   └── migrations/                 # SQL migrations for schema + RLS
├── public/                         # Static assets
│   └── assets/templates/           # Template-specific images
├── index.html                      # HTML shell
├── vite.config.js                  # Vite build configuration
├── tailwind.config.js              # Tailwind CSS theme
├── tsconfig.json                   # TypeScript compiler options
├── eslint.config.js                # ESLint rules
├── postcss.config.js               # PostCSS (Tailwind + Autoprefixer)
├── CLAUDE.md                       # Project context (this file reference)
└── .planning/codebase/             # GSD mapping documents (this output)
```

## Directory Purposes

**`src/pages/`:**
- Purpose: Top-level route components
- Contains: `EventPage.jsx`, `Dashboard.tsx`, `AutomationTimeline.tsx`, `DashboardSettings.tsx`, `LoginPage.tsx`, `OnboardingPage.tsx`, `NotFoundPage.jsx`
- Key files:
  - `EventPage.jsx`: Fetches event by slug, dispatches to template, handles preview mode
  - `Dashboard.tsx`: Guest table, KPI cards, filters, bulk actions
  - `AutomationTimeline.tsx`: Visual funnel pipeline with stage editing
  - `DashboardSettings.tsx`: Event content editor with live preview

**`src/components/`:**
- Purpose: Reusable UI components organized by domain
- Contains: Subdirectories by feature area
- Key subdirectories:
  - `dashboard/`: Dashboard-specific components (sheets, modals, cards)
    - `constants.ts`: Shared stage metadata, labels, status maps
    - `EditGuestSheet.tsx`: Side sheet for editing individual invitation
    - `StageEditModal.tsx`: Centered modal for automation stage editing
    - `StageLogsSheet.tsx`: Side sheet for per-stage message log drill-down
    - `GuestUploadModal.tsx`: 3-step Excel import flow
    - `LivePreview.tsx`: iPhone frame for previewing template
    - `DashboardNav.tsx`: Shared tab navigation
  - `ui/`: Primitive UI components (Radix-based)
    - `sheet.tsx`: Drawer/sidebar component (@radix-ui/react-dialog)
    - `glass-card.tsx`: Glassmorphism card family
  - `auth/`: Authentication components
    - `ProtectedRoute.tsx`: Wraps routes requiring login + active event
  - `Hero/`, `RsvpForm/`, `Map/`: Template subcomponents (used by both WeddingDefaultTemplate and ElegantTemplate)

**`src/contexts/`:**
- Purpose: React context providers for application state
- Contains:
  - `AuthContext.tsx`: User session, sign-out function
  - `EventContext.tsx`: Authenticated user's event (fetched from user_events table), isActive flag, loading state, refetch callback

**`src/hooks/`:**
- Purpose: Custom React hooks
- Contains:
  - `useEvent.js`: Fetches event by slug, returns { event, loading, notFound }
  - `useFeatureAccess.ts`: Returns feature flags based on event.status (canManageGuests, canUseWhatsApp)

**`src/lib/`:**
- Purpose: Utilities and data layer
- Contains:
  - `supabase.js`: Supabase client initialization, all query/mutation functions
  - `guest-excel.ts`: Excel template download + row parsing for bulk import
  - `utils.ts`: Tailwind `cn()` classname utility
  - All Supabase functions use dynamic imports: `import.meta.env.VITE_SUPABASE_*`

**`src/templates/`:**
- Purpose: Event invitation template implementations (pluggable by template_id)
- Contains:
  - `WeddingDefaultTemplate/`: Warm burgundy/cream, decorative flowers, GSAP scroll animations
  - `ElegantTemplate/`: Deep navy + gold, minimal, CSS-only decor
  - `WeddingTemplate/`: Legacy template
- Pattern: Each template is a self-contained React component receiving `{ event, config }` props
- Subcomponents: `Hero`, `RsvpForm`, `Map` are imported by multiple templates

**`src/styles/`:**
- Purpose: Global styles, fonts, CSS framework configuration
- Contains:
  - `global.scss`: @font-face declarations, CSS reset, RTL baseline styles
  - `tailwind.css`: Tailwind directives
  - `_variables.scss`: SCSS variables (colors, fonts, spacing) imported globally
  - `_mixins.scss`: SCSS mixins for common patterns
  - `fonts/`: Local font files (Polin-Regular.woff2, Polin-Bold.woff2, Danidin-CondensedBold.woff2)
- Note: `preflight: false` in Tailwind config — `global.scss` owns CSS reset

**`src/timeline/`:**
- Purpose: SVG icons used in schedule rendering
- Contains: `dance.tsx`, `marry.tsx`, `food.tsx` (mapped to icon strings in content_config)

**`supabase/functions/`:**
- Purpose: Backend async processing
- Contains:
  - `whatsapp-scheduler/index.ts`: Polls message_logs for pending, respects operating hours, calls Green API
  - `sync-to-sheets/index.ts`: Syncs arrival_permits rows to Google Sheets (triggered on INSERT/UPDATE)
  - `automation-engine/index.ts`: Evaluates automation stages, creates message_logs rows
  - `whatsapp-webhook/index.ts`: Handles inbound WhatsApp messages (currently paused)

**`supabase/migrations/`:**
- Purpose: Database schema and RLS policies as code
- Contains: Timestamped SQL files applied in order
  - `20260221120000_allow_anon_rls.sql`: Initial RLS on arrival_permits
  - `20260223140000_create_automation_settings.sql`: Automation stage configuration table
  - `20260226100000_automation_rls_and_rpc.sql`: RPC functions for atomic JSONB updates
  - `20260302100000_auth_multitenant_schema.sql`: user_events junction table for multi-tenant support

**`public/`:**
- Purpose: Static assets served by Vite dev server
- Contains:
  - `assets/templates/<template-id>/`: Template-specific images (e.g., `assets/templates/elegant/monstrea.png`)
  - Root-level images: Legacy/shared assets (flowers, frame, logo images)

## Key File Locations

**Entry Points:**
- `index.html`: HTML shell with `<div id="root"></div>`
- `src/main.jsx`: BrowserRouter + AuthProvider + App
- `src/App.jsx`: Route definitions

**Configuration:**
- `vite.config.js`: Build tool, path alias `@` → `src/`
- `tailwind.config.js`: Theme (fontFamily: brand/danidin), preflight disabled
- `tsconfig.json`: Target ES2020, JSX react-jsx, strict: false
- `eslint.config.js`: ESLint rules
- `postcss.config.js`: Tailwind + Autoprefixer
- `CLAUDE.md`: Project context and conventions (MUST read before implementing)

**Core Logic:**
- `src/lib/supabase.js`: Supabase client, all data fetching functions
- `src/hooks/useEvent.js`: Slug-to-event data flow for public pages
- `src/contexts/AuthContext.tsx`: Session management
- `src/contexts/EventContext.tsx`: Authenticated user's event state

**Styles:**
- `src/styles/global.scss`: @font-face, reset, RTL baseline
- `src/styles/tailwind.css`: Tailwind imports
- `tailwind.config.js`: Polin (font-brand) + Danidin (font-danidin) theme
- Individual component SCSS: `src/templates/*/` and `src/components/*/` have .scss files

**Tests:**
- Not detected (no test files found in src/)

## Naming Conventions

**Files:**
- React components: PascalCase (e.g., `EditGuestSheet.tsx`, `RsvpForm.jsx`)
- Utilities: camelCase (e.g., `supabase.js`, `guest-excel.ts`, `utils.ts`)
- SCSS: snake-case (e.g., `global.scss`, `RsvpForm.scss`, `ElegantTemplate.scss`)
- SVG imports: descriptive names (e.g., `dance.tsx`, `marry.tsx`, `food.tsx`)

**Directories:**
- Feature areas: lowercase plural or descriptive (e.g., `pages/`, `components/`, `contexts/`, `hooks/`)
- Component groups: domain-based (e.g., `dashboard/`, `auth/`, `ui/`)
- Template subdirs: kebab-case or CamelCase (e.g., `ElegantTemplate/`, `WeddingDefaultTemplate/`)

**React Components:**
- Named exports for pages/components accessed via React Router
- `function ComponentName() { ... }` or `export default` pattern both used
- TypeScript used selectively (auth, contexts, dashboard components)

**TypeScript Types:**
- Interface naming: `PascalCase` (e.g., `EditGuestSheetProps`, `AutomationSettingRow`, `ContentConfig`)
- Type aliases: `PascalCase` (e.g., `StageName`, `RsvpStatus`, `StageStatus`)
- Discriminated unions for complex types (e.g., `PipelineNode = { type: 'stage' | 'event' | 'add-nudge' }`)

**Constants:**
- All-caps for enums and stage name constants: `CANONICAL_STAGES`, `ALL_STAGE_NAMES`, `STAGE_META`
- Tailwind class groupings: `INPUT_BASE`, `STATUS_MAP`, `ICON_MAP`

**Functions:**
- camelCase for all functions (hooks, utilities, event handlers)
- Event handlers: `handle*` prefix (e.g., `handleInputChange`, `handleSubmit`)
- Fetch/query functions: `fetch*` or declarative (e.g., `fetchEventBySlug`, `submitRsvp`, `updateAutomationSetting`)

## Where to Add New Code

**New Feature (e.g., Guest Message History):**
- Primary code:
  - Page component: `src/pages/NewFeature.tsx`
  - Supporting components: `src/components/dashboard/NewFeatureSheet.tsx`, modals, cards
  - Data fetching: Add functions to `src/lib/supabase.js`
  - Types: Define in component file or shared constants file
- Tests: Not yet present (add as `src/pages/NewFeature.test.tsx` when testing added)

**New Component/Module:**
- Implementation:
  - UI primitives: `src/components/ui/new-primitive.tsx` (Radix-based)
  - Dashboard feature: `src/components/dashboard/NewDashboardComponent.tsx`
  - Reusable subcomponent: `src/components/FeatureName/FeatureName.jsx`
- Styling: Colocate SCSS file (`FeatureName.scss`) in same directory
- Exports: Use named exports for flexibility; default export optional for lazy-loaded pages

**New Template:**
1. Create directory: `src/templates/TemplateNameTemplate/`
2. Copy existing template as starting point (usually `ElegantTemplate`)
3. Rewrite SCSS for new color palette/fonts
4. Replace hardcoded image imports with new files from `public/assets/templates/<template-name>/`
5. Register in `EventPage.jsx` TEMPLATES object: `'template-key': TemplateNameTemplate`
6. Update `CLAUDE.md` Template Registry table

**Utilities:**
- Shared helpers: `src/lib/utils.ts`
- Data transformation: `src/lib/[domain]-[operation].ts` (e.g., `guest-excel.ts`)
- Hooks: `src/hooks/[domain].ts` (e.g., `useFeatureAccess.ts`)

**Context & State:**
- New context: `src/contexts/[Domain]Context.tsx`
- Pattern: Provider + `use[Domain]` hook, both exported together
- Example: `AuthContext.tsx` exports `AuthProvider` + `useAuth()`

**Styles:**
- Global changes: Edit `src/styles/global.scss` or `tailwind.config.js`
- Component-specific: Colocate `.scss` file in component directory
- Theme variables: Add to `src/styles/_variables.scss`

## Special Directories

**`.planning/codebase/`:**
- Purpose: GSD (Grind SaaS Done) mapping documents
- Generated: Yes (by GSD orchestrator)
- Committed: Yes (guides future development)
- Contents: ARCHITECTURE.md, STRUCTURE.md, CONVENTIONS.md, TESTING.md, CONCERNS.md

**`dist/`:**
- Purpose: Production build output
- Generated: Yes (by `npm run build`)
- Committed: No (.gitignore)

**`node_modules/`:**
- Purpose: Installed dependencies
- Generated: Yes (by `npm install`)
- Committed: No (.gitignore)

**`supabase/`:**
- Purpose: Backend infrastructure as code
- Generated: No (manual edits only)
- Committed: Yes
- Contains: Edge function source + SQL migrations

**`.worktrees/`:**
- Purpose: Git worktrees for isolated branches
- Generated: Yes (git worktree create)
- Committed: No (.gitignore)

---

*Structure analysis: 2026-03-03*
