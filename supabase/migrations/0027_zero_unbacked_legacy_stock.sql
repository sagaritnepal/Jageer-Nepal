-- Three pre-catalog reseller listings had stock with no wholesale purchase
-- behind them (catalog_id null, purchased_stock 0) - no traceability back to
-- a wholesaler, which matters for warranty claims. Take them off the market
-- without deleting the rows; re-enable once properly linked to a purchase.
update products
set stock_level = 0
where catalog_id is null and purchased_stock = 0 and stock_level > 0;
