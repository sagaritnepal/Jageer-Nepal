-- Chat threads (order and job messages) subscribe to realtime, but the
-- messages table was never added to the publication - so a thread only ever
-- updated on a fresh page load and a message you sent looked like it had
-- vanished. Publishing the table makes the other side's replies arrive live
-- the way the code already expects.
alter publication supabase_realtime add table public.messages;
