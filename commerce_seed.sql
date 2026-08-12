CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  sku TEXT,
  excerpt TEXT,
  description TEXT,
  category TEXT,
  material TEXT,
  size TEXT,
  image_url TEXT,
  price_cents INTEGER DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  inventory INTEGER DEFAULT 0,
  status TEXT DEFAULT 'draft',
  allow_checkout INTEGER DEFAULT 0,
  created_at INTEGER,
  updated_at INTEGER
);

INSERT INTO products (id, slug, name, sku, excerpt, description, category, material, size, image_url, price_cents, currency, inventory, status, allow_checkout, created_at, updated_at)
VALUES
('starter-hex-bolts', 'stainless-hex-bolts', 'Stainless Steel Hex Bolts', 'QUOTE-HEX-BOLT', 'Metric stainless hex bolts for repair, assembly, and cross-border procurement.', 'Available by specification. Send diameter, length, grade, surface finish, quantity, and destination country for quotation.', 'Hex bolts and socket screws', 'Stainless steel', 'M3–M24', '', 0, 'USD', 0, 'published', 0, strftime('%s','now'), strftime('%s','now')),
('starter-socket-screws', 'socket-head-cap-screws', 'Socket Head Cap Screws', 'QUOTE-SOCKET-CAP', 'Socket head cap screws for machinery, fixtures, and OEM builds.', 'Available in multiple metric sizes and material grades. Pricing depends on quantity, packaging, and export destination.', 'Hex bolts and socket screws', 'Alloy / stainless', 'M2–M20', '', 0, 'USD', 0, 'published', 0, strftime('%s','now'), strftime('%s','now')),
('starter-washers-nuts', 'nuts-and-washers-bundle', 'Nuts and Washers Bundle', 'QUOTE-NUT-WASHER', 'Hex nuts, lock nuts, flat washers, and spring washers for bundled sourcing.', 'Useful for buyers who need matching nuts and washers together with bolts or screws. Send BOM or drawings for matching support.', 'Nuts, washers, and threaded inserts', 'Carbon steel / stainless', 'Metric assorted', '', 0, 'USD', 0, 'published', 0, strftime('%s','now'), strftime('%s','now')),
('starter-industrial-accessories', 'industrial-hardware-accessories', 'Industrial Hardware Accessories', 'QUOTE-HARDWARE', 'Brackets, clips, anchors, pins, rivets, and complementary hardware.', 'Cross-border sourcing for industrial accessory bundles. Best suited for small-batch procurement and distributor requests.', 'Industrial accessories', 'Mixed', 'By specification', '', 0, 'USD', 0, 'published', 0, strftime('%s','now'), strftime('%s','now'))
ON CONFLICT(id) DO UPDATE SET
  slug=excluded.slug,
  name=excluded.name,
  sku=excluded.sku,
  excerpt=excluded.excerpt,
  description=excluded.description,
  category=excluded.category,
  material=excluded.material,
  size=excluded.size,
  updated_at=strftime('%s','now');

