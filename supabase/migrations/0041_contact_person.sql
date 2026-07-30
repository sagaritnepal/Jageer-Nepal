-- Allow a saved customer (which may be a company) to have a distinct point
-- of contact from the customer/company name itself.
alter table customers add column if not exists contact_person_name text;
alter table service_requests add column if not exists contact_person_name text;
