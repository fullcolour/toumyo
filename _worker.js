const SITE = {
  name: "Toumyou",
  url: "https://toumyou.com",
  description:
    "Toumyou LLC supplies fasteners and industrial accessories for cross-border buyers, with digital design and software services from Japan.",
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

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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

async function listPublished(env) {
  const db = env.DB;
  if (!db) return [];
  const result = await db
    .prepare("SELECT slug,title,excerpt,category,published_at,updated_at FROM posts WHERE lower(trim(status))='published' ORDER BY published_at DESC, updated_at DESC")
    .all();
  return result.results || [];
}

async function listAll(env) {
  const result = await env.DB
    .prepare("SELECT id,slug,title,excerpt,body,category,status,published_at,created_at,updated_at FROM posts ORDER BY updated_at DESC")
    .all();
  return result.results || [];
}

async function getPost(env, slug) {
  return await env.DB
    .prepare("SELECT slug,title,excerpt,body,category,status,published_at,updated_at FROM posts WHERE slug=?")
    .bind(slug)
    .first();
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
    raw_event TEXT,
    notes TEXT,
    created_at INTEGER,
    updated_at INTEGER
  )`).run();
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

async function listOrders(env) {
  await ensureCommerce(env);
  if (!env.DB) return [];
  const result = await env.DB.prepare("SELECT * FROM orders ORDER BY created_at DESC, updated_at DESC").all();
  return result.results || [];
}

async function listInquiries(env) {
  await ensureCommerce(env);
  if (!env.DB) return [];
  const result = await env.DB.prepare("SELECT * FROM inquiries ORDER BY created_at DESC").all();
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
  if (!env.ASSETS) return new Response("Media bucket is not configured", { status: 503 });
  const object = await env.ASSETS.get(key);
  if (!object) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata?.(headers);
  if (!headers.has("content-type")) headers.set("content-type", mediaContentType(key));
  headers.set("etag", object.httpEtag || object.etag || "");
  headers.set("cache-control", "public, max-age=31536000, immutable");
  return new Response(object.body, { headers });
}

async function uploadMedia(request, env) {
  if (!env.ASSETS) return json({ error: "R2 bucket binding ASSETS is not configured yet" }, { status: 503 });
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
    await env.ASSETS.put(key, file.stream(), {
      httpMetadata: { contentType: type || mediaContentType(file.name) },
      customMetadata: { originalName: String(file.name).slice(0, 180) },
    });
    uploaded.push({ key, url: `/media/${key}`, name: file.name, size: file.size, type });
  }
  return json({ ok: true, files: uploaded });
}

function shell({ title, description, path = "/", content, schema }) {
  const canonical = `${SITE.url}${path}`;
  return `<!doctype html>
<html lang="en">
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
  <meta name="twitter:card" content="summary_large_image">
  <style>
    :root{color-scheme:light;--ink:#121417;--paper:#f6f7f8;--panel:#eceff2;--acid:#dce7ff;--accent:#2457ff;--line:#d4d8dd;--muted:#5f6670;--soft:#ffffff;--focus:#2457ff}
    *{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.55 Arial,Helvetica,sans-serif}
    a{color:inherit;text-decoration:none}header{height:76px;padding:0 4vw;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line);position:sticky;top:0;background:rgba(244,241,233,.9);backdrop-filter:blur(18px);z-index:2}
    nav{display:flex;gap:26px;align-items:center}.brand{font-size:21px;font-weight:850;letter-spacing:-1.6px}.brand span{font-size:9px;vertical-align:top;margin-left:2px}.nav{font-size:13px;color:#343630}.nav-admin{border:1px solid var(--ink);padding:8px 12px;border-radius:6px}
    main{overflow:hidden}.hero{min-height:calc(100dvh - 76px);padding:92px 8vw 52px;position:relative;border-bottom:1px solid var(--line);display:grid;align-content:center}
    .hero:after{content:"";position:absolute;right:8vw;top:118px;width:min(34vw,430px);height:min(34vw,430px);background:linear-gradient(135deg,var(--acid),transparent 70%);border-radius:28px;z-index:-1}
    .eyebrow{font-size:11px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;margin:0 0 22px}.hero h1,.section h2,.contact h2,.listing h1,.article h1{font-family:Arial,Helvetica,sans-serif;font-weight:850;letter-spacing:-.055em;line-height:.92;margin:0}
    .hero h1{font-size:clamp(54px,8vw,118px);max-width:920px}.lead{font-size:clamp(18px,2vw,22px);line-height:1.45;max-width:560px;margin:36px 0 30px;color:#303740}
    .btn{display:inline-flex;align-items:center;gap:22px;background:var(--ink);color:#fff;border:0;border-radius:6px;padding:14px 16px;font-weight:760;cursor:pointer}.btn.secondary{background:transparent;color:var(--ink);border:1px solid var(--ink)}
    .toolbar{display:flex;gap:12px;flex-wrap:wrap;margin:18px 0}.hero-note{position:absolute;right:8vw;bottom:38px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#4d5048}
    .section{padding:104px 8vw;border-bottom:1px solid var(--line)}.section h2,.contact h2{font-size:clamp(44px,6.1vw,92px);max-width:850px}.intro-strip{display:grid;grid-template-columns:1.2fr .8fr;gap:9vw;margin-top:46px;align-items:end}.intro-strip p{font-size:20px;line-height:1.55;color:#343630;margin:0;max-width:620px}.intro-strip ul{list-style:none;padding:0;margin:0;display:grid;gap:12px}.intro-strip li{border-top:1px solid var(--line);padding-top:12px;color:var(--muted)}
    .service-grid{display:grid;grid-template-columns:1.3fr 1fr 1fr;gap:0;margin-top:72px;border-top:1px solid var(--ink)}
    .service-grid article{min-height:268px;padding:24px 26px 24px 0;border-right:1px solid var(--line)}.service-grid article+article{padding-left:26px}.service-grid article:last-child{border-right:0}.service-grid span,.meta{font-size:11px;letter-spacing:.8px;text-transform:uppercase;color:var(--muted)}
    h3{font-family:Arial,Helvetica,sans-serif;font-size:29px;letter-spacing:-.04em;line-height:1.08;font-weight:780;margin:54px 0 16px}.service-grid p,.muted{color:var(--muted);max-width:320px}.insights-head{display:flex;justify-content:space-between;align-items:end;gap:24px}.text-link{text-decoration:underline;text-underline-offset:4px;font-size:13px}
    .portfolio-grid{display:grid;grid-template-columns:1.15fr .85fr 1fr;grid-auto-rows:minmax(330px,auto);gap:16px;margin-top:70px}.work-card{position:relative;overflow:hidden;border-radius:10px;background:var(--panel);min-height:330px;display:flex;align-items:flex-end}.work-card.large{grid-row:span 2}.work-card img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:saturate(.82) contrast(1.02)}.work-card:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(23,24,21,.03),rgba(23,24,21,.78))}.work-copy{position:relative;z-index:1;color:#fff;padding:26px}.work-copy span{font-size:11px;text-transform:uppercase;letter-spacing:.9px;color:#d8dccf}.work-copy h3{margin:16px 0 8px;color:#fff}.work-copy p{margin:0;color:#eceee7;max-width:300px}
    .timeline{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:0;margin-top:72px;border-top:1px solid var(--ink)}.timeline article{padding:26px 26px 0 0;min-height:300px;border-right:1px solid var(--line)}.timeline article+article{padding-left:26px}.timeline article:last-child{border-right:0}.timeline img{width:100%;height:135px;object-fit:cover;border-radius:10px;margin-bottom:28px;filter:saturate(.85)}.timeline strong{font-size:13px;text-transform:uppercase;letter-spacing:.8px}.timeline h3{margin:18px 0 12px}.team-panel{margin-top:70px;display:grid;grid-template-columns:.9fr 1.1fr;gap:16px}.team-note{background:var(--ink);color:var(--paper);border-radius:10px;padding:32px;display:flex;flex-direction:column;justify-content:space-between;min-height:420px}.team-note p{font-size:24px;line-height:1.35;margin:0;color:#f2f0e8}.team-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.person{background:var(--panel);border-radius:10px;overflow:hidden}.person img{width:100%;height:260px;object-fit:cover;display:block;filter:saturate(.85)}.person div{padding:20px}.person h3{margin:0 0 8px;font-size:28px}.person p{margin:0;color:var(--muted)}.logo-row{display:flex;gap:24px;flex-wrap:wrap;align-items:center;margin-top:50px}.logo-row img{max-height:44px;max-width:132px;object-fit:contain;filter:grayscale(1) contrast(.95);opacity:.72}
    .article-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin-top:62px}.article-card{min-height:275px;padding:24px;background:var(--panel);display:flex;flex-direction:column;border-radius:6px;transition:transform .2s,background .2s}.article-card:hover{transform:translateY(-3px);background:var(--acid)}
    .commerce-panel{display:grid;grid-template-columns:1.15fr .85fr;gap:18px;margin-top:50px;align-items:stretch}.commerce-card{background:var(--soft);border:1px solid var(--line);border-radius:10px;padding:26px}.commerce-card strong{display:block;font-size:14px;text-transform:uppercase;letter-spacing:.8px;margin-bottom:12px}.commerce-list{list-style:none;margin:0;padding:0;display:grid;gap:12px}.commerce-list li{border-top:1px solid var(--line);padding-top:12px;color:var(--muted)}.metric-strip{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-top:34px}.metric-strip div{border:1px solid var(--line);border-radius:10px;background:var(--soft);padding:18px}.metric-strip strong{display:block;font-size:28px;line-height:1;letter-spacing:-.04em}.metric-strip span{display:block;margin-top:8px;font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.7px}.shop-filter{display:grid;grid-template-columns:1.3fr .7fr .7fr;gap:12px;margin:34px 0 0}.catalog-first{padding-top:58px}.catalog-first h1{font-family:Arial,Helvetica,sans-serif;font-size:clamp(48px,6.4vw,96px);font-weight:850;letter-spacing:-.055em;line-height:.94;margin:0;max-width:940px}.product-card{position:relative;overflow:hidden;background:var(--soft);border:1px solid var(--line)}.product-card:hover{background:var(--soft);border-color:#aeb6c0}.product-card[hidden]{display:none}.card-tag{position:absolute;top:16px;right:16px;border:1px solid var(--ink);border-radius:999px;padding:7px 10px;background:rgba(255,255,255,.94);font-size:11px;font-weight:850;letter-spacing:.5px;text-transform:uppercase}.card-tag.pay{background:var(--accent);color:#fff;border-color:var(--accent)}.pill-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.pill{border:1px solid var(--line);border-radius:999px;padding:6px 10px;font-size:12px;background:rgba(255,255,255,.82)}.status-badge{display:inline-flex;border:1px solid var(--line);border-radius:999px;padding:6px 10px;font-size:11px;font-weight:850;letter-spacing:.5px;text-transform:uppercase;background:var(--soft)}.status-badge.paid{background:#dff7df;border-color:#3d7d3d}.status-badge.failed,.status-badge.expired{background:#ffe2dc}.status-badge.open,.status-badge.unpaid,.status-badge.checkout_created{background:#fff4bd}.product-buy{display:flex;gap:12px;align-items:end;flex-wrap:wrap}.product-buy input{max-width:130px}.order-meta{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:14px 0}.order-meta span{display:block;border-top:1px solid var(--line);padding-top:8px;color:var(--muted);font-size:13px}.order-dashboard{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:26px 0}.metric-card{border:1px solid var(--line);border-radius:6px;background:var(--soft);padding:16px}.metric-card strong{display:block;font-size:32px;line-height:1;letter-spacing:-.04em}.metric-card span{display:block;margin-top:6px;color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.7px}.order-filter{display:grid;grid-template-columns:1fr 180px;gap:12px;margin:20px 0}.order-card[hidden]{display:none}
    .article-card h3{margin:34px 0 14px}.article-card p{color:var(--muted)}.article-card b{margin-top:auto;font-size:12px}.empty{margin-top:62px;padding:34px;border-top:1px solid var(--ink)}.empty p{font-family:Georgia,"Times New Roman",serif;font-size:32px;margin:0 0 8px}
    .contact{background:var(--ink);color:var(--paper);padding:104px 8vw;min-height:520px}.contact-grid{display:grid;grid-template-columns:1.15fr .85fr;gap:8vw;align-items:end}.contact-mail{display:block;margin-top:48px;font-size:clamp(20px,2.6vw,36px);border-bottom:1px solid #666960;padding-bottom:13px}.contact-list{list-style:none;margin:0;padding:0;border-top:1px solid #666960}.contact-list li{display:grid;grid-template-columns:90px 1fr;gap:24px;padding:18px 0;border-bottom:1px solid #41433d}.contact-list span{font-size:11px;text-transform:uppercase;letter-spacing:.9px;color:#a9ada2}.address{font-size:13px;line-height:1.7;color:#c5c7be;margin:0}
    footer{padding:24px 4vw;background:var(--ink);color:#c5c7be;display:flex;justify-content:space-between;gap:20px;border-top:1px solid #494b44;font-size:11px}.listing{padding:88px 8vw}.listing h1{font-size:clamp(56px,7vw,108px)}.articles{display:grid;gap:14px}.article-link{display:block;border-top:1px solid var(--line);padding:24px 0}.article-link:hover h3{color:#2b3310}
    .article-page{padding:88px 8vw}.article-page article{max-width:860px}.article h1{font-size:clamp(52px,7.4vw,110px)}.article-dek{font-size:23px;line-height:1.42;max-width:700px;margin:36px 0}.post-body{font-family:Georgia,"Times New Roman",serif;font-size:21px;line-height:1.65;white-space:pre-wrap;max-width:680px}
    input,textarea,select{width:100%;border:1px solid #aaa69c;border-radius:6px;padding:11px 12px;background:var(--soft);color:var(--ink);font:15px Arial,Helvetica,sans-serif}textarea{min-height:150px;line-height:1.45;resize:vertical}label{display:block;margin:14px 0 7px;font-size:12px;font-weight:800;letter-spacing:.3px}.notice{border:1px solid var(--line);padding:18px;border-radius:6px;background:var(--soft)}
    .admin-wrap{padding:58px 5vw 90px}.editor{display:grid;grid-template-columns:minmax(240px,360px) minmax(0,740px);gap:7vw}.editor aside{border-right:1px solid var(--line);padding-right:28px}.editor-actions{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-top:20px}.status{margin:12px 0 0;color:#36510d;font-weight:700}.danger{background:transparent;color:var(--ink);border:1px solid var(--line)}
    :focus-visible{outline:3px solid var(--focus);outline-offset:3px}@media(max-width:980px){.portfolio-grid,.timeline,.team-panel,.contact-grid,.intro-strip,.commerce-panel,.metric-strip,.order-dashboard{grid-template-columns:1fr 1fr}.portfolio-grid{grid-auto-rows:minmax(310px,auto)}.work-card.large{grid-row:auto}.timeline article,.timeline article+article{border-right:0;border-bottom:1px solid var(--line);padding:26px 0}.team-grid{grid-template-columns:1fr 1fr}.contact-list{margin-top:34px}}@media(max-width:760px){header{height:auto;min-height:68px;align-items:flex-start;gap:14px;flex-direction:column;padding:18px 6vw}nav{gap:16px;flex-wrap:wrap}.hero{min-height:620px;padding:82px 7vw 46px}.hero:after{width:88vw;height:88vw;right:-36vw;top:126px}.hero-note{position:static;margin-top:42px}.section,.contact,.listing,.article-page{padding:72px 7vw}.service-grid,.article-grid,.editor,.team-grid,.shop-filter,.order-filter,.commerce-panel,.metric-strip,.order-dashboard{grid-template-columns:1fr}.service-grid article,.service-grid article+article{border-right:0;border-bottom:1px solid var(--line);min-height:auto;padding:24px 0}.person img{height:310px}.insights-head{display:block}.article-grid{margin-top:40px}.editor aside{border-right:0;border-bottom:1px solid var(--line);padding:0 0 26px}footer{display:block}.contact-mail{word-break:break-word}.contact-list li{grid-template-columns:1fr;gap:6px}}
  </style>
  ${schema ? `<script type="application/ld+json">${JSON.stringify(schema)}</script>` : ""}
</head>
<body>
  <header><a class="brand" href="/">TOUMYOU<span>®</span></a><nav><a class="nav" href="/#supply">Supply</a><a class="nav" href="/shop">Shop</a><a class="nav" href="/#digital">Digital</a><a class="nav" href="/articles">Insights</a><a class="nav" href="/#contact">Contact</a><a class="nav nav-admin" href="/admin">Admin</a></nav></header>
  ${content}
  <footer><span>© ${new Date().getFullYear()} Toumyou LLC</span><span>Fastener supply, digital systems, and cross-border operations from Japan.</span></footer>
</body>
</html>`;
}

async function home(env) {
  const posts = (await listPublished(env)).slice(0, 3);
  const products = (await listProducts(env)).slice(0, 3);
  const asset = "https://4f4b3799.toumyou.pages.dev/assets/img";
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
      <div class="article-grid">${products.length ? products.map((p) => productCard(p, env)).join("") : SHOP.categories.map((item) => `<article class="article-card"><div class="meta">${escapeHtml(item.slug)}</div><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.summary)}</p><b>Request quote</b></article>`).join("")}</div>
    </section>
    <section id="digital" class="section">
      <p class="eyebrow">Digital services</p>
      <h2>Design and software<br>support the operation.</h2>
      <div class="intro-strip">
        <p>Toumyou also keeps its original design and development work: brand identity, websites, animation, WeChat mini-programs, software tools, and AI workflow support.</p>
        <ul>
          <li>Brand systems and graphic design</li>
          <li>Responsive websites and commerce interfaces</li>
          <li>Mini-programs, internal tools, and AI workflows</li>
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
    <section id="insights" class="section">
      <div class="insights-head"><div><p class="eyebrow">Articles</p><h2>Updates and<br>procurement notes.</h2></div><a class="text-link" href="/articles">All articles</a></div>
      ${posts.length ? `<div class="article-grid">${posts.map(articleLink).join("")}</div>` : '<div class="empty"><p>Our first notes are in progress.</p><span class="muted">Published articles will appear here immediately after you save them.</span></div>'}
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
    title: "Toumyou | Fastener supply and digital operations from Japan",
    description: SITE.description,
    content,
    schema: { "@context": "https://schema.org", "@type": "Organization", name: "Toumyou LLC", url: SITE.url, email: "sunflyerjp@gmail.com", telephone: "+8107018461357", address: { "@type": "PostalAddress", streetAddress: "2-1-35 Sugimoto, Sumiyoshi-ku", addressLocality: "Osaka City", addressCountry: "JP" }, description: SITE.description, sameAs: ["https://toumyou.com"] },
  }));
}

function articleLink(post) {
  const date = post.published_at ? new Date(post.published_at * 1000).toISOString().slice(0, 10) : "Draft";
  return `<a class="article-card" href="/articles/${escapeHtml(post.slug)}"><div class="meta">${escapeHtml(post.category || "Insights")} / ${date}</div><h3>${escapeHtml(post.title)}</h3><p>${escapeHtml(post.excerpt)}</p><b>Read article</b></a>`;
}

async function articles(env) {
  const posts = await listPublished(env);
  return html(shell({
    title: "Insights | Toumyou",
    description: "Toumyou updates on fastener supply, cross-border commerce, digital operations, and web systems.",
    path: "/articles",
    content: `<main class="listing"><h1>Supply notes<br>and company updates.</h1><p class="lead">Articles on fastener procurement, cross-border commerce, digital systems, and practical operations from Toumyou.</p><div class="article-grid">${posts.map(articleLink).join("") || '<div class="empty"><p>No published articles yet.</p><span class="muted">Use the editor to publish the first note.</span></div>'}</div></main>`,
  }));
}

async function article(env, slug) {
  const post = await getPost(env, slug);
  if (!post || post.status !== "published") return html(shell({ title: "Not found | Toumyou", description: "Article not found.", content: "<main><h1>Article not found</h1></main>" }), { status: 404 });
  return html(shell({
    title: `${post.title} | Toumyou`,
    description: post.excerpt,
    path: `/articles/${post.slug}`,
    content: `<main class="article-page article"><article><div class="meta">${escapeHtml(post.category || "Insights")}</div><h1>${escapeHtml(post.title)}</h1><p class="article-dek">${escapeHtml(post.excerpt)}</p><div class="post-body">${escapeHtml(post.body)}</div></article><div class="toolbar"><a class="btn secondary" href="/articles">All insights</a><a class="btn" href="/#contact">Talk to Toumyou</a></div></main>`,
    schema: {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: post.title,
      description: post.excerpt,
      datePublished: post.published_at ? new Date(post.published_at * 1000).toISOString() : undefined,
      dateModified: post.updated_at ? new Date(post.updated_at * 1000).toISOString() : undefined,
      author: { "@type": "Organization", name: SITE.name },
    },
  }));
}

function productCard(product, env) {
  const canCheckout = product.allow_checkout && product.price_cents > 0 && (env.STRIPE_SECRET_KEY || env.STRIPE_RESTRICTED_KEY);
  const price = product.price_cents > 0 ? money(product.price_cents, product.currency) : "Quote";
  const meta = [product.category, product.material, product.size].filter(Boolean).join(" / ") || "Fastener";
  const moq = Number(product.moq || 1) > 1 ? `, MOQ ${escapeHtml(product.moq)}` : "";
  const minQty = Math.max(1, Number.parseInt(product.moq || 1, 10) || 1);
  const searchText = [product.name, product.sku, product.slug, product.category, product.material, product.size, product.excerpt, product.description, product.specs].filter(Boolean).join(" ").toLowerCase();
  const images = productImages(product);
  const image = images[0]
    ? `<img src="${escapeHtml(images[0])}" alt="${escapeHtml(product.name)}" loading="lazy" style="width:100%;height:190px;object-fit:cover;border-radius:6px;margin-bottom:18px">`
    : "";
  return `<article class="article-card product-card" data-product-card data-search="${escapeHtml(searchText)}" data-category="${escapeHtml(product.category || "")}" data-availability="${canCheckout ? "stock" : "quote"}">
    <span class="card-tag ${canCheckout ? "pay" : ""}">${canCheckout ? "Pay now" : "Quote"}</span>
    ${image}
    <div class="meta">${escapeHtml(meta)}</div>
    <h3>${escapeHtml(product.name)}</h3>
    <p>${escapeHtml(product.excerpt || product.description || "Industrial supply item available for cross-border sourcing.")}</p>
    <p class="muted">SKU: ${escapeHtml(product.sku || product.slug)}<br>${escapeHtml(price)}${moq}${product.inventory ? `, stock ${escapeHtml(product.inventory)}` : ""}</p>
    <div class="toolbar" style="margin-top:auto">
      <a class="btn secondary" href="/shop/products/${escapeHtml(product.slug)}">Details</a>
      ${
        canCheckout
          ? `<form method="post" action="/api/checkout"><input type="hidden" name="product_id" value="${escapeHtml(product.id)}"><input type="hidden" name="quantity" value="${escapeHtml(minQty)}"><button class="btn" type="submit">Checkout</button></form>`
          : `<a class="btn" href="mailto:sunflyerjp@gmail.com?subject=${encodeURIComponent(`Quote request: ${product.name}`)}">Request quote</a>`
      }
    </div>
  </article>`;
}

async function shopPage(env) {
  const medusaUrl = env.MEDUSA_BACKEND_URL || "";
  const checkoutStatus = env.STRIPE_SECRET_KEY || env.STRIPE_RESTRICTED_KEY ? "Secure checkout is available for listed paid products." : "Checkout is pending merchant configuration.";
  const products = await listProducts(env);
  const categories = [...new Set(products.map((p) => String(p.category || "Fasteners").trim()).filter(Boolean))].sort();
  const categoryCards = SHOP.categories
    .map(
      (item) => `<article class="article-card"><div class="meta">Catalog / ${escapeHtml(item.slug)}</div><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.summary)}</p><b>Request quote</b></article>`,
    )
    .join("");
  const content = `<main>
    <section id="catalog" class="section catalog-first">
      <p class="eyebrow">International fastener shop</p>
      <h1>Fasteners, hardware,<br>and sourcing support.</h1>
      <div class="intro-strip">
        <p>Browse live SKUs, pay online when checkout is enabled, or request a quotation for special materials, drawings, bulk quantities, and mixed procurement lists.</p>
        <ul>
          <li>Metric screws, bolts, nuts, washers, anchors, and accessory parts</li>
          <li>Small-batch supply for repair, prototype, distributor, and OEM needs</li>
          <li>Stripe Checkout with address collection, freight options, and local payment methods where eligible</li>
        </ul>
      </div>
      ${
        products.length
          ? `<div class="shop-filter">
              <input id="shopSearch" type="search" placeholder="Search by SKU, size, material, standard, or finish...">
              <select id="shopCategory"><option value="">All categories</option>${categories.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("")}</select>
              <select id="shopAvailability"><option value="">All ordering types</option><option value="stock">Online checkout</option><option value="quote">Quote required</option></select>
            </div>
            <p id="shopCount" class="muted" style="max-width:none;margin-top:12px">${products.length} products listed</p>`
          : ""
      }
      <div class="article-grid">${products.length ? products.map((p) => productCard(p, env)).join("") : categoryCards}</div>
      ${products.length ? "" : '<div class="notice" style="margin-top:24px">No live products have been published yet. Use <a class="text-link" href="/admin/products">Product Admin</a> to publish the first SKUs.</div>'}
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
                  if (count) count.textContent = shown + ' of ' + cards.length + ' products shown';
                }
                [search, category, availability].forEach(el => el && el.addEventListener('input', applyFilter));
              })();
            </script>`
          : ""
      }
    </section>
    <section class="section">
      <p class="eyebrow">Ordering and delivery</p>
      <h2>Clear terms before<br>you place the order.</h2>
      <div class="service-grid">
        <article><span>Product details</span><h3>Each paid SKU shows price, MOQ, stock, and specifications.</h3><p>For special sizes, materials, coatings, or drawings, send a quote request before payment.</p></article>
        <article><span>Shipping</span><h3>Standard and express freight are shown at checkout.</h3><p>Checkout collects the destination address. Import duties, VAT, and local customs fees are normally paid by the recipient.</p></article>
        <article><span>Payment</span><h3>${escapeHtml(checkoutStatus)}</h3><p>Stripe may show cards, Alipay, WeChat Pay, Apple Pay, or other methods depending on buyer location, currency, and Stripe eligibility.</p></article>
      </div>
      <div class="notice" style="margin-top:34px"><strong>Shipping note:</strong> Standard delivery is normally 7 to 14 business days. Express delivery is normally 3 to 7 business days. The exact charge and estimate are shown by Stripe Checkout before payment.</div>
    </section>
    <section class="contact">
      <div class="contact-grid">
        <div><p class="eyebrow">Start procurement</p><h2>Send the size,<br>material and quantity.</h2><a href="mailto:sunflyerjp@gmail.com?subject=Fastener%20quote%20request" class="contact-mail">sunflyerjp@gmail.com</a></div>
        <ul class="contact-list">
          <li><span>Examples</span><p class="address">M3 to M24 screws, stainless bolts, nuts, washers, anchors, pins, rivets, clips, brackets, and custom hardware.</p></li>
          <li><span>Markets</span><p class="address">Japan, Asia, North America, Europe, and cross-border B2B buyers.</p></li>
          <li><span>Quote details</span><p class="address">Send standard, size, material, finish, quantity, destination country, and any drawing or reference photo.</p></li>
        </ul>
      </div>
    </section>
  </main>`;
  return html(shell({
    title: "Fastener Shop | Toumyou",
    description: SHOP.description,
    path: "/shop",
    content,
    schema: {
      "@context": "https://schema.org",
      "@type": "Store",
      name: SHOP.name,
      url: `${SITE.url}/shop`,
      description: SHOP.description,
      email: "sunflyerjp@gmail.com",
      parentOrganization: { "@type": "Organization", name: "Toumyou LLC" },
      makesOffer: (products.length ? products : SHOP.categories).map((item) => ({
        "@type": "Offer",
        price: item.price_cents ? String(minorToDisplay(item.price_cents, item.currency)) : undefined,
        priceCurrency: item.currency || undefined,
        itemOffered: { "@type": "Product", name: item.name, description: item.summary || item.excerpt },
        availability: item.inventory ? "https://schema.org/InStock" : "https://schema.org/PreOrder",
      })),
    },
  }));
}

async function productPage(env, slug) {
  const product = await getProduct(env, slug);
  if (!product || product.status !== "published") {
    return html(shell({ title: "Product not found | Toumyou", description: "Product not found.", content: "<main><h1>Product not found</h1></main>" }), { status: 404 });
  }
  const canCheckout = product.allow_checkout && product.price_cents > 0 && (env.STRIPE_SECRET_KEY || env.STRIPE_RESTRICTED_KEY);
  const images = productImages(product);
  const specs = String(product.specs || "").trim();
  const minQty = Math.max(1, Number.parseInt(product.moq || 1, 10) || 1);
  const maxQty = product.inventory ? Math.max(minQty, Math.min(999, Number.parseInt(product.inventory, 10) || 999)) : 999;
  const specRows = [
    ["SKU", product.sku || product.slug],
    ["Category", product.category || "Fasteners"],
    ["Material", product.material || "Confirm by order"],
    ["Size", product.size || "Confirm by order"],
    ["MOQ", product.moq || 1],
    ["Weight", product.weight_grams ? `${product.weight_grams} g / unit` : "Confirm by order"],
  ];
  const gallery = images.length
    ? `<div class="product-gallery" data-gallery>
        <img data-main src="${escapeHtml(images[0])}" alt="${escapeHtml(product.name)}" style="width:100%;max-height:500px;object-fit:cover;border-radius:10px;margin:10px 0 16px">
        ${
          images.length > 1
            ? `<div class="toolbar">${images.map((src, index) => `<button class="btn secondary" type="button" data-img="${escapeHtml(src)}">${index + 1}</button>`).join("")}</div>`
            : ""
        }
      </div>
      <script>
        document.querySelectorAll('[data-gallery]').forEach(g=>{const main=g.querySelector('[data-main]');g.querySelectorAll('[data-img]').forEach(b=>b.onclick=()=>{main.src=b.dataset.img})});
      </script>`
    : "";
  const content = `<main class="article-page article"><article>
    <div class="meta">${escapeHtml(product.category || "Fasteners")} / ${escapeHtml(product.sku || product.slug)}</div>
    <h1>${escapeHtml(product.name)}</h1>
    <p class="article-dek">${escapeHtml(product.excerpt || "Cross-border fastener and industrial accessory supply.")}</p>
    ${gallery}
    <div class="post-body">${escapeHtml(product.description || "")}</div>
    <div class="notice" style="margin-top:34px">
      <p><strong>Price:</strong> ${escapeHtml(product.price_cents > 0 ? money(product.price_cents, product.currency) : "Quote required")}</p>
      <p><strong>Inventory:</strong> ${escapeHtml(product.inventory || "Confirm availability")}</p>
      <p><strong>Delivery:</strong> Standard 7 to 14 business days or Express 3 to 7 business days. Freight is calculated in Stripe Checkout; duties and import taxes are normally payable by the recipient.</p>
    </div>
    <div class="notice" style="margin-top:18px">
      <h3>Specifications</h3>
      ${specRows.map(([k, v]) => `<p><strong>${escapeHtml(k)}:</strong> ${escapeHtml(v)}</p>`).join("")}
      ${specs ? `<p><strong>Detailed specs:</strong><br>${escapeHtml(specs).replaceAll("\n", "<br>")}</p>` : ""}
    </div>
  </article>
  <div class="toolbar">
    ${
      canCheckout
        ? `<form class="product-buy" method="post" action="/api/checkout"><input type="hidden" name="product_id" value="${escapeHtml(product.id)}"><div><label>Quantity</label><input name="quantity" type="number" min="${escapeHtml(minQty)}" max="${escapeHtml(maxQty)}" value="${escapeHtml(minQty)}"></div><button class="btn" type="submit">Checkout with Stripe</button><span class="muted">MOQ ${escapeHtml(minQty)}${product.inventory ? `, max ${escapeHtml(maxQty)} now` : ""}</span></form>`
        : `<a class="btn" href="mailto:sunflyerjp@gmail.com?subject=${encodeURIComponent(`Quote request: ${product.name}`)}">Request quote</a>`
    }
    <a class="btn secondary" href="/shop">Back to shop</a>
  </div></main>`;
  const quoteForm = `<section class="section" style="padding-top:40px"><p class="eyebrow">Need a custom quote?</p><h2>Send quantity,<br>drawing or specs.</h2><div class="notice"><form id="quoteForm" class="quote-form">
    <input type="hidden" name="product_id" value="${escapeHtml(product.id)}">
    <label>Name</label><input name="name" required>
    <label>Email</label><input name="email" type="email" required>
    <label>Company</label><input name="company">
    <label>Country / region</label><input name="country">
    <label>Quantity</label><input name="quantity" placeholder="Example: 500 pcs / 20 boxes">
    <label>Specifications</label><textarea name="specs" placeholder="Material, size, standard, finish, drawing link, packaging..."></textarea>
    <label>Message</label><textarea name="message" placeholder="Tell us delivery country, target date, or anything special."></textarea>
    <div class="toolbar"><button class="btn" type="submit">Submit quote request</button><a class="btn secondary" href="mailto:sunflyerjp@gmail.com?subject=${encodeURIComponent(`Quote request: ${product.name}`)}">Email instead</a></div>
    <p id="quoteStatus" class="status"></p>
  </form></div>
  <script>
    document.getElementById('quoteForm')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const status = document.getElementById('quoteStatus');
      status.textContent = 'Sending...';
      const payload = Object.fromEntries(new FormData(event.target).entries());
      const res = await fetch('/api/quote', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      status.textContent = res.ok ? 'Quote request saved. We will contact you by email.' : 'Could not save request. Please email us directly.';
      if (res.ok) event.target.reset();
    });
  </script></section>`;
  return html(shell({
    title: `${product.name} | Toumyou Shop`,
    description: product.excerpt || product.description || SHOP.description,
    path: `/shop/products/${product.slug}`,
    content: content.replace("</main>", `${quoteForm}</main>`),
    schema: {
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.name,
      sku: product.sku || product.slug,
      mpn: product.sku || product.slug,
      brand: { "@type": "Brand", name: "Toumyou Fastener Supply" },
      description: product.excerpt || product.description,
      image: images.length ? images : undefined,
      offers: {
        "@type": "Offer",
        price: product.price_cents ? String(minorToDisplay(product.price_cents, product.currency)) : undefined,
        priceCurrency: product.currency,
        availability: product.inventory ? "https://schema.org/InStock" : "https://schema.org/PreOrder",
        inventoryLevel: product.inventory ? { "@type": "QuantitativeValue", value: Number(product.inventory) || 0 } : undefined,
        eligibleQuantity: { "@type": "QuantitativeValue", minValue: minQty },
        url: `${SITE.url}/shop/products/${product.slug}`,
      },
    },
  }));
}

function adminPage() {
  const content = `<main class="admin-wrap"><h1>Editor</h1><p class="lead">Create, publish, and update Toumyou articles.</p>
    <div id="app" class="notice">Loading...</div>
    <script>
      const app = document.getElementById('app');
      const esc = (v='') => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
      async function api(url, options={}){const r=await fetch(url,{cache:'no-store',headers:{'content-type':'application/json'},...options}); if(!r.ok) throw new Error(await r.text()); return r.json();}
      function login(){app.className='notice';app.innerHTML='<label>Password</label><input id="pw" type="password" autocomplete="current-password"><div class="toolbar"><button class="btn" id="go">Log in</button></div>';document.getElementById('go').onclick=async()=>{try{await api('/api/admin/login',{method:'POST',body:JSON.stringify({password:document.getElementById('pw').value})});load()}catch(e){alert('Login failed')}}}
      function form(p={}){const currentStatus=p.status||'published';return '<label>Title</label><input id="title" value="'+esc(p.title||'')+'"><label>Slug</label><input id="slug" value="'+esc(p.slug||'')+'"><label>Excerpt</label><textarea id="excerpt">'+esc(p.excerpt||'')+'</textarea><label>Body</label><textarea id="body">'+esc(p.body||'')+'</textarea><label>Category</label><input id="category" value="'+esc(p.category||'Insights')+'"><label>Status</label><select id="status"><option value="published" '+(currentStatus==='published'?'selected':'')+'>published</option><option value="draft" '+(currentStatus==='draft'?'selected':'')+'>draft</option></select><div class="editor-actions"><button class="btn" id="save">Save and publish</button>'+(p.id?'<button class="btn danger" id="delete">Delete</button>':'')+'<a class="btn secondary" href="/" target="_blank">Open home</a><a class="btn secondary" href="/articles" target="_blank">Open insights</a><a class="btn secondary" href="/admin/products">Products</a><a class="btn secondary" href="/admin/orders">Orders</a></div><p id="saved" class="status"></p>'}
      async function load(){try{const s=await api('/api/admin/session'); if(!s.authenticated)return login(); const posts=await api('/api/admin/posts'); app.className='editor'; app.innerHTML='<aside><button class="btn" id="new">New article</button><div class="articles">'+posts.map(p=>'<a class="article-link" data-id="'+esc(p.id)+'"><div class="meta">'+esc(p.status)+' / '+esc(p.category||'Insights')+'</div><h3>'+esc(p.title)+'</h3><p>'+esc(p.slug)+'</p></a>').join('')+'</div></aside><section id="edit">'+form()+'</section>'; const edit=document.getElementById('edit'); document.getElementById('new').onclick=()=>{edit.innerHTML=form(); wireSave()}; document.querySelectorAll('[data-id]').forEach(a=>a.onclick=()=>{const p=posts.find(x=>x.id===a.dataset.id); edit.innerHTML=form(p); wireSave(p.id)}); wireSave()}catch(e){app.className='notice';app.textContent=e.message}}
      function wireSave(id){document.getElementById('save').onclick=async()=>{const payload={title:document.getElementById('title').value,slug:document.getElementById('slug').value,excerpt:document.getElementById('excerpt').value,body:document.getElementById('body').value,category:document.getElementById('category').value,status:document.getElementById('status').value}; const result=await api(id?'/api/admin/posts/'+id:'/api/admin/posts',{method:id?'PUT':'POST',body:JSON.stringify(payload)}); const slug=result.slug||payload.slug; document.getElementById('saved').innerHTML='Saved. <a class="text-link" target="_blank" href="/articles/'+encodeURIComponent(slug)+'?fresh='+Date.now()+'">Open article</a> or <a class="text-link" target="_blank" href="/?fresh='+Date.now()+'">check home</a>.'; if(!id)setTimeout(load,700)}; const del=document.getElementById('delete'); if(del)del.onclick=async()=>{if(!confirm('Delete this article?'))return; await api('/api/admin/posts/'+id,{method:'DELETE'}); load()}}
      load();
    </script></main>`;
  return html(shell({ title: "Admin | Toumyou", description: "Toumyou admin.", path: "/admin", content }), { cache: "no-store" });
}

function adminProductsPage() {
  const content = `<main class="admin-wrap"><h1>Products</h1><p class="lead">Add fastener SKUs, publish product pages, and enable checkout when Stripe is configured.</p>
    <div id="app" class="notice">Loading...</div>
    <script>
      const app = document.getElementById('app');
      const esc = (v='') => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
      async function api(url, options={}){const r=await fetch(url,{cache:'no-store',headers:{'content-type':'application/json'},...options}); if(!r.ok) throw new Error(await r.text()); return r.json();}
      function login(){app.className='notice';app.innerHTML='<label>Password</label><input id="pw" type="password" autocomplete="current-password"><div class="toolbar"><button class="btn" id="go">Log in</button></div>';document.getElementById('go').onclick=async()=>{try{await api('/api/admin/login',{method:'POST',body:JSON.stringify({password:document.getElementById('pw').value})});load()}catch(e){alert('Login failed')}}}
      const zeroDecimalCurrencies = new Set(['BIF','CLP','DJF','GNF','JPY','KMF','KRW','MGA','PYG','RWF','UGX','VND','VUV','XAF','XOF','XPF']);
      function currencyScale(currency){return zeroDecimalCurrencies.has(String(currency||'USD').toUpperCase())?1:100}
      function amountFromPrice(v,currency){const n=Number(String(v||'').replace(/[^0-9.]/g,'')); return Math.round((Number.isFinite(n)?n:0)*currencyScale(currency))}
      function priceFromAmount(v,currency){const scale=currencyScale(currency); return ((Number(v)||0)/scale).toFixed(scale===1?0:2)}
      function form(p={}){const status=p.status||'draft'; const checkout=Number(p.allow_checkout||0)===1; const currency=p.currency||'JPY'; return '<label>Name</label><input id="name" value="'+esc(p.name||'')+'"><label>Slug</label><input id="slug" value="'+esc(p.slug||'')+'"><label>SKU</label><input id="sku" value="'+esc(p.sku||'')+'"><label>Short excerpt</label><textarea id="excerpt">'+esc(p.excerpt||'')+'</textarea><label>Description</label><textarea id="description">'+esc(p.description||'')+'</textarea><label>Category</label><input id="category" value="'+esc(p.category||'Fasteners')+'"><label>Material</label><input id="material" value="'+esc(p.material||'')+'"><label>Size</label><input id="size" value="'+esc(p.size||'')+'"><label>Detailed specifications</label><textarea id="specs" placeholder="Standards, finish, thread pitch, packaging, drawing notes...">'+esc(p.specs||'')+'</textarea><label>MOQ</label><input id="moq" type="number" min="1" value="'+esc(p.moq||1)+'"><label>Weight grams / unit</label><input id="weight_grams" type="number" min="0" value="'+esc(p.weight_grams||0)+'"><label>Main image URL</label><input id="image_url" value="'+esc(p.image_url||'')+'"><label>Gallery image URLs</label><textarea id="image_urls" placeholder="One image URL per line. Upload images below or paste CDN URLs here.">'+esc(p.image_urls||'')+'</textarea><label>Upload product images</label><input id="image_files" type="file" accept="image/*" multiple><div class="toolbar"><button class="btn secondary" id="upload_images" type="button">Upload images</button><span id="upload_status" class="muted">Images are stored in Cloudflare R2.</span></div><label>Price</label><input id="price" inputmode="decimal" value="'+esc(priceFromAmount(p.price_cents,currency))+'"><label>Currency</label><input id="currency" value="'+esc(currency)+'"><label>Inventory</label><input id="inventory" type="number" min="0" value="'+esc(p.inventory||0)+'"><label>Status</label><select id="status"><option value="draft" '+(status==='draft'?'selected':'')+'>draft</option><option value="published" '+(status==='published'?'selected':'')+'>published</option></select><label><input id="allow_checkout" type="checkbox" style="width:auto" '+(checkout?'checked':'')+'> Enable Stripe Checkout for this product</label><div class="editor-actions"><button class="btn" id="save">Save product</button>'+(p.id?'<button class="btn danger" id="delete">Delete</button>':'')+'<a class="btn secondary" href="/shop" target="_blank">Open shop</a><a class="btn secondary" href="/admin/orders">Orders</a><a class="btn secondary" href="/admin">Articles</a></div><p id="saved" class="status"></p>'}
      async function load(){try{const s=await api('/api/admin/session'); if(!s.authenticated)return login(); const products=await api('/api/admin/products'); app.className='editor'; app.innerHTML='<aside><button class="btn" id="new">New product</button><div class="articles">'+products.map(p=>'<a class="article-link" data-id="'+esc(p.id)+'"><div class="meta">'+esc(p.status)+' / '+esc(p.category||'Fasteners')+'</div><h3>'+esc(p.name)+'</h3><p>'+esc(p.sku||p.slug)+' · '+esc(priceFromAmount(p.price_cents,p.currency))+' '+esc(p.currency||'JPY')+'</p></a>').join('')+'</div></aside><section id="edit">'+form()+'</section>'; const edit=document.getElementById('edit'); document.getElementById('new').onclick=()=>{edit.innerHTML=form(); wireSave()}; document.querySelectorAll('[data-id]').forEach(a=>a.onclick=()=>{const p=products.find(x=>x.id===a.dataset.id); edit.innerHTML=form(p); wireSave(p.id)}); wireSave()}catch(e){app.className='notice';app.textContent=e.message}}
      async function uploadImages(){const input=document.getElementById('image_files'); const status=document.getElementById('upload_status'); if(!input?.files?.length){status.textContent='Choose one or more image files first.';return} const form=new FormData(); [...input.files].forEach(file=>form.append('files',file)); status.textContent='Uploading...'; const r=await fetch('/api/admin/upload',{method:'POST',body:form}); const data=await r.json().catch(()=>({})); if(!r.ok){status.textContent=data.error||'Upload failed';return} const urls=(data.files||[]).map(f=>f.url).filter(Boolean); if(!urls.length){status.textContent='No image URL returned.';return} const main=document.getElementById('image_url'); const gallery=document.getElementById('image_urls'); if(!main.value)main.value=urls[0]; const existing=gallery.value.trim(); gallery.value=[existing,...urls.slice(main.value===urls[0]?1:0)].filter(Boolean).join('\\n'); status.textContent='Uploaded '+urls.length+' image(s). Save product to publish them.'}
      function payload(){const currency=document.getElementById('currency').value; return {name:document.getElementById('name').value,slug:document.getElementById('slug').value,sku:document.getElementById('sku').value,excerpt:document.getElementById('excerpt').value,description:document.getElementById('description').value,category:document.getElementById('category').value,material:document.getElementById('material').value,size:document.getElementById('size').value,specs:document.getElementById('specs').value,moq:Number(document.getElementById('moq').value||1),weight_grams:Number(document.getElementById('weight_grams').value||0),image_url:document.getElementById('image_url').value,image_urls:document.getElementById('image_urls').value,price_cents:amountFromPrice(document.getElementById('price').value,currency),currency,inventory:Number(document.getElementById('inventory').value||0),status:document.getElementById('status').value,allow_checkout:document.getElementById('allow_checkout').checked?1:0}}
      function wireSave(id){const uploader=document.getElementById('upload_images'); if(uploader)uploader.onclick=uploadImages; document.getElementById('save').onclick=async()=>{const p=payload(); const result=await api(id?'/api/admin/products/'+id:'/api/admin/products',{method:id?'PUT':'POST',body:JSON.stringify(p)}); const slug=result.slug||p.slug; document.getElementById('saved').innerHTML='Saved. <a class="text-link" target="_blank" href="/shop/products/'+encodeURIComponent(slug)+'?fresh='+Date.now()+'">Open product</a> or <a class="text-link" target="_blank" href="/shop?fresh='+Date.now()+'">check shop</a>.'; if(!id)setTimeout(load,700)}; const del=document.getElementById('delete'); if(del)del.onclick=async()=>{if(!confirm('Delete this product?'))return; await api('/api/admin/products/'+id,{method:'DELETE'}); load()}}
      load();
    </script></main>`;
  return html(shell({ title: "Product Admin | Toumyou", description: "Toumyou product admin.", path: "/admin/products", content }), { cache: "no-store" });
}

function adminOrdersPage() {
  const content = `<main class="admin-wrap"><h1>Orders & quotes</h1><p class="lead">Review Stripe checkout orders, update fulfillment status, and follow up on quote requests.</p>
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
      function summary(orders,inquiries){const paid=orders.filter(o=>String(o.payment_status).toLowerCase()==='paid'); const attention=orders.filter(o=>['checkout_created','failed','expired','unpaid'].includes(String(o.payment_status).toLowerCase())); const openQuotes=inquiries.filter(q=>!['won','lost','archived'].includes(String(q.status||'new').toLowerCase())); return '<div class="order-dashboard"><div class="metric-card"><strong>'+orders.length+'</strong><span>Total checkout orders</span></div><div class="metric-card"><strong>'+paid.length+'</strong><span>Paid by Stripe</span></div><div class="metric-card"><strong>'+attention.length+'</strong><span>Need attention</span></div><div class="metric-card"><strong>'+openQuotes.length+'</strong><span>Open quotes</span></div></div>'}
      function wireOrderFilter(){const q=document.getElementById('orderSearch'); const f=document.getElementById('paymentFilter'); const cards=[...document.querySelectorAll('[data-order-card]')]; const count=document.getElementById('orderVisibleCount'); function apply(){const text=(q?.value||'').trim().toLowerCase(); const status=f?.value||''; let shown=0; cards.forEach(card=>{const ok=(!text||(card.dataset.search||'').includes(text))&&(!status||card.dataset.payment===status); card.hidden=!ok; if(ok)shown+=1}); if(count)count.textContent=shown+' of '+cards.length+' orders shown'} [q,f].forEach(el=>el&&el.addEventListener('input',apply)); apply()}
      async function load(){try{const s=await api('/api/admin/session'); if(!s.authenticated)return login(); const orders=await api('/api/admin/orders'); const inquiries=await api('/api/admin/inquiries'); app.className=''; app.innerHTML='<div class="toolbar" style="margin-bottom:24px"><a class="btn secondary" href="/admin/products">Products</a><a class="btn secondary" href="/admin">Articles</a><a class="btn secondary" href="/shop" target="_blank">Open shop</a></div>'+summary(orders,inquiries)+'<section class="section" style="padding:0"><p class="eyebrow">Paid checkout</p><h2>Orders</h2><div class="order-filter"><input id="orderSearch" type="search" placeholder="Search by SKU, buyer, country, session..."><select id="paymentFilter"><option value="">All payment statuses</option><option value="paid">Paid</option><option value="checkout_created">Waiting</option><option value="failed">Failed</option><option value="expired">Expired</option></select></div><p id="orderVisibleCount" class="muted"></p><div class="article-grid">'+(orders.length?orders.map(orderCard).join(''):'<div class="notice">No orders yet. New checkout attempts will appear here after customers click Pay.</div>')+'</div></section><section class="section" style="padding:40px 0 0"><p class="eyebrow">Quote requests</p><h2>Inquiries</h2><div class="article-grid">'+(inquiries.length?inquiries.map(inquiryCard).join(''):'<div class="notice">No quote requests yet.</div>')+'</div></section>'; orders.forEach(o=>{const s=document.querySelector('[data-status="'+CSS.escape(o.id)+'"]'); if(s)s.value=o.fulfillment_status||'new'}); inquiries.forEach(q=>{const s=document.querySelector('[data-inquiry-status="'+CSS.escape(q.id)+'"]'); if(s)s.value=q.status||'new'}); wireOrderFilter(); document.querySelectorAll('[data-save-order]').forEach(b=>b.onclick=async()=>{const id=b.dataset.saveOrder; await api('/api/admin/orders/'+encodeURIComponent(id),{method:'PATCH',body:JSON.stringify({fulfillment_status:document.querySelector('[data-status="'+CSS.escape(id)+'"]').value,notes:document.querySelector('[data-notes="'+CSS.escape(id)+'"]').value})}); b.textContent='Saved'}); document.querySelectorAll('[data-save-inquiry]').forEach(b=>b.onclick=async()=>{const id=b.dataset.saveInquiry; await api('/api/admin/inquiries/'+encodeURIComponent(id),{method:'PATCH',body:JSON.stringify({status:document.querySelector('[data-inquiry-status="'+CSS.escape(id)+'"]').value})}); b.textContent='Saved'})}catch(e){app.className='notice';app.textContent=e.message}}
      load();
    </script></main>`;
  return html(shell({ title: "Orders | Toumyou", description: "Toumyou order and quote admin.", path: "/admin/orders", content }), { cache: "no-store" });
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
  const stripeKey = env.STRIPE_RESTRICTED_KEY || env.STRIPE_SECRET_KEY;
  if (!stripeKey) return html(shell({
    title: "Checkout not configured | Toumyou",
    description: "Stripe checkout is not configured yet.",
    content: '<main class="listing"><h1>Checkout is<br><em>not configured.</em></h1><p class="lead">Please request a quote while payment keys are being configured.</p><a class="btn" href="mailto:sunflyerjp@gmail.com?subject=Fastener%20quote%20request">Request quote</a></main>',
  }), { status: 503 });
  const body = await readBody(request);
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
  await ensureCommerce(env);
  const orderId = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const params = new URLSearchParams();
  params.set("mode", "payment");
  params.set("success_url", `${SITE.url}/shop/success?session_id={CHECKOUT_SESSION_ID}`);
  params.set("cancel_url", `${SITE.url}/shop/products/${encodeURIComponent(product.slug)}`);
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
    await env.DB.prepare("INSERT INTO orders (id,stripe_session_id,product_id,product_slug,product_name,sku,quantity,amount_total,currency,payment_status,fulfillment_status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)")
      .bind(orderId, data.id || "", product.id, product.slug, product.name, product.sku || "", quantity, product.price_cents * quantity, product.currency, "checkout_created", "new", now, now).run()
      .catch(() => {});
  }
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
  return json({ ok: true, id });
}

function checkoutSuccessPage() {
  return html(shell({
    title: "Order submitted | Toumyou",
    description: "Thank you for your Toumyou shop order.",
    path: "/shop/success",
    content: `<main class="listing"><h1>Order submitted,<br><em>thank you.</em></h1><p class="lead">Your Stripe checkout was submitted. Some local payment methods, including Alipay, can take a little longer to confirm, so we will mark the order as paid only after Stripe sends the final payment confirmation.</p>
      <div class="notice">
        <p><strong>What happens next</strong></p>
        <p>1. Stripe sends Toumyou a signed payment update.</p>
        <p>2. Paid orders move to the admin order list automatically.</p>
        <p>3. We verify SKU, stock, export handling, and freight details before dispatch.</p>
        <p id="sessionNote" class="muted"></p>
      </div>
      <div class="toolbar"><a class="btn" href="/shop">Back to shop</a><a class="btn secondary" href="mailto:sunflyerjp@gmail.com">Contact us</a></div>
      <script>
        const sid = new URL(location.href).searchParams.get('session_id');
        if (sid) document.getElementById('sessionNote').textContent = 'Stripe session: ' + sid;
      </script>
    </main>`,
  }), { cache: "no-store" });
}

async function handleApi(request, env, pathname) {
  if (pathname === "/api/checkout" && request.method === "POST") return stripeCheckout(request, env);
  if (pathname === "/api/stripe/webhook" && request.method === "POST") return stripeWebhook(request, env);
  if (pathname === "/api/quote" && request.method === "POST") return quoteRequest(request, env);
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
  if (pathname === "/api/admin/inquiries" && request.method === "GET") return json(await listInquiries(env));
  if (pathname === "/api/admin/upload" && request.method === "POST") return uploadMedia(request, env);
  if (pathname === "/api/admin/products" && request.method === "POST") {
    const raw = await request.json();
    const now = Math.floor(Date.now() / 1000);
    const id = crypto.randomUUID();
    const p = normalizeProduct(raw, id);
    await ensureCommerce(env);
    await env.DB.prepare("INSERT INTO products (id,slug,name,sku,excerpt,description,category,material,size,image_url,image_urls,specs,moq,weight_grams,price_cents,currency,inventory,status,allow_checkout,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
      .bind(id, p.slug, p.name, p.sku, p.excerpt, p.description, p.category, p.material, p.size, p.image_url, p.image_urls, p.specs, p.moq, p.weight_grams, p.price_cents, p.currency, p.inventory, p.status, p.allow_checkout, now, now).run();
    return json({ ok: true, id, slug: p.slug });
  }
  const productMatch = pathname.match(/^\/api\/admin\/products\/([^/]+)$/);
  if (productMatch && request.method === "PUT") {
    const existing = await getProduct(env, productMatch[1]);
    if (!existing) return json({ error: "Product not found" }, { status: 404 });
    const p = normalizeProduct(await request.json(), existing.id);
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare("UPDATE products SET slug=?,name=?,sku=?,excerpt=?,description=?,category=?,material=?,size=?,image_url=?,image_urls=?,specs=?,moq=?,weight_grams=?,price_cents=?,currency=?,inventory=?,status=?,allow_checkout=?,updated_at=? WHERE id=?")
      .bind(p.slug, p.name, p.sku, p.excerpt, p.description, p.category, p.material, p.size, p.image_url, p.image_urls, p.specs, p.moq, p.weight_grams, p.price_cents, p.currency, p.inventory, p.status, p.allow_checkout, now, existing.id).run();
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
    const p = await request.json();
    const now = Math.floor(Date.now() / 1000);
    const id = crypto.randomUUID();
    const slug = slugify(p.slug || p.title || id);
    await env.DB.prepare("INSERT INTO posts (id,slug,title,excerpt,body,category,status,published_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
      .bind(id, slug, p.title || "Untitled", p.excerpt || "", p.body || "", p.category || "Insights", p.status || "draft", p.status === "published" ? now : null, now, now).run();
    return json({ ok: true, id, slug });
  }
  const match = pathname.match(/^\/api\/admin\/posts\/([^/]+)$/);
  if (match && request.method === "PUT") {
    const p = await request.json();
    const now = Math.floor(Date.now() / 1000);
    const existing = await env.DB.prepare("SELECT published_at FROM posts WHERE id=?").bind(match[1]).first();
    const publishedAt = p.status === "published" ? (existing?.published_at || now) : null;
    await env.DB.prepare("UPDATE posts SET slug=?,title=?,excerpt=?,body=?,category=?,status=?,published_at=?,updated_at=? WHERE id=?")
      .bind(slugify(p.slug || p.title || match[1]), p.title || "Untitled", p.excerpt || "", p.body || "", p.category || "Insights", p.status || "draft", publishedAt, now, match[1]).run();
    return json({ ok: true, slug: slugify(p.slug || p.title || match[1]) });
  }
  if (match && request.method === "DELETE") {
    await env.DB.prepare("DELETE FROM posts WHERE id=?").bind(match[1]).run();
    return json({ ok: true });
  }
  return json({ error: "Not found" }, { status: 404 });
}

async function sitemap(env) {
  const posts = await listPublished(env);
  const products = await listProducts(env);
  const urls = ["/", "/shop", "/articles", ...products.map((p) => `/shop/products/${p.slug}`), ...posts.map((p) => `/articles/${p.slug}`)];
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((u) => `<url><loc>${SITE.url}${u}</loc></url>`).join("")}</urlset>`, {
    headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "no-store, no-cache, must-revalidate" },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/robots.txt") return new Response(`User-agent: *\nAllow: /\nSitemap: ${SITE.url}/sitemap.xml\n`, { headers: { "content-type": "text/plain; charset=utf-8" } });
    if (url.pathname === "/sitemap.xml") return sitemap(env);
    if (url.pathname.startsWith("/media/")) return mediaFile(request, env, decodeURIComponent(url.pathname.slice("/media/".length)));
    if (url.pathname.startsWith("/api/")) return handleApi(request, env, url.pathname);
    if (url.pathname === "/") return home(env);
    if (url.pathname === "/shop") return shopPage(env);
    if (url.pathname === "/shop/success") return checkoutSuccessPage();
    if (url.pathname.startsWith("/shop/products/")) return productPage(env, decodeURIComponent(url.pathname.split("/").pop()));
    if (url.pathname === "/articles") return articles(env);
    if (url.pathname.startsWith("/articles/")) return article(env, decodeURIComponent(url.pathname.split("/").pop()));
    if (url.pathname === "/admin") return adminPage();
    if (url.pathname === "/admin/products") return adminProductsPage();
    if (url.pathname === "/admin/orders") return adminOrdersPage();
    return html(shell({ title: "Not found | Toumyou", description: "Page not found.", content: "<main><h1>Page not found</h1></main>" }), { status: 404 });
  },
};
