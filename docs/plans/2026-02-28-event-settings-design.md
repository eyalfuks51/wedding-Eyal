# Event Settings Editor — Design Document

**Date:** 2026-02-28
**Status:** Approved

## Goal

Give the couple a settings screen where they can edit all their event details (`content_config`) and see a live mobile preview of their invitation page. This is the 3rd tab in the admin dashboard ("הגדרות").

## Design Decisions

### 1. Placement — 3rd Tab in DashboardNav

A new tab "הגדרות" at `/dashboard/settings`. Separate from the guest table and timeline — each screen has a distinct mental model:
- Dashboard = who's coming (data)
- Timeline = what's being sent (automation)
- Settings = what does my event look like (content editing)

### 2. Universal Form (No Template-Specific Fields)

Both existing templates (`wedding-default`, `elegant`) consume the exact same `content_config` fields. No template-specific sections needed now. When a future template requires unique fields, we can add a conditional `template_fields` section.

### 3. Live Preview (Phone Frame)

Split-pane layout: form on the right, phone-frame mockup on the left (desktop only — hidden on mobile).

The preview renders the actual template component inside a scaled-down container with `transform: scale()` inside a phone-shaped frame. As the user edits fields, draft `content_config` is passed directly to the template — instant re-render, no API calls.

On mobile, a floating "תצוגה מקדימה" button opens the preview as a bottom sheet or full-screen overlay.

### 4. Form Sections

The form is organized into collapsible sections matching the `content_config` structure:

#### Section 1: פרטי הזוג (Couple Details)
| Field | Key | Type | Notes |
|---|---|---|---|
| שמות הזוג | `couple_names` | text | |
| ציטוט | `quote` | textarea | |
| טקסט הזמנה | `invitation_text` | textarea | |

#### Section 2: תאריך ומיקום (Date & Venue)
| Field | Key | Type | Notes |
|---|---|---|---|
| תאריך (תצוגה) | `date_display` | text | e.g. "ה-10.05" |
| תאריך עברי | `date_hebrew` | text | e.g. "ה-10 במאי" |
| יום בשבוע | `day_of_week` | text | e.g. "שלישי" |
| שם מקום | `venue_name` | text | |
| כתובת | `venue_address` | textarea | Short, 2-3 lines |
| כתובת מלאה | `venue_address_full` | text | For Maps API |
| שאילתת מפות | `venue_maps_query` | text | Google Maps query |

#### Section 3: לוז האירוע (Event Schedule)
Dynamic list — each row has:
- **שעה** (time input, e.g. "19:00")
- **אירוע** (text input, e.g. "קבלת פנים")
- **אייקון** (dropdown: food/marry/dance)
- **×** button to remove the row

"+ הוסף פריט" button to add a new schedule item. Items are rendered in order.

Available icons: `food` (אוכל), `marry` (טקס), `dance` (ריקודים).

#### Section 4: הגעה ותחבורה (Transport)
| Field | Key | Type | Notes |
|---|---|---|---|
| קישור Waze | `waze_link` | text | URL |
| קו רכבת | `train_line` | text | |
| תחנת רכבת | `train_station` | text | |
| דקות הליכה מרכבת | `train_walk_minutes` | number | |
| חניון | `parking_lot` | text | |
| דקות הליכה מחניון | `parking_walk_minutes` | number | |

#### Section 5: סיום (Footer)
| Field | Key | Type | Notes |
|---|---|---|---|
| הערה תחתונה | `footer_note` | textarea | |
| הודעת סיום | `closing_message` | textarea | Bold display on page |

### 5. WhatsApp Templates — NOT in Settings

WhatsApp templates are already editable via the Timeline's `StageEditModal`. No need to duplicate them here. The settings screen focuses on invitation content only.

### 6. Save Strategy

- Single "שמור" (Save) button at the bottom of the form
- On save: PATCH `events.content_config` via a single Supabase update (merge draft into existing JSONB)
- Toast confirmation on success
- No auto-save (explicit user action to prevent accidental changes)
- Dirty-state tracking: warn if navigating away with unsaved changes

### 7. Data Flow

```
DashboardSettings
  ├── useEvent('hagit-and-itai')  → loads event + content_config
  ├── Local draft state (useState) ← form edits
  ├── FormSections (right pane)
  │     └── edits update draft state
  └── LivePreview (left pane)
        └── renders Template(draft content_config)
```

On save: `supabase.from('events').update({ content_config: mergedConfig }).eq('id', eventId)`

### 8. New Files

- `src/pages/DashboardSettings.tsx` — Main settings page with form + preview layout
- `src/components/dashboard/LivePreview.tsx` — Phone frame wrapper that renders the template at scale
