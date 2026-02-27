# Guest Upload Feature — Design Document

**Date:** 2026-02-27
**Status:** Approved

## Goal

Allow the couple to bulk-upload their guest list via an Excel file. A popup guides them through downloading a pre-filled template, filling it in, and uploading it back. The system validates the data, shows a summary with errors, and upserts into the `invitations` table.

## Design Decisions

### 1. Upload Flow (Modal-Based)

A new "ייבוא" (Import) button in the Dashboard header opens a multi-step modal:
- **Step 1 — Instructions:** Explanation text + "הורד תבנית" (Download Template) button
- **Step 2 — Upload:** File drop zone + file input, user uploads their filled Excel
- **Step 3 — Validation Results:** Summary showing success/error counts, list of invalid rows with reasons

### 2. Excel Template

Downloaded `.xlsx` file with a single sheet containing:
- Header row with Hebrew column names
- An instructions row (row 2) in gray text explaining each column
- Columns: שם קבוצה | טלפון 1 | טלפון 2 | כמות מוזמנים | צד | קבוצה | שליחה אוטומטית

### 3. Upsert Strategy

- **Key:** Primary phone number (`phone_numbers[0]`) normalized to `972XXXXXXXXX` format
- **Match:** If an existing invitation has the same `phone_numbers[0]` and `event_id` → UPDATE
- **No match:** INSERT new row
- **Preserved on update:** `rsvp_status`, `confirmed_pax`, `messages_sent_count`, `last_message_sent_at` — never overwritten by upload

### 4. Validation (Server-Side via Edge Function)

- Phone format: 9-10 digits, Israeli format (05X...)
- Required fields: `group_name`, phone 1, `invited_pax` (>= 1)
- Optional: phone 2, side, guest_group, is_automated
- Returns per-row errors with group_name for user-friendly display

### 5. Library Choice

- `xlsx` (SheetJS) for Excel generation and parsing — mature, works client-side, supports Hebrew RTL
- `file-saver` for triggering the template download

### 6. Phone Format in Template

Two separate columns: "טלפון 1" (required) and "טלפון 2" (optional). Instructions note: "ניתן להוסיף טלפונים נוספים דרך מסך העריכה לאחר העלאה"
