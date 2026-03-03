# Testing Patterns

**Analysis Date:** 2026-03-03

## Test Framework

**Status:** No testing framework configured

- No test runner installed (Vitest, Jest, etc.)
- No test files in `src/` directory
- No test-related npm scripts in `package.json` (only `dev`, `build`, `lint`, `preview`)
- No test configuration files (`vitest.config.js`, `jest.config.js`) present

**Current State:**
The codebase relies entirely on:
- ESLint static analysis for code quality
- TypeScript LSP (IDE diagnostics) for type checking
- Manual testing (likely via browser during development)

## Recommended Testing Architecture

While not yet implemented, based on the codebase structure and dependencies, here is the recommended approach for future test implementation:

**Suggested Test Runner:** Vitest (lightweight, Vite-native, fast)
- Installed with: `npm install -D vitest`
- Config file: `vitest.config.ts` at project root
- Run command: `npm run test` (add to `package.json`)

**Assertion Library:** Vitest's built-in `assert` or `expect` from `@vitest/expect`

**DOM Testing:** React Testing Library (recommended for component testing)
- Install: `npm install -D @testing-library/react @testing-library/jest-dom`
- Provides `render()`, `screen`, `userEvent` utilities

## Test File Organization

**Current:** Not applicable (no tests exist)

**Recommended:**
- **Location:** Co-located with source files
- **Pattern:** `ComponentName.test.tsx` or `ComponentName.spec.tsx` next to `ComponentName.tsx`
- **Example structure:**
  ```
  src/
  ├── components/
  │   ├── dashboard/
  │   │   ├── EditGuestSheet.tsx
  │   │   ├── EditGuestSheet.test.tsx        ← test file
  │   │   ├── DashboardNav.tsx
  │   │   └── DashboardNav.test.tsx
  ├── lib/
  │   ├── supabase.js
  │   ├── supabase.test.js
  │   ├── guest-excel.ts
  │   └── guest-excel.test.ts
  ├── hooks/
  │   ├── useEvent.js
  │   └── useEvent.test.js
  ```

## Testing Recommendations by Module

### 1. Utility Functions (`src/lib/`)

**Modules to test:**
- `guest-excel.ts` — Excel parsing, phone normalization, validation
- `utils.ts` — Class name merging (`cn()` utility)
- `supabase.js` — API integration (partially mockable)

**Pattern:** Pure function unit tests

**Example approach for `guest-excel.ts`:**
```typescript
describe('guest-excel', () => {
  describe('normalizePhone', () => {
    it('converts "05X-XXXX-XXXX" to "972..."', () => {
      expect(normalizePhone('054-1234567')).toBe('972541234567');
    });
    it('keeps "972..." unchanged', () => {
      expect(normalizePhone('972541234567')).toBe('972541234567');
    });
  });

  describe('isValidPhone', () => {
    it('accepts 10-12 digit numbers', () => {
      expect(isValidPhone('0541234567')).toBe(true);
      expect(isValidPhone('972541234567')).toBe(true);
    });
    it('rejects too-short or too-long numbers', () => {
      expect(isValidPhone('123')).toBe(false);
      expect(isValidPhone('12345678901234')).toBe(false);
    });
  });

  describe('parseGuestFile', () => {
    it('parses valid Excel file and returns { valid, errors, warnings }', async () => {
      // Create a mock File with test data
      const file = new File([/* XLSX bytes */], 'test.xlsx');
      const result = await parseGuestFile(file);
      expect(result.valid).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
    });
    it('captures validation errors with row numbers', async () => {
      const file = new File([/* XLSX with bad phone */], 'test.xlsx');
      const result = await parseGuestFile(file);
      expect(result.errors[0]).toEqual({
        row_number: 2,
        group_name: 'Test Family',
        errors: ['טלפון 1 אינו תקין'],
      });
    });
  });
});
```

### 2. React Hooks (`src/hooks/`)

**Modules to test:**
- `useEvent.js` — Event fetching with cancellation handling
- `useEventContext.tsx` — Context provider and hook
- `useFeatureAccess.ts` — Feature flag access logic

**Pattern:** React Testing Library with `renderHook()`

**Example approach for `useEvent.ts`:**
```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { useEvent } from '@/hooks/useEvent';

// Mock the supabase module
vi.mock('@/lib/supabase', () => ({
  fetchEventBySlug: vi.fn(),
}));

describe('useEvent', () => {
  it('returns loading=true initially, then loads event by slug', async () => {
    const mockEvent = { id: '123', slug: 'test-slug', template_id: 'elegant' };
    vi.mocked(fetchEventBySlug).mockResolvedValue(mockEvent);

    const { result } = renderHook(() => useEvent('test-slug'));

    // Initial state
    expect(result.current.loading).toBe(true);
    expect(result.current.event).toBeNull();

    // After fetch
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.event).toEqual(mockEvent);
  });

  it('sets notFound=true and loading=false on fetch error', async () => {
    vi.mocked(fetchEventBySlug).mockRejectedValue(new Error('Not found'));

    const { result } = renderHook(() => useEvent('unknown-slug'));

    await waitFor(() => {
      expect(result.current.notFound).toBe(true);
      expect(result.current.loading).toBe(false);
    });
  });

  it('cancels fetch on unmount to prevent state update', async () => {
    const { unmount } = renderHook(() => useEvent('test-slug'));
    unmount();
    // Verify no console errors about state update on unmounted component
  });
});
```

### 3. React Components

**Modules to test:**
- Micro-components: `Spinner()`, `ErrorView()` — render correctly with props
- Sheets/Modals: `EditGuestSheet`, `StageEditModal` — open/close, form submission
- Pages: `Dashboard`, `AutomationTimeline` — data loading, user interactions, filtering

**Pattern:** React Testing Library with `render()` and `screen`

**Example approach for `EditGuestSheet.tsx`:**
```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { EditGuestSheet, type Invitation } from '@/components/dashboard/EditGuestSheet';

describe('EditGuestSheet', () => {
  const mockInvitation: Invitation = {
    id: 'inv-1',
    group_name: 'Test Family',
    phone_numbers: ['0541234567'],
    rsvp_status: 'pending',
    confirmed_pax: 0,
    invited_pax: 4,
    is_automated: true,
    side: 'חתן',
    guest_group: 'משפחה',
  };

  it('opens sheet when invitation is provided', () => {
    const { rerender } = render(
      <EditGuestSheet
        invitation={null}
        sides={['חתן', 'כלה']}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    rerender(
      <EditGuestSheet
        invitation={mockInvitation}
        sides={['חתן', 'כלה']}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('populates form fields with invitation data', () => {
    render(
      <EditGuestSheet
        invitation={mockInvitation}
        sides={['חתן', 'כלה']}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );
    expect(screen.getByDisplayValue('Test Family')).toBeInTheDocument();
    expect(screen.getByDisplayValue('0541234567')).toBeInTheDocument();
    expect(screen.getByDisplayValue('4')).toBeInTheDocument(); // invited_pax
  });

  it('calls onSave with updated data when form is submitted', async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();
    render(
      <EditGuestSheet
        invitation={mockInvitation}
        sides={['חתן', 'כלה']}
        onClose={vi.fn()}
        onSave={onSave}
      />
    );

    const groupInput = screen.getByDisplayValue('Test Family');
    await user.clear(groupInput);
    await user.type(groupInput, 'Updated Family');

    const saveButton = screen.getByRole('button', { name: /שמור/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ group_name: 'Updated Family' })
      );
    });
  });
});
```

### 4. Supabase Integration

**Approach:** Mock Supabase client entirely using `vi.mock()`

**Example approach for `supabase.js`:**
```typescript
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: '123', slug: 'test' },
            error: null,
          }),
        }),
      }),
    }),
    rpc: vi.fn().mockResolvedValue({ error: null }),
  })),
}));

describe('supabase', () => {
  describe('fetchEventBySlug', () => {
    it('fetches and returns event data', async () => {
      const event = await fetchEventBySlug('test-slug');
      expect(event.id).toBe('123');
    });

    it('throws on error', async () => {
      // Mock error state
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: new Error('Not found'),
            }),
          }),
        }),
      });

      await expect(fetchEventBySlug('unknown')).rejects.toThrow('Not found');
    });
  });

  describe('bulkUpsertInvitations', () => {
    it('returns { inserted, updated, errors } with proper counts', async () => {
      const guests = [
        { group_name: 'New', phone_numbers: ['0541234567'], invited_pax: 2 },
        { group_name: 'Existing', phone_numbers: ['0549876543'], invited_pax: 3 },
      ];
      const result = await bulkUpsertInvitations('event-id', guests);
      expect(result).toHaveProperty('inserted');
      expect(result).toHaveProperty('updated');
      expect(result).toHaveProperty('errors');
    });
  });
});
```

## Mocking Strategy

**What to Mock:**
- External API calls (Supabase, Google Sheets)
- File system operations (FileReader for Excel parsing)
- GSAP animations (return mock context with `revert()` method)
- Lucide icons (return mock SVG or `<div>`)

**What NOT to Mock:**
- React components (render the actual component, test behavior via UI)
- Utility functions like `cn()`, `normalizePhone()` (test real output)
- React hooks like `useState`, `useEffect` (test the hook's effects)

## Fixtures and Factories

**Location:** `src/__fixtures__/` or `src/__mocks__/`

**Pattern:** Factory functions for creating test data

**Example:**
```typescript
// src/__fixtures__/invitation.ts
export function createMockInvitation(overrides?: Partial<Invitation>): Invitation {
  return {
    id: 'inv-1',
    group_name: 'Test Family',
    phone_numbers: ['0541234567'],
    rsvp_status: 'pending',
    confirmed_pax: 0,
    invited_pax: 4,
    is_automated: true,
    side: 'חתן',
    guest_group: 'משפחה',
    messages_sent_count: 0,
    ...overrides,
  };
}

export function createMockAutomationSetting(overrides?): AutomationSettingRow {
  return {
    id: 'setting-1',
    event_id: 'event-1',
    stage_name: 'nudge',
    days_before: 7,
    target_status: 'pending',
    is_active: true,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}
```

## Coverage Targets

**Recommended coverage (not currently enforced):**
- Utilities: 90%+ (most critical for correctness)
- Hooks: 80%+ (logic is testable, but side effects are complex)
- Components: 60%+ (UI testing is brittle; focus on user flows, not implementation)
- Integration tests for critical user paths (e.g., guest upload, RSVP submission)

**View coverage:**
```bash
# Add to package.json scripts after Vitest setup:
"test": "vitest",
"test:ui": "vitest --ui",
"test:coverage": "vitest --coverage"
```

## Test Types

**Unit Tests:**
- Scope: Individual functions and hooks
- Approach: Test inputs and outputs in isolation
- Example: `normalizePhone()`, `isValidPhone()`, `useEvent()`

**Integration Tests:**
- Scope: Component interaction + state management
- Approach: Render component, interact via UI, verify state changes
- Example: `EditGuestSheet` form submission, `Dashboard` guest table filtering

**E2E Tests:**
- **Status:** Not implemented
- **Recommended:** Playwright or Cypress for critical user flows
- **Scenarios to cover:**
  1. Event creation → onboarding page
  2. RSVP form submission → database update
  3. Guest upload workflow (download template → parse → upsert)
  4. Automation timeline editing (toggle stage, edit template, delete nudge)

## Common Test Patterns

**Async Testing:**
```typescript
// Use waitFor for state updates
await waitFor(() => {
  expect(result.current.event).not.toBeNull();
});

// Use userEvent for user interactions (better than fireEvent)
const user = userEvent.setup();
await user.click(saveButton);
await user.type(input, 'text');
```

**Error Testing:**
```typescript
it('throws on network error', async () => {
  vi.mocked(fetchEventBySlug).mockRejectedValue(new Error('Network error'));
  await expect(fetchEventBySlug('slug')).rejects.toThrow('Network error');
});

it('displays error message to user', () => {
  render(<ErrorView message="Test error" />);
  expect(screen.getByText('Test error')).toBeInTheDocument();
});
```

**Form Testing:**
```typescript
it('validates required fields before submit', async () => {
  const user = userEvent.setup();
  render(<MyForm onSubmit={vi.fn()} />);

  const submitBtn = screen.getByRole('button', { name: /submit/i });
  await user.click(submitBtn);

  // Form should show error, not call onSubmit
  expect(screen.getByText(/required/i)).toBeInTheDocument();
});
```

**Context Testing:**
```typescript
// Wrap component in provider
render(
  <EventProvider>
    <TestComponent />
  </EventProvider>
);

// Verify hook accesses context
const { result } = renderHook(() => useEventContext(), {
  wrapper: EventProvider,
});
expect(result.current.event).toBeDefined();
```

---

*Testing analysis: 2026-03-03*
