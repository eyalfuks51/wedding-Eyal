# Project Context: Wedding RSVP Platform
**Current Stack:** React frontend, Supabase backend.
**Current Phase:** Migrating a single-tenant React project to a new Supabase project and fixing broken integrations.

**Database Schema (Table: arrival_permits):**
- `id` (int8, primary key)
- `created_at` (timestamptz)
- `full_name` (text)
- `phone` (text) -> **Needs to be set as UNIQUE for upsert logic.**
- `attending` (bool)
- `needs_parking` (bool)
- `guests_count` (int2)
- `updated_at` (timestamptz)

**Current Issues to Solve:**
1. **Supabase RLS Policies:** Data insertion is failing, likely due to Row Level Security. The app needs to allow unauthenticated (public) users to submit their RSVP. If a user submits again with the same phone number, it should UPDATE the existing row (Upsert) rather than fail or create a duplicate.
2. **Google Sheets Sync:** The previous setup synced data to a Google Sheet and updated existing rows based on the phone number. I need to recreate this pipeline. 

**Task:** Please provide the SQL commands to configure the correct RLS policies for public insert/upsert. Then, guide me on the best way to implement the Google Sheets sync directly from Supabase (e.g., using a Database Webhook triggering a Google Apps Script, or a Supabase Edge Function).

**Attached Code Context:**
I have provided the relevant React codebase. Please analyze the components (especially the RSVP form and Supabase client calls). 
Based on how the code currently sends data to Supabase (insert vs. upsert), help me write the exact SQL policies for RLS to allow unauthenticated users to submit and update their RSVP.