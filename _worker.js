const SITE = {
  name: "Toumyou",
  url: "https://toumyou.com",
  description:
    "Toumyou LLC supplies fasteners, hardware, and industrial accessories for cross-border buyers from Japan and Asia.",
};

const SHOP = {
  name: "Toumyou Fastener Supply",
  description:
    "Cross-border fastener and industrial accessory supply from Japan and Asia for distributors, workshops, OEM teams, and small-batch buyers.",
  categories: [
    {
      name: "Hex bolts and socket screws",
      slug: "hex-bolts-socket-screws",
      summary: "Metric bolts, socket head cap screws, set screws, and machine screws for assembly, repair, and OEM projects.",
    },
    {
      name: "Nuts, washers, and threaded inserts",
      slug: "nuts-washers-inserts",
      summary: "Hex nuts, lock nuts, flat washers, spring washers, inserts, and related threaded components.",
    },
    {
      name: "Stainless, alloy, and specialty parts",
      slug: "stainless-alloy-specialty",
      summary: "Corrosion-resistant stainless parts, high-strength alloy fasteners, custom finishes, and hard-to-source specifications.",
    },
    {
      name: "Industrial accessories",
      slug: "industrial-accessories",
      summary: "Brackets, clips, anchors, pins, rivets, tools, and complementary hardware for procurement bundles.",
    },
  ],
};

const TENANTS = {
  toumyou: {
    key: "toumyou",
    lang: "en",
    name: "Toumyou",
    legalName: "Toumyou LLC",
    brand: "TOUMYOU",
    url: "https://toumyou.com",
    email: "sunflyerjp@gmail.com",
    phone: "+81 070 1846 1357",
    telHref: "+8107018461357",
    addressHtml: "2-1-35 Sugimoto, Sumiyoshi-ku<br>Osaka City, Japan",
    footer: "Cross-border fastener supply and practical procurement support from Japan.",
    showDigital: true,
    tawkSrc: "https://embed.tawk.to/6a7deb5d9b88671d449028d5/1jvttupc1",
  },
  ximiaokeji: {
    key: "ximiaokeji",
    lang: "zh-CN",
    name: "西缈科技",
    legalName: "上海西缈科技有限公司",
    brand: "西缈科技",
    url: "https://ximiaokeji.com",
    email: "hello@ximiaokeji.com",
    phone: "18616626832",
    telHref: "+8618616626832",
    addressHtml: "上海西缈科技有限公司",
    footer: "专注紧固件销售、工业配件供应与企业采购支持。",
    showDigital: false,
    tawkSrc: "https://embed.tawk.to/6a7deb5d9b88671d449028d5/1jvttupc1",
  },
};

function tenantFromRequest(request) {
  const host = new URL(request.url).hostname.toLowerCase();
  return host === "ximiaokeji.com" || host.endsWith(".ximiaokeji.com") ? TENANTS.ximiaokeji : TENANTS.toumyou;
}

const encoder = new TextEncoder();

function html(body, init = {}) {
  return new Response(body, {
    status: init.status || 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": init.cache || "no-store, no-cache, must-revalidate",
      "cdn-cache-control": "no-store",
      "cloudflare-cdn-cache-control": "no-store",
      ...init.headers,
    },
  });
}

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    status: init.status || 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...init.headers,
    },
  });
}

function redirect(location, status = 302, headers = {}) {
  const h = new Headers(headers);
  h.set("location", location);
  return new Response(null, { status, headers: h });
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function truncate(value = "", max = 1200) {
  const text = String(value || "").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function supportPageUrl(request, value = "") {
  const tenant = request?.url ? tenantFromRequest(request) : TENANTS.toumyou;
  const fallback = request?.headers ? request.headers.get("referer") || tenant.url : tenant.url;
  try {
    const url = new URL(String(value || fallback || tenant.url), tenant.url);
    if (url.protocol !== "https:" && url.protocol !== "http:") return tenant.url;
    return url.toString();
  } catch {
    return fallback || tenant.url;
  }
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function cookieValue(request, name) {
  const cookie = request.headers.get("cookie") || "";
  const part = cookie.split(";").map((x) => x.trim()).find((x) => x.startsWith(`${name}=`));
  return part ? decodeURIComponent(part.slice(name.length + 1)) : "";
}

async function hmac(secret, value) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function isAuthed(request, env) {
  const token = cookieValue(request, "toumyou_admin");
  if (!token || !env.ADMIN_SESSION_SECRET) return false;
  const [stamp, sig] = token.split(".");
  if (!stamp || !sig) return false;
  if (Date.now() - Number(stamp) > 1000 * 60 * 60 * 24 * 7) return false;
  return (await hmac(env.ADMIN_SESSION_SECRET, stamp)) === sig;
}

async function issueSession(env) {
  const stamp = String(Date.now());
  return `${stamp}.${await hmac(env.ADMIN_SESSION_SECRET, stamp)}`;
}

function randomToken(bytes = 24) {
  const array = new Uint8Array(bytes);
  crypto.getRandomValues(array);
  return [...array].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function customerSecret(env) {
  return env.CUSTOMER_SESSION_SECRET || env.ADMIN_SESSION_SECRET || "";
}

async function issueCustomerSession(env, customerId) {
  const stamp = String(Date.now());
  const value = `${customerId}.${stamp}`;
  return `${value}.${await hmac(customerSecret(env), value)}`;
}

async function currentCustomer(request, env) {
  const token = cookieValue(request, "toumyou_customer");
  const secret = customerSecret(env);
  if (!token || !secret || !env.DB) return null;
  const [customerId, stamp, sig] = token.split(".");
  if (!customerId || !stamp || !sig) return null;
  if (Date.now() - Number(stamp) > 1000 * 60 * 60 * 24 * 30) return null;
  if ((await hmac(secret, `${customerId}.${stamp}`)) !== sig) return null;
  await ensureCommerce(env);
  return await env.DB.prepare("SELECT id,email,name,picture,created_at,updated_at FROM customers WHERE id=?").bind(customerId).first();
}

function customerCookie(token) {
  return `toumyou_customer=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`;
}

async function listPublished(env) {
  const db = env.DB;
  if (!db) return [];
  await ensureContent(env);
  const result = await db
    .prepare("SELECT slug,title,excerpt,category,cover_image,seo_title,seo_description,published_at,updated_at FROM posts WHERE lower(trim(status))='published' ORDER BY published_at DESC, updated_at DESC")
    .all();
  return result.results || [];
}

async function listAll(env) {
  await ensureContent(env);
  const result = await env.DB
    .prepare("SELECT id,slug,title,excerpt,body,category,status,cover_image,seo_title,seo_description,published_at,created_at,updated_at FROM posts ORDER BY updated_at DESC")
    .all();
  return result.results || [];
}

async function getPost(env, slug) {
  await ensureContent(env);
  return await env.DB
    .prepare("SELECT slug,title,excerpt,body,category,status,cover_image,seo_title,seo_description,published_at,updated_at FROM posts WHERE slug=?")
    .bind(slug)
    .first();
}

async function ensureContent(env) {
  if (!env.DB) return;
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS posts (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    excerpt TEXT,
    body TEXT,
    category TEXT,
    status TEXT DEFAULT 'draft',
    cover_image TEXT,
    seo_title TEXT,
    seo_description TEXT,
    published_at INTEGER,
    created_at INTEGER,
    updated_at INTEGER
  )`).run();
  await env.DB.prepare("ALTER TABLE posts ADD COLUMN cover_image TEXT").run().catch(() => {});
  await env.DB.prepare("ALTER TABLE posts ADD COLUMN seo_title TEXT").run().catch(() => {});
  await env.DB.prepare("ALTER TABLE posts ADD COLUMN seo_description TEXT").run().catch(() => {});
}

async function ensureCommerce(env) {
  if (!env.DB) return;
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS products (
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
    image_urls TEXT,
    specs TEXT,
    package_info TEXT,
    lead_time TEXT,
    shipping_note TEXT,
    moq INTEGER DEFAULT 1,
    weight_grams INTEGER DEFAULT 0,
    price_cents INTEGER DEFAULT 0,
    currency TEXT DEFAULT 'JPY',
    inventory INTEGER DEFAULT 0,
    status TEXT DEFAULT 'draft',
    allow_checkout INTEGER DEFAULT 0,
    created_at INTEGER,
    updated_at INTEGER
  )`).run();
  await env.DB.prepare("ALTER TABLE products ADD COLUMN image_urls TEXT").run().catch(() => {});
  await env.DB.prepare("ALTER TABLE products ADD COLUMN specs TEXT").run().catch(() => {});
  await env.DB.prepare("ALTER TABLE products ADD COLUMN package_info TEXT").run().catch(() => {});
  await env.DB.prepare("ALTER TABLE products ADD COLUMN lead_time TEXT").run().catch(() => {});
  await env.DB.prepare("ALTER TABLE products ADD COLUMN shipping_note TEXT").run().catch(() => {});
  await env.DB.prepare("ALTER TABLE products ADD COLUMN moq INTEGER DEFAULT 1").run().catch(() => {});
  await env.DB.prepare("ALTER TABLE products ADD COLUMN weight_grams INTEGER DEFAULT 0").run().catch(() => {});
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    stripe_session_id TEXT UNIQUE,
    product_id TEXT,
    product_slug TEXT,
    product_name TEXT,
    sku TEXT,
    quantity INTEGER DEFAULT 1,
    amount_total INTEGER DEFAULT 0,
    currency TEXT DEFAULT 'JPY',
    payment_status TEXT DEFAULT 'pending',
    fulfillment_status TEXT DEFAULT 'new',
    customer_email TEXT,
    customer_name TEXT,
    customer_phone TEXT,
    shipping_name TEXT,
    shipping_address TEXT,
    shipping_country TEXT,
    stripe_payment_intent TEXT,
    customer_id TEXT,
    raw_event TEXT,
    notes TEXT,
    created_at INTEGER,
    updated_at INTEGER
  )`).run();
  await env.DB.prepare("ALTER TABLE orders ADD COLUMN customer_id TEXT").run().catch(() => {});
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS inquiries (
    id TEXT PRIMARY KEY,
    product_id TEXT,
    product_slug TEXT,
    product_name TEXT,
    name TEXT,
    email TEXT,
    company TEXT,
    country TEXT,
    quantity TEXT,
    specs TEXT,
    message TEXT,
    status TEXT DEFAULT 'new',
    created_at INTEGER,
    updated_at INTEGER
  )`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS support_messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT,
    sender TEXT DEFAULT 'customer',
    page_url TEXT,
    name TEXT,
    email TEXT,
    company TEXT,
    message TEXT,
    status TEXT DEFAULT 'new',
    forwarded_discord INTEGER DEFAULT 0,
    forwarded_telegram INTEGER DEFAULT 0,
    created_at INTEGER,
    updated_at INTEGER
  )`).run();
  await env.DB.prepare("ALTER TABLE support_messages ADD COLUMN conversation_id TEXT").run().catch(() => {});
  await env.DB.prepare("ALTER TABLE support_messages ADD COLUMN sender TEXT DEFAULT 'customer'").run().catch(() => {});
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    google_sub TEXT UNIQUE,
    email TEXT UNIQUE,
    name TEXT,
    picture TEXT,
    created_at INTEGER,
    updated_at INTEGER
  )`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS cart_items (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    created_at INTEGER,
    updated_at INTEGER,
    UNIQUE(customer_id, product_id)
  )`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS site_settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at INTEGER
  )`).run();
}

function normalizeProduct(p = {}, id = crypto.randomUUID()) {
  const name = String(p.name || "Untitled product").trim();
  const slug = slugify(p.slug || name || id);
  const priceCents = Math.max(0, Number.parseInt(p.price_cents ?? p.priceCents ?? 0, 10) || 0);
  const inventory = Math.max(0, Number.parseInt(p.inventory ?? 0, 10) || 0);
  const moq = Math.max(1, Number.parseInt(p.moq ?? 1, 10) || 1);
  const weightGrams = Math.max(0, Number.parseInt(p.weight_grams ?? p.weightGrams ?? 0, 10) || 0);
  return {
    id,
    slug,
    name,
    sku: String(p.sku || "").trim(),
    excerpt: String(p.excerpt || "").trim(),
    description: String(p.description || "").trim(),
    category: String(p.category || "Fasteners").trim(),
    material: String(p.material || "").trim(),
    size: String(p.size || "").trim(),
    image_url: String(p.image_url || p.imageUrl || "").trim(),
    image_urls: String(p.image_urls || p.imageUrls || "").trim(),
    specs: String(p.specs || "").trim(),
    package_info: String(p.package_info || p.packageInfo || "").trim(),
    lead_time: String(p.lead_time || p.leadTime || "").trim(),
    shipping_note: String(p.shipping_note || p.shippingNote || "").trim(),
    moq,
    weight_grams: weightGrams,
    price_cents: priceCents,
    currency: String(p.currency || "JPY").trim().toUpperCase().slice(0, 3) || "JPY",
    inventory,
    status: p.status === "published" ? "published" : "draft",
    allow_checkout: p.allow_checkout || p.allowCheckout ? 1 : 0,
  };
}

const ZERO_DECIMAL_CURRENCIES = new Set([
  "BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA", "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF",
]);

function currencyScale(currency = "USD") {
  return ZERO_DECIMAL_CURRENCIES.has(String(currency || "USD").toUpperCase()) ? 1 : 100;
}

function minorToDisplay(amount = 0, currency = "USD") {
  return (Number(amount) || 0) / currencyScale(currency);
}

function parsePublishDate(value, fallback = null) {
  const text = String(value || "").trim();
  if (!text) return fallback;
  const stamp = Date.parse(`${text}T00:00:00Z`);
  return Number.isFinite(stamp) ? Math.floor(stamp / 1000) : fallback;
}

function money(amount = 0, currency = "USD") {
  const value = minorToDisplay(amount, currency);
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency: currency || "USD" }).format(value);
  } catch {
    return `${currency || "USD"} ${value.toFixed(currencyScale(currency) === 1 ? 0 : 2)}`;
  }
}

function productImages(product = {}) {
  const urls = [
    product.image_url,
    ...String(product.image_urls || "")
      .split(/\r?\n|,/)
      .map((x) => x.trim()),
  ].filter(Boolean);
  return [...new Set(urls)].slice(0, 12);
}

async function listProducts(env, { admin = false } = {}) {
  await ensureCommerce(env);
  if (!env.DB) return [];
  const sql = admin
    ? "SELECT * FROM products ORDER BY updated_at DESC"
    : "SELECT * FROM products WHERE lower(trim(status))='published' ORDER BY updated_at DESC";
  const result = await env.DB.prepare(sql).all();
  return result.results || [];
}

async function getProduct(env, slugOrId) {
  await ensureCommerce(env);
  if (!env.DB) return null;
  return await env.DB.prepare("SELECT * FROM products WHERE slug=? OR id=?").bind(slugOrId, slugOrId).first();
}

async function upsertProductSnapshot(env, product = {}) {
  if (!env.DB || !product?.id) return;
  await ensureCommerce(env);
  const p = normalizeProduct(product, product.id);
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare("INSERT INTO products (id,slug,name,sku,excerpt,description,category,material,size,image_url,image_urls,specs,package_info,lead_time,shipping_note,moq,weight_grams,price_cents,currency,inventory,status,allow_checkout,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET slug=excluded.slug,name=excluded.name,sku=excluded.sku,excerpt=excluded.excerpt,description=excluded.description,category=excluded.category,material=excluded.material,size=excluded.size,image_url=excluded.image_url,image_urls=excluded.image_urls,specs=excluded.specs,package_info=excluded.package_info,lead_time=excluded.lead_time,shipping_note=excluded.shipping_note,moq=excluded.moq,weight_grams=excluded.weight_grams,price_cents=excluded.price_cents,currency=excluded.currency,inventory=excluded.inventory,status=excluded.status,allow_checkout=excluded.allow_checkout,updated_at=excluded.updated_at")
    .bind(p.id, p.slug, p.name, p.sku, p.excerpt, p.description, p.category, p.material, p.size, p.image_url, p.image_urls, p.specs, p.package_info, p.lead_time, p.shipping_note, p.moq, p.weight_grams, p.price_cents, p.currency, p.inventory, p.status, p.allow_checkout, now, now).run();
}

async function listOrders(env) {
  await ensureCommerce(env);
  if (!env.DB) return [];
  const result = await env.DB.prepare("SELECT * FROM orders ORDER BY created_at DESC, updated_at DESC").all();
  return result.results || [];
}

async function listCustomers(env) {
  await ensureCommerce(env);
  if (!env.DB) return [];
  const result = await env.DB.prepare(`SELECT customers.*, COUNT(orders.id) AS order_count, COALESCE(SUM(CASE WHEN lower(orders.payment_status)='paid' THEN orders.amount_total ELSE 0 END),0) AS paid_total
    FROM customers LEFT JOIN orders ON orders.customer_id=customers.id OR lower(orders.customer_email)=lower(customers.email)
    GROUP BY customers.id ORDER BY customers.updated_at DESC`).all();
  return result.results || [];
}

async function getSiteSettings(env, tenant = TENANTS.toumyou) {
  await ensureCommerce(env);
  const defaults = {
    cms_mode: "lightweight_d1_r2",
    cms_notes: tenant.lang === "zh-CN"
      ? "当前生产后台使用 Cloudflare D1 管理文章、商品、订单、客户与设置，使用 R2 管理图片媒体库。Payload 已暂缓，避免 Workers 免费版体积限制影响部署。"
      : "Production CMS uses Cloudflare D1 for articles, products, orders, customers, and settings, with R2 as the media library. Payload is deferred to avoid Workers Free bundle-size limits.",
    b2b_shipping_default: tenant.lang === "zh-CN" ? "运费、交期、关税根据数量和目的地确认。" : "Freight, lead time, duties, and import taxes are confirmed by quantity and destination.",
  };
  const result = await env.DB.prepare("SELECT key,value FROM site_settings").all().catch(() => ({ results: [] }));
  for (const row of result.results || []) defaults[row.key] = row.value || "";
  return defaults;
}

async function saveSiteSettings(env, values = {}) {
  await ensureCommerce(env);
  const allowed = ["cms_notes", "b2b_shipping_default"];
  const now = Math.floor(Date.now() / 1000);
  for (const key of allowed) {
    if (!(key in values)) continue;
    await env.DB.prepare("INSERT INTO site_settings (key,value,updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at")
      .bind(key, String(values[key] ?? "").slice(0, 2000), now).run();
  }
  return getSiteSettings(env);
}

async function listInquiries(env) {
  await ensureCommerce(env);
  if (!env.DB) return [];
  const result = await env.DB.prepare("SELECT * FROM inquiries ORDER BY created_at DESC").all();
  return result.results || [];
}

async function listSupportMessages(env) {
  await ensureCommerce(env);
  if (!env.DB) return [];
  const result = await env.DB.prepare("SELECT *, COALESCE(conversation_id,id) AS thread_id FROM support_messages ORDER BY created_at ASC").all();
  const threads = new Map();
  for (const row of result.results || []) {
    const id = row.thread_id || row.id;
    if (!threads.has(id)) {
      threads.set(id, {
        id,
        page_url: row.page_url || SITE.url,
        name: row.name || "",
        email: row.email || "",
        company: row.company || "",
        status: row.status || "open",
        forwarded_discord: 0,
        forwarded_telegram: 0,
        created_at: row.created_at,
        updated_at: row.updated_at,
        messages: [],
      });
    }
    const thread = threads.get(id);
    thread.page_url = row.page_url || thread.page_url;
    thread.name = row.name || thread.name;
    thread.email = row.email || thread.email;
    thread.company = row.company || thread.company;
    thread.status = row.status || thread.status;
    thread.forwarded_discord = Math.max(Number(thread.forwarded_discord || 0), Number(row.forwarded_discord || 0));
    thread.forwarded_telegram = Math.max(Number(thread.forwarded_telegram || 0), Number(row.forwarded_telegram || 0));
    thread.created_at = Math.min(Number(thread.created_at || row.created_at || 0), Number(row.created_at || thread.created_at || 0));
    thread.updated_at = Math.max(Number(thread.updated_at || 0), Number(row.updated_at || row.created_at || 0));
    thread.messages.push({
      id: row.id,
      sender: row.sender || "customer",
      message: row.message || "",
      created_at: row.created_at,
    });
  }
  return [...threads.values()].sort((a, b) => Number(b.updated_at || 0) - Number(a.updated_at || 0));
}

async function getSupportConversation(env, conversationId) {
  await ensureCommerce(env);
  if (!env.DB || !conversationId) return null;
  const result = await env.DB.prepare("SELECT *, COALESCE(conversation_id,id) AS thread_id FROM support_messages WHERE conversation_id=? OR id=? ORDER BY created_at ASC")
    .bind(conversationId, conversationId).all();
  const rows = result.results || [];
  if (!rows.length) return null;
  const first = rows[0];
  const last = rows[rows.length - 1];
  return {
    id: conversationId,
    page_url: last.page_url || first.page_url || SITE.url,
    name: last.name || first.name || "",
    email: last.email || first.email || "",
    company: last.company || first.company || "",
    status: last.status || "open",
    created_at: first.created_at,
    updated_at: last.updated_at || last.created_at,
    messages: rows.map((row) => ({
      id: row.id,
      sender: row.sender || "customer",
      message: row.message || "",
      created_at: row.created_at,
    })),
  };
}

function supportText(payload = {}) {
  return [
    "New Toumyou support message",
    payload.conversation_id ? `Conversation: ${payload.conversation_id}` : "",
    `Page: ${payload.page_url || SITE.url}`,
    `Name: ${payload.name || "Not provided"}`,
    `Email: ${payload.email || "Not provided"}`,
    payload.company ? `Company: ${payload.company}` : "",
    `Reply in support desk: ${SITE.url}/admin/support`,
    "Discord is notification only. Use the support desk to reply to the customer page.",
    "",
    truncate(payload.message || "", 1800),
  ].filter((line) => line !== "").join("\n");
}

async function forwardSupportMessage(env, payload = {}) {
  const result = { discord: false };
  const text = supportText(payload);
  if (env.DISCORD_WEBHOOK_URL) {
    const res = await fetch(env.DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        username: "Toumyou Support",
        content: truncate(text, 1900),
        allowed_mentions: { parse: [] },
      }),
    }).catch(() => null);
    result.discord = Boolean(res && res.ok);
  }
  return result;
}

async function upsertCustomer(env, profile = {}) {
  await ensureCommerce(env);
  const now = Math.floor(Date.now() / 1000);
  const sub = String(profile.sub || "").trim();
  const email = String(profile.email || "").trim().toLowerCase();
  const name = String(profile.name || email || "Customer").trim();
  const picture = String(profile.picture || "").trim();
  if (!sub || !email) throw new Error("Google profile missing sub or email");
  const existing = await env.DB.prepare("SELECT * FROM customers WHERE google_sub=? OR email=?").bind(sub, email).first();
  if (existing) {
    await env.DB.prepare("UPDATE customers SET google_sub=?,email=?,name=?,picture=?,updated_at=? WHERE id=?")
      .bind(sub, email, name, picture, now, existing.id).run();
    return await env.DB.prepare("SELECT * FROM customers WHERE id=?").bind(existing.id).first();
  }
  const id = crypto.randomUUID();
  await env.DB.prepare("INSERT INTO customers (id,google_sub,email,name,picture,created_at,updated_at) VALUES (?,?,?,?,?,?,?)")
    .bind(id, sub, email, name, picture, now, now).run();
  return await env.DB.prepare("SELECT * FROM customers WHERE id=?").bind(id).first();
}

async function listCart(env, customerId) {
  await ensureCommerce(env);
  const result = await env.DB.prepare(`SELECT cart_items.id AS cart_id,cart_items.quantity,products.*
    FROM cart_items JOIN products ON products.id=cart_items.product_id
    WHERE cart_items.customer_id=?
    ORDER BY cart_items.updated_at DESC`).bind(customerId).all();
  return result.results || [];
}

async function listCustomerOrders(env, customer) {
  await ensureCommerce(env);
  if (!customer) return [];
  const result = await env.DB.prepare("SELECT * FROM orders WHERE customer_id=? OR lower(customer_email)=? ORDER BY created_at DESC, updated_at DESC")
    .bind(customer.id, String(customer.email || "").toLowerCase()).all();
  return result.results || [];
}

function formatAddress(address = {}) {
  if (!address || typeof address !== "object") return "";
  return [
    address.line1,
    address.line2,
    address.city,
    address.state,
    address.postal_code,
    address.country,
  ].filter(Boolean).join(", ");
}

function safeJson(value) {
  try {
    return JSON.stringify(value || {});
  } catch {
    return "{}";
  }
}

function mediaContentType(key = "") {
  const lower = String(key).toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  return "application/octet-stream";
}

function safeFileName(name = "image") {
  const ext = (String(name).match(/\.[a-z0-9]{2,8}$/i)?.[0] || "").toLowerCase();
  const base = String(name).replace(/\.[a-z0-9]{2,8}$/i, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "image";
  return `${base}${ext}`;
}

async function mediaFile(request, env, key) {
  const bucket = env.PRODUCT_MEDIA;
  if (!bucket) return new Response("Media bucket is not configured", { status: 503 });
  const object = await bucket.get(key);
  if (!object) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata?.(headers);
  if (!headers.has("content-type")) headers.set("content-type", mediaContentType(key));
  headers.set("etag", object.httpEtag || object.etag || "");
  headers.set("cache-control", "public, max-age=31536000, immutable");
  return new Response(object.body, { headers });
}

async function uploadMedia(request, env) {
  const bucket = env.PRODUCT_MEDIA;
  if (!bucket) return json({ error: "R2 bucket binding PRODUCT_MEDIA is not configured yet" }, { status: 503 });
  const form = await request.formData();
  const files = [...form.getAll("files"), form.get("file")].filter((file) => file && typeof file === "object" && file.name);
  if (!files.length) return json({ error: "No image file received" }, { status: 400 });
  const uploaded = [];
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  for (const file of files.slice(0, 12)) {
    const type = String(file.type || "");
    if (!type.startsWith("image/")) return json({ error: "Only image files are supported" }, { status: 400 });
    if (file.size > 8 * 1024 * 1024) return json({ error: "Each image must be smaller than 8 MB" }, { status: 400 });
    const key = `products/${yyyy}/${mm}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
    await bucket.put(key, file.stream(), {
      httpMetadata: { contentType: type || mediaContentType(file.name) },
      customMetadata: { originalName: String(file.name).slice(0, 180) },
    });
    uploaded.push({ key, url: `/media/${key}`, name: file.name, size: file.size, type });
  }
  return json({ ok: true, files: uploaded });
}

async function listMedia(env, cursor = "") {
  const bucket = env.PRODUCT_MEDIA;
  if (!bucket) return json({ error: "R2 bucket binding PRODUCT_MEDIA is not configured yet" }, { status: 503 });
  const options = { limit: 60 };
  if (cursor) options.cursor = cursor;
  const result = await bucket.list(options);
  const files = (result.objects || []).map((object) => ({
    key: object.key,
    url: `/media/${object.key}`,
    size: object.size || 0,
    uploaded: object.uploaded ? new Date(object.uploaded).toISOString() : "",
    type: mediaContentType(object.key),
  }));
  return json({ ok: true, files, cursor: result.truncated ? result.cursor : "", truncated: Boolean(result.truncated) });
}

async function deleteMedia(env, key) {
  const bucket = env.PRODUCT_MEDIA;
  if (!bucket) return json({ error: "R2 bucket binding PRODUCT_MEDIA is not configured yet" }, { status: 503 });
  if (!key || key.includes("..") || key.startsWith("/") || !key.includes("/")) return json({ error: "Invalid media key" }, { status: 400 });
  await bucket.delete(key);
  return json({ ok: true, key });
}

function shell({ title, description, path = "/", content, schema, image, tenant = TENANTS.toumyou }) {
  const canonical = `${tenant.url}${path}`;
  const absoluteImage = image ? new URL(image, tenant.url).toString() : "";
  const nav = tenant.lang === "zh-CN"
    ? `<a class="nav" href="/#supply">供应</a><a class="nav" href="/shop">产品</a><a class="nav" href="/cart">购物车</a><a class="nav" href="/account">账户</a><a class="nav" href="/articles">文章</a><a class="nav nav-admin" href="/admin">后台</a>`
    : `<a class="nav" href="/#supply">Supply</a><a class="nav" href="/shop">Shop</a><a class="nav" href="/cart">Cart</a><a class="nav" href="/account">Account</a>${tenant.showDigital ? '<a class="nav" href="/digital">Digital</a>' : ""}<a class="nav" href="/articles">Insights</a><a class="nav nav-admin" href="/admin">Admin</a>`;
  return `<!doctype html>
<html lang="${escapeHtml(tenant.lang)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${canonical}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${canonical}">
  ${absoluteImage ? `<meta property="og:image" content="${escapeHtml(absoluteImage)}">` : ""}
  <meta name="twitter:card" content="summary_large_image">
  ${absoluteImage ? `<meta name="twitter:image" content="${escapeHtml(absoluteImage)}">` : ""}
  <style>
    :root{color-scheme:light;--ink:#121417;--paper:#f6f7f8;--panel:#eceff2;--acid:#dce7ff;--accent:#2457ff;--line:#d4d8dd;--muted:#5f6670;--soft:#ffffff;--focus:#2457ff}
    *{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.55 Arial,Helvetica,sans-serif}
    a{color:inherit;text-decoration:none}header{height:76px;padding:0 4vw;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line);position:sticky;top:0;background:rgba(244,241,233,.9);backdrop-filter:blur(18px);z-index:2}
    nav{display:flex;gap:26px;align-items:center}.brand{font-size:21px;font-weight:850;letter-spacing:-1.6px}.brand span{font-size:9px;vertical-align:top;margin-left:2px}.nav{font-size:13px;color:#343630}.nav-admin{border:1px solid var(--ink);padding:8px 12px;border-radius:6px}
    main{overflow:hidden}.hero{min-height:calc(100dvh - 76px);padding:92px 8vw 52px;position:relative;border-bottom:1px solid var(--line);display:grid;align-content:center}
    .hero:after{content:"";position:absolute;right:8vw;top:118px;width:min(34vw,430px);height:min(34vw,430px);background:linear-gradient(135deg,var(--acid),transparent 70%);border-radius:28px;z-index:-1}
    .eyebrow{font-size:11px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;margin:0 0 22px}.hero h1,.section h2,.contact h2,.listing h1,.article h1{font-family:Arial,Helvetica,sans-serif;font-weight:850;letter-spacing:-.055em;line-height:.92;margin:0}
    .hero h1{font-size:clamp(54px,8vw,118px);max-width:920px}.lead{font-size:clamp(18px,2vw,22px);line-height:1.45;max-width:560px;margin:36px 0 30px;color:#303740}
    .btn{position:relative;isolation:isolate;display:inline-flex;align-items:center;justify-content:center;gap:12px;background:var(--ink);color:#fff;border:1px solid var(--ink);border-radius:6px;padding:14px 17px;font-weight:780;line-height:1;white-space:nowrap;cursor:pointer;box-shadow:0 10px 24px rgba(18,20,23,.12);transform:translateY(0);transition:transform .24s cubic-bezier(.16,1,.3,1),box-shadow .24s cubic-bezier(.16,1,.3,1),background .24s cubic-bezier(.16,1,.3,1),border-color .24s cubic-bezier(.16,1,.3,1),color .24s cubic-bezier(.16,1,.3,1)}.btn:before{content:"";position:absolute;inset:1px;border-radius:5px;background:linear-gradient(120deg,transparent 0%,rgba(255,255,255,.22) 45%,transparent 62%);opacity:0;transform:translateX(-28%);transition:opacity .24s cubic-bezier(.16,1,.3,1),transform .5s cubic-bezier(.16,1,.3,1);z-index:-1}.btn:hover{transform:translateY(-2px);box-shadow:0 16px 34px rgba(18,20,23,.16)}.btn:hover:before{opacity:1;transform:translateX(28%)}.btn:active{transform:translateY(1px) scale(.985);box-shadow:0 6px 14px rgba(18,20,23,.13)}.btn.secondary{background:rgba(255,255,255,.42);color:var(--ink);border:1px solid var(--ink);box-shadow:none}.btn.secondary:hover{background:var(--soft);box-shadow:0 12px 26px rgba(18,20,23,.08)}.btn.buy{background:var(--accent);border-color:var(--accent);color:#fff;box-shadow:0 14px 30px rgba(36,87,255,.22)}.btn.buy:hover{box-shadow:0 18px 38px rgba(36,87,255,.26)}
    .toolbar{display:flex;gap:12px;flex-wrap:wrap;margin:18px 0}.hero-note{position:absolute;right:8vw;bottom:38px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#4d5048}
    .section{padding:104px 8vw;border-bottom:1px solid var(--line)}.section h2,.contact h2{font-size:clamp(44px,6.1vw,92px);max-width:850px}.intro-strip{display:grid;grid-template-columns:1.2fr .8fr;gap:9vw;margin-top:46px;align-items:end}.intro-strip p{font-size:20px;line-height:1.55;color:#343630;margin:0;max-width:620px}.intro-strip ul{list-style:none;padding:0;margin:0;display:grid;gap:12px}.intro-strip li{border-top:1px solid var(--line);padding-top:12px;color:var(--muted)}
    .service-grid{display:grid;grid-template-columns:1.3fr 1fr 1fr;gap:0;margin-top:72px;border-top:1px solid var(--ink)}
    .service-grid article{min-height:268px;padding:24px 26px 24px 0;border-right:1px solid var(--line)}.service-grid article+article{padding-left:26px}.service-grid article:last-child{border-right:0}.service-grid span,.meta{font-size:11px;letter-spacing:.8px;text-transform:uppercase;color:var(--muted)}
    h3{font-family:Arial,Helvetica,sans-serif;font-size:29px;letter-spacing:-.04em;line-height:1.08;font-weight:780;margin:54px 0 16px}.service-grid p,.muted{color:var(--muted);max-width:320px}.insights-head{display:flex;justify-content:space-between;align-items:end;gap:24px}.text-link{text-decoration:underline;text-underline-offset:4px;font-size:13px}
    .portfolio-grid{display:grid;grid-template-columns:1.15fr .85fr 1fr;grid-auto-rows:minmax(330px,auto);gap:16px;margin-top:70px}.work-card{position:relative;overflow:hidden;border-radius:10px;background:var(--panel);min-height:330px;display:flex;align-items:flex-end}.work-card.large{grid-row:span 2}.work-card img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:saturate(.82) contrast(1.02)}.work-card:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(23,24,21,.03),rgba(23,24,21,.78))}.work-copy{position:relative;z-index:1;color:#fff;padding:26px}.work-copy span{font-size:11px;text-transform:uppercase;letter-spacing:.9px;color:#d8dccf}.work-copy h3{margin:16px 0 8px;color:#fff}.work-copy p{margin:0;color:#eceee7;max-width:300px}
    .timeline{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:0;margin-top:72px;border-top:1px solid var(--ink)}.timeline article{padding:26px 26px 0 0;min-height:300px;border-right:1px solid var(--line)}.timeline article+article{padding-left:26px}.timeline article:last-child{border-right:0}.timeline img{width:100%;height:135px;object-fit:cover;border-radius:10px;margin-bottom:28px;filter:saturate(.85)}.timeline strong{font-size:13px;text-transform:uppercase;letter-spacing:.8px}.timeline h3{margin:18px 0 12px}.team-panel{margin-top:70px;display:grid;grid-template-columns:.9fr 1.1fr;gap:16px}.team-note{background:var(--ink);color:var(--paper);border-radius:10px;padding:32px;display:flex;flex-direction:column;justify-content:space-between;min-height:420px}.team-note p{font-size:24px;line-height:1.35;margin:0;color:#f2f0e8}.team-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.person{background:var(--panel);border-radius:10px;overflow:hidden}.person img{width:100%;height:260px;object-fit:cover;display:block;filter:saturate(.85)}.person div{padding:20px}.person h3{margin:0 0 8px;font-size:28px}.person p{margin:0;color:var(--muted)}.logo-row{display:flex;gap:24px;flex-wrap:wrap;align-items:center;margin-top:50px}.logo-row img{max-height:44px;max-width:132px;object-fit:contain;filter:grayscale(1) contrast(.95);opacity:.72}
    .article-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin-top:62px}.article-card{min-height:275px;padding:24px;background:var(--panel);display:flex;flex-direction:column;border-radius:6px;transition:transform .2s,background .2s}.article-card:hover{transform:translateY(-3px);background:var(--acid)}.article-cover{width:100%;height:170px;object-fit:cover;border-radius:8px;margin:0 0 18px;background:var(--soft);filter:saturate(.92)}
    .commerce-panel{display:grid;grid-template-columns:1.15fr .85fr;gap:18px;margin-top:50px;align-items:stretch}.commerce-card{background:var(--soft);border:1px solid var(--line);border-radius:10px;padding:26px}.commerce-card strong{display:block;font-size:14px;text-transform:uppercase;letter-spacing:.8px;margin-bottom:12px}.commerce-list{list-style:none;margin:0;padding:0;display:grid;gap:12px}.commerce-list li{border-top:1px solid var(--line);padding-top:12px;color:var(--muted)}.metric-strip{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-top:34px}.metric-strip div{border:1px solid var(--line);border-radius:10px;background:var(--soft);padding:18px}.metric-strip strong{display:block;font-size:28px;line-height:1;letter-spacing:-.04em}.metric-strip span{display:block;margin-top:8px;font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.7px}.shop-filter{display:grid;grid-template-columns:1.3fr .7fr .7fr;gap:12px;margin:34px 0 0}.catalog-first{padding-top:58px}.catalog-first h1{font-family:Arial,Helvetica,sans-serif;font-size:clamp(48px,6.4vw,96px);font-weight:850;letter-spacing:-.055em;line-height:.94;margin:0;max-width:940px}.product-card{position:relative;overflow:hidden;background:var(--soft);border:1px solid var(--line)}.product-card:hover{background:var(--soft);border-color:#aeb6c0}.product-card[hidden]{display:none}.card-tag{position:absolute;top:16px;right:16px;border:1px solid var(--ink);border-radius:999px;padding:7px 10px;background:rgba(255,255,255,.94);font-size:11px;font-weight:850;letter-spacing:.5px;text-transform:uppercase}.card-tag.pay{background:var(--accent);color:#fff;border-color:var(--accent)}.pill-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.pill{border:1px solid var(--line);border-radius:999px;padding:6px 10px;font-size:12px;background:rgba(255,255,255,.82)}.status-badge{display:inline-flex;border:1px solid var(--line);border-radius:999px;padding:6px 10px;font-size:11px;font-weight:850;letter-spacing:.5px;text-transform:uppercase;background:var(--soft)}.status-badge.paid{background:#dff7df;border-color:#3d7d3d}.status-badge.failed,.status-badge.expired{background:#ffe2dc}.status-badge.open,.status-badge.unpaid,.status-badge.checkout_created{background:#fff4bd}.product-buy{display:flex;gap:12px;align-items:end;flex-wrap:wrap}.product-buy input{max-width:130px}.gallery-main{width:100%;max-height:500px;object-fit:cover;border-radius:10px;margin:10px 0 16px;background:var(--panel);transition:opacity .28s cubic-bezier(.16,1,.3,1),transform .28s cubic-bezier(.16,1,.3,1)}.gallery-main.is-swapping{opacity:.62;transform:scale(.992)}.gallery-thumbs{display:grid;grid-template-columns:repeat(auto-fit,minmax(76px,96px));gap:10px;margin:0 0 18px}.gallery-thumb{display:block;width:100%;height:72px;border:1px solid var(--line);border-radius:8px;padding:0;background:var(--soft);overflow:hidden;cursor:pointer;transition:transform .2s cubic-bezier(.16,1,.3,1),border-color .2s cubic-bezier(.16,1,.3,1),box-shadow .2s cubic-bezier(.16,1,.3,1)}.gallery-thumb img{width:100%;height:100%;object-fit:cover;display:block}.gallery-thumb:hover,.gallery-thumb.active{border-color:var(--accent);box-shadow:0 10px 22px rgba(36,87,255,.14);transform:translateY(-2px)}.order-meta{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:14px 0}.order-meta span{display:block;border-top:1px solid var(--line);padding-top:8px;color:var(--muted);font-size:13px}.order-dashboard{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:26px 0}.metric-card{border:1px solid var(--line);border-radius:6px;background:var(--soft);padding:16px}.metric-card strong{display:block;font-size:32px;line-height:1;letter-spacing:-.04em}.metric-card span{display:block;margin-top:6px;color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.7px}.order-filter{display:grid;grid-template-columns:1fr 180px;gap:12px;margin:20px 0}.order-card[hidden]{display:none}
    .article-card h3{margin:34px 0 14px}.article-card p{color:var(--muted)}.article-card b{margin-top:auto;font-size:12px}.empty{margin-top:62px;padding:34px;border-top:1px solid var(--ink)}.empty p{font-family:Georgia,"Times New Roman",serif;font-size:32px;margin:0 0 8px}
    .contact{background:var(--ink);color:var(--paper);padding:104px 8vw;min-height:520px}.contact-grid{display:grid;grid-template-columns:1.15fr .85fr;gap:8vw;align-items:end}.contact-mail{display:block;margin-top:48px;font-size:clamp(20px,2.6vw,36px);border-bottom:1px solid #666960;padding-bottom:13px}.contact-list{list-style:none;margin:0;padding:0;border-top:1px solid #666960}.contact-list li{display:grid;grid-template-columns:90px 1fr;gap:24px;padding:18px 0;border-bottom:1px solid #41433d}.contact-list span{font-size:11px;text-transform:uppercase;letter-spacing:.9px;color:#a9ada2}.address{font-size:13px;line-height:1.7;color:#c5c7be;margin:0}
    footer{padding:24px 4vw;background:var(--ink);color:#c5c7be;display:flex;justify-content:space-between;gap:20px;border-top:1px solid #494b44;font-size:11px}.listing{padding:88px 8vw}.listing h1{font-size:clamp(56px,7vw,108px)}.articles{display:grid;gap:14px}.article-link{display:block;border-top:1px solid var(--line);padding:24px 0}.article-link:hover h3{color:#2b3310}
    .article-page{padding:88px 8vw}.article-page article{max-width:860px}.article h1{font-size:clamp(52px,7.4vw,110px)}.article-dek{font-size:23px;line-height:1.42;max-width:700px;margin:36px 0}.post-body{font-family:Georgia,"Times New Roman",serif;font-size:21px;line-height:1.65;white-space:pre-wrap;max-width:680px}
    input,textarea,select{width:100%;border:1px solid #aaa69c;border-radius:6px;padding:11px 12px;background:var(--soft);color:var(--ink);font:15px Arial,Helvetica,sans-serif}textarea{min-height:150px;line-height:1.45;resize:vertical}label{display:block;margin:14px 0 7px;font-size:12px;font-weight:800;letter-spacing:.3px}.notice{border:1px solid var(--line);padding:18px;border-radius:6px;background:var(--soft)}.support-widget{position:fixed;right:22px;bottom:22px;z-index:20;width:min(390px,calc(100vw - 32px));font-family:Arial,Helvetica,sans-serif}.support-toggle{width:100%;justify-content:space-between;border-radius:999px;padding:14px 18px}.support-panel{display:none;margin-top:10px;border:1px solid var(--line);border-radius:14px;background:rgba(255,255,255,.97);box-shadow:0 20px 60px rgba(18,20,23,.18);padding:16px;backdrop-filter:blur(18px)}.support-widget.open .support-panel{display:block}.support-panel h3{margin:0 0 8px;font-size:24px}.support-panel p{margin:0;color:var(--muted);font-size:13px}.support-panel textarea{min-height:70px}.support-status{font-size:13px;color:#36510d;margin:10px 0 0;font-weight:700}.support-close{background:transparent;border:0;color:var(--muted);font-weight:800;cursor:pointer;padding:0}.support-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px}.support-feed{height:230px;overflow:auto;margin:14px 0;padding:12px;background:var(--paper);border:1px solid var(--line);border-radius:10px;display:flex;flex-direction:column;gap:10px}.support-bubble{max-width:86%;padding:10px 12px;border-radius:12px;background:#fff;border:1px solid var(--line);font-size:14px;line-height:1.42;white-space:pre-wrap}.support-bubble.customer{align-self:flex-end;background:var(--accent);border-color:var(--accent);color:#fff}.support-bubble.agent{align-self:flex-start}.support-bubble.system{align-self:center;background:transparent;border:0;color:var(--muted);font-size:12px;text-align:center}.support-fields{display:grid;grid-template-columns:1fr 1fr;gap:8px}.support-fields input{padding:9px 10px}.support-fields.hidden{display:none}.support-chat-row{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:end}.support-chat-row textarea{min-height:58px}.support-meta-line{font-size:12px;color:var(--muted);margin-top:8px}.support-desk{display:grid;grid-template-columns:minmax(260px,360px) minmax(0,1fr);gap:24px;background:transparent;border:0;padding:0}.support-desk aside,.support-desk section{min-height:680px}.support-thread-list{display:grid;gap:10px;margin-top:14px;max-height:680px;overflow:auto}.support-thread{width:100%;text-align:left;border:1px solid var(--line);background:var(--soft);border-radius:10px;padding:14px;cursor:pointer;color:var(--ink)}.support-thread.active,.support-thread:hover{border-color:var(--accent);box-shadow:0 12px 28px rgba(36,87,255,.1)}.support-thread span{display:flex;justify-content:space-between;gap:10px}.support-thread b{display:block;font-size:15px}.support-thread small,.support-thread em{display:block;color:var(--muted);font-size:11px;font-style:normal}.support-thread p{margin:10px 0 0;color:var(--muted);font-size:13px}.support-conversation-head{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;border-bottom:1px solid var(--line);padding-bottom:18px}.support-conversation-head h2{font-family:Arial,Helvetica,sans-serif;font-size:clamp(34px,4vw,56px);font-weight:850;letter-spacing:-.055em;line-height:.95;margin:0}.desk-feed{height:430px;overflow:auto;border:1px solid var(--line);border-radius:12px;background:var(--paper);padding:18px;margin:18px 0;display:flex;flex-direction:column;gap:12px}.desk-bubble{max-width:76%;border:1px solid var(--line);border-radius:12px;background:#fff;padding:13px 15px}.desk-bubble.agent{align-self:flex-end;background:var(--accent);color:#fff;border-color:var(--accent)}.desk-bubble.customer{align-self:flex-start}.desk-bubble strong{display:block;font-size:12px;margin-bottom:6px}.desk-bubble p{margin:0;white-space:pre-wrap}.desk-bubble small{display:block;margin-top:8px;font-size:11px;opacity:.72}
    .admin-wrap{padding:58px 5vw 90px}.admin-hero{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:24px;align-items:end;margin-bottom:28px;border-bottom:1px solid var(--ink);padding-bottom:28px}.admin-hero h1{font-size:clamp(48px,6vw,88px);letter-spacing:-.06em;margin:0}.admin-tabs{display:flex;gap:10px;flex-wrap:wrap;margin:0 0 32px}.admin-tab{border:1px solid var(--line);background:var(--soft);border-radius:999px;padding:10px 14px;font-size:12px;font-weight:850;letter-spacing:.5px;text-transform:uppercase}.admin-tab.active,.admin-tab:hover{border-color:var(--ink);background:var(--ink);color:var(--paper)}.editor{display:grid;grid-template-columns:minmax(260px,390px) minmax(0,820px);gap:5vw}.editor aside{border-right:1px solid var(--line);padding-right:28px}.admin-list-tools{display:grid;grid-template-columns:1fr 130px;gap:10px;margin:18px 0}.mini-dashboard{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:18px 0}.mini-dashboard div{border:1px solid var(--line);background:var(--soft);border-radius:8px;padding:14px}.mini-dashboard strong{display:block;font-size:26px;letter-spacing:-.04em}.mini-dashboard span{display:block;margin-top:4px;font-size:11px;text-transform:uppercase;letter-spacing:.7px;color:var(--muted)}.admin-list-empty{border-top:1px solid var(--line);padding:20px 0;color:var(--muted)}.admin-thumb-row{display:grid;grid-template-columns:62px 1fr;gap:12px;align-items:center}.admin-thumb{width:62px;height:52px;border-radius:8px;object-fit:cover;background:var(--panel);border:1px solid var(--line)}.admin-preview-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(72px,1fr));gap:10px;margin:12px 0}.image-chip{position:relative;border:1px solid var(--line);border-radius:8px;overflow:hidden;background:var(--soft);min-height:68px}.image-chip img{width:100%;height:74px;object-fit:cover;display:block}.image-chip span{display:block;padding:6px 8px;font-size:10px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.media-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:14px;margin-top:24px}.media-card{border:1px solid var(--line);border-radius:10px;background:var(--soft);overflow:hidden}.media-card img{width:100%;height:154px;object-fit:cover;background:var(--panel);display:block}.media-card div{padding:12px}.media-card code{display:block;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--muted);background:transparent}.media-card .toolbar{margin:12px 0 0}.field-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.editor-actions{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-top:20px}.status{margin:12px 0 0;color:#36510d;font-weight:700}.danger{background:transparent;color:var(--ink);border:1px solid var(--line)}
    :focus-visible{outline:3px solid var(--focus);outline-offset:3px}@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}.btn,.btn:before,.article-card,.gallery-main,.gallery-thumb{transition:none}.btn:hover,.btn:active,.article-card:hover,.gallery-thumb:hover,.gallery-thumb.active{transform:none}}@media(max-width:980px){.portfolio-grid,.timeline,.team-panel,.contact-grid,.intro-strip,.commerce-panel,.metric-strip,.order-dashboard,.mini-dashboard{grid-template-columns:1fr 1fr}.portfolio-grid{grid-auto-rows:minmax(310px,auto)}.work-card.large{grid-row:auto}.timeline article,.timeline article+article{border-right:0;border-bottom:1px solid var(--line);padding:26px 0}.team-grid{grid-template-columns:1fr 1fr}.contact-list{margin-top:34px}.support-desk{grid-template-columns:1fr}.support-desk aside,.support-desk section{min-height:auto}}@media(max-width:760px){header{height:auto;min-height:68px;align-items:flex-start;gap:14px;flex-direction:column;padding:18px 6vw}nav{gap:16px;flex-wrap:wrap}.hero{min-height:620px;padding:82px 7vw 46px}.hero:after{width:88vw;height:88vw;right:-36vw;top:126px}.hero-note{position:static;margin-top:42px}.section,.contact,.listing,.article-page{padding:72px 7vw}.service-grid,.article-grid,.editor,.team-grid,.shop-filter,.order-filter,.commerce-panel,.metric-strip,.order-dashboard,.mini-dashboard,.field-grid,.admin-hero,.admin-list-tools{grid-template-columns:1fr}.service-grid article,.service-grid article+article{border-right:0;border-bottom:1px solid var(--line);min-height:auto;padding:24px 0}.person img{height:310px}.insights-head{display:block}.article-grid{margin-top:40px}.editor aside{border-right:0;border-bottom:1px solid var(--line);padding:0 0 26px}footer{display:block}.contact-mail{word-break:break-word}.contact-list li{grid-template-columns:1fr;gap:6px}.support-widget{right:16px;bottom:16px}.desk-feed{height:360px}.desk-bubble{max-width:92%}}
  </style>
  ${schema ? `<script type="application/ld+json">${JSON.stringify(schema)}</script>` : ""}
</head>
<body>
  <header><a class="brand" href="/">${escapeHtml(tenant.brand)}${tenant.key === "toumyou" ? "<span>®</span>" : ""}</a><nav>${nav}</nav></header>
  ${content}
  <!--Start of Tawk.to Script-->
  <script type="text/javascript">
    var Tawk_API=Tawk_API||{}, Tawk_LoadStart=new Date();
    (function(){
      var s1=document.createElement("script"),s0=document.getElementsByTagName("script")[0];
      s1.async=true;
      s1.src='${escapeHtml(tenant.tawkSrc)}';
      s1.charset='UTF-8';
      s1.setAttribute('crossorigin','*');
      s0.parentNode.insertBefore(s1,s0);
    })();
  </script>
  <!--End of Tawk.to Script-->
  <footer><span>© ${new Date().getFullYear()} ${escapeHtml(tenant.legalName)}</span><span>${escapeHtml(tenant.footer)}</span></footer>
</body>
</html>`;
}

async function home(env, tenant = TENANTS.toumyou) {
  const posts = (await listPublished(env)).slice(0, 3);
  const products = (await listProducts(env)).slice(0, 3);
  if (tenant.key === "ximiaokeji") {
    const categoryCards = SHOP.categories.map((item) => `<article class="article-card"><div class="meta">产品目录 / ${escapeHtml(item.slug)}</div><h3>${escapeHtml(zhCategoryName(item.name))}</h3><p>${escapeHtml(zhCategorySummary(item.summary))}</p><b>询价采购</b></article>`).join("");
    const content = `<main>
      <section id="supply" class="hero">
        <p class="eyebrow">紧固件销售与工业配件供应</p>
        <h1>面向企业采购的<br>紧固件供应服务。</h1>
        <p class="lead">上海西缈科技有限公司经营螺丝、螺栓、螺母、垫圈、锚固件、销钉、铆钉及相关工业配件，支持在线下单、批量询价和非标规格采购沟通。</p>
        <div class="toolbar"><a class="btn" href="/shop">查看产品</a><a class="btn secondary" href="mailto:${escapeHtml(tenant.email)}?subject=${encodeURIComponent("紧固件询价")}">发送询价</a></div>
      </section>
      <section class="section">
        <h2>为采购流程设计，<br>不只是展示产品。</h2>
        <div class="commerce-panel">
          <div class="commerce-card"><strong>主营产品</strong><p>公制螺丝、内六角螺钉、六角螺栓、螺母、平垫、弹垫、锚栓、铆钉、卡扣、支架、特殊材质紧固件及工业配件。</p></div>
          <div class="commerce-card"><strong>采购方式</strong><ul class="commerce-list">
            <li>已上架产品可直接加入购物车或在线购买。</li>
            <li>特殊尺寸、材质、表面处理、图纸件和批量采购可发送询价。</li>
            <li>支持按 SKU、规格、数量和交付要求整理采购清单。</li>
            <li>支付与配送信息会在下单流程中进一步确认。</li>
          </ul></div>
        </div>
        <div class="metric-strip"><div><strong>上海</strong><span>公司主体</span></div><div><strong>B2B</strong><span>企业采购</span></div><div><strong>在线</strong><span>购物车下单</span></div><div><strong>询价</strong><span>批量与非标</span></div></div>
      </section>
      <section class="section">
        <div class="insights-head"><div><p class="eyebrow">产品目录</p><h2>现货产品与<br>可询价规格。</h2></div><a class="text-link" href="/shop">进入产品页</a></div>
        <div class="article-grid">${products.length ? products.map((p) => productCard(p, env, tenant)).join("") : categoryCards}</div>
      </section>
      <section id="insights" class="section">
        <div class="insights-head"><div><p class="eyebrow">文章</p><h2>紧固件知识<br>与采购说明。</h2></div><a class="text-link" href="/articles">查看全部文章</a></div>
        ${posts.length ? `<div class="article-grid">${posts.map((post) => articleLink(post, tenant)).join("")}</div>` : '<div class="empty"><p>文章正在整理中。</p><span class="muted">后台发布后会自动显示在这里。</span></div>'}
      </section>
      <section id="contact" class="contact">
        <div class="contact-grid">
          <div><p class="eyebrow">联系采购</p><h2>发送规格、数量<br>或图纸要求。</h2><a href="mailto:${escapeHtml(tenant.email)}" class="contact-mail">${escapeHtml(tenant.email)}</a></div>
          <ul class="contact-list">
            <li><span>电话</span><a href="tel:${escapeHtml(tenant.telHref)}">${escapeHtml(tenant.phone)}</a></li>
            <li><span>邮箱</span><a href="mailto:${escapeHtml(tenant.email)}">${escapeHtml(tenant.email)}</a></li>
            <li><span>公司</span><p class="address">${escapeHtml(tenant.legalName)}</p></li>
          </ul>
        </div>
      </section>
    </main>`;
    return html(shell({
      title: "上海西缈科技有限公司 | 紧固件销售",
      description: "上海西缈科技有限公司主营紧固件销售和工业配件供应，支持螺丝、螺栓、螺母、垫圈及非标件询价采购。",
      content,
      tenant,
      schema: { "@context": "https://schema.org", "@type": "Organization", name: tenant.legalName, url: tenant.url, email: tenant.email, telephone: tenant.phone, description: "紧固件销售、工业配件供应与企业采购支持。" },
    }));
  }
  const content = `<main>
    <section id="supply" class="hero">
      <p class="eyebrow">Cross-border fastener supply</p>
      <h1>Fasteners for<br>international buyers.</h1>
      <p class="lead">Toumyou supplies screws, bolts, nuts, washers, anchors, pins, and industrial accessories from Japan and Asia, with Stripe Checkout and quote support for custom orders.</p>
      <div class="toolbar"><a class="btn" href="/shop">Shop fasteners</a><a class="btn secondary" href="mailto:sunflyerjp@gmail.com?subject=Fastener%20quote%20request">Request a quote</a></div>
    </section>
    <section class="section">
      <h2>Built for procurement,<br>not impulse shopping.</h2>
      <div class="commerce-panel">
        <div class="commerce-card"><strong>What we supply</strong><p>Metric screws, socket screws, hex bolts, nuts, washers, anchors, rivets, clips, brackets, specialty materials, and hard-to-source industrial parts.</p></div>
        <div class="commerce-card"><strong>How orders work</strong><ul class="commerce-list">
          <li>Buy listed products directly with Stripe Checkout where available.</li>
          <li>Send drawings, standards, sizes, and quantities for quote-only items.</li>
          <li>Choose standard or express freight during checkout for supported SKUs.</li>
          <li>Alipay and other local methods appear when Stripe approves them for the buyer and order.</li>
        </ul>
        </div>
      </div>
      <div class="metric-strip"><div><strong>JP</strong><span>Japan base</span></div><div><strong>B2B</strong><span>Procurement focus</span></div><div><strong>Stripe</strong><span>Secure checkout</span></div><div><strong>Quote</strong><span>Custom sourcing</span></div></div>
    </section>
    <section class="section">
      <div class="insights-head"><div><p class="eyebrow">Featured catalog</p><h2>Ready-to-order<br>and quote-ready SKUs.</h2></div><a class="text-link" href="/shop">Open full shop</a></div>
      <div class="article-grid">${products.length ? products.map((p) => productCard(p, env, tenant)).join("") : SHOP.categories.map((item) => `<article class="article-card"><div class="meta">${escapeHtml(item.slug)}</div><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.summary)}</p><b>Request quote</b></article>`).join("")}</div>
    </section>
    <section id="insights" class="section">
      <div class="insights-head"><div><p class="eyebrow">Articles</p><h2>Updates and<br>procurement notes.</h2></div><a class="text-link" href="/articles">All articles</a></div>
      ${posts.length ? `<div class="article-grid">${posts.map((post) => articleLink(post, tenant)).join("")}</div>` : '<div class="empty"><p>Our first notes are in progress.</p><span class="muted">Published articles will appear here immediately after you save them.</span></div>'}
    </section>
    <section id="contact" class="contact">
      <div class="contact-grid">
        <div><p class="eyebrow">Contact</p><h2>Send your drawing,<br>SKU, or quantity.</h2><a href="mailto:sunflyerjp@gmail.com" class="contact-mail">sunflyerjp@gmail.com</a></div>
        <ul class="contact-list">
          <li><span>Tel</span><a href="tel:+8107018461357">+81 070 1846 1357</a></li>
          <li><span>Email</span><a href="mailto:sunflyerjp@gmail.com">sunflyerjp@gmail.com</a></li>
          <li><span>Address</span><p class="address">2-1-35 Sugimoto, Sumiyoshi-ku<br>Osaka City, Japan</p></li>
        </ul>
      </div>
    </section>
  </main>`;
  return html(shell({
    title: "Toumyou | Fastener supply from Japan",
    description: SITE.description,
    content,
    schema: { "@context": "https://schema.org", "@type": "Organization", name: "Toumyou LLC", url: SITE.url, email: "sunflyerjp@gmail.com", telephone: "+8107018461357", address: { "@type": "PostalAddress", streetAddress: "2-1-35 Sugimoto, Sumiyoshi-ku", addressLocality: "Osaka City", addressCountry: "JP" }, description: SITE.description, sameAs: ["https://toumyou.com"] },
    tenant,
  }));
}

function digitalPage() {
  const asset = "https://4f4b3799.toumyou.pages.dev/assets/img";
  const description = "Toumyou digital services: brand identity, graphic design, websites, animation, WeChat mini-programs, software tools, and AI workflow support.";
  const content = `<main>
    <section class="hero">
      <p class="eyebrow">Digital services archive</p>
      <h1>Design, web,<br>and software work.</h1>
      <p class="lead">Toumyou's original creative and technology services are collected here: visual identity, websites, animation, WeChat mini-programs, lightweight software, and AI-assisted workflow systems.</p>
      <div class="toolbar"><a class="btn" href="mailto:sunflyerjp@gmail.com?subject=Digital%20service%20inquiry">Discuss a project</a><a class="btn secondary" href="/">Back to fasteners</a></div>
    </section>
    <section class="section">
      <p class="eyebrow">Original business content</p>
      <h2>Creative systems<br>for practical operations.</h2>
      <div class="intro-strip">
        <p>The earlier Toumyou site introduced a design-and-development practice. Instead of mixing it into the fastener homepage, those services now live here as a focused secondary business page.</p>
        <ul>
          <li>Brand systems, logo design, graphic design, and printed communication</li>
          <li>Responsive websites, landing pages, and commerce interfaces</li>
          <li>Animation, mini-programs, internal tools, and AI workflow support</li>
        </ul>
      </div>
    </section>
    <section id="portfolio" class="section">
      <h2>Previous work,<br>cleanly organized.</h2>
      <div class="portfolio-grid">
        <article class="work-card large"><img src="${asset}/portfolio/2.jpg" alt="Graphic design work by Toumyou" loading="lazy"><div class="work-copy"><span>Graphic design</span><h3>Identity systems for business communication.</h3><p>Logos, visual rules, printed material, and presentation assets.</p></div></article>
        <article class="work-card"><img src="${asset}/portfolio/3.jpg" alt="Animation work by Toumyou" loading="lazy"><div class="work-copy"><span>Animation</span><h3>Motion assets for product and brand stories.</h3><p>Short-form animation, visual explainers, and campaign material.</p></div></article>
        <article class="work-card"><img src="${asset}/portfolio/4.jpg" alt="WeChat mini-program development by Toumyou" loading="lazy"><div class="work-copy"><span>Mini-programs</span><h3>Focused services inside WeChat.</h3><p>Simple flows for ordering, information, membership, and service access.</p></div></article>
        <article class="work-card"><img src="${asset}/portfolio/5.jpg" alt="Website design by Toumyou" loading="lazy"><div class="work-copy"><span>Websites</span><h3>Clear pages for search and conversion.</h3><p>Responsive web design with fast loading and clean structure.</p></div></article>
        <article class="work-card"><img src="${asset}/portfolio/6.jpg" alt="Software development by Toumyou" loading="lazy"><div class="work-copy"><span>Software</span><h3>Tools for daily operations.</h3><p>Internal systems, lightweight apps, automation, and AI-assisted workflows.</p></div></article>
      </div>
    </section>
    <section id="about" class="section">
      <h2>From design studio<br>to trading operation.</h2>
      <div class="timeline">
        <article><img src="${asset}/about/1.jpg" alt="Toumyou early company history" loading="lazy"><strong>2011</strong><h3>Cultural communication work begins.</h3><p>The team started with brand, design, and communication projects.</p></article>
        <article><img src="${asset}/about/2.jpg" alt="Toumyou digital business development" loading="lazy"><strong>2017</strong><h3>Digital services expand.</h3><p>Web, visual, and online service projects became a core part of the business.</p></article>
        <article><img src="${asset}/about/3.jpg" alt="Toumyou software development transition" loading="lazy"><strong>2023</strong><h3>Software work becomes formal.</h3><p>Custom systems, websites, and workflow tools were added to the service base.</p></article>
        <article><img src="${asset}/about/4.jpg" alt="Toumyou Japan operation" loading="lazy"><strong>2025</strong><h3>Japan-based cross-border work grows.</h3><p>The company now combines supply, commerce, and digital operations from Osaka.</p></article>
      </div>
    </section>
    <section class="contact">
      <div class="contact-grid">
        <div><p class="eyebrow">Digital inquiry</p><h2>Need a clean web,<br>design, or workflow system?</h2><a href="mailto:sunflyerjp@gmail.com?subject=Digital%20service%20inquiry" class="contact-mail">sunflyerjp@gmail.com</a></div>
        <ul class="contact-list">
          <li><span>Services</span><p class="address">Brand identity, websites, animation, mini-programs, internal tools, and AI workflow support.</p></li>
          <li><span>Base</span><p class="address">Osaka City, Japan</p></li>
          <li><span>Main site</span><p class="address"><a href="/">Toumyou fastener supply</a></p></li>
        </ul>
      </div>
    </section>
  </main>`;
  return html(shell({
    title: "Digital Services | Toumyou",
    description,
    path: "/digital",
    content,
    schema: { "@context": "https://schema.org", "@type": "ProfessionalService", name: "Toumyou Digital Services", url: `${SITE.url}/digital`, email: "sunflyerjp@gmail.com", description, parentOrganization: { "@type": "Organization", name: "Toumyou LLC", url: SITE.url } },
  }));
}

function zhCategoryName(name = "") {
  const text = String(name);
  if (/hex|socket/i.test(text)) return "六角螺栓与内六角螺钉";
  if (/nuts|washers|insert/i.test(text)) return "螺母、垫圈与螺纹嵌件";
  if (/stainless|alloy|specialty/i.test(text)) return "不锈钢、合金与特殊规格件";
  if (/industrial/i.test(text)) return "工业配件与五金附件";
  return text || "紧固件产品";
}

function zhCategorySummary(summary = "") {
  const text = String(summary);
  if (/Metric bolts|socket head/i.test(text)) return "公制螺栓、内六角螺钉、紧定螺钉和机螺钉，适用于装配、维修与 OEM 项目。";
  if (/Hex nuts|lock nuts/i.test(text)) return "六角螺母、防松螺母、平垫、弹垫、嵌件及相关螺纹连接件。";
  if (/Corrosion-resistant|stainless/i.test(text)) return "耐腐蚀不锈钢件、高强度合金紧固件、定制表面处理与难找规格。";
  if (/Brackets|clips|anchors/i.test(text)) return "支架、卡扣、锚固件、销钉、铆钉、工具及可合并采购的配套五金。";
  return text || "支持常规规格采购与特殊需求询价。";
}

function articleLink(post, tenant = TENANTS.toumyou) {
  const date = post.published_at ? new Date(post.published_at * 1000).toISOString().slice(0, 10) : "Draft";
  const fallbackCategory = tenant.lang === "zh-CN" ? "文章" : "Insights";
  const cta = tenant.lang === "zh-CN" ? "阅读文章" : "Read article";
  const cover = post.cover_image ? `<img class="article-cover" src="${escapeHtml(post.cover_image)}" alt="${escapeHtml(post.title)}" loading="lazy">` : "";
  return `<a class="article-card" href="/articles/${escapeHtml(post.slug)}">${cover}<div class="meta">${escapeHtml(post.category || fallbackCategory)} / ${date}</div><h3>${escapeHtml(post.title)}</h3><p>${escapeHtml(post.excerpt)}</p><b>${cta}</b></a>`;
}

async function articles(env, tenant = TENANTS.toumyou) {
  const posts = await listPublished(env);
  const zh = tenant.lang === "zh-CN";
  return html(shell({
    title: zh ? "紧固件文章 | 上海西缈科技有限公司" : "Insights | Toumyou",
    description: zh ? "上海西缈科技有限公司发布紧固件产品知识、采购说明和企业采购相关信息。" : "Toumyou updates on fastener supply, cross-border commerce, digital operations, and web systems.",
    path: "/articles",
    content: zh
      ? `<main class="listing"><h1>紧固件知识<br>与采购文章。</h1><p class="lead">这里发布产品规格、材料选择、采购流程、下单说明和工业配件供应相关内容。</p><div class="article-grid">${posts.map((post) => articleLink(post, tenant)).join("") || '<div class="empty"><p>暂无已发布文章。</p><span class="muted">在后台保存发布后，文章会自动显示。</span></div>'}</div></main>`
      : `<main class="listing"><h1>Supply notes<br>and company updates.</h1><p class="lead">Articles on fastener procurement, cross-border commerce, digital systems, and practical operations from Toumyou.</p><div class="article-grid">${posts.map((post) => articleLink(post, tenant)).join("") || '<div class="empty"><p>No published articles yet.</p><span class="muted">Use the editor to publish the first note.</span></div>'}</div></main>`,
    tenant,
  }));
}

async function article(env, slug, tenant = TENANTS.toumyou) {
  const post = await getPost(env, slug);
  const zh = tenant.lang === "zh-CN";
  if (!post || post.status !== "published") return html(shell({ title: zh ? "未找到文章 | 西缈科技" : "Not found | Toumyou", description: zh ? "未找到文章。" : "Article not found.", content: zh ? "<main><h1>未找到文章</h1></main>" : "<main><h1>Article not found</h1></main>", tenant }), { status: 404 });
  const pageTitle = post.seo_title || `${post.title} | ${tenant.name}`;
  const pageDescription = post.seo_description || post.excerpt;
  const cover = post.cover_image ? `<img class="gallery-main" src="${escapeHtml(post.cover_image)}" alt="${escapeHtml(post.title)}" loading="eager">` : "";
  return html(shell({
    title: pageTitle,
    description: pageDescription,
    path: `/articles/${post.slug}`,
    content: `<main class="article-page article"><article><div class="meta">${escapeHtml(post.category || (zh ? "文章" : "Insights"))}</div><h1>${escapeHtml(post.title)}</h1><p class="article-dek">${escapeHtml(post.excerpt)}</p>${cover}<div class="post-body">${escapeHtml(post.body)}</div></article><div class="toolbar"><a class="btn secondary" href="/articles">${zh ? "全部文章" : "All insights"}</a><a class="btn" href="/#contact">${zh ? "联系西缈科技" : "Talk to Toumyou"}</a></div></main>`,
    schema: {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: post.title,
      description: pageDescription,
      image: post.cover_image || undefined,
      datePublished: post.published_at ? new Date(post.published_at * 1000).toISOString() : undefined,
      dateModified: post.updated_at ? new Date(post.updated_at * 1000).toISOString() : undefined,
      author: { "@type": "Organization", name: tenant.legalName },
    },
    image: post.cover_image || undefined,
    tenant,
  }));
}

function productCard(product, env, tenant = TENANTS.toumyou) {
  const zh = tenant.lang === "zh-CN";
  const canCheckout = product.allow_checkout && product.price_cents > 0 && (env.STRIPE_SECRET_KEY || env.STRIPE_RESTRICTED_KEY);
  const price = product.price_cents > 0 ? money(product.price_cents, product.currency) : (zh ? "询价" : "Quote");
  const meta = [product.category, product.material, product.size].filter(Boolean).join(" / ") || (zh ? "紧固件" : "Fastener");
  const moq = Number(product.moq || 1) > 1 ? `, ${zh ? "起订量" : "MOQ"} ${escapeHtml(product.moq)}` : "";
  const minQty = Math.max(1, Number.parseInt(product.moq || 1, 10) || 1);
  const searchText = [product.name, product.sku, product.slug, product.category, product.material, product.size, product.excerpt, product.description, product.specs].filter(Boolean).join(" ").toLowerCase();
  const images = productImages(product);
  const image = images[0]
    ? `<img src="${escapeHtml(images[0])}" alt="${escapeHtml(product.name)}" loading="lazy" style="width:100%;height:190px;object-fit:cover;border-radius:6px;margin-bottom:18px">`
    : "";
  return `<article class="article-card product-card" data-product-card data-search="${escapeHtml(searchText)}" data-category="${escapeHtml(product.category || "")}" data-availability="${canCheckout ? "stock" : "quote"}">
    <span class="card-tag ${canCheckout ? "pay" : ""}">${canCheckout ? (zh ? "可购买" : "Ready to buy") : (zh ? "询价" : "Quote")}</span>
    ${image}
    <div class="meta">${escapeHtml(meta)}</div>
    <h3>${escapeHtml(product.name)}</h3>
    <p>${escapeHtml(product.excerpt || product.description || (zh ? "适用于企业采购的紧固件及工业配件产品。" : "Industrial supply item available for cross-border sourcing."))}</p>
    <p class="muted">SKU: ${escapeHtml(product.sku || product.slug)}<br>${escapeHtml(price)}${moq}${product.inventory ? `, ${zh ? "库存" : "stock"} ${escapeHtml(product.inventory)}` : ""}</p>
    <div class="toolbar" style="margin-top:auto">
      <a class="btn secondary" href="/shop/products/${escapeHtml(product.slug)}">${zh ? "查看详情" : "Details"}</a>
      ${
        canCheckout
          ? `<form method="post" action="/api/cart/add"><input type="hidden" name="product_id" value="${escapeHtml(product.id)}"><input type="hidden" name="quantity" value="${escapeHtml(minQty)}"><button class="btn secondary" type="submit">${zh ? "加入购物车" : "Add to cart"}</button></form><form method="post" action="/api/checkout"><input type="hidden" name="product_id" value="${escapeHtml(product.id)}"><input type="hidden" name="quantity" value="${escapeHtml(minQty)}"><button class="btn buy" type="submit">${zh ? "立即购买" : "Buy now"}</button></form>`
          : `<a class="btn" href="mailto:${escapeHtml(tenant.email)}?subject=${encodeURIComponent(`${zh ? "紧固件询价" : "Quote request"}: ${product.name}`)}">${zh ? "发送询价" : "Request quote"}</a>`
      }
    </div>
  </article>`;
}

async function shopPage(env, tenant = TENANTS.toumyou) {
  const zh = tenant.lang === "zh-CN";
  const medusaUrl = env.MEDUSA_BACKEND_URL || "";
  const checkoutStatus = env.STRIPE_SECRET_KEY || env.STRIPE_RESTRICTED_KEY ? (zh ? "已配置在线支付，可用于支持购买的产品。" : "Secure checkout is available for listed paid products.") : (zh ? "在线支付正在配置中，可先提交询价。" : "Checkout is pending merchant configuration.");
  const products = await listProducts(env);
  const categories = [...new Set(products.map((p) => String(p.category || (zh ? "紧固件" : "Fasteners")).trim()).filter(Boolean))].sort();
  const categoryCards = SHOP.categories
    .map(
      (item) => `<article class="article-card"><div class="meta">${zh ? "产品目录" : "Catalog"} / ${escapeHtml(item.slug)}</div><h3>${escapeHtml(zh ? zhCategoryName(item.name) : item.name)}</h3><p>${escapeHtml(zh ? zhCategorySummary(item.summary) : item.summary)}</p><b>${zh ? "询价采购" : "Request quote"}</b></article>`,
    )
    .join("");
  const content = `<main>
    <section id="catalog" class="section catalog-first">
      <p class="eyebrow">${zh ? "紧固件产品中心" : "International fastener shop"}</p>
      <h1>${zh ? "紧固件、五金件<br>与工业配件供应。" : "Fasteners, hardware,<br>and sourcing support."}</h1>
      <div class="intro-strip">
        <p>${zh ? "浏览已上架 SKU，支持购物车和在线购买；特殊材质、图纸件、批量采购和组合清单可提交询价。" : "Browse live SKUs, pay online when checkout is enabled, or request a quotation for special materials, drawings, bulk quantities, and mixed procurement lists."}</p>
        <ul>
          <li>${zh ? "螺丝、螺栓、螺母、垫圈、锚固件和配套工业五金" : "Metric screws, bolts, nuts, washers, anchors, and accessory parts"}</li>
          <li>${zh ? "适合维修、样品、经销、工程项目和 OEM 采购需求" : "Small-batch supply for repair, prototype, distributor, and OEM needs"}</li>
          <li>${zh ? "支持账户、购物车、订单记录和支付状态查询" : "Stripe Checkout with address collection, freight options, and local payment methods where eligible"}</li>
        </ul>
      </div>
      ${
        products.length
          ? `<div class="shop-filter">
              <input id="shopSearch" type="search" placeholder="${zh ? "按 SKU、规格、材质、标准或表面处理搜索..." : "Search by SKU, size, material, standard, or finish..."}">
              <select id="shopCategory"><option value="">${zh ? "全部分类" : "All categories"}</option>${categories.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("")}</select>
              <select id="shopAvailability"><option value="">${zh ? "全部采购方式" : "All ordering types"}</option><option value="stock">${zh ? "可在线购买" : "Online checkout"}</option><option value="quote">${zh ? "需要询价" : "Quote required"}</option></select>
            </div>
            <p id="shopCount" class="muted" style="max-width:none;margin-top:12px">${products.length} ${zh ? "个产品已上架" : "products listed"}</p>`
          : ""
      }
      <div class="article-grid">${products.length ? products.map((p) => productCard(p, env, tenant)).join("") : categoryCards}</div>
      ${products.length ? "" : `<div class="notice" style="margin-top:24px">${zh ? '暂无已发布产品。可在 <a class="text-link" href="/admin/products">产品后台</a> 发布第一个 SKU。' : 'No live products have been published yet. Use <a class="text-link" href="/admin/products">Product Admin</a> to publish the first SKUs.'}</div>`}
      ${
        products.length
          ? `<script>
              (() => {
                const search = document.getElementById('shopSearch');
                const category = document.getElementById('shopCategory');
                const availability = document.getElementById('shopAvailability');
                const count = document.getElementById('shopCount');
                const cards = [...document.querySelectorAll('[data-product-card]')];
                function applyFilter(){
                  const q = (search?.value || '').trim().toLowerCase();
                  const c = category?.value || '';
                  const a = availability?.value || '';
                  let shown = 0;
                  cards.forEach(card => {
                    const text = card.dataset.search || '';
                    const cat = card.dataset.category || '';
                    const stock = card.dataset.availability === 'stock';
                    const ok = (!q || text.includes(q)) && (!c || cat === c) && (!a || (a === 'stock' ? stock : !stock));
                    card.hidden = !ok;
                    if (ok) shown += 1;
                  });
                  if (count) count.textContent = ${JSON.stringify(zh)} ? (shown + ' / ' + cards.length + ' 个产品') : (shown + ' of ' + cards.length + ' products shown');
                }
                [search, category, availability].forEach(el => el && el.addEventListener('input', applyFilter));
              })();
            </script>`
          : ""
      }
    </section>
    <section class="section">
      <p class="eyebrow">${zh ? "下单与交付" : "Ordering and delivery"}</p>
      <h2>${zh ? "下单前清楚确认<br>规格、数量和交付。" : "Clear terms before<br>you place the order."}</h2>
      <div class="service-grid">
        <article><span>${zh ? "产品信息" : "Product details"}</span><h3>${zh ? "每个可购买 SKU 会显示价格、起订量、库存和规格。" : "Each paid SKU shows price, MOQ, stock, and specifications."}</h3><p>${zh ? "特殊尺寸、材料、表面处理或图纸件，建议先提交询价再确认。" : "For special sizes, materials, coatings, or drawings, send a quote request before payment."}</p></article>
        <article><span>${zh ? "配送" : "Shipping"}</span><h3>${zh ? "订单配送和交付方式会根据地址与产品确认。" : "Standard and express freight are shown at checkout."}</h3><p>${zh ? "如需批量采购或指定物流，可在询价时备注目的地和交期要求。" : "Checkout collects the destination address. Import duties, VAT, and local customs fees are normally paid by the recipient."}</p></article>
        <article><span>${zh ? "支付" : "Payment"}</span><h3>${escapeHtml(checkoutStatus)}</h3><p>${zh ? "支持的支付方式会根据账户配置、币种和订单条件显示；批量采购也可先沟通确认。" : "Stripe may show cards, Alipay, WeChat Pay, Apple Pay, or other methods depending on buyer location, currency, and Stripe eligibility."}</p></article>
      </div>
      <div class="notice" style="margin-top:34px"><strong>${zh ? "采购提示：" : "Shipping note:"}</strong> ${zh ? "请尽量提供规格、材质、表面处理、数量、用途、交付城市和图纸/照片，便于更快确认报价。" : "Standard delivery is normally 7 to 14 business days. Express delivery is normally 3 to 7 business days. The exact charge and estimate are shown by Stripe Checkout before payment."}</div>
    </section>
    <section class="contact">
      <div class="contact-grid">
        <div><p class="eyebrow">${zh ? "开始采购" : "Start procurement"}</p><h2>${zh ? "发送规格、材质<br>和采购数量。" : "Send the size,<br>material and quantity."}</h2><a href="mailto:${escapeHtml(tenant.email)}?subject=${encodeURIComponent(zh ? "紧固件询价" : "Fastener quote request")}" class="contact-mail">${escapeHtml(tenant.email)}</a></div>
        <ul class="contact-list">
          <li><span>${zh ? "范围" : "Examples"}</span><p class="address">${zh ? "螺丝、螺栓、螺母、垫圈、锚固件、销钉、铆钉、卡扣、支架及非标五金件。" : "M3 to M24 screws, stainless bolts, nuts, washers, anchors, pins, rivets, clips, brackets, and custom hardware."}</p></li>
          <li><span>${zh ? "电话" : "Markets"}</span><p class="address">${zh ? `<a href="tel:${escapeHtml(tenant.telHref)}">${escapeHtml(tenant.phone)}</a>` : "Japan, Asia, North America, Europe, and cross-border B2B buyers."}</p></li>
          <li><span>${zh ? "询价信息" : "Quote details"}</span><p class="address">${zh ? "请发送标准、尺寸、材质、表面处理、数量、交付地，以及图纸或参考照片。" : "Send standard, size, material, finish, quantity, destination country, and any drawing or reference photo."}</p></li>
        </ul>
      </div>
    </section>
  </main>`;
  return html(shell({
    title: zh ? "紧固件产品 | 上海西缈科技有限公司" : "Fastener Shop | Toumyou",
    description: zh ? "上海西缈科技有限公司紧固件产品中心，提供螺丝、螺栓、螺母、垫圈和工业配件销售与询价。" : SHOP.description,
    path: "/shop",
    content,
    schema: {
      "@context": "https://schema.org",
      "@type": "Store",
      name: zh ? "上海西缈科技紧固件产品中心" : SHOP.name,
      url: `${tenant.url}/shop`,
      description: zh ? "紧固件、工业五金和配件销售。" : SHOP.description,
      email: tenant.email,
      parentOrganization: { "@type": "Organization", name: tenant.legalName },
      makesOffer: (products.length ? products : SHOP.categories).map((item) => ({
        "@type": "Offer",
        price: item.price_cents ? String(minorToDisplay(item.price_cents, item.currency)) : undefined,
        priceCurrency: item.currency || undefined,
        itemOffered: { "@type": "Product", name: item.name, description: item.summary || item.excerpt },
        availability: item.inventory ? "https://schema.org/InStock" : "https://schema.org/PreOrder",
      })),
    },
    tenant,
  }));
}

async function productPage(env, slug, tenant = TENANTS.toumyou) {
  const zh = tenant.lang === "zh-CN";
  const product = await getProduct(env, slug);
  if (!product || product.status !== "published") {
    return html(shell({ title: zh ? "产品未找到 | 西缈科技" : "Product not found | Toumyou", description: zh ? "产品未找到。" : "Product not found.", content: zh ? "<main><h1>产品未找到</h1></main>" : "<main><h1>Product not found</h1></main>", tenant }), { status: 404 });
  }
  const canCheckout = product.allow_checkout && product.price_cents > 0 && (env.STRIPE_SECRET_KEY || env.STRIPE_RESTRICTED_KEY);
  const images = productImages(product);
  const specs = String(product.specs || "").trim();
  const minQty = Math.max(1, Number.parseInt(product.moq || 1, 10) || 1);
  const maxQty = product.inventory ? Math.max(minQty, Math.min(999, Number.parseInt(product.inventory, 10) || 999)) : 999;
  const specRows = [
    ["SKU", product.sku || product.slug],
    [zh ? "分类" : "Category", product.category || (zh ? "紧固件" : "Fasteners")],
    [zh ? "材质" : "Material", product.material || (zh ? "按订单确认" : "Confirm by order")],
    [zh ? "规格" : "Size", product.size || (zh ? "按订单确认" : "Confirm by order")],
    [zh ? "包装" : "Packaging", product.package_info || (zh ? "标准出口包装，可按订单确认" : "Standard export packaging, confirmed by order")],
    [zh ? "起订量" : "MOQ", product.moq || 1],
    [zh ? "交期" : "Lead time", product.lead_time || (zh ? "常规 7-14 个工作日，急单另行确认" : "Usually 7-14 business days; urgent orders confirmed case by case")],
    [zh ? "重量" : "Weight", product.weight_grams ? `${product.weight_grams} g / ${zh ? "件" : "unit"}` : (zh ? "按订单确认" : "Confirm by order")],
  ];
  const gallery = images.length
    ? `<div class="product-gallery" data-gallery>
        <img class="gallery-main" data-main src="${escapeHtml(images[0])}" alt="${escapeHtml(product.name)}">
        ${
          images.length > 1
            ? `<div class="gallery-thumbs">${images.map((src, index) => `<button class="gallery-thumb ${index === 0 ? "active" : ""}" type="button" data-img="${escapeHtml(src)}" aria-label="View image ${index + 1}"><img src="${escapeHtml(src)}" alt="" loading="lazy"></button>`).join("")}</div>`
            : ""
        }
      </div>
      <script>
        document.querySelectorAll('[data-gallery]').forEach(g=>{const main=g.querySelector('[data-main]');const buttons=[...g.querySelectorAll('[data-img]')];let i=0;const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;function show(next){if(!buttons.length||!main)return;i=next;buttons.forEach((b,idx)=>b.classList.toggle('active',idx===i));main.classList.add('is-swapping');setTimeout(()=>{main.src=buttons[i].dataset.img;main.classList.remove('is-swapping')},reduce?0:120)}buttons.forEach((b,idx)=>b.onclick=()=>show(idx));if(buttons.length>1&&!reduce)setInterval(()=>show((i+1)%buttons.length),4200)});
      </script>`
    : "";
  const content = `<main class="article-page article"><article>
    <div class="meta">${escapeHtml(product.category || (zh ? "紧固件" : "Fasteners"))} / ${escapeHtml(product.sku || product.slug)}</div>
    <h1>${escapeHtml(product.name)}</h1>
    <p class="article-dek">${escapeHtml(product.excerpt || (zh ? "紧固件与工业配件供应产品。" : "Cross-border fastener and industrial accessory supply."))}</p>
    ${gallery}
    <div class="post-body">${escapeHtml(product.description || "")}</div>
    <div class="notice" style="margin-top:34px">
      <p><strong>${zh ? "价格" : "Price"}:</strong> ${escapeHtml(product.price_cents > 0 ? money(product.price_cents, product.currency) : (zh ? "需要询价" : "Quote required"))}</p>
      <p><strong>${zh ? "库存" : "Inventory"}:</strong> ${escapeHtml(product.inventory || (zh ? "请确认库存" : "Confirm availability"))}</p>
      <p><strong>${zh ? "交付" : "Delivery"}:</strong> ${escapeHtml(product.shipping_note || (zh ? "交付方式、周期和运费会根据产品、数量和地址确认；批量采购建议先提交询价。" : "Standard 7 to 14 business days or Express 3 to 7 business days. Freight is calculated in Stripe Checkout; duties and import taxes are normally payable by the recipient."))}</p>
    </div>
    <div class="notice" style="margin-top:18px">
      <h3>${zh ? "规格参数" : "Specifications"}</h3>
      ${specRows.map(([k, v]) => `<p><strong>${escapeHtml(k)}:</strong> ${escapeHtml(v)}</p>`).join("")}
      ${specs ? `<p><strong>${zh ? "详细规格" : "Detailed specs"}:</strong><br>${escapeHtml(specs).replaceAll("\n", "<br>")}</p>` : ""}
    </div>
  </article>
  <div class="toolbar">
    ${
      canCheckout
        ? `<form class="product-buy" method="post" action="/api/cart/add"><input type="hidden" name="product_id" value="${escapeHtml(product.id)}"><div><label>${zh ? "数量" : "Quantity"}</label><input name="quantity" type="number" min="${escapeHtml(minQty)}" max="${escapeHtml(maxQty)}" value="${escapeHtml(minQty)}"></div><button class="btn secondary" type="submit">${zh ? "加入购物车" : "Add to cart"}</button><span class="muted">${zh ? "起订量" : "MOQ"} ${escapeHtml(minQty)}${product.inventory ? `, ${zh ? "当前最多" : "max"} ${escapeHtml(maxQty)}` : ""}</span></form><form class="product-buy" method="post" action="/api/checkout"><input type="hidden" name="product_id" value="${escapeHtml(product.id)}"><input name="quantity" type="hidden" value="${escapeHtml(minQty)}"><button class="btn buy" type="submit">${zh ? "立即购买" : "Buy now"}</button></form>`
        : `<a class="btn" href="mailto:${escapeHtml(tenant.email)}?subject=${encodeURIComponent(`${zh ? "紧固件询价" : "Quote request"}: ${product.name}`)}">${zh ? "发送询价" : "Request quote"}</a>`
    }
    <a class="btn secondary" href="/shop">${zh ? "返回产品页" : "Back to shop"}</a>
  </div></main>`;
  const quoteForm = `<section class="section" style="padding-top:40px"><p class="eyebrow">${zh ? "需要定制询价？" : "Need a custom quote?"}</p><h2>${zh ? "发送数量、图纸<br>或详细规格。" : "Send quantity,<br>drawing or specs."}</h2><div class="notice"><form id="quoteForm" class="quote-form">
    <input type="hidden" name="product_id" value="${escapeHtml(product.id)}">
    <label>${zh ? "姓名" : "Name"}</label><input name="name" required>
    <label>${zh ? "邮箱" : "Email"}</label><input name="email" type="email" required>
    <label>${zh ? "公司" : "Company"}</label><input name="company">
    <label>${zh ? "地区" : "Country / region"}</label><input name="country">
    <label>${zh ? "数量" : "Quantity"}</label><input name="quantity" placeholder="${zh ? "例如：500 件 / 20 箱" : "Example: 500 pcs / 20 boxes"}">
    <label>${zh ? "规格" : "Specifications"}</label><textarea name="specs" placeholder="${zh ? "材质、尺寸、标准、表面处理、图纸链接、包装要求..." : "Material, size, standard, finish, drawing link, packaging..."}"></textarea>
    <label>${zh ? "备注" : "Message"}</label><textarea name="message" placeholder="${zh ? "交付城市、目标日期或其他特殊要求。" : "Tell us delivery country, target date, or anything special."}"></textarea>
    <div class="toolbar"><button class="btn" type="submit">${zh ? "提交询价" : "Submit quote request"}</button><a class="btn secondary" href="mailto:${escapeHtml(tenant.email)}?subject=${encodeURIComponent(`${zh ? "紧固件询价" : "Quote request"}: ${product.name}`)}">${zh ? "改用邮件发送" : "Email instead"}</a></div>
    <p id="quoteStatus" class="status"></p>
  </form></div>
  <script>
    document.getElementById('quoteForm')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const status = document.getElementById('quoteStatus');
      status.textContent = ${JSON.stringify(zh ? "正在发送..." : "Sending...")};
      const payload = Object.fromEntries(new FormData(event.target).entries());
      payload.page_url = location.href;
      const res = await fetch('/api/quote', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      status.textContent = res.ok ? ${JSON.stringify(zh ? "询价已提交，我们会通过邮箱联系你。" : "Quote request saved. We will contact you by email.")} : ${JSON.stringify(zh ? "提交失败，请直接发送邮件联系我们。" : "Could not save request. Please email us directly.")};
      if (res.ok) event.target.reset();
    });
  </script></section>`;
  return html(shell({
    title: `${product.name} | ${zh ? "上海西缈科技有限公司" : "Toumyou Shop"}`,
    description: product.excerpt || product.description || (zh ? "紧固件与工业配件产品详情。" : SHOP.description),
    path: `/shop/products/${product.slug}`,
    content: content.replace("</main>", `${quoteForm}</main>`),
    schema: {
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.name,
      sku: product.sku || product.slug,
      mpn: product.sku || product.slug,
      brand: { "@type": "Brand", name: zh ? "上海西缈科技有限公司" : "Toumyou Fastener Supply" },
      description: product.excerpt || product.description,
      image: images.length ? images : undefined,
      offers: {
        "@type": "Offer",
        price: product.price_cents ? String(minorToDisplay(product.price_cents, product.currency)) : undefined,
        priceCurrency: product.currency,
        availability: product.inventory ? "https://schema.org/InStock" : "https://schema.org/PreOrder",
        inventoryLevel: product.inventory ? { "@type": "QuantitativeValue", value: Number(product.inventory) || 0 } : undefined,
        eligibleQuantity: { "@type": "QuantitativeValue", minValue: minQty },
        url: `${tenant.url}/shop/products/${product.slug}`,
      },
    },
    image: images[0] || undefined,
    tenant,
  }));
}

function adminHeader(tenant = TENANTS.toumyou, active = "articles") {
  const zh = tenant.lang === "zh-CN";
  const labels = zh
    ? { articles: "文章", products: "商品", orders: "订单", customers: "客户", media: "媒体库", settings: "设置", support: "客服", shop: "查看商城" }
    : { articles: "Articles", products: "Products", orders: "Orders", customers: "Customers", media: "Media", settings: "Settings", support: "Support", shop: "Open shop" };
  const tab = (key, href) => `<a class="admin-tab ${active === key ? "active" : ""}" href="${href}">${labels[key]}</a>`;
  return `<div class="admin-hero"><div><p class="eyebrow">${zh ? "运营后台" : "Operations console"}</p><h1>${zh ? "内容与商品管理。" : "Content and commerce."}</h1><p class="lead">${zh ? "统一管理文章、商品、订单与客户咨询，让前台内容保持实时、清楚、可信。" : "Manage articles, products, orders, and customer conversations from one cleaner workspace."}</p></div><a class="btn secondary" href="/shop" target="_blank">${labels.shop}</a></div>
    <nav class="admin-tabs" aria-label="Admin sections">${tab("products", "/admin/products")}${tab("articles", "/admin")}${tab("orders", "/admin/orders")}${tab("customers", "/admin/customers")}${tab("media", "/admin/media")}${tab("settings", "/admin/settings")}${tab("support", "/admin/support")}</nav>`;
}

function adminPage(tenant = TENANTS.toumyou) {
  const zh = tenant.lang === "zh-CN";
  const content = `<main class="admin-wrap">${adminHeader(tenant, "articles")}
    <div id="app" class="notice">Loading...</div>
    <script>
      const app = document.getElementById('app');
      const esc = (v='') => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
      const copy = ${JSON.stringify(zh ? {
        password: "后台密码",
        login: "登录",
        newArticle: "新建文章",
        search: "搜索标题、分类、slug...",
        all: "全部状态",
        published: "已发布",
        draft: "草稿",
        title: "标题",
        slug: "Slug",
        excerpt: "摘要",
        body: "正文",
        category: "分类",
        publishDate: "发布时间",
        coverImage: "封面图 URL",
        uploadCover: "上传文章封面",
        uploadButton: "上传封面",
        uploadHint: "建议使用横图，保存后会显示在文章卡片和详情页。",
        seoTitle: "SEO 标题",
        seoDescription: "SEO 描述",
        status: "状态",
        save: "保存文章",
        delete: "删除",
        openHome: "查看首页",
        openArticles: "查看文章",
        products: "商品",
        orders: "订单",
        support: "客服",
        empty: "没有匹配的文章。",
        deleteConfirm: "确定删除这篇文章？"
      } : {
        password: "Password",
        login: "Log in",
        newArticle: "New article",
        search: "Search title, category, slug...",
        all: "All status",
        published: "Published",
        draft: "Draft",
        title: "Title",
        slug: "Slug",
        excerpt: "Excerpt",
        body: "Body",
        category: "Category",
        publishDate: "Publish date",
        coverImage: "Cover image URL",
        uploadCover: "Upload article cover",
        uploadButton: "Upload cover",
        uploadHint: "Use a landscape image. It appears on article cards and article pages after saving.",
        seoTitle: "SEO title",
        seoDescription: "SEO description",
        status: "Status",
        save: "Save article",
        delete: "Delete",
        openHome: "Open home",
        openArticles: "Open insights",
        products: "Products",
        orders: "Orders",
        support: "Support",
        empty: "No matching articles.",
        deleteConfirm: "Delete this article?"
      })};
      async function api(url, options={}){const r=await fetch(url,{cache:'no-store',headers:{'content-type':'application/json'},...options}); if(!r.ok) throw new Error(await r.text()); return r.json();}
      function login(){app.className='notice';app.innerHTML='<label>'+copy.password+'</label><input id="pw" type="password" autocomplete="current-password"><div class="toolbar"><button class="btn" id="go">'+copy.login+'</button></div>';document.getElementById('go').onclick=async()=>{try{await api('/api/admin/login',{method:'POST',body:JSON.stringify({password:document.getElementById('pw').value})});load()}catch(e){alert('Login failed')}}}
      function coverPreview(p={}){return p.cover_image?'<div class="admin-preview-grid"><div class="image-chip"><img src="'+esc(p.cover_image)+'" alt=""><span>Cover</span></div></div>':''}
      function postDate(p={}){return p.published_at?new Date(Number(p.published_at)*1000).toISOString().slice(0,10):''}
      function form(p={}){const currentStatus=p.status||'published';return coverPreview(p)+'<div class="field-grid"><div><label>'+copy.title+'</label><input id="title" value="'+esc(p.title||'')+'"></div><div><label>'+copy.slug+'</label><input id="slug" value="'+esc(p.slug||'')+'"></div></div><label>'+copy.excerpt+'</label><textarea id="excerpt">'+esc(p.excerpt||'')+'</textarea><label>'+copy.body+'</label><textarea id="body" style="min-height:320px">'+esc(p.body||'')+'</textarea><div class="field-grid"><div><label>'+copy.category+'</label><input id="category" value="'+esc(p.category||'Insights')+'"></div><div><label>'+copy.status+'</label><select id="status"><option value="published" '+(currentStatus==='published'?'selected':'')+'>published</option><option value="draft" '+(currentStatus==='draft'?'selected':'')+'>draft</option></select></div></div><label>'+copy.publishDate+'</label><input id="published_at" type="date" value="'+esc(postDate(p))+'"><label>'+copy.coverImage+'</label><input id="cover_image" value="'+esc(p.cover_image||'')+'"><label>'+copy.uploadCover+'</label><input id="cover_file" type="file" accept="image/*"><div class="toolbar"><button class="btn secondary" id="upload_cover" type="button">'+copy.uploadButton+'</button><span id="upload_status" class="muted">'+copy.uploadHint+'</span></div><div class="field-grid"><div><label>'+copy.seoTitle+'</label><input id="seo_title" value="'+esc(p.seo_title||'')+'" placeholder="'+esc(p.title||'')+'"></div><div><label>'+copy.seoDescription+'</label><textarea id="seo_description" style="min-height:92px">'+esc(p.seo_description||'')+'</textarea></div></div><div class="editor-actions"><button class="btn" id="save">'+copy.save+'</button>'+(p.id?'<button class="btn danger" id="delete">'+copy.delete+'</button>':'')+'<a class="btn secondary" href="/" target="_blank">'+copy.openHome+'</a><a class="btn secondary" href="/articles" target="_blank">'+copy.openArticles+'</a></div><p id="saved" class="status"></p>'}
      function stats(posts){const published=posts.filter(p=>String(p.status).toLowerCase()==='published').length;const draft=posts.filter(p=>String(p.status).toLowerCase()==='draft').length;return '<div class="mini-dashboard"><div><strong>'+posts.length+'</strong><span>Total</span></div><div><strong>'+published+'</strong><span>'+copy.published+'</span></div><div><strong>'+draft+'</strong><span>'+copy.draft+'</span></div></div>'}
      function listItem(p){const thumb=p.cover_image?'<img class="admin-thumb" src="'+esc(p.cover_image)+'" alt="">':'<div class="admin-thumb"></div>';return '<a class="article-link" data-id="'+esc(p.id)+'" data-status="'+esc(String(p.status||'').toLowerCase())+'" data-search="'+esc([p.title,p.slug,p.category,p.excerpt,p.seo_title,p.seo_description].filter(Boolean).join(' ').toLowerCase())+'"><div class="admin-thumb-row">'+thumb+'<div><div class="meta"><span class="status-badge '+esc(String(p.status||'draft').toLowerCase())+'">'+esc(p.status||'draft')+'</span> / '+esc(p.category||'Insights')+'</div><h3>'+esc(p.title||'Untitled article')+'</h3><p>'+esc(p.slug||'no-slug')+'</p></div></div></a>'}
      function wireFilter(){const q=document.getElementById('adminSearch');const f=document.getElementById('adminStatus');const empty=document.getElementById('adminEmpty');const items=[...document.querySelectorAll('[data-id]')];function apply(){const text=(q?.value||'').trim().toLowerCase();const status=f?.value||'';let shown=0;items.forEach(item=>{const ok=(!text||(item.dataset.search||'').includes(text))&&(!status||item.dataset.status===status);item.hidden=!ok;if(ok)shown++});if(empty)empty.hidden=shown>0}q&&q.addEventListener('input',apply);f&&f.addEventListener('input',apply);apply()}
      async function load(){try{const s=await api('/api/admin/session'); if(!s.authenticated)return login(); const posts=await api('/api/admin/posts'); app.className='editor'; app.innerHTML='<aside><button class="btn" id="new">'+copy.newArticle+'</button>'+stats(posts)+'<div class="admin-list-tools"><input id="adminSearch" type="search" placeholder="'+copy.search+'"><select id="adminStatus"><option value="">'+copy.all+'</option><option value="published">'+copy.published+'</option><option value="draft">'+copy.draft+'</option></select></div><div class="articles">'+posts.map(listItem).join('')+'<div id="adminEmpty" class="admin-list-empty" hidden>'+copy.empty+'</div></div></aside><section id="edit">'+form()+'</section>'; const edit=document.getElementById('edit'); document.getElementById('new').onclick=()=>{edit.innerHTML=form(); wireSave()}; document.querySelectorAll('[data-id]').forEach(a=>a.onclick=()=>{const p=posts.find(x=>x.id===a.dataset.id); edit.innerHTML=form(p); wireSave(p.id)}); wireFilter(); wireSave()}catch(e){app.className='notice';app.textContent=e.message}}
      async function uploadCover(){const input=document.getElementById('cover_file');const status=document.getElementById('upload_status');if(!input?.files?.length){status.textContent='Choose an image first.';return}const form=new FormData();form.append('files',input.files[0]);status.textContent='Uploading...';const r=await fetch('/api/admin/upload',{method:'POST',body:form});const data=await r.json().catch(()=>({}));if(!r.ok){status.textContent=data.error||'Upload failed';return}const url=data.files?.[0]?.url;if(!url){status.textContent='No image URL returned.';return}document.getElementById('cover_image').value=url;status.textContent='Uploaded. Save article to publish the cover.'}
      function wireSave(id){const uploader=document.getElementById('upload_cover');if(uploader)uploader.onclick=uploadCover;document.getElementById('save').onclick=async()=>{const payload={title:document.getElementById('title').value,slug:document.getElementById('slug').value,excerpt:document.getElementById('excerpt').value,body:document.getElementById('body').value,category:document.getElementById('category').value,status:document.getElementById('status').value,published_at:document.getElementById('published_at').value,cover_image:document.getElementById('cover_image').value,seo_title:document.getElementById('seo_title').value,seo_description:document.getElementById('seo_description').value}; const result=await api(id?'/api/admin/posts/'+id:'/api/admin/posts',{method:id?'PUT':'POST',body:JSON.stringify(payload)}); const slug=result.slug||payload.slug; document.getElementById('saved').innerHTML='Saved. <a class="text-link" target="_blank" href="/articles/'+encodeURIComponent(slug)+'?fresh='+Date.now()+'">Open article</a> or <a class="text-link" target="_blank" href="/?fresh='+Date.now()+'">check home</a>.'; if(!id)setTimeout(load,700)}; const del=document.getElementById('delete'); if(del)del.onclick=async()=>{if(!confirm(copy.deleteConfirm))return; await api('/api/admin/posts/'+id,{method:'DELETE'}); load()}}
      load();
    </script></main>`;
  return html(shell({ title: `${tenant.lang === "zh-CN" ? "后台" : "Admin"} | ${tenant.name}`, description: `${tenant.name} admin.`, path: "/admin", content, tenant }), { cache: "no-store" });
}

function adminProductsPage(tenant = TENANTS.toumyou) {
  const zh = tenant.lang === "zh-CN";
  const content = `<main class="admin-wrap">${adminHeader(tenant, "products")}
    <div id="app" class="notice">Loading...</div>
    <script>
      const app = document.getElementById('app');
      const esc = (v='') => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
      const copy = ${JSON.stringify(zh ? {
        password: "后台密码",
        login: "登录",
        newProduct: "新建商品",
        search: "搜索商品、SKU、分类、材质...",
        all: "全部状态",
        published: "已发布",
        draft: "草稿",
        name: "商品名称",
        slug: "Slug",
        sku: "SKU",
        excerpt: "短摘要",
        description: "详细描述",
        category: "分类",
        material: "材质",
        size: "规格尺寸",
        specs: "详细规格",
        packageInfo: "包装说明",
        leadTime: "交期",
        shippingNote: "运输/关税说明",
        moq: "起订量",
        weight: "单件重量（克）",
        mainImage: "主图 URL",
        gallery: "轮播图 URL",
        upload: "上传商品图片",
        uploadButton: "上传图片",
        uploadHint: "图片会保存到 Cloudflare R2。",
        price: "价格",
        currency: "币种",
        inventory: "库存",
        status: "状态",
        checkout: "开启 Stripe 购买",
        save: "保存商品",
        delete: "删除",
        openShop: "查看商城",
        orders: "订单",
        support: "客服",
        articles: "文章",
        empty: "没有匹配的商品。",
        deleteConfirm: "确定删除这个商品？",
        noImage: "暂无图片",
        checkoutOn: "可购买",
        checkoutOff: "询价"
      } : {
        password: "Password",
        login: "Log in",
        newProduct: "New product",
        search: "Search product, SKU, category, material...",
        all: "All status",
        published: "Published",
        draft: "Draft",
        name: "Name",
        slug: "Slug",
        sku: "SKU",
        excerpt: "Short excerpt",
        description: "Description",
        category: "Category",
        material: "Material",
        size: "Size",
        specs: "Detailed specifications",
        packageInfo: "Packaging",
        leadTime: "Lead time",
        shippingNote: "Shipping / duties note",
        moq: "MOQ",
        weight: "Weight grams / unit",
        mainImage: "Main image URL",
        gallery: "Gallery image URLs",
        upload: "Upload product images",
        uploadButton: "Upload images",
        uploadHint: "Images are stored in Cloudflare R2.",
        price: "Price",
        currency: "Currency",
        inventory: "Inventory",
        status: "Status",
        checkout: "Enable Stripe Buy for this product",
        save: "Save product",
        delete: "Delete",
        openShop: "Open shop",
        orders: "Orders",
        support: "Support",
        articles: "Articles",
        empty: "No matching products.",
        deleteConfirm: "Delete this product?",
        noImage: "No image",
        checkoutOn: "Buy enabled",
        checkoutOff: "Quote"
      })};
      async function api(url, options={}){const r=await fetch(url,{cache:'no-store',headers:{'content-type':'application/json'},...options}); if(!r.ok) throw new Error(await r.text()); return r.json();}
      function login(){app.className='notice';app.innerHTML='<label>'+copy.password+'</label><input id="pw" type="password" autocomplete="current-password"><div class="toolbar"><button class="btn" id="go">'+copy.login+'</button></div>';document.getElementById('go').onclick=async()=>{try{await api('/api/admin/login',{method:'POST',body:JSON.stringify({password:document.getElementById('pw').value})});load()}catch(e){alert('Login failed')}}}
      const zeroDecimalCurrencies = new Set(['BIF','CLP','DJF','GNF','JPY','KMF','KRW','MGA','PYG','RWF','UGX','VND','VUV','XAF','XOF','XPF']);
      function currencyScale(currency){return zeroDecimalCurrencies.has(String(currency||'USD').toUpperCase())?1:100}
      function amountFromPrice(v,currency){const n=Number(String(v||'').replace(/[^0-9.]/g,'')); return Math.round((Number.isFinite(n)?n:0)*currencyScale(currency))}
      function priceFromAmount(v,currency){const scale=currencyScale(currency); return ((Number(v)||0)/scale).toFixed(scale===1?0:2)}
      function imageList(p={}){return [p.image_url,...String(p.image_urls||'').split(/\\n|,/)].map(x=>String(x||'').trim()).filter(Boolean)}
      function imagePreview(p={}){const imgs=imageList(p).slice(0,6);return imgs.length?'<div class="admin-preview-grid">'+imgs.map((src,i)=>'<div class="image-chip"><img src="'+esc(src)+'" alt=""><span>'+(i===0?'Main':'Gallery '+i)+'</span></div>').join('')+'</div>':'<div class="notice">'+copy.noImage+'</div>'}
      function form(p={}){const status=p.status||'draft'; const checkout=Number(p.allow_checkout||0)===1; const currency=p.currency||'JPY'; return imagePreview(p)+'<div class="field-grid"><div><label>'+copy.name+'</label><input id="name" value="'+esc(p.name||'')+'"></div><div><label>'+copy.slug+'</label><input id="slug" value="'+esc(p.slug||'')+'"></div></div><div class="field-grid"><div><label>'+copy.sku+'</label><input id="sku" value="'+esc(p.sku||'')+'"></div><div><label>'+copy.category+'</label><input id="category" value="'+esc(p.category||'Fasteners')+'"></div></div><label>'+copy.excerpt+'</label><textarea id="excerpt">'+esc(p.excerpt||'')+'</textarea><label>'+copy.description+'</label><textarea id="description">'+esc(p.description||'')+'</textarea><div class="field-grid"><div><label>'+copy.material+'</label><input id="material" value="'+esc(p.material||'')+'"></div><div><label>'+copy.size+'</label><input id="size" value="'+esc(p.size||'')+'"></div></div><label>'+copy.specs+'</label><textarea id="specs" placeholder="Standards, finish, thread pitch, packaging, drawing notes...">'+esc(p.specs||'')+'</textarea><div class="field-grid"><div><label>'+copy.packageInfo+'</label><input id="package_info" value="'+esc(p.package_info||'')+'"></div><div><label>'+copy.leadTime+'</label><input id="lead_time" value="'+esc(p.lead_time||'')+'"></div></div><label>'+copy.shippingNote+'</label><textarea id="shipping_note" style="min-height:92px">'+esc(p.shipping_note||'')+'</textarea><div class="field-grid"><div><label>'+copy.moq+'</label><input id="moq" type="number" min="1" value="'+esc(p.moq||1)+'"></div><div><label>'+copy.weight+'</label><input id="weight_grams" type="number" min="0" value="'+esc(p.weight_grams||0)+'"></div></div><label>'+copy.mainImage+'</label><input id="image_url" value="'+esc(p.image_url||'')+'"><label>'+copy.gallery+'</label><textarea id="image_urls" placeholder="One image URL per line. Upload images below or paste CDN URLs here.">'+esc(p.image_urls||'')+'</textarea><label>'+copy.upload+'</label><input id="image_files" type="file" accept="image/*" multiple><div class="toolbar"><button class="btn secondary" id="upload_images" type="button">'+copy.uploadButton+'</button><span id="upload_status" class="muted">'+copy.uploadHint+'</span></div><div class="field-grid"><div><label>'+copy.price+'</label><input id="price" inputmode="decimal" value="'+esc(priceFromAmount(p.price_cents,currency))+'"></div><div><label>'+copy.currency+'</label><input id="currency" value="'+esc(currency)+'"></div></div><div class="field-grid"><div><label>'+copy.inventory+'</label><input id="inventory" type="number" min="0" value="'+esc(p.inventory||0)+'"></div><div><label>'+copy.status+'</label><select id="status"><option value="draft" '+(status==='draft'?'selected':'')+'>draft</option><option value="published" '+(status==='published'?'selected':'')+'>published</option></select></div></div><label><input id="allow_checkout" type="checkbox" style="width:auto" '+(checkout?'checked':'')+'> '+copy.checkout+'</label><div class="editor-actions"><button class="btn" id="save">'+copy.save+'</button>'+(p.id?'<button class="btn danger" id="delete">'+copy.delete+'</button>':'')+'<a class="btn secondary" href="/shop" target="_blank">'+copy.openShop+'</a><a class="btn secondary" href="/admin/orders">'+copy.orders+'</a></div><p id="saved" class="status"></p>'}
      function stats(products){const published=products.filter(p=>String(p.status).toLowerCase()==='published').length;const buy=products.filter(p=>Number(p.allow_checkout||0)===1).length;const low=products.filter(p=>Number(p.inventory||0)>0&&Number(p.inventory||0)<=5).length;return '<div class="mini-dashboard"><div><strong>'+products.length+'</strong><span>Total</span></div><div><strong>'+published+'</strong><span>'+copy.published+'</span></div><div><strong>'+buy+'</strong><span>'+copy.checkoutOn+'</span></div><div><strong>'+low+'</strong><span>Low stock</span></div></div>'}
      function listItem(p){const imgs=imageList(p);const thumb=imgs[0]?'<img class="admin-thumb" src="'+esc(imgs[0])+'" alt="">':'<div class="admin-thumb"></div>';return '<a class="article-link" data-id="'+esc(p.id)+'" data-status="'+esc(String(p.status||'').toLowerCase())+'" data-search="'+esc([p.name,p.slug,p.sku,p.category,p.material,p.size].filter(Boolean).join(' ').toLowerCase())+'"><div class="admin-thumb-row">'+thumb+'<div><div class="meta"><span class="status-badge '+esc(String(p.status||'draft').toLowerCase())+'">'+esc(p.status||'draft')+'</span> / '+(Number(p.allow_checkout||0)===1?copy.checkoutOn:copy.checkoutOff)+'</div><h3>'+esc(p.name||'Untitled product')+'</h3><p>'+esc(p.sku||p.slug||'No SKU')+' · '+esc(priceFromAmount(p.price_cents,p.currency))+' '+esc(p.currency||'JPY')+' · Stock '+esc(p.inventory||0)+'</p></div></div></a>'}
      function wireFilter(){const q=document.getElementById('adminSearch');const f=document.getElementById('adminStatus');const empty=document.getElementById('adminEmpty');const items=[...document.querySelectorAll('[data-id]')];function apply(){const text=(q?.value||'').trim().toLowerCase();const status=f?.value||'';let shown=0;items.forEach(item=>{const ok=(!text||(item.dataset.search||'').includes(text))&&(!status||item.dataset.status===status);item.hidden=!ok;if(ok)shown++});if(empty)empty.hidden=shown>0}q&&q.addEventListener('input',apply);f&&f.addEventListener('input',apply);apply()}
      async function load(){try{const s=await api('/api/admin/session'); if(!s.authenticated)return login(); const products=await api('/api/admin/products'); app.className='editor'; app.innerHTML='<aside><button class="btn" id="new">'+copy.newProduct+'</button>'+stats(products)+'<div class="admin-list-tools"><input id="adminSearch" type="search" placeholder="'+copy.search+'"><select id="adminStatus"><option value="">'+copy.all+'</option><option value="published">'+copy.published+'</option><option value="draft">'+copy.draft+'</option></select></div><div class="articles">'+products.map(listItem).join('')+'<div id="adminEmpty" class="admin-list-empty" hidden>'+copy.empty+'</div></div></aside><section id="edit">'+form()+'</section>'; const edit=document.getElementById('edit'); document.getElementById('new').onclick=()=>{edit.innerHTML=form(); wireSave()}; document.querySelectorAll('[data-id]').forEach(a=>a.onclick=()=>{const p=products.find(x=>x.id===a.dataset.id); edit.innerHTML=form(p); wireSave(p.id)}); wireFilter(); wireSave()}catch(e){app.className='notice';app.textContent=e.message}}
      async function uploadImages(){const input=document.getElementById('image_files'); const status=document.getElementById('upload_status'); if(!input?.files?.length){status.textContent='Choose one or more image files first.';return} const form=new FormData(); [...input.files].forEach(file=>form.append('files',file)); status.textContent='Uploading...'; const r=await fetch('/api/admin/upload',{method:'POST',body:form}); const data=await r.json().catch(()=>({})); if(!r.ok){status.textContent=data.error||'Upload failed';return} const urls=(data.files||[]).map(f=>f.url).filter(Boolean); if(!urls.length){status.textContent='No image URL returned.';return} const main=document.getElementById('image_url'); const gallery=document.getElementById('image_urls'); if(!main.value)main.value=urls[0]; const existing=gallery.value.trim(); gallery.value=[existing,...urls.slice(main.value===urls[0]?1:0)].filter(Boolean).join('\\n'); status.textContent='Uploaded '+urls.length+' image(s). Save product to publish them.'}
      function payload(){const currency=document.getElementById('currency').value; return {name:document.getElementById('name').value,slug:document.getElementById('slug').value,sku:document.getElementById('sku').value,excerpt:document.getElementById('excerpt').value,description:document.getElementById('description').value,category:document.getElementById('category').value,material:document.getElementById('material').value,size:document.getElementById('size').value,specs:document.getElementById('specs').value,package_info:document.getElementById('package_info').value,lead_time:document.getElementById('lead_time').value,shipping_note:document.getElementById('shipping_note').value,moq:Number(document.getElementById('moq').value||1),weight_grams:Number(document.getElementById('weight_grams').value||0),image_url:document.getElementById('image_url').value,image_urls:document.getElementById('image_urls').value,price_cents:amountFromPrice(document.getElementById('price').value,currency),currency,inventory:Number(document.getElementById('inventory').value||0),status:document.getElementById('status').value,allow_checkout:document.getElementById('allow_checkout').checked?1:0}}
      function wireSave(id){const uploader=document.getElementById('upload_images'); if(uploader)uploader.onclick=uploadImages; document.getElementById('save').onclick=async()=>{const p=payload(); const result=await api(id?'/api/admin/products/'+id:'/api/admin/products',{method:id?'PUT':'POST',body:JSON.stringify(p)}); const slug=result.slug||p.slug; document.getElementById('saved').innerHTML='Saved. <a class="text-link" target="_blank" href="/shop/products/'+encodeURIComponent(slug)+'?fresh='+Date.now()+'">Open product</a> or <a class="text-link" target="_blank" href="/shop?fresh='+Date.now()+'">check shop</a>.'; if(!id)setTimeout(load,700)}; const del=document.getElementById('delete'); if(del)del.onclick=async()=>{if(!confirm(copy.deleteConfirm))return; await api('/api/admin/products/'+id,{method:'DELETE'}); load()}}
      load();
    </script></main>`;
  return html(shell({ title: `${tenant.lang === "zh-CN" ? "产品后台" : "Product Admin"} | ${tenant.name}`, description: `${tenant.name} product admin.`, path: "/admin/products", content, tenant }), { cache: "no-store" });
}

function adminMediaPage(tenant = TENANTS.toumyou) {
  const zh = tenant.lang === "zh-CN";
  const copy = zh
    ? {
      loading: "正在加载媒体库...",
      password: "后台密码",
      login: "登录",
      upload: "上传图片到媒体库",
      choose: "选择图片",
      uploadButton: "上传",
      search: "搜索文件名或路径...",
      empty: "媒体库为空。上传文章封面或商品图片后会显示在这里。",
      copy: "复制 URL",
      open: "打开",
      delete: "删除",
      more: "加载更多",
      copied: "已复制",
      confirm: "确定删除这张图片？如果文章或商品正在使用它，前台图片会失效。",
    }
    : {
      loading: "Loading media library...",
      password: "Password",
      login: "Log in",
      upload: "Upload images to media library",
      choose: "Choose images",
      uploadButton: "Upload",
      search: "Search file name or path...",
      empty: "No media yet. Article covers and product images will appear here after upload.",
      copy: "Copy URL",
      open: "Open",
      delete: "Delete",
      more: "Load more",
      copied: "Copied",
      confirm: "Delete this image? If an article or product still uses it, the frontend image will break.",
    };
  const content = `<main class="admin-wrap">${adminHeader(tenant, "media")}
    <div id="app" class="notice">${escapeHtml(copy.loading)}</div>
    <script>
      const app=document.getElementById('app');
      const copy=${JSON.stringify(copy)};
      const esc=(v='')=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
      async function api(url,options={}){const r=await fetch(url,{cache:'no-store',headers:{'content-type':'application/json'},...options});if(!r.ok)throw new Error(await r.text());return r.json()}
      function login(){app.className='notice';app.innerHTML='<label>'+copy.password+'</label><input id="pw" type="password" autocomplete="current-password"><div class="toolbar"><button class="btn" id="go">'+copy.login+'</button></div>';document.getElementById('go').onclick=async()=>{try{await api('/api/admin/login',{method:'POST',body:JSON.stringify({password:document.getElementById('pw').value})});load()}catch(e){alert('Login failed')}}}
      let files=[];let cursor='';
      function size(n){n=Number(n)||0;if(n>1024*1024)return (n/1024/1024).toFixed(1)+' MB';if(n>1024)return Math.round(n/1024)+' KB';return n+' B'}
      function render(){app.className='';app.innerHTML='<section class="notice"><p class="eyebrow">Media library</p><h2>'+copy.upload+'</h2><label>'+copy.choose+'</label><input id="mediaFiles" type="file" accept="image/*" multiple><div class="toolbar"><button class="btn" id="upload">'+copy.uploadButton+'</button><input id="mediaSearch" type="search" placeholder="'+copy.search+'" style="max-width:360px"></div><p id="mediaStatus" class="status"></p></section><div id="grid" class="media-grid"></div><div class="toolbar">'+(cursor?'<button class="btn secondary" id="more">'+copy.more+'</button>':'')+'</div>';document.getElementById('upload').onclick=upload;const q=document.getElementById('mediaSearch');q.oninput=draw;const more=document.getElementById('more');if(more)more.onclick=()=>loadPage(cursor);draw()}
      function draw(){const grid=document.getElementById('grid');if(!grid)return;const q=(document.getElementById('mediaSearch')?.value||'').trim().toLowerCase();const visible=files.filter(f=>!q||String(f.key).toLowerCase().includes(q));grid.innerHTML=visible.length?visible.map(card).join(''):'<div class="notice">'+copy.empty+'</div>';grid.querySelectorAll('[data-copy]').forEach(b=>b.onclick=async()=>{const url=new URL(b.dataset.copy,location.origin).toString();await navigator.clipboard.writeText(url).catch(()=>{});b.textContent=copy.copied});grid.querySelectorAll('[data-delete]').forEach(b=>b.onclick=async()=>{if(!confirm(copy.confirm))return;await api('/api/admin/media/'+encodeURIComponent(b.dataset.delete),{method:'DELETE'});files=files.filter(f=>f.key!==b.dataset.delete);draw()})}
      function card(f){return '<article class="media-card"><img src="'+esc(f.url)+'" alt="" loading="lazy"><div><code title="'+esc(f.key)+'">'+esc(f.key)+'</code><p class="muted">'+esc(size(f.size))+' · '+esc((f.uploaded||'').slice(0,10))+'</p><div class="toolbar"><button class="btn secondary" data-copy="'+esc(f.url)+'">'+copy.copy+'</button><a class="btn secondary" href="'+esc(f.url)+'" target="_blank">'+copy.open+'</a><button class="btn danger" data-delete="'+esc(f.key)+'">'+copy.delete+'</button></div></div></article>'}
      async function upload(){const input=document.getElementById('mediaFiles');const status=document.getElementById('mediaStatus');if(!input.files.length){status.textContent='Choose image files first.';return}const form=new FormData();[...input.files].forEach(file=>form.append('files',file));status.textContent='Uploading...';const r=await fetch('/api/admin/upload',{method:'POST',body:form});const data=await r.json().catch(()=>({}));if(!r.ok){status.textContent=data.error||'Upload failed';return}files=[...(data.files||[]),...files];status.textContent='Uploaded '+(data.files||[]).length+' image(s).';input.value='';draw()}
      async function loadPage(next=''){const data=await api('/api/admin/media'+(next?'?cursor='+encodeURIComponent(next):''));files=[...files,...(data.files||[])];cursor=data.cursor||'';render()}
      async function load(){try{const s=await api('/api/admin/session');if(!s.authenticated)return login();await loadPage('')}catch(e){app.className='notice';app.textContent=e.message}}
      load();
    </script></main>`;
  return html(shell({ title: `${zh ? "媒体库" : "Media library"} | ${tenant.name}`, description: `${tenant.name} media library.`, path: "/admin/media", content, tenant }), { cache: "no-store" });
}

function adminCustomersPage(tenant = TENANTS.toumyou) {
  const zh = tenant.lang === "zh-CN";
  const content = `<main class="admin-wrap">${adminHeader(tenant, "customers")}
    <div id="app" class="notice">${zh ? "正在加载客户..." : "Loading customers..."}</div>
    <script>
      const app=document.getElementById('app');
      const esc=(v='')=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
      async function api(url,options={}){const r=await fetch(url,{cache:'no-store',headers:{'content-type':'application/json'},...options});if(!r.ok)throw new Error(await r.text());return r.json()}
      function login(){app.className='notice';app.innerHTML='<label>${zh ? "后台密码" : "Password"}</label><input id="pw" type="password" autocomplete="current-password"><div class="toolbar"><button class="btn" id="go">${zh ? "登录" : "Log in"}</button></div>';document.getElementById('go').onclick=async()=>{try{await api('/api/admin/login',{method:'POST',body:JSON.stringify({password:document.getElementById('pw').value})});load()}catch(e){alert('Login failed')}}}
      function dt(v){return v?new Date(Number(v)*1000).toLocaleString():'-'}
      function card(c){return '<article class="article-card"><div class="meta">Customer / '+esc(c.google_sub?'Google':'Email')+'</div><h3>'+esc(c.name||c.email||'Customer')+'</h3><p>'+esc(c.email||'')+'</p><div class="order-meta"><span>${zh ? "订单数" : "Orders"}<br>'+esc(c.order_count||0)+'</span><span>${zh ? "已支付合计" : "Paid total"}<br>'+esc(c.paid_total||0)+'</span><span>${zh ? "创建" : "Created"}<br>'+esc(dt(c.created_at))+'</span><span>${zh ? "更新" : "Updated"}<br>'+esc(dt(c.updated_at))+'</span></div></article>'}
      async function load(){try{const s=await api('/api/admin/session');if(!s.authenticated)return login();const customers=await api('/api/admin/customers');app.className='';app.innerHTML='<section class="section" style="padding:0"><p class="eyebrow">${zh ? "客户系统" : "Customer system"}</p><h2>${zh ? "客户、登录与订单记录。" : "Customers, login, and order history."}</h2><div class="order-filter"><input id="q" type="search" placeholder="${zh ? "搜索客户邮箱或姓名..." : "Search customer email or name..."}"></div><div id="grid" class="article-grid">'+(customers.length?customers.map(card).join(''):'<div class="notice">${zh ? "暂无客户。客户 Google 登录或下单后会显示在这里。" : "No customers yet. Google sign-ins and orders will appear here."}</div>')+'</div></section>';document.getElementById('q')?.addEventListener('input',e=>{const q=e.target.value.toLowerCase();document.querySelectorAll('.article-card').forEach(card=>card.hidden=q&&!card.textContent.toLowerCase().includes(q))})}catch(e){app.className='notice';app.textContent=e.message}}
      load();
    </script></main>`;
  return html(shell({ title: `${zh ? "客户后台" : "Customers"} | ${tenant.name}`, description: `${tenant.name} customers.`, path: "/admin/customers", content, tenant }), { cache: "no-store" });
}

function adminSettingsPage(tenant = TENANTS.toumyou) {
  const zh = tenant.lang === "zh-CN";
  const content = `<main class="admin-wrap">${adminHeader(tenant, "settings")}
    <div id="app" class="notice">${zh ? "正在加载设置..." : "Loading settings..."}</div>
    <script>
      const app=document.getElementById('app');
      const esc=(v='')=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
      async function api(url,options={}){const r=await fetch(url,{cache:'no-store',headers:{'content-type':'application/json'},...options});if(!r.ok)throw new Error(await r.text());return r.json()}
      function login(){app.className='notice';app.innerHTML='<label>${zh ? "后台密码" : "Password"}</label><input id="pw" type="password" autocomplete="current-password"><div class="toolbar"><button class="btn" id="go">${zh ? "登录" : "Log in"}</button></div>';document.getElementById('go').onclick=async()=>{try{await api('/api/admin/login',{method:'POST',body:JSON.stringify({password:document.getElementById('pw').value})});load()}catch(e){alert('Login failed')}}}
      function form(s){return '<section class="notice"><p class="eyebrow">${zh ? "轻量 CMS" : "Lightweight CMS"}</p><h2>${zh ? "Cloudflare 免费版可用的生产后台正在运行。" : "A Cloudflare Free-compatible production admin is active."}</h2><p class="muted">${zh ? "文章、商品、订单、客户与设置读取 D1；图片媒体库读取 R2。Payload 已暂缓，不再影响主站部署。" : "Articles, products, orders, customers, and settings read from D1; image media reads from R2. Payload is deferred and no longer affects production deployment."}</p><div class="order-dashboard"><a class="metric-card" href="/admin"><strong>D1</strong><span>${zh ? "Articles / 文章" : "Articles"}</span></a><a class="metric-card" href="/admin/products"><strong>D1</strong><span>${zh ? "Products / 商品" : "Products"}</span></a><a class="metric-card" href="/admin/media"><strong>R2</strong><span>${zh ? "Media / 图片" : "Media"}</span></a><a class="metric-card" href="/admin/orders"><strong>Stripe</strong><span>${zh ? "Orders / 订单" : "Orders"}</span></a><a class="metric-card" href="/admin/customers"><strong>Login</strong><span>${zh ? "Customers / 客户" : "Customers"}</span></a></div><label>${zh ? "后台备注" : "CMS notes"}</label><textarea id="cms_notes">'+esc(s.cms_notes||'')+'</textarea><label>${zh ? "默认 B2B 运输说明" : "Default B2B shipping note"}</label><textarea id="b2b_shipping_default">'+esc(s.b2b_shipping_default||'')+'</textarea><div class="toolbar"><button class="btn" id="save">${zh ? "保存设置" : "Save settings"}</button><a class="btn secondary" href="/shop" target="_blank">${zh ? "打开商店" : "Open shop"}</a><a class="btn secondary" href="/admin/media">${zh ? "媒体库" : "Media library"}</a></div><p id="status" class="status"></p></section>'}
      async function load(){try{const s=await api('/api/admin/session');if(!s.authenticated)return login();const settings=await api('/api/admin/settings');app.className='';app.innerHTML=form(settings);document.getElementById('save').onclick=async()=>{const payload={cms_notes:document.getElementById('cms_notes').value,b2b_shipping_default:document.getElementById('b2b_shipping_default').value};await api('/api/admin/settings',{method:'PUT',body:JSON.stringify(payload)});document.getElementById('status').textContent='${zh ? "已保存。" : "Saved."}'}}catch(e){app.className='notice';app.textContent=e.message}}
      load();
    </script></main>`;
  return html(shell({ title: `${zh ? "设置" : "Settings"} | ${tenant.name}`, description: `${tenant.name} settings.`, path: "/admin/settings", content, tenant }), { cache: "no-store" });
}

function adminOrdersPage(tenant = TENANTS.toumyou) {
  const content = `<main class="admin-wrap">${adminHeader(tenant, "orders")}
    <div id="app" class="notice">Loading...</div>
    <script>
      const app = document.getElementById('app');
      const esc = (v='') => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
      async function api(url, options={}){const r=await fetch(url,{cache:'no-store',headers:{'content-type':'application/json'},...options}); if(!r.ok) throw new Error(await r.text()); return r.json();}
      function login(){app.className='notice';app.innerHTML='<label>Password</label><input id="pw" type="password" autocomplete="current-password"><div class="toolbar"><button class="btn" id="go">Log in</button></div>';document.getElementById('go').onclick=async()=>{try{await api('/api/admin/login',{method:'POST',body:JSON.stringify({password:document.getElementById('pw').value})});load()}catch(e){alert('Login failed')}}}
      function money(amount,currency){try{return new Intl.NumberFormat('en',{style:'currency',currency:currency||'JPY'}).format(Number(amount||0)/(['BIF','CLP','DJF','GNF','JPY','KMF','KRW','MGA','PYG','RWF','UGX','VND','VUV','XAF','XOF','XPF'].includes(String(currency||'JPY').toUpperCase())?1:100))}catch{return (currency||'JPY')+' '+amount}}
      function dt(v){return v?new Date(Number(v)*1000).toLocaleString():'-'}
      function statusClass(v){return String(v||'pending').toLowerCase().replace(/[^a-z0-9_]+/g,'_')}
      function paymentHint(o){const s=String(o.payment_status||'pending').toLowerCase(); if(s==='paid')return 'Payment confirmed by Stripe webhook.'; if(s==='failed')return 'Payment failed or was declined. Ask buyer to retry checkout.'; if(s==='expired')return 'Checkout session expired before payment.'; if(s==='checkout_created')return 'Buyer opened Checkout; waiting for Stripe final payment update.'; return 'Payment status from Stripe: '+s}
      function orderCard(o){const paymentStatus=esc(o.payment_status||'pending'); const stripe=o.stripe_payment_intent?'<a class="btn secondary" href="https://dashboard.stripe.com/payments/'+esc(o.stripe_payment_intent)+'" target="_blank">Stripe payment</a>':'<span class="pill">Waiting for webhook</span>';return '<article class="article-card order-card" data-order-card data-payment="'+esc(statusClass(o.payment_status))+'" data-search="'+esc([o.product_name,o.product_slug,o.sku,o.customer_email,o.customer_name,o.shipping_name,o.shipping_country,o.stripe_session_id].filter(Boolean).join(' ').toLowerCase())+'"><div class="meta"><span class="status-badge '+esc(statusClass(o.payment_status))+'">'+paymentStatus+'</span> / '+esc(o.fulfillment_status||'new')+'</div><h3>'+esc(o.product_name||o.product_slug||'Order')+'</h3><p>'+esc(o.sku||'No SKU')+' · Qty '+esc(o.quantity||1)+' · '+esc(money(o.amount_total,o.currency))+'</p><p class="muted">'+esc(paymentHint(o))+'</p><div class="order-meta"><span>Email<br>'+esc(o.customer_email||'No email yet')+'</span><span>Name<br>'+esc(o.customer_name||o.shipping_name||'-')+'</span><span>Phone<br>'+esc(o.customer_phone||'-')+'</span><span>Country<br>'+esc(o.shipping_country||'-')+'</span></div><p class="muted">'+esc(o.shipping_address||'No shipping address yet')+'</p><p class="muted">Session: '+esc(o.stripe_session_id||'-')+'</p><label>Fulfillment</label><select data-status="'+esc(o.id)+'"><option value="new">new</option><option value="processing">processing</option><option value="shipped">shipped</option><option value="completed">completed</option><option value="cancelled">cancelled</option></select><label>Notes</label><textarea data-notes="'+esc(o.id)+'">'+esc(o.notes||'')+'</textarea><div class="toolbar"><button class="btn" data-save-order="'+esc(o.id)+'">Save</button>'+stripe+'</div><p class="muted">Created '+esc(dt(o.created_at))+' · Updated '+esc(dt(o.updated_at))+'</p></article>'}
      function inquiryCard(q){return '<article class="article-card"><div class="meta">Quote / '+esc(q.status||'new')+'</div><h3>'+esc(q.product_name||'General inquiry')+'</h3><p>'+esc(q.name||'')+' · '+esc(q.email||'')+' · '+esc(q.company||'')+'</p><p class="muted">Qty '+esc(q.quantity||'-')+' · '+esc(q.country||'')+'</p><p>'+esc(q.specs||q.message||'').replace(/\\n/g,'<br>')+'</p><label>Status</label><select data-inquiry-status="'+esc(q.id)+'"><option value="new">new</option><option value="quoted">quoted</option><option value="won">won</option><option value="lost">lost</option><option value="archived">archived</option></select><div class="toolbar"><button class="btn" data-save-inquiry="'+esc(q.id)+'">Save</button><a class="btn secondary" href="mailto:'+encodeURIComponent(q.email||'')+'?subject='+encodeURIComponent('Quote request: '+(q.product_name||'Toumyou shop'))+'">Reply</a></div><p class="muted">Created '+esc(dt(q.created_at))+'</p></article>'}
      function supportCard(m){const last=(m.messages||[]).slice(-1)[0]||{}; return '<article class="article-card"><div class="meta">Support conversation / '+esc(m.status||'open')+'</div><h3>'+esc(m.name||'Website visitor')+'</h3><p>'+esc(m.email||'')+' · '+esc(m.company||'')+'</p><p class="muted"><a class="text-link" href="'+esc(m.page_url||'/')+'" target="_blank">Open submitted page</a> · Discord '+(Number(m.forwarded_discord)?'sent':'not configured')+'</p><p>'+esc(last.message||'').replace(/\\n/g,'<br>')+'</p><div class="toolbar"><a class="btn" href="/admin/support">Open support desk</a></div><p class="muted">Updated '+esc(dt(m.updated_at||m.created_at))+'</p></article>'}
      function summary(orders,inquiries,support){const paid=orders.filter(o=>String(o.payment_status).toLowerCase()==='paid'); const attention=orders.filter(o=>['checkout_created','failed','expired','unpaid'].includes(String(o.payment_status).toLowerCase())); const openQuotes=inquiries.filter(q=>!['won','lost','archived'].includes(String(q.status||'new').toLowerCase())); return '<div class="order-dashboard"><div class="metric-card"><strong>'+orders.length+'</strong><span>Total checkout orders</span></div><div class="metric-card"><strong>'+paid.length+'</strong><span>Paid by Stripe</span></div><div class="metric-card"><strong>'+attention.length+'</strong><span>Need attention</span></div><div class="metric-card"><strong>'+openQuotes.length+'</strong><span>Open quotes</span></div><div class="metric-card"><strong>'+support.length+'</strong><span>Support messages</span></div></div>'}
      function wireOrderFilter(){const q=document.getElementById('orderSearch'); const f=document.getElementById('paymentFilter'); const cards=[...document.querySelectorAll('[data-order-card]')]; const count=document.getElementById('orderVisibleCount'); function apply(){const text=(q?.value||'').trim().toLowerCase(); const status=f?.value||''; let shown=0; cards.forEach(card=>{const ok=(!text||(card.dataset.search||'').includes(text))&&(!status||card.dataset.payment===status); card.hidden=!ok; if(ok)shown+=1}); if(count)count.textContent=shown+' of '+cards.length+' orders shown'} [q,f].forEach(el=>el&&el.addEventListener('input',apply)); apply()}
      async function load(){try{const s=await api('/api/admin/session'); if(!s.authenticated)return login(); const orders=await api('/api/admin/orders'); const inquiries=await api('/api/admin/inquiries'); const support=await api('/api/admin/support'); app.className=''; app.innerHTML='<div class="toolbar" style="margin-bottom:24px"><a class="btn" href="/admin/support">Support desk</a><a class="btn secondary" href="/admin/products">Products</a><a class="btn secondary" href="/admin">Articles</a><a class="btn secondary" href="/shop" target="_blank">Open shop</a></div>'+summary(orders,inquiries,support)+'<section class="section" style="padding:0"><p class="eyebrow">Paid checkout</p><h2>Orders</h2><div class="order-filter"><input id="orderSearch" type="search" placeholder="Search by SKU, buyer, country, session..."><select id="paymentFilter"><option value="">All payment statuses</option><option value="paid">Paid</option><option value="checkout_created">Waiting</option><option value="failed">Failed</option><option value="expired">Expired</option></select></div><p id="orderVisibleCount" class="muted"></p><div class="article-grid">'+(orders.length?orders.map(orderCard).join(''):'<div class="notice">No orders yet. New checkout attempts will appear here after customers click Pay.</div>')+'</div></section><section class="section" style="padding:40px 0 0"><p class="eyebrow">Support inbox</p><h2>Live chat conversations</h2><div class="article-grid">'+(support.length?support.map(supportCard).join(''):'<div class="notice">No support conversations yet.</div>')+'</div></section><section class="section" style="padding:40px 0 0"><p class="eyebrow">Quote requests</p><h2>Inquiries</h2><div class="article-grid">'+(inquiries.length?inquiries.map(inquiryCard).join(''):'<div class="notice">No quote requests yet.</div>')+'</div></section>'; orders.forEach(o=>{const s=document.querySelector('[data-status="'+CSS.escape(o.id)+'"]'); if(s)s.value=o.fulfillment_status||'new'}); inquiries.forEach(q=>{const s=document.querySelector('[data-inquiry-status="'+CSS.escape(q.id)+'"]'); if(s)s.value=q.status||'new'}); wireOrderFilter(); document.querySelectorAll('[data-save-order]').forEach(b=>b.onclick=async()=>{const id=b.dataset.saveOrder; await api('/api/admin/orders/'+encodeURIComponent(id),{method:'PATCH',body:JSON.stringify({fulfillment_status:document.querySelector('[data-status="'+CSS.escape(id)+'"]').value,notes:document.querySelector('[data-notes="'+CSS.escape(id)+'"]').value})}); b.textContent='Saved'}); document.querySelectorAll('[data-save-inquiry]').forEach(b=>b.onclick=async()=>{const id=b.dataset.saveInquiry; await api('/api/admin/inquiries/'+encodeURIComponent(id),{method:'PATCH',body:JSON.stringify({status:document.querySelector('[data-inquiry-status="'+CSS.escape(id)+'"]').value})}); b.textContent='Saved'})}catch(e){app.className='notice';app.textContent=e.message}}
      load();
    </script></main>`;
  return html(shell({ title: `${tenant.lang === "zh-CN" ? "订单后台" : "Orders"} | ${tenant.name}`, description: `${tenant.name} order and quote admin.`, path: "/admin/orders", content, tenant }), { cache: "no-store" });
}

function adminSupportPage(tenant = TENANTS.toumyou) {
  const content = `<main class="admin-wrap">${adminHeader(tenant, "support")}
    <div id="app" class="notice">Loading...</div>
    <script>
      const app=document.getElementById('app');
      let conversations=[],activeId='';
      const esc=(v='')=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
      const dt=v=>v?new Date(Number(v)*1000).toLocaleString():'-';
      async function api(url,options={}){const r=await fetch(url,{cache:'no-store',headers:{'content-type':'application/json'},...options});if(!r.ok)throw new Error(await r.text());return r.json()}
      function login(){app.className='notice';app.innerHTML='<label>Password</label><input id="pw" type="password" autocomplete="current-password"><div class="toolbar"><button class="btn" id="go">Log in</button><a class="btn secondary" href="/admin/orders">Orders</a></div>';document.getElementById('go').onclick=async()=>{try{await api('/api/admin/login',{method:'POST',body:JSON.stringify({password:document.getElementById('pw').value})});load()}catch(e){alert('Login failed')}}}
      function lastMessage(c){return (c.messages||[]).slice(-1)[0]||{}}
      function threadButton(c){const last=lastMessage(c);const unread=last.sender==='customer'?' · needs reply':'';return '<button class="support-thread '+(c.id===activeId?'active':'')+'" data-thread="'+esc(c.id)+'"><span><b>'+esc(c.name||'Website visitor')+'</b><small>'+esc(c.email||'No email')+unread+'</small></span><em>'+esc(dt(c.updated_at||c.created_at))+'</em><p>'+esc(last.message||'').slice(0,120)+'</p></button>'}
      function bubble(m){return '<div class="desk-bubble '+esc(m.sender==='agent'?'agent':'customer')+'"><strong>'+esc(m.sender==='agent'?'Toumyou':'Customer')+'</strong><p>'+esc(m.message||'').replace(/\\n/g,'<br>')+'</p><small>'+esc(dt(m.created_at))+'</small></div>'}
      function render(){if(!conversations.length){app.className='notice';app.innerHTML='<div class="toolbar"><a class="btn secondary" href="/admin/orders">Orders</a><a class="btn secondary" href="/shop" target="_blank">Open shop</a></div>No support conversations yet.';return}if(!activeId||!conversations.some(c=>c.id===activeId))activeId=conversations[0].id;const active=conversations.find(c=>c.id===activeId);app.className='support-desk';app.innerHTML='<aside><div class="toolbar"><a class="btn secondary" href="/admin/orders">Orders</a><a class="btn secondary" href="/shop" target="_blank">Shop</a></div><input id="supportSearch" type="search" placeholder="Search customer, email, message"><div class="support-thread-list">'+conversations.map(threadButton).join('')+'</div></aside><section><div class="support-conversation-head"><div><p class="eyebrow">Conversation</p><h2>'+esc(active.name||'Website visitor')+'</h2><p class="muted">'+esc(active.email||'')+' · '+esc(active.company||'')+'</p><p class="muted"><a class="text-link" href="'+esc(active.page_url||'/')+'" target="_blank">Open customer page</a> · '+esc(active.id)+'</p></div><a class="btn secondary" href="mailto:'+encodeURIComponent(active.email||'')+'">Email</a></div><div class="desk-feed" id="deskFeed">'+(active.messages||[]).map(bubble).join('')+'</div><form method="post" action="/api/admin/support/'+encodeURIComponent(active.id)+'/reply-form"><label>Reply to customer page</label><textarea id="replyBox" name="message" required minlength="2" placeholder="Write a clear reply. The customer will see it in their website chat window."></textarea><div class="toolbar"><button class="btn" type="submit">Send reply</button><span id="replyStatus" class="status">This sends directly to the website chat.</span></div></form></section>';document.querySelectorAll('[data-thread]').forEach(b=>b.onclick=()=>{activeId=b.dataset.thread;render()});const feed=document.getElementById('deskFeed');if(feed)feed.scrollTop=feed.scrollHeight;const search=document.getElementById('supportSearch');if(search)search.oninput=()=>{const q=search.value.trim().toLowerCase();document.querySelectorAll('[data-thread]').forEach(btn=>{btn.hidden=q&&!btn.textContent.toLowerCase().includes(q)})}}
      async function load(){try{const s=await api('/api/admin/session');if(!s.authenticated)return login();conversations=await api('/api/admin/support');render()}catch(e){app.className='notice';app.textContent=e.message}}
      load();setInterval(async()=>{const box=document.getElementById('replyBox');if(app.className==='support-desk'&&!(box&&(document.activeElement===box||box.value.trim()))){const prev=activeId;conversations=await api('/api/admin/support');activeId=prev;render()}},5000);
    </script></main>`;
  return html(shell({ title: `${tenant.lang === "zh-CN" ? "客服后台" : "Support desk"} | ${tenant.name}`, description: `${tenant.name} live chat support desk.`, path: "/admin/support", content, tenant }), { cache: "no-store" });
}

async function readBody(request) {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) return request.json().catch(() => ({}));
  if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    return Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]));
  }
  return {};
}

async function stripeCheckout(request, env) {
  const tenant = tenantFromRequest(request);
  const zh = tenant.lang === "zh-CN";
  const stripeKey = env.STRIPE_RESTRICTED_KEY || env.STRIPE_SECRET_KEY;
  if (!stripeKey) return html(shell({
    title: zh ? "支付未配置 | 西缈科技" : "Checkout not configured | Toumyou",
    description: zh ? "在线支付尚未配置。" : "Stripe checkout is not configured yet.",
    content: zh ? `<main class="listing"><h1>在线支付<br><em>暂未配置。</em></h1><p class="lead">请先发送询价，我们会与你确认采购信息。</p><a class="btn" href="mailto:${escapeHtml(tenant.email)}?subject=${encodeURIComponent("紧固件询价")}">发送询价</a></main>` : '<main class="listing"><h1>Checkout is<br><em>not configured.</em></h1><p class="lead">Please request a quote while payment keys are being configured.</p><a class="btn" href="mailto:sunflyerjp@gmail.com?subject=Fastener%20quote%20request">Request quote</a></main>',
    tenant,
  }), { status: 503 });
  const body = await readBody(request);
  const customer = await currentCustomer(request, env);
  const productId = body.product_id || body.productId;
  const requestedQuantity = Math.min(999, Math.max(1, Number.parseInt(body.quantity || "1", 10) || 1));
  const product = await getProduct(env, productId);
  if (!product || product.status !== "published" || !product.allow_checkout || product.price_cents <= 0) {
    return json({ error: "Product is not available for checkout" }, { status: 400 });
  }
  const minQty = Math.max(1, Number.parseInt(product.moq || 1, 10) || 1);
  const inventory = Math.max(0, Number.parseInt(product.inventory || 0, 10) || 0);
  if (requestedQuantity < minQty) return json({ error: `Minimum order quantity is ${minQty}` }, { status: 400 });
  if (inventory > 0 && requestedQuantity > inventory) return json({ error: `Only ${inventory} units are available for immediate checkout` }, { status: 400 });
  const quantity = requestedQuantity;
  await upsertProductSnapshot(env, product);
  await ensureCommerce(env);
  const orderId = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const params = new URLSearchParams();
  params.set("mode", "payment");
  params.set("success_url", `${tenant.url}/shop/success?session_id={CHECKOUT_SESSION_ID}`);
  params.set("cancel_url", `${tenant.url}/shop/products/${encodeURIComponent(product.slug)}`);
  params.set("client_reference_id", product.id);
  params.set("integration_identifier", "toumyou_shop_mqzjprla");
  params.set("phone_number_collection[enabled]", "true");
  params.set("shipping_address_collection[allowed_countries][0]", "JP");
  params.set("shipping_address_collection[allowed_countries][1]", "US");
  params.set("shipping_address_collection[allowed_countries][2]", "CA");
  params.set("shipping_address_collection[allowed_countries][3]", "GB");
  params.set("shipping_address_collection[allowed_countries][4]", "AU");
  params.set("shipping_address_collection[allowed_countries][5]", "DE");
  params.set("shipping_address_collection[allowed_countries][6]", "FR");
  params.set("shipping_address_collection[allowed_countries][7]", "SG");
  params.set("shipping_address_collection[allowed_countries][8]", "CN");
  params.set("shipping_address_collection[allowed_countries][9]", "HK");
  params.set("shipping_address_collection[allowed_countries][10]", "TW");
  // Keep freight visible and selectable in Stripe Checkout. Values can be
  // overridden per deployment without changing product prices.
  const shippingCurrency = String(product.currency || "USD").toLowerCase();
  const standardShipping = Math.max(0, Number.parseInt(env.SHIPPING_STANDARD_CENTS || "2500", 10) || 2500);
  const expressShipping = Math.max(0, Number.parseInt(env.SHIPPING_EXPRESS_CENTS || "6500", 10) || 6500);
  params.set("shipping_options[0][shipping_rate_data][type]", "fixed_amount");
  params.set("shipping_options[0][shipping_rate_data][display_name]", "Standard international shipping");
  params.set("shipping_options[0][shipping_rate_data][fixed_amount][amount]", String(standardShipping));
  params.set("shipping_options[0][shipping_rate_data][fixed_amount][currency]", shippingCurrency);
  params.set("shipping_options[0][shipping_rate_data][delivery_estimate][minimum][unit]", "business_day");
  params.set("shipping_options[0][shipping_rate_data][delivery_estimate][minimum][value]", "7");
  params.set("shipping_options[0][shipping_rate_data][delivery_estimate][maximum][unit]", "business_day");
  params.set("shipping_options[0][shipping_rate_data][delivery_estimate][maximum][value]", "14");
  params.set("shipping_options[1][shipping_rate_data][type]", "fixed_amount");
  params.set("shipping_options[1][shipping_rate_data][display_name]", "Express international shipping");
  params.set("shipping_options[1][shipping_rate_data][fixed_amount][amount]", String(expressShipping));
  params.set("shipping_options[1][shipping_rate_data][fixed_amount][currency]", shippingCurrency);
  params.set("shipping_options[1][shipping_rate_data][delivery_estimate][minimum][unit]", "business_day");
  params.set("shipping_options[1][shipping_rate_data][delivery_estimate][minimum][value]", "3");
  params.set("shipping_options[1][shipping_rate_data][delivery_estimate][maximum][unit]", "business_day");
  params.set("shipping_options[1][shipping_rate_data][delivery_estimate][maximum][value]", "7");
  params.set("line_items[0][quantity]", String(quantity));
  params.set("line_items[0][price_data][currency]", String(product.currency || "USD").toLowerCase());
  params.set("line_items[0][price_data][unit_amount]", String(product.price_cents));
  params.set("line_items[0][price_data][product_data][name]", product.name);
  params.set("line_items[0][price_data][product_data][description]", product.excerpt || product.description || product.sku || product.slug);
  if (product.image_url) params.set("line_items[0][price_data][product_data][images][0]", product.image_url);
  params.set("metadata[product_id]", product.id);
  params.set("metadata[product_slug]", product.slug);
  params.set("metadata[order_id]", orderId);
  params.set("metadata[sku]", product.sku || "");
  params.set("metadata[order_type]", "single");
  if (customer?.id) params.set("metadata[customer_id]", customer.id);
  if (customer?.email) params.set("customer_email", customer.email);
  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${stripeKey}`,
      "content-type": "application/x-www-form-urlencoded",
      "stripe-version": "2026-06-24.dahlia",
    },
    body: params,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.url) return json({ error: "Stripe checkout failed", details: data.error?.message || "Unknown error" }, { status: 502 });
  if (env.DB) {
    await env.DB.prepare("INSERT INTO orders (id,stripe_session_id,product_id,product_slug,product_name,sku,quantity,amount_total,currency,payment_status,fulfillment_status,customer_id,customer_email,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
      .bind(orderId, data.id || "", product.id, product.slug, product.name, product.sku || "", quantity, product.price_cents * quantity, product.currency, "checkout_created", "new", customer?.id || "", customer?.email || "", now, now).run()
      .catch(() => {});
  }
  return Response.redirect(data.url, 303);
}

async function stripeCartCheckout(request, env) {
  const tenant = tenantFromRequest(request);
  const stripeKey = env.STRIPE_RESTRICTED_KEY || env.STRIPE_SECRET_KEY;
  if (!stripeKey) return html(shell({ title: tenant.lang === "zh-CN" ? "支付未配置 | 西缈科技" : "Checkout not configured | Toumyou", description: "Stripe checkout is not configured yet.", content: tenant.lang === "zh-CN" ? '<main class="listing"><h1>在线支付暂未配置。</h1><p class="lead">请先发送询价，我们会与你确认采购信息。</p></main>' : '<main class="listing"><h1>Checkout is not configured.</h1><p class="lead">Please request a quote while payment keys are being configured.</p></main>', tenant }), { status: 503 });
  const customer = await currentCustomer(request, env);
  if (!customer) return Response.redirect(`${tenant.url}/login?next=/cart`, 303);
  const items = (await listCart(env, customer.id)).filter((item) => item.status === "published" && item.allow_checkout && item.price_cents > 0);
  if (!items.length) return Response.redirect(`${tenant.url}/cart`, 303);
  const orderId = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const currency = String(items[0].currency || "JPY").toUpperCase();
  if (items.some((item) => String(item.currency || "JPY").toUpperCase() !== currency)) return json({ error: "Cart checkout requires one currency per order" }, { status: 400 });
  const subtotal = items.reduce((sum, item) => sum + Number(item.price_cents || 0) * Number(item.quantity || 1), 0);
  const totalQty = items.reduce((sum, item) => sum + Number(item.quantity || 1), 0);
  const params = new URLSearchParams();
  params.set("mode", "payment");
  params.set("success_url", `${tenant.url}/shop/success?session_id={CHECKOUT_SESSION_ID}`);
  params.set("cancel_url", `${tenant.url}/cart`);
  params.set("client_reference_id", customer.id);
  params.set("customer_email", customer.email || "");
  params.set("integration_identifier", "toumyou_cart_mqzjprla");
  params.set("phone_number_collection[enabled]", "true");
  ["JP", "US", "CA", "GB", "AU", "DE", "FR", "SG", "CN", "HK", "TW"].forEach((country, index) => params.set(`shipping_address_collection[allowed_countries][${index}]`, country));
  const shippingCurrency = currency.toLowerCase();
  const standardShipping = Math.max(0, Number.parseInt(env.SHIPPING_STANDARD_CENTS || "2500", 10) || 2500);
  const expressShipping = Math.max(0, Number.parseInt(env.SHIPPING_EXPRESS_CENTS || "6500", 10) || 6500);
  params.set("shipping_options[0][shipping_rate_data][type]", "fixed_amount");
  params.set("shipping_options[0][shipping_rate_data][display_name]", "Standard international shipping");
  params.set("shipping_options[0][shipping_rate_data][fixed_amount][amount]", String(standardShipping));
  params.set("shipping_options[0][shipping_rate_data][fixed_amount][currency]", shippingCurrency);
  params.set("shipping_options[1][shipping_rate_data][type]", "fixed_amount");
  params.set("shipping_options[1][shipping_rate_data][display_name]", "Express international shipping");
  params.set("shipping_options[1][shipping_rate_data][fixed_amount][amount]", String(expressShipping));
  params.set("shipping_options[1][shipping_rate_data][fixed_amount][currency]", shippingCurrency);
  items.forEach((item, index) => {
    params.set(`line_items[${index}][quantity]`, String(Math.max(1, Number(item.quantity || 1))));
    params.set(`line_items[${index}][price_data][currency]`, String(item.currency || "JPY").toLowerCase());
    params.set(`line_items[${index}][price_data][unit_amount]`, String(item.price_cents));
    params.set(`line_items[${index}][price_data][product_data][name]`, item.name);
    params.set(`line_items[${index}][price_data][product_data][description]`, item.sku || item.slug);
    if (item.image_url) params.set(`line_items[${index}][price_data][product_data][images][0]`, item.image_url);
  });
  params.set("metadata[order_id]", orderId);
  params.set("metadata[order_type]", "cart");
  params.set("metadata[customer_id]", customer.id);
  params.set("metadata[item_count]", String(items.length));
  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { authorization: `Bearer ${stripeKey}`, "content-type": "application/x-www-form-urlencoded", "stripe-version": "2026-06-24.dahlia" },
    body: params,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.url) return json({ error: "Stripe checkout failed", details: data.error?.message || "Unknown error" }, { status: 502 });
  await env.DB.prepare("INSERT INTO orders (id,stripe_session_id,product_id,product_slug,product_name,sku,quantity,amount_total,currency,payment_status,fulfillment_status,customer_id,customer_email,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
    .bind(orderId, data.id || "", "cart", "cart", `Cart checkout (${items.length} items)`, "Multiple SKUs", totalQty, subtotal, currency, "checkout_created", "new", customer.id, customer.email || "", now, now).run();
  return Response.redirect(data.url, 303);
}

function timingSafeEqualHex(a = "", b = "") {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

async function verifyStripeSignature(payload, header = "", secret = "") {
  if (!payload || !header || !secret) return false;
  const parts = Object.fromEntries(header.split(",").map((part) => {
    const [key, ...rest] = part.split("=");
    return [key, rest.join("=")];
  }));
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;
  const signedPayload = `${timestamp}.${payload}`;
  const expected = await hmac(secret, signedPayload);
  return timingSafeEqualHex(expected, signature);
}

async function stripeWebhook(request, env) {
  if (!env.STRIPE_WEBHOOK_SECRET) return json({ error: "Webhook signing secret is not configured" }, { status: 503 });
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature") || "";
  if (!(await verifyStripeSignature(payload, signature, env.STRIPE_WEBHOOK_SECRET))) {
    return json({ error: "Invalid Stripe signature" }, { status: 400 });
  }
  const event = JSON.parse(payload);
  await ensureCommerce(env);
  const now = Math.floor(Date.now() / 1000);
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data?.object || {};
    const orderId = session.metadata?.order_id || "";
    const customer = session.customer_details || {};
    const shipping = session.shipping_details || {};
    const shippingAddress = shipping.address ? formatAddress(shipping.address) : "";
    const updateSql = orderId
      ? "UPDATE orders SET stripe_session_id=?,amount_total=?,currency=?,payment_status=?,customer_email=?,customer_name=?,customer_phone=?,shipping_name=?,shipping_address=?,shipping_country=?,stripe_payment_intent=?,raw_event=?,updated_at=? WHERE id=?"
      : "UPDATE orders SET amount_total=?,currency=?,payment_status=?,customer_email=?,customer_name=?,customer_phone=?,shipping_name=?,shipping_address=?,shipping_country=?,stripe_payment_intent=?,raw_event=?,updated_at=? WHERE stripe_session_id=?";
    const result = orderId
      ? await env.DB.prepare(updateSql).bind(session.id || "", session.amount_total || 0, String(session.currency || "").toUpperCase(), session.payment_status || "paid", customer.email || "", customer.name || "", customer.phone || "", shipping.name || "", shippingAddress, shipping.address?.country || "", session.payment_intent || "", payload.slice(0, 12000), now, orderId).run()
      : await env.DB.prepare(updateSql).bind(session.amount_total || 0, String(session.currency || "").toUpperCase(), session.payment_status || "paid", customer.email || "", customer.name || "", customer.phone || "", shipping.name || "", shippingAddress, shipping.address?.country || "", session.payment_intent || "", payload.slice(0, 12000), now, session.id || "").run();
    if (!result.meta?.changes && session.id) {
      const fallbackId = orderId || crypto.randomUUID();
      await env.DB.prepare("INSERT OR IGNORE INTO orders (id,stripe_session_id,product_id,product_slug,product_name,sku,quantity,amount_total,currency,payment_status,fulfillment_status,customer_email,customer_name,customer_phone,shipping_name,shipping_address,shipping_country,stripe_payment_intent,raw_event,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
        .bind(fallbackId, session.id, session.metadata?.product_id || "", session.metadata?.product_slug || "", session.metadata?.product_slug || "Stripe order", session.metadata?.sku || "", 1, session.amount_total || 0, String(session.currency || "JPY").toUpperCase(), session.payment_status || "paid", "new", customer.email || "", customer.name || "", customer.phone || "", shipping.name || "", shippingAddress, shipping.address?.country || "", session.payment_intent || "", payload.slice(0, 12000), now, now).run();
    }
    if (session.payment_status === "paid") {
      const paidOrder = orderId
        ? await env.DB.prepare("SELECT product_id,quantity FROM orders WHERE id=?").bind(orderId).first()
        : await env.DB.prepare("SELECT product_id,quantity FROM orders WHERE stripe_session_id=?").bind(session.id || "").first();
      const productId = paidOrder?.product_id || session.metadata?.product_id || "";
      const paidQuantity = Math.max(1, Number.parseInt(paidOrder?.quantity || "1", 10) || 1);
      if (productId) {
        await env.DB.prepare("UPDATE products SET inventory=MAX(inventory-?,0),updated_at=? WHERE id=? AND inventory>0")
          .bind(paidQuantity, now, productId).run().catch(() => {});
      }
      if (session.metadata?.order_type === "cart" && session.metadata?.customer_id) {
        await env.DB.prepare("DELETE FROM cart_items WHERE customer_id=?").bind(session.metadata.customer_id).run().catch(() => {});
      }
    }
  }
  if (event.type === "checkout.session.async_payment_failed" || event.type === "checkout.session.expired") {
    const session = event.data?.object || {};
    const orderId = session.metadata?.order_id || "";
    const status = event.type === "checkout.session.expired" ? "expired" : "failed";
    const paymentIntent = typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id || "");
    const result = orderId
      ? await env.DB.prepare("UPDATE orders SET stripe_session_id=?,payment_status=?,stripe_payment_intent=?,raw_event=?,updated_at=? WHERE id=?")
        .bind(session.id || "", status, paymentIntent, payload.slice(0, 12000), now, orderId).run()
      : await env.DB.prepare("UPDATE orders SET payment_status=?,stripe_payment_intent=?,raw_event=?,updated_at=? WHERE stripe_session_id=?")
        .bind(status, paymentIntent, payload.slice(0, 12000), now, session.id || "").run();
    if (!result.meta?.changes && session.id) {
      const fallbackId = orderId || crypto.randomUUID();
      await env.DB.prepare("INSERT OR IGNORE INTO orders (id,stripe_session_id,product_id,product_slug,product_name,sku,quantity,amount_total,currency,payment_status,fulfillment_status,stripe_payment_intent,raw_event,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
        .bind(fallbackId, session.id, session.metadata?.product_id || "", session.metadata?.product_slug || "", session.metadata?.product_slug || "Stripe order", session.metadata?.sku || "", 1, session.amount_total || 0, String(session.currency || "JPY").toUpperCase(), status, "new", paymentIntent, payload.slice(0, 12000), now, now).run();
    }
  }
  return json({ received: true });
}

async function quoteRequest(request, env) {
  const body = await readBody(request);
  const email = String(body.email || "").trim();
  if (!email || !email.includes("@")) return json({ error: "Valid email is required" }, { status: 400 });
  await ensureCommerce(env);
  const product = body.product_id ? await getProduct(env, body.product_id) : null;
  const now = Math.floor(Date.now() / 1000);
  const id = crypto.randomUUID();
  await env.DB.prepare("INSERT INTO inquiries (id,product_id,product_slug,product_name,name,email,company,country,quantity,specs,message,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
    .bind(id, product?.id || String(body.product_id || ""), product?.slug || "", product?.name || "", String(body.name || ""), email, String(body.company || ""), String(body.country || ""), String(body.quantity || ""), String(body.specs || ""), String(body.message || ""), "new", now, now).run();
  const pageUrl = supportPageUrl(request, body.page_url || (product?.slug ? `/shop/products/${product.slug}` : "/shop"));
  await forwardSupportMessage(env, {
    page_url: pageUrl,
    name: String(body.name || ""),
    email,
    company: String(body.company || ""),
    message: [
      product?.name ? `Quote request for ${product.name}` : "Quote request",
      body.quantity ? `Quantity: ${body.quantity}` : "",
      body.country ? `Country: ${body.country}` : "",
      body.specs ? `Specs: ${body.specs}` : "",
      body.message ? `Message: ${body.message}` : "",
    ].filter(Boolean).join("\n"),
  });
  return json({ ok: true, id });
}

async function supportRequest(request, env) {
  const body = await readBody(request);
  const email = String(body.email || "").trim();
  const message = String(body.message || "").trim();
  if (message.length < 3) return json({ error: "Message is required" }, { status: 400 });
  await ensureCommerce(env);
  const requestedConversation = String(body.conversation_id || "").trim();
  const existing = requestedConversation ? await getSupportConversation(env, requestedConversation) : null;
  if (!existing && (!email || !email.includes("@"))) return json({ error: "Valid email is required" }, { status: 400 });
  const now = Math.floor(Date.now() / 1000);
  const id = crypto.randomUUID();
  const conversationId = existing?.id || requestedConversation || id;
  const payload = {
    page_url: supportPageUrl(request, body.page_url),
    conversation_id: conversationId,
    name: String(body.name || "").trim(),
    email: email || existing?.email || "",
    company: String(body.company || "").trim(),
    message,
  };
  const forwarded = await forwardSupportMessage(env, payload);
  await env.DB.prepare("INSERT INTO support_messages (id,conversation_id,sender,page_url,name,email,company,message,status,forwarded_discord,forwarded_telegram,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)")
    .bind(id, conversationId, "customer", payload.page_url, payload.name || existing?.name || "", payload.email, payload.company || existing?.company || "", payload.message, "open", forwarded.discord ? 1 : 0, 0, now, now).run();
  return json({ ok: true, id, conversation_id: conversationId, forwarded, ...(await getSupportConversation(env, conversationId)) });
}

async function supportConversationRequest(env, conversationId) {
  const conversation = await getSupportConversation(env, conversationId);
  if (!conversation) return json({ error: "Conversation not found" }, { status: 404 });
  return json(conversation, { cache: "no-store" });
}

async function adminSupportReply(request, env, conversationId) {
  const tenant = tenantFromRequest(request);
  const body = await readBody(request);
  const message = String(body.message || "").trim();
  if (message.length < 2) return json({ error: "Reply is required" }, { status: 400 });
  const existing = await getSupportConversation(env, conversationId);
  if (!existing) return json({ error: "Conversation not found" }, { status: 404 });
  const now = Math.floor(Date.now() / 1000);
  const id = crypto.randomUUID();
  await env.DB.prepare("INSERT INTO support_messages (id,conversation_id,sender,page_url,name,email,company,message,status,forwarded_discord,forwarded_telegram,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)")
    .bind(id, conversationId, "agent", existing.page_url || tenant.url, existing.name || "", existing.email || "", existing.company || "", message, "open", 0, 0, now, now).run();
  return json({ ok: true, ...(await getSupportConversation(env, conversationId)) });
}

async function adminSupportReplyForm(request, env, conversationId) {
  const tenant = tenantFromRequest(request);
  const body = await readBody(request);
  const message = String(body.message || "").trim();
  if (message.length < 2) return redirect(`${tenant.url}/admin/support?error=empty`, 303);
  const existing = await getSupportConversation(env, conversationId);
  if (!existing) return redirect(`${tenant.url}/admin/support?error=missing`, 303);
  const now = Math.floor(Date.now() / 1000);
  const id = crypto.randomUUID();
  await env.DB.prepare("INSERT INTO support_messages (id,conversation_id,sender,page_url,name,email,company,message,status,forwarded_discord,forwarded_telegram,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)")
    .bind(id, conversationId, "agent", existing.page_url || tenant.url, existing.name || "", existing.email || "", existing.company || "", message, "open", 0, 0, now, now).run();
  return redirect(`${tenant.url}/admin/support?sent=1`, 303);
}

function checkoutSuccessPage(tenant = TENANTS.toumyou) {
  const zh = tenant.lang === "zh-CN";
  return html(shell({
    title: zh ? "订单已提交 | 西缈科技" : "Order submitted | Toumyou",
    description: zh ? "感谢你的订单提交。" : "Thank you for your Toumyou shop order.",
    path: "/shop/success",
    content: `<main class="listing"><h1>${zh ? "订单已提交，<br><em>谢谢。</em>" : "Order submitted,<br><em>thank you.</em>"}</h1><p class="lead">${zh ? "你的支付流程已提交。部分支付方式可能需要一点时间确认，后台会在收到支付确认后更新订单状态。" : "Your Stripe checkout was submitted. Some local payment methods, including Alipay, can take a little longer to confirm, so we will mark the order as paid only after Stripe sends the final payment confirmation."}</p>
      <div class="notice">
        <p><strong>${zh ? "接下来" : "What happens next"}</strong></p>
        <p>${zh ? "1. 支付平台发送最终支付确认。" : "1. Stripe sends Toumyou a signed payment update."}</p>
        <p>${zh ? "2. 已支付订单会进入后台订单列表。" : "2. Paid orders move to the admin order list automatically."}</p>
        <p>${zh ? "3. 我们会核对 SKU、库存和交付信息。" : "3. We verify SKU, stock, export handling, and freight details before dispatch."}</p>
        <p id="sessionNote" class="muted"></p>
      </div>
      <div class="toolbar"><a class="btn" href="/shop">${zh ? "返回产品页" : "Back to shop"}</a><a class="btn secondary" href="mailto:${escapeHtml(tenant.email)}">${zh ? "联系我们" : "Contact us"}</a></div>
      <script>
        const sid = new URL(location.href).searchParams.get('session_id');
        if (sid) document.getElementById('sessionNote').textContent = 'Stripe session: ' + sid;
      </script>
    </main>`,
    tenant,
  }), { cache: "no-store" });
}

function loginPage(request, env) {
  const tenant = tenantFromRequest(request);
  const zh = tenant.lang === "zh-CN";
  const configured = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
  const next = new URL(request.url).searchParams.get("next") || "/account";
  return html(shell({
    title: zh ? "客户登录 | 上海西缈科技有限公司" : "Customer login | Toumyou",
    description: zh ? "登录后管理购物车、订单和支付记录。" : "Sign in to Toumyou to manage cart, orders, and payment records.",
    path: "/login",
    content: `<main class="listing"><h1>${zh ? "客户登录。" : "Customer login."}</h1><p class="lead">${zh ? "登录后可以保存购物车，查看订单、支付状态和采购记录。" : "Sign in to save your cart and view your Toumyou orders, payment status, shipping address, and Stripe records."}</p>
      <div class="notice">
        ${configured
          ? `<a class="btn" href="/api/auth/google/start?next=${encodeURIComponent(next)}">${zh ? "使用 Google 登录" : "Continue with Google"}</a>`
          : `<p><strong>${zh ? "Google 登录尚未配置。" : "Google login is not configured yet."}</strong></p><p>${zh ? "请在 Cloudflare Pages 中配置 GOOGLE_CLIENT_ID 和 GOOGLE_CLIENT_SECRET，并将 OAuth 回调地址设置为" : "Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Cloudflare Pages, then set the Google OAuth redirect URI to"} ${tenant.url}/api/auth/google/callback.</p>`}
        ${zh ? '<p class="muted" style="margin-top:16px">QQ 登录需要 QQ 互联 AppID / AppKey / 回调域名审核，拿到凭据后可以继续接入。</p>' : ""}
      </div>
    </main>`,
    tenant,
  }), { cache: "no-store" });
}

async function accountPage(request, env) {
  const tenant = tenantFromRequest(request);
  const zh = tenant.lang === "zh-CN";
  const customer = await currentCustomer(request, env);
  if (!customer) return loginPage(new Request(`${tenant.url}/login?next=/account`), env);
  const orders = await listCustomerOrders(env, customer);
  const cards = orders.map((o) => `<article class="article-card">
    <div class="meta">${escapeHtml(o.payment_status || "pending")} / ${escapeHtml(o.fulfillment_status || "new")}</div>
    <h3>${escapeHtml(o.product_name || o.product_slug || (zh ? "西缈订单" : "Toumyou order"))}</h3>
    <p>${escapeHtml(o.sku || "Order")}<br>${escapeHtml(money(o.amount_total, o.currency))}</p>
    <p class="muted">${zh ? "数量" : "Quantity"} ${escapeHtml(o.quantity || 1)}. ${zh ? "创建时间" : "Created"} ${escapeHtml(o.created_at ? new Date(Number(o.created_at) * 1000).toLocaleString() : "-")}.</p>
    <p class="muted">Stripe session: ${escapeHtml(o.stripe_session_id || "-")}</p>
    ${o.stripe_payment_intent ? `<a class="btn secondary" href="https://dashboard.stripe.com/payments/${escapeHtml(o.stripe_payment_intent)}" target="_blank">${zh ? "支付记录" : "Payment record"}</a>` : ""}
  </article>`).join("");
  return html(shell({
    title: zh ? "我的账户 | 上海西缈科技有限公司" : "My account | Toumyou",
    description: zh ? "客户账户与订单历史。" : "Toumyou customer account and order history.",
    path: "/account",
    content: `<main class="listing"><h1>${zh ? "我的账户。" : "My account."}</h1><p class="lead">${escapeHtml(customer.name || customer.email)}<br>${escapeHtml(customer.email || "")}</p>
      <div class="toolbar"><a class="btn" href="/cart">${zh ? "打开购物车" : "Open cart"}</a><a class="btn secondary" href="/shop">${zh ? "继续采购" : "Continue shopping"}</a><a class="btn secondary" href="/api/auth/logout">${zh ? "退出登录" : "Log out"}</a></div>
      <section class="section" style="padding:40px 0 0"><p class="eyebrow">${zh ? "订单与支付" : "Orders and payments"}</p><h2>${zh ? "你的订单记录。" : "Your order history."}</h2><div class="article-grid">${cards || `<div class="notice">${zh ? "暂无订单。登录后下单或支付尝试会显示在这里。" : "No orders yet. Paid and attempted Stripe checkouts will appear here after you use this account."}</div>`}</div></section>
    </main>`,
    tenant,
  }), { cache: "no-store" });
}

async function cartPage(request, env) {
  const tenant = tenantFromRequest(request);
  const zh = tenant.lang === "zh-CN";
  const customer = await currentCustomer(request, env);
  if (!customer) return loginPage(new Request(`${tenant.url}/login?next=/cart`), env);
  const items = await listCart(env, customer.id);
  const subtotal = items.reduce((sum, item) => sum + (Number(item.price_cents || 0) * Number(item.quantity || 1)), 0);
  const currency = items[0]?.currency || "JPY";
  const cards = items.map((item) => `<article class="article-card">
    <div class="meta">${escapeHtml(item.category || (zh ? "紧固件" : "Fasteners"))} / ${escapeHtml(item.sku || item.slug)}</div>
    <h3>${escapeHtml(item.name)}</h3>
    <p>${escapeHtml(money(item.price_cents, item.currency))}<br>${zh ? "数量" : "Quantity"} ${escapeHtml(item.quantity || 1)}</p>
    <div class="toolbar">
      <form method="post" action="/api/cart/update"><input type="hidden" name="cart_id" value="${escapeHtml(item.cart_id)}"><input name="quantity" type="number" min="1" value="${escapeHtml(item.quantity || 1)}"><button class="btn secondary" type="submit">${zh ? "更新" : "Update"}</button></form>
      <form method="post" action="/api/cart/remove"><input type="hidden" name="cart_id" value="${escapeHtml(item.cart_id)}"><button class="btn secondary" type="submit">${zh ? "移除" : "Remove"}</button></form>
    </div>
  </article>`).join("");
  return html(shell({
    title: zh ? "购物车 | 上海西缈科技有限公司" : "Cart | Toumyou",
    description: zh ? "西缈科技购物车。" : "Toumyou shopping cart.",
    path: "/cart",
    content: `<main class="listing"><h1>${zh ? "购物车。" : "Shopping cart."}</h1><p class="lead">${items.length} ${zh ? "个产品" : "item(s)"}. ${zh ? "预估小计" : "Estimated subtotal"} ${escapeHtml(money(subtotal, currency))}. ${zh ? "运费和最终支付信息会在付款前确认。" : "Freight is shown before payment."}</p>
      <div class="toolbar">${items.length ? `<form method="post" action="/api/checkout/cart"><button class="btn buy" type="submit">${zh ? "购买已选产品" : "Buy selected"}</button></form>` : ""}<a class="btn secondary" href="/shop">${zh ? "继续采购" : "Continue shopping"}</a><a class="btn secondary" href="/account">${zh ? "我的账户" : "My account"}</a></div>
      <div class="article-grid">${cards || `<div class="notice">${zh ? "购物车为空。登录后可从产品页添加产品。" : "Your cart is empty. Add products from the shop after signing in."}</div>`}</div>
    </main>`,
    tenant,
  }), { cache: "no-store" });
}

async function handleApi(request, env, pathname) {
  const tenant = tenantFromRequest(request);
  if (pathname === "/api/auth/google/start") {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return json({ error: "Google login is not configured" }, { status: 503 });
    const url = new URL(request.url);
    const state = randomToken(24);
    const next = url.searchParams.get("next") || "/account";
    const auth = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    auth.searchParams.set("client_id", env.GOOGLE_CLIENT_ID);
    auth.searchParams.set("redirect_uri", `${tenant.url}/api/auth/google/callback`);
    auth.searchParams.set("response_type", "code");
    auth.searchParams.set("scope", "openid profile email");
    auth.searchParams.set("state", `${state}:${next}`);
    auth.searchParams.set("prompt", "select_account");
    return redirect(auth.toString(), 302, { "set-cookie": `toumyou_oauth_state=${encodeURIComponent(state)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600` });
  }
  if (pathname === "/api/auth/google/callback") {
    const url = new URL(request.url);
    const stateParam = url.searchParams.get("state") || "";
    const [state, next = "/account"] = stateParam.split(":");
    if (!state || state !== cookieValue(request, "toumyou_oauth_state")) return html(shell({ title: tenant.lang === "zh-CN" ? "登录失败 | 西缈科技" : "Login failed | Toumyou", description: "Google login failed.", content: tenant.lang === "zh-CN" ? '<main class="listing"><h1>登录失败。</h1><p class="lead">登录状态已过期，请重新尝试。</p><a class="btn" href="/login">返回登录</a></main>' : '<main class="listing"><h1>Login failed.</h1><p class="lead">The login state expired. Please try again.</p><a class="btn" href="/login">Back to login</a></main>', tenant }), { status: 400 });
    const code = url.searchParams.get("code") || "";
    if (!code) return json({ error: "Missing Google authorization code" }, { status: 400 });
    const body = new URLSearchParams();
    body.set("code", code);
    body.set("client_id", env.GOOGLE_CLIENT_ID || "");
    body.set("client_secret", env.GOOGLE_CLIENT_SECRET || "");
    body.set("redirect_uri", `${tenant.url}/api/auth/google/callback`);
    body.set("grant_type", "authorization_code");
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body });
    const token = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok || !token.access_token) return json({ error: "Google token exchange failed" }, { status: 502 });
    const profileRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { authorization: `Bearer ${token.access_token}` } });
    const profile = await profileRes.json().catch(() => ({}));
    if (!profileRes.ok || !profile.email || profile.email_verified === false) return json({ error: "Google profile verification failed" }, { status: 502 });
    const customer = await upsertCustomer(env, profile);
    const session = await issueCustomerSession(env, customer.id);
    const safeNext = String(next || "/account").startsWith("/") ? String(next || "/account") : "/account";
    const headers = new Headers({ location: `${tenant.url}${safeNext}` });
    headers.append("set-cookie", customerCookie(session));
    headers.append("set-cookie", "toumyou_oauth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0");
    return new Response(null, { status: 302, headers });
  }
  if (pathname === "/api/auth/logout") {
    return redirect(`${tenant.url}/`, 302, { "set-cookie": "toumyou_customer=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0" });
  }
  if (pathname === "/api/customer/session") {
    const customer = await currentCustomer(request, env);
    return json({ authenticated: Boolean(customer), customer: customer ? { email: customer.email, name: customer.name, picture: customer.picture } : null });
  }
  if (pathname === "/api/cart" && request.method === "GET") {
    const customer = await currentCustomer(request, env);
    if (!customer) return json({ error: "Login required" }, { status: 401 });
    return json(await listCart(env, customer.id));
  }
  if (pathname === "/api/cart/add" && request.method === "POST") {
    const customer = await currentCustomer(request, env);
    if (!customer) return Response.redirect(`${tenant.url}/login?next=/cart`, 303);
    const body = await readBody(request);
    const product = await getProduct(env, body.product_id || body.productId);
    if (!product || product.status !== "published" || !product.allow_checkout || product.price_cents <= 0) return json({ error: "Product is not available for cart checkout" }, { status: 400 });
    await upsertProductSnapshot(env, product);
    const qty = Math.max(Math.max(1, Number(product.moq || 1)), Math.min(999, Number.parseInt(body.quantity || "1", 10) || 1));
    const now = Math.floor(Date.now() / 1000);
    await ensureCommerce(env);
    await env.DB.prepare("INSERT INTO cart_items (id,customer_id,product_id,quantity,created_at,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(customer_id,product_id) DO UPDATE SET quantity=quantity+excluded.quantity,updated_at=excluded.updated_at")
      .bind(crypto.randomUUID(), customer.id, product.id, qty, now, now).run();
    return Response.redirect(`${tenant.url}/cart`, 303);
  }
  if (pathname === "/api/cart/update" && request.method === "POST") {
    const customer = await currentCustomer(request, env);
    if (!customer) return Response.redirect(`${tenant.url}/login?next=/cart`, 303);
    const body = await readBody(request);
    const qty = Math.max(1, Math.min(999, Number.parseInt(body.quantity || "1", 10) || 1));
    await env.DB.prepare("UPDATE cart_items SET quantity=?,updated_at=? WHERE id=? AND customer_id=?").bind(qty, Math.floor(Date.now() / 1000), body.cart_id || "", customer.id).run();
    return Response.redirect(`${tenant.url}/cart`, 303);
  }
  if (pathname === "/api/cart/remove" && request.method === "POST") {
    const customer = await currentCustomer(request, env);
    if (!customer) return Response.redirect(`${tenant.url}/login?next=/cart`, 303);
    const body = await readBody(request);
    await env.DB.prepare("DELETE FROM cart_items WHERE id=? AND customer_id=?").bind(body.cart_id || "", customer.id).run();
    return Response.redirect(`${tenant.url}/cart`, 303);
  }
  if (pathname === "/api/account/orders") {
    const customer = await currentCustomer(request, env);
    if (!customer) return json({ error: "Login required" }, { status: 401 });
    return json(await listCustomerOrders(env, customer));
  }
  if (pathname === "/api/checkout/cart" && request.method === "POST") return stripeCartCheckout(request, env);
  if (pathname === "/api/checkout" && request.method === "POST") return stripeCheckout(request, env);
  if (pathname === "/api/stripe/webhook" && request.method === "POST") return stripeWebhook(request, env);
  if (pathname === "/api/quote" && request.method === "POST") return quoteRequest(request, env);
  if (pathname === "/api/support" && request.method === "POST") return supportRequest(request, env);
  const publicSupportMatch = pathname.match(/^\/api\/support\/([^/]+)$/);
  if (publicSupportMatch && request.method === "GET") return supportConversationRequest(env, decodeURIComponent(publicSupportMatch[1]));
  if (pathname === "/api/admin/login" && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    if (!env.ADMIN_PASSWORD || body.password !== env.ADMIN_PASSWORD) return json({ error: "Invalid password" }, { status: 401 });
    const token = await issueSession(env);
    return json({ ok: true }, { headers: { "set-cookie": `toumyou_admin=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800` } });
  }
  if (pathname === "/api/admin/session") return json({ authenticated: await isAuthed(request, env) });
  if (!(await isAuthed(request, env))) return json({ error: "Unauthorized" }, { status: 401 });
  if (pathname === "/api/admin/posts" && request.method === "GET") return json(await listAll(env));
  if (pathname === "/api/admin/products" && request.method === "GET") return json(await listProducts(env, { admin: true }));
  if (pathname === "/api/admin/orders" && request.method === "GET") return json(await listOrders(env));
  if (pathname === "/api/admin/customers" && request.method === "GET") return json(await listCustomers(env));
  if (pathname === "/api/admin/settings" && request.method === "GET") return json(await getSiteSettings(env, tenant));
  if (pathname === "/api/admin/settings" && (request.method === "PUT" || request.method === "PATCH")) return json(await saveSiteSettings(env, await request.json().catch(() => ({}))));
  if (pathname === "/api/admin/inquiries" && request.method === "GET") return json(await listInquiries(env));
  if (pathname === "/api/admin/support" && request.method === "GET") return json(await listSupportMessages(env));
  const supportReplyFormMatch = pathname.match(/^\/api\/admin\/support\/([^/]+)\/reply-form$/);
  if (supportReplyFormMatch && request.method === "POST") return adminSupportReplyForm(request, env, decodeURIComponent(supportReplyFormMatch[1]));
  const supportReplyMatch = pathname.match(/^\/api\/admin\/support\/([^/]+)\/reply$/);
  if (supportReplyMatch && request.method === "POST") return adminSupportReply(request, env, decodeURIComponent(supportReplyMatch[1]));
  if (pathname === "/api/admin/upload" && request.method === "POST") return uploadMedia(request, env);
  if (pathname === "/api/admin/media" && request.method === "GET") {
    const url = new URL(request.url);
    return listMedia(env, url.searchParams.get("cursor") || "");
  }
  const mediaMatch = pathname.match(/^\/api\/admin\/media\/(.+)$/);
  if (mediaMatch && request.method === "DELETE") return deleteMedia(env, decodeURIComponent(mediaMatch[1]));
  if (pathname === "/api/admin/products" && request.method === "POST") {
    const raw = await request.json();
    const now = Math.floor(Date.now() / 1000);
    const id = crypto.randomUUID();
    const p = normalizeProduct(raw, id);
    await ensureCommerce(env);
    await env.DB.prepare("INSERT INTO products (id,slug,name,sku,excerpt,description,category,material,size,image_url,image_urls,specs,package_info,lead_time,shipping_note,moq,weight_grams,price_cents,currency,inventory,status,allow_checkout,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
      .bind(id, p.slug, p.name, p.sku, p.excerpt, p.description, p.category, p.material, p.size, p.image_url, p.image_urls, p.specs, p.package_info, p.lead_time, p.shipping_note, p.moq, p.weight_grams, p.price_cents, p.currency, p.inventory, p.status, p.allow_checkout, now, now).run();
    return json({ ok: true, id, slug: p.slug });
  }
  const productMatch = pathname.match(/^\/api\/admin\/products\/([^/]+)$/);
  if (productMatch && request.method === "PUT") {
    const existing = await getProduct(env, productMatch[1]);
    if (!existing) return json({ error: "Product not found" }, { status: 404 });
    const p = normalizeProduct(await request.json(), existing.id);
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare("UPDATE products SET slug=?,name=?,sku=?,excerpt=?,description=?,category=?,material=?,size=?,image_url=?,image_urls=?,specs=?,package_info=?,lead_time=?,shipping_note=?,moq=?,weight_grams=?,price_cents=?,currency=?,inventory=?,status=?,allow_checkout=?,updated_at=? WHERE id=?")
      .bind(p.slug, p.name, p.sku, p.excerpt, p.description, p.category, p.material, p.size, p.image_url, p.image_urls, p.specs, p.package_info, p.lead_time, p.shipping_note, p.moq, p.weight_grams, p.price_cents, p.currency, p.inventory, p.status, p.allow_checkout, now, existing.id).run();
    return json({ ok: true, slug: p.slug });
  }
  if (productMatch && request.method === "DELETE") {
    await ensureCommerce(env);
    await env.DB.prepare("DELETE FROM products WHERE id=?").bind(productMatch[1]).run();
    return json({ ok: true });
  }
  const orderMatch = pathname.match(/^\/api\/admin\/orders\/([^/]+)$/);
  if (orderMatch && (request.method === "PATCH" || request.method === "PUT")) {
    await ensureCommerce(env);
    const body = await request.json().catch(() => ({}));
    const now = Math.floor(Date.now() / 1000);
    const status = String(body.fulfillment_status || "new").trim().slice(0, 40) || "new";
    const notes = String(body.notes || "").slice(0, 4000);
    await env.DB.prepare("UPDATE orders SET fulfillment_status=?,notes=?,updated_at=? WHERE id=?")
      .bind(status, notes, now, decodeURIComponent(orderMatch[1])).run();
    return json({ ok: true });
  }
  const inquiryMatch = pathname.match(/^\/api\/admin\/inquiries\/([^/]+)$/);
  if (inquiryMatch && (request.method === "PATCH" || request.method === "PUT")) {
    await ensureCommerce(env);
    const body = await request.json().catch(() => ({}));
    const now = Math.floor(Date.now() / 1000);
    const status = String(body.status || "new").trim().slice(0, 40) || "new";
    await env.DB.prepare("UPDATE inquiries SET status=?,updated_at=? WHERE id=?")
      .bind(status, now, decodeURIComponent(inquiryMatch[1])).run();
    return json({ ok: true });
  }
  if (pathname === "/api/admin/posts" && request.method === "POST") {
    await ensureContent(env);
    const p = await request.json();
    const now = Math.floor(Date.now() / 1000);
    const id = crypto.randomUUID();
    const slug = slugify(p.slug || p.title || id);
    const publishedAt = p.status === "published" ? parsePublishDate(p.published_at, now) : null;
    await env.DB.prepare("INSERT INTO posts (id,slug,title,excerpt,body,category,status,cover_image,seo_title,seo_description,published_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)")
      .bind(id, slug, p.title || "Untitled", p.excerpt || "", p.body || "", p.category || "Insights", p.status || "draft", p.cover_image || "", p.seo_title || "", p.seo_description || "", publishedAt, now, now).run();
    return json({ ok: true, id, slug });
  }
  const match = pathname.match(/^\/api\/admin\/posts\/([^/]+)$/);
  if (match && request.method === "PUT") {
    await ensureContent(env);
    const p = await request.json();
    const now = Math.floor(Date.now() / 1000);
    const existing = await env.DB.prepare("SELECT published_at FROM posts WHERE id=?").bind(match[1]).first();
    const publishedAt = p.status === "published" ? parsePublishDate(p.published_at, existing?.published_at || now) : null;
    await env.DB.prepare("UPDATE posts SET slug=?,title=?,excerpt=?,body=?,category=?,status=?,cover_image=?,seo_title=?,seo_description=?,published_at=?,updated_at=? WHERE id=?")
      .bind(slugify(p.slug || p.title || match[1]), p.title || "Untitled", p.excerpt || "", p.body || "", p.category || "Insights", p.status || "draft", p.cover_image || "", p.seo_title || "", p.seo_description || "", publishedAt, now, match[1]).run();
    return json({ ok: true, slug: slugify(p.slug || p.title || match[1]) });
  }
  if (match && request.method === "DELETE") {
    await ensureContent(env);
    await env.DB.prepare("DELETE FROM posts WHERE id=?").bind(match[1]).run();
    return json({ ok: true });
  }
  return json({ error: "Not found" }, { status: 404 });
}

async function sitemap(env, tenant = TENANTS.toumyou) {
  const posts = await listPublished(env);
  const products = await listProducts(env);
  const urls = ["/", "/shop", ...(tenant.showDigital ? ["/digital"] : []), "/articles", ...products.map((p) => `/shop/products/${p.slug}`), ...posts.map((p) => `/articles/${p.slug}`)];
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((u) => `<url><loc>${tenant.url}${u}</loc></url>`).join("")}</urlset>`, {
    headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "no-store, no-cache, must-revalidate" },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const tenant = tenantFromRequest(request);
    if (url.pathname === "/robots.txt") return new Response(`User-agent: *\nAllow: /\nSitemap: ${tenant.url}/sitemap.xml\n`, { headers: { "content-type": "text/plain; charset=utf-8" } });
    if (url.pathname === "/sitemap.xml") return sitemap(env, tenant);
    if (url.pathname.startsWith("/media/")) return mediaFile(request, env, decodeURIComponent(url.pathname.slice("/media/".length)));
    if (url.pathname.startsWith("/api/")) return handleApi(request, env, url.pathname);
    if (url.pathname === "/") return home(env, tenant);
    if (url.pathname === "/login") return loginPage(request, env);
    if (url.pathname === "/cart") return cartPage(request, env);
    if (url.pathname === "/account") return accountPage(request, env);
    if (url.pathname === "/shop") return shopPage(env, tenant);
    if (url.pathname === "/digital" && tenant.showDigital) return digitalPage();
    if (url.pathname === "/digital") return redirect(`${tenant.url}/`, 302);
    if (url.pathname === "/shop/success") return checkoutSuccessPage(tenant);
    if (url.pathname.startsWith("/shop/products/")) return productPage(env, decodeURIComponent(url.pathname.split("/").pop()), tenant);
    if (url.pathname === "/articles") return articles(env, tenant);
    if (url.pathname.startsWith("/articles/")) return article(env, decodeURIComponent(url.pathname.split("/").pop()), tenant);
    if (url.pathname === "/admin") return adminPage(tenant);
    if (url.pathname === "/admin/products") return adminProductsPage(tenant);
    if (url.pathname === "/admin/media") return adminMediaPage(tenant);
    if (url.pathname === "/admin/orders") return adminOrdersPage(tenant);
    if (url.pathname === "/admin/customers") return adminCustomersPage(tenant);
    if (url.pathname === "/admin/settings") return adminSettingsPage(tenant);
    if (url.pathname === "/admin/support") return adminSupportPage(tenant);
    return html(shell({ title: tenant.lang === "zh-CN" ? "页面未找到 | 西缈科技" : "Not found | Toumyou", description: tenant.lang === "zh-CN" ? "页面未找到。" : "Page not found.", content: tenant.lang === "zh-CN" ? "<main><h1>页面未找到</h1></main>" : "<main><h1>Page not found</h1></main>", tenant }), { status: 404 });
  },
};
