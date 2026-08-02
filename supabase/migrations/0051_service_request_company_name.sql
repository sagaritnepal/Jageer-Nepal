-- A reseller booking a service on behalf of a company/office (not a
-- personal residence) needs somewhere to record which company it's for -
-- separate from "contact person," which is about who to reach on-site, not
-- who the job is billed/attributed to.

alter table service_requests add column if not exists company_name text;
