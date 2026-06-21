# Directory Structure

## Root Layout

```
Wedding-Eyal/
├── .planning/                    # GSD planning documents
│   └── codebase/                 # This codebase map
├── .vercel/                      # Vercel deployment config
├── public/                       # Static assets (images, template assets)
│   └── templates/                # Per-template asset folders
├── src/                          # Frontend source code
├── supabase/                     # Backend (edge functions + migrations)
├── CLAUDE.md                     # AI assistant instructions
├── package.json                  # Node dependencies
├── vite.config.js                # Vite build config
├── tailwind.config.js            # Tailwind CSS config
├── tsconfig.json                 # TypeScript config
├── eslint.config.js              # ESLint 9 flat config
└── postcss.config.js             # PostCSS config
```

## Source Directory (`src/`)

```
src/
├── main.jsx                      # App entry: BrowserRouter + AuthProvider + App
├── App.jsx                       # Route definitions
├── App.scss                      # Global app styles
│
├── contexts/
│   ├── AuthContext.tsx            # Auth state provider (Supabase session)
│   └── EventContext.tsx           # Current event provider (for dashboard)
│
├── hooks/
│   ├── useEvent.js               # Fetch event by slug (public pages)
│   └── useFeatureAccess.ts       # Feature gating (draft vs active events)
│
├── pages/
│   ├── EventPage.jsx             # Public: slug → template dispatch
│   ├── NotFoundPage.jsx          # 404 fallback
│   ├── LoginPage.tsx             # Google OAuth login
│   ├── OnboardingPage.tsx        # New event creation wizard
│   ├── Dashboard.tsx             # Guest table + KPI cards + bulk actions
│   ├── AutomationTimeline.tsx    # Automation pipeline visualization
│   └── DashboardSettings.tsx     # Event content_config editor + live preview
│
├── templates/
│   ├── WeddingDefaultTemplate/
│   │   └── WeddingDefaultTemplate.jsx    # Burgundy/cream, GSAP animations
│   ├── ElegantTemplate/
│   │   ├── ElegantTemplate.jsx           # Navy/gold minimal
│   │   └── ElegantTemplate.scss
│   ├── WeddingModernTemplate/
│   │   ├── WeddingModernTemplate.jsx     # Retro zine aesthetic
│   │   └── WeddingModernTemplate.scss
│   └── WeddingTemplate/
│       └── WeddingTemplate.jsx           # Legacy/unused template
│
├── components/
│   ├── Hero/
│   │   ├── Hero.jsx              # Hero section (config-driven)
│   │   └── Hero.scss
│   ├── RsvpForm/
│   │   ├── RsvpForm.jsx          # RSVP form (eventId-driven)
│   │   └── RsvpForm.scss
│   ├── Map/
│   │   ├── Map.jsx               # Venue map embed (config-driven)
│   │   └── Map.scss
│   ├── auth/
│   │   └── ProtectedRoute.tsx    # Auth + event guard for dashboard routes
│   ├── ui/
│   │   ├── glass-card.tsx        # GlassCard glassmorphism primitives
│   │   └── sheet.tsx             # Sheet drawer (Radix Dialog wrapper)
│   └── dashboard/
│       ├── constants.ts          # Shared stage names, labels, status maps
│       ├── DashboardNav.tsx      # Tab navigation (guests / timeline / settings)
│       ├── EditGuestSheet.tsx    # Side sheet: edit invitation fields
│       ├── GuestUploadModal.tsx  # 3-step Excel upload modal
│       ├── LivePreview.tsx       # Phone-frame preview wrapper (for settings)
│       ├── StageEditModal.tsx    # Glass modal: edit stage timing + templates
│       └── StageLogsSheet.tsx    # Side sheet: per-stage message log drill-down
│
├── lib/
│   ├── supabase.js               # All Supabase queries, RPC calls, mutations
│   ├── guest-excel.ts            # Excel template download + file parser + export
│   └── utils.ts                  # cn() class utility
│
├── styles/
│   ├── global.scss               # CSS reset, @font-face, base styles, utilities
│   ├── tailwind.css              # Tailwind directives
│   ├── _variables.scss           # SCSS variables (colors, spacing, typography)
│   ├── _mixins.scss              # SCSS mixins (responsive, flex, button, input)
│   └── fonts/                    # Local font files (Polin, Danidin)
│
└── timeline/
    └── dance.tsx                 # Timeline animation component
```

## Supabase Directory

```
supabase/
├── functions/
│   ├── automation-engine/
│   │   └── index.ts              # Evaluates stages, queues messages
│   ├── whatsapp-scheduler/
│   │   └── index.ts              # Sends pending messages via Green API
│   ├── sync-to-sheets/
│   │   └── index.ts              # Syncs RSVP data to Google Sheets
│   └── whatsapp-webhook/
│       └── index.ts              # Inbound auto-reply handler (PAUSED)
│
└── migrations/
    ├── 20260221120000_allow_anon_rls.sql
    ├── 20260223140000_create_automation_settings.sql
    ├── 20260226100000_automation_rls_and_rpc.sql
    ├── 20260226100100_seed_automation_settings.sql
    ├── 20260226200000_dynamic_nudges_and_autopilot.sql
    ├── 20260302100000_auth_multitenant_schema.sql
    ├── 20260302100100_auth_rls_policies.sql
    ├── 20260302100200_events_anon_rls.sql
    └── 20260304090000_schedule_automation_cron.sql
```

## Naming Conventions

- **Pages:** PascalCase `.tsx` files in `src/pages/` (e.g., `Dashboard.tsx`, `LoginPage.tsx`)
- **Templates:** PascalCase directory + file in `src/templates/` (e.g., `ElegantTemplate/ElegantTemplate.jsx`)
- **Components:** PascalCase directory + file (e.g., `Hero/Hero.jsx`, `RsvpForm/RsvpForm.jsx`)
- **Dashboard components:** Flat in `src/components/dashboard/` (e.g., `EditGuestSheet.tsx`)
- **UI primitives:** Kebab-case in `src/components/ui/` (e.g., `glass-card.tsx`, `sheet.tsx`)
- **Hooks:** camelCase with `use` prefix in `src/hooks/` (e.g., `useEvent.js`)
- **Lib modules:** Kebab-case in `src/lib/` (e.g., `guest-excel.ts`, `supabase.js`)
- **Styles:** Kebab-case SCSS, partials prefixed with `_` (e.g., `_variables.scss`, `_mixins.scss`)
- **Migrations:** Timestamp-prefixed snake_case SQL (e.g., `20260302100000_auth_multitenant_schema.sql`)
- **Edge functions:** Kebab-case directories (e.g., `automation-engine/`, `whatsapp-scheduler/`)
