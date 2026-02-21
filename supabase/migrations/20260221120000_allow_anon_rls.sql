CREATE POLICY "Allow anon insert" ON arrival_permits FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update" ON arrival_permits FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon select" ON arrival_permits FOR SELECT TO anon USING (true);
