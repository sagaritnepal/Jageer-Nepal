-- Companion phone number for contact_person_name (0041) - needed whenever the
-- contact person differs from the customer/company itself.
alter table customers add column if not exists contact_person_phone text;
alter table service_requests add column if not exists contact_person_phone text;
