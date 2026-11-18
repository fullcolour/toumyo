-- Optional seed for a fresh, empty test database. Production data lives in D1; do not run this against production.
-- The worker creates and migrates tables automatically; this only adds the online-orderable diagnostic service.
INSERT OR IGNORE INTO products (id, slug, name, sku, excerpt, description, category, price_cents, currency, inventory, status, allow_checkout, created_at, updated_at)
VALUES ('service-content-growth-audit', 'ewe', 'Website and system diagnostic', 'WEB-AUDIT', 'Review of an existing website or business system with prioritized improvements.', 'Full copy is built into the worker (TOUMYOU_SERVICE_PRODUCTS).', 'Diagnostic', 100000, 'JPY', 999, 'published', 1, strftime('%s','now'), strftime('%s','now'));
