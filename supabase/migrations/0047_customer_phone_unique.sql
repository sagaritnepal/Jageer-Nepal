-- A customer's phone number is how a reseller/wholesaler tells two
-- similarly-named customers apart, so it should never be reused for two
-- different customers under the same owner. Phone stays optional (most
-- existing customers don't have one saved) - this only blocks a second,
-- different customer being saved with a phone number already in use.
-- NULL/empty phones are unaffected: a unique index treats every NULL as
-- distinct, so any number of customers can still have no phone at all.

create unique index if not exists customers_owner_phone_idx
  on customers (owner_id, phone)
  where phone is not null and phone <> '';
