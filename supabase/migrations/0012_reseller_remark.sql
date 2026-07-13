-- Replaces the live chat thread on a service request with a single remark
-- field the reseller fills in after calling the customer and confirming
-- exactly what's wrong - this is what the technician actually reads to
-- know what they're walking into, since a client's own description is
-- often vague.

alter table service_requests add column if not exists remark text;
