const SITE = {
  name: "Toumyou",
  url: "https://toumyou.com",
  description:
    "Toumyou LLC is an independent digital studio in Japan for brand identities, animation, WeChat mini-programs, websites, software, and AI workflows.",
};

const SHOP = {
  name: "Toumyou Fastener Supply",
  description:
    "Cross-border fastener and industrial accessory sourcing from Japan and Asia, built for small-batch buyers, distributors, and product teams.",
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
    price_cents INTEGER DEFAULT 0,
    currency TEXT DEFAULT 'USD',
    inventory INTEGER DEFAULT 0,
    status TEXT DEFAULT 'draft',
    allow_checkout INTEGER DEFAULT 0,
    created_at INTEGER,
    updated_at INTEGER
  )`).run();
}

function normalizeProduct(p = {}, id = crypto.randomUUID()) {
  const name = String(p.name || "Untitled product").trim();
  const slug = slugify(p.slug || name || id);
  const priceCents = Math.max(0, Number.parseInt(p.price_cents ?? p.priceCents ?? 0, 10) || 0);
  const inventory = Math.max(0, Number.parseInt(p.inventory ?? 0, 10) || 0);
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
    price_cents: priceCents,
    currency: String(p.currency || "USD").trim().toUpperCase().slice(0, 3) || "USD",
    inventory,
    status: p.status === "published" ? "published" : "draft",
    allow_checkout: p.allow_checkout || p.allowCheckout ? 1 : 0,
  };
}

function money(cents = 0, currency = "USD") {
  const value = (Number(cents) || 0) / 100;
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency: currency || "USD" }).format(value);
  } catch {
    return `${currency || "USD"} ${value.toFixed(2)}`;
  }
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
    :root{color-scheme:light;--ink:#171815;--paper:#f4f1e9;--panel:#e7e3da;--acid:#d9ff3f;--line:#c9c5b9;--muted:#696b64;--soft:#faf8f1;--focus:#3842ff}
    *{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.55 Arial,Helvetica,sans-serif}
    a{color:inherit;text-decoration:none}header{height:76px;padding:0 4vw;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line);position:sticky;top:0;background:rgba(244,241,233,.9);backdrop-filter:blur(18px);z-index:2}
    nav{display:flex;gap:26px;align-items:center}.brand{font-size:21px;font-weight:850;letter-spacing:-1.6px}.brand span{font-size:9px;vertical-align:top;margin-left:2px}.nav{font-size:13px;color:#343630}.nav-admin{border:1px solid var(--ink);padding:8px 12px;border-radius:6px}
    main{overflow:hidden}.hero{min-height:calc(100dvh - 76px);padding:92px 8vw 52px;position:relative;border-bottom:1px solid var(--line);display:grid;align-content:center}
    .hero:after{content:"";position:absolute;right:-10vw;top:72px;width:min(52vw,680px);height:min(52vw,680px);background:var(--acid);border-radius:999px;z-index:-1}
    .eyebrow{font-size:11px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;margin:0 0 22px}.hero h1,.section h2,.contact h2,.listing h1,.article h1{font-family:Georgia,"Times New Roman",serif;font-weight:500;letter-spacing:-.07em;line-height:.88;margin:0}
    .hero h1{font-size:clamp(58px,8.6vw,132px);max-width:920px}.lead{font-size:clamp(18px,2vw,22px);line-height:1.45;max-width:520px;margin:36px 0 30px;color:#33352f}
    .btn{display:inline-flex;align-items:center;gap:22px;background:var(--ink);color:#fff;border:0;border-radius:6px;padding:14px 16px;font-weight:760;cursor:pointer}.btn.secondary{background:transparent;color:var(--ink);border:1px solid var(--ink)}
    .toolbar{display:flex;gap:12px;flex-wrap:wrap;margin:18px 0}.hero-note{position:absolute;right:8vw;bottom:38px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#4d5048}
    .section{padding:104px 8vw;border-bottom:1px solid var(--line)}.section h2,.contact h2{font-size:clamp(44px,6.1vw,92px);max-width:850px}.intro-strip{display:grid;grid-template-columns:1.2fr .8fr;gap:9vw;margin-top:46px;align-items:end}.intro-strip p{font-size:20px;line-height:1.55;color:#343630;margin:0;max-width:620px}.intro-strip ul{list-style:none;padding:0;margin:0;display:grid;gap:12px}.intro-strip li{border-top:1px solid var(--line);padding-top:12px;color:var(--muted)}
    .service-grid{display:grid;grid-template-columns:1.3fr 1fr 1fr;gap:0;margin-top:72px;border-top:1px solid var(--ink)}
    .service-grid article{min-height:268px;padding:24px 26px 24px 0;border-right:1px solid var(--line)}.service-grid article+article{padding-left:26px}.service-grid article:last-child{border-right:0}.service-grid span,.meta{font-size:11px;letter-spacing:.8px;text-transform:uppercase;color:var(--muted)}
    h3{font-family:Georgia,"Times New Roman",serif;font-size:31px;line-height:1.06;font-weight:400;margin:54px 0 16px}.service-grid p,.muted{color:var(--muted);max-width:300px}.insights-head{display:flex;justify-content:space-between;align-items:end;gap:24px}.text-link{text-decoration:underline;text-underline-offset:4px;font-size:13px}
    .portfolio-grid{display:grid;grid-template-columns:1.15fr .85fr 1fr;grid-auto-rows:minmax(330px,auto);gap:16px;margin-top:70px}.work-card{position:relative;overflow:hidden;border-radius:10px;background:var(--panel);min-height:330px;display:flex;align-items:flex-end}.work-card.large{grid-row:span 2}.work-card img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:saturate(.82) contrast(1.02)}.work-card:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(23,24,21,.03),rgba(23,24,21,.78))}.work-copy{position:relative;z-index:1;color:#fff;padding:26px}.work-copy span{font-size:11px;text-transform:uppercase;letter-spacing:.9px;color:#d8dccf}.work-copy h3{margin:16px 0 8px;color:#fff}.work-copy p{margin:0;color:#eceee7;max-width:300px}
    .timeline{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:0;margin-top:72px;border-top:1px solid var(--ink)}.timeline article{padding:26px 26px 0 0;min-height:300px;border-right:1px solid var(--line)}.timeline article+article{padding-left:26px}.timeline article:last-child{border-right:0}.timeline img{width:100%;height:135px;object-fit:cover;border-radius:10px;margin-bottom:28px;filter:saturate(.85)}.timeline strong{font-size:13px;text-transform:uppercase;letter-spacing:.8px}.timeline h3{margin:18px 0 12px}.team-panel{margin-top:70px;display:grid;grid-template-columns:.9fr 1.1fr;gap:16px}.team-note{background:var(--ink);color:var(--paper);border-radius:10px;padding:32px;display:flex;flex-direction:column;justify-content:space-between;min-height:420px}.team-note p{font-size:24px;line-height:1.35;margin:0;color:#f2f0e8}.team-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.person{background:var(--panel);border-radius:10px;overflow:hidden}.person img{width:100%;height:260px;object-fit:cover;display:block;filter:saturate(.85)}.person div{padding:20px}.person h3{margin:0 0 8px;font-size:28px}.person p{margin:0;color:var(--muted)}.logo-row{display:flex;gap:24px;flex-wrap:wrap;align-items:center;margin-top:50px}.logo-row img{max-height:44px;max-width:132px;object-fit:contain;filter:grayscale(1) contrast(.95);opacity:.72}
    .article-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin-top:62px}.article-card{min-height:275px;padding:24px;background:var(--panel);display:flex;flex-direction:column;border-radius:6px;transition:transform .2s,background .2s}.article-card:hover{transform:translateY(-3px);background:var(--acid)}
    .article-card h3{margin:34px 0 14px}.article-card p{color:var(--muted)}.article-card b{margin-top:auto;font-size:12px}.empty{margin-top:62px;padding:34px;border-top:1px solid var(--ink)}.empty p{font-family:Georgia,"Times New Roman",serif;font-size:32px;margin:0 0 8px}
    .contact{background:var(--ink);color:var(--paper);padding:104px 8vw;min-height:520px}.contact-grid{display:grid;grid-template-columns:1.15fr .85fr;gap:8vw;align-items:end}.contact-mail{display:block;margin-top:48px;font-size:clamp(20px,2.6vw,36px);border-bottom:1px solid #666960;padding-bottom:13px}.contact-list{list-style:none;margin:0;padding:0;border-top:1px solid #666960}.contact-list li{display:grid;grid-template-columns:90px 1fr;gap:24px;padding:18px 0;border-bottom:1px solid #41433d}.contact-list span{font-size:11px;text-transform:uppercase;letter-spacing:.9px;color:#a9ada2}.address{font-size:13px;line-height:1.7;color:#c5c7be;margin:0}
    footer{padding:24px 4vw;background:var(--ink);color:#c5c7be;display:flex;justify-content:space-between;gap:20px;border-top:1px solid #494b44;font-size:11px}.listing{padding:88px 8vw}.listing h1{font-size:clamp(56px,7vw,108px)}.articles{display:grid;gap:14px}.article-link{display:block;border-top:1px solid var(--line);padding:24px 0}.article-link:hover h3{color:#2b3310}
    .article-page{padding:88px 8vw}.article-page article{max-width:860px}.article h1{font-size:clamp(52px,7.4vw,110px)}.article-dek{font-size:23px;line-height:1.42;max-width:700px;margin:36px 0}.post-body{font-family:Georgia,"Times New Roman",serif;font-size:21px;line-height:1.65;white-space:pre-wrap;max-width:680px}
    input,textarea,select{width:100%;border:1px solid #aaa69c;border-radius:6px;padding:11px 12px;background:var(--soft);color:var(--ink);font:15px Arial,Helvetica,sans-serif}textarea{min-height:150px;line-height:1.45;resize:vertical}label{display:block;margin:14px 0 7px;font-size:12px;font-weight:800;letter-spacing:.3px}.notice{border:1px solid var(--line);padding:18px;border-radius:6px;background:var(--soft)}
    .admin-wrap{padding:58px 5vw 90px}.editor{display:grid;grid-template-columns:minmax(240px,360px) minmax(0,740px);gap:7vw}.editor aside{border-right:1px solid var(--line);padding-right:28px}.editor-actions{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-top:20px}.status{margin:12px 0 0;color:#36510d;font-weight:700}.danger{background:transparent;color:var(--ink);border:1px solid var(--line)}
    :focus-visible{outline:3px solid var(--focus);outline-offset:3px}@media(max-width:980px){.portfolio-grid,.timeline,.team-panel,.contact-grid,.intro-strip{grid-template-columns:1fr}.portfolio-grid{grid-auto-rows:minmax(310px,auto)}.work-card.large{grid-row:auto}.timeline article,.timeline article+article{border-right:0;border-bottom:1px solid var(--line);padding:26px 0}.team-grid{grid-template-columns:1fr 1fr}.contact-list{margin-top:34px}}@media(max-width:760px){header{height:auto;min-height:68px;align-items:flex-start;gap:14px;flex-direction:column;padding:18px 6vw}nav{gap:16px;flex-wrap:wrap}.hero{min-height:620px;padding:82px 7vw 46px}.hero:after{width:88vw;height:88vw;right:-36vw;top:126px}.hero-note{position:static;margin-top:42px}.section,.contact,.listing,.article-page{padding:72px 7vw}.service-grid,.article-grid,.editor,.team-grid{grid-template-columns:1fr}.service-grid article,.service-grid article+article{border-right:0;border-bottom:1px solid var(--line);min-height:auto;padding:24px 0}.person img{height:310px}.insights-head{display:block}.article-grid{margin-top:40px}.editor aside{border-right:0;border-bottom:1px solid var(--line);padding:0 0 26px}footer{display:block}.contact-mail{word-break:break-word}.contact-list li{grid-template-columns:1fr;gap:6px}}
  </style>
  ${schema ? `<script type="application/ld+json">${JSON.stringify(schema)}</script>` : ""}
</head>
<body>
  <header><a class="brand" href="/">TOUMYOU<span>®</span></a><nav><a class="nav" href="/#portfolio">Portfolio</a><a class="nav" href="/#about">About</a><a class="nav" href="/shop">Shop</a><a class="nav" href="/articles">Insights</a><a class="nav" href="/#contact">Contact</a><a class="nav nav-admin" href="/admin">Editor</a></nav></header>
  ${content}
  <footer><span>© ${new Date().getFullYear()} Toumyou LLC</span><span>Designed for clarity and useful digital work.</span></footer>
</body>
</html>`;
}

async function home(env) {
  const posts = (await listPublished(env)).slice(0, 3);
  const asset = "https://4f4b3799.toumyou.pages.dev/assets/img";
  const content = `<main>
    <section class="hero">
      <p class="eyebrow">Independent digital studio, Japan</p>
      <h1>Make the next<br><em>clear move.</em></h1>
      <p class="lead">Toumyou builds brand, web, software, and AI systems for teams that need useful digital work.</p>
      <div class="toolbar"><a class="btn" href="#contact">Start a conversation</a><a class="btn secondary" href="/shop">Visit fastener shop</a><a class="btn secondary" href="/articles">Read insights</a></div>
      <div class="hero-note">Design, development and digital business</div>
    </section>
    <section class="section">
      <h2>Give people a<br>new experience.</h2>
      <div class="intro-strip">
        <p>From cultural communication to full-service software development, Toumyou LLC combines visual thinking, practical technology, and a Japan-based operating base.</p>
        <ul>
          <li>Brand identities and graphic systems</li>
          <li>Animation, websites, and responsive interfaces</li>
          <li>WeChat mini-programs, custom software, and AI workflows</li>
        </ul>
      </div>
    </section>
    <section id="services" class="section">
      <p class="eyebrow">What we do</p>
      <h2>Digital work with<br>a point of view.</h2>
      <div class="service-grid">
        <article><span>Web platforms</span><h3>First impressions that keep earning attention.</h3><p>Fast, expressive websites for teams that need clarity, performance, and a strong public presence.</p></article>
        <article><span>Cross-border shop</span><h3>Fasteners and industrial accessories for global buyers.</h3><p>A new commerce channel for metric screws, bolts, nuts, washers, and sourcing support.</p></article>
        <article><span>Product design</span><h3>Interfaces people can move through with confidence.</h3><p>Design systems, flows, and product surfaces shaped around the actual decision in front of the user.</p></article>
      </div>
    </section>
    <section id="portfolio" class="section">
      <h2>Selected work,<br>reshaped for now.</h2>
      <div class="portfolio-grid">
        <article class="work-card large"><img src="${asset}/portfolio/2.jpg" alt="Graphic design work by Toumyou" loading="lazy"><div class="work-copy"><span>Graphic Design</span><h3>Brand identities with a clearer voice.</h3><p>Visual systems for teams that need to be remembered and understood.</p></div></article>
        <article class="work-card"><img src="${asset}/portfolio/3.jpg" alt="Animation design work by Toumyou" loading="lazy"><div class="work-copy"><span>Animation Design</span><h3>Spark imagination.</h3><p>Motion and narrative assets that make ideas easier to feel.</p></div></article>
        <article class="work-card"><img src="${asset}/portfolio/4.jpg" alt="WeChat mini-program development by Toumyou" loading="lazy"><div class="work-copy"><span>WeChat Mini-Program</span><h3>Bespoke digital services.</h3><p>Focused mini-program experiences built around real user flows.</p></div></article>
        <article class="work-card"><img src="${asset}/portfolio/5.jpg" alt="Responsive website design by Toumyou" loading="lazy"><div class="work-copy"><span>Website Design</span><h3>Responsive by default.</h3><p>Public-facing websites that work across screens and search surfaces.</p></div></article>
        <article class="work-card"><img src="${asset}/portfolio/6.jpg" alt="Software development by Toumyou" loading="lazy"><div class="work-copy"><span>Software Development</span><h3>Scalable software solutions.</h3><p>Custom tools and business systems made to support everyday operations.</p></div></article>
      </div>
    </section>
    <section id="about" class="section">
      <h2>Our history is<br>still moving.</h2>
      <div class="timeline">
        <article><img src="${asset}/about/1.jpg" alt="Toumyou early company history" loading="lazy"><strong>2011</strong><h3>Our humble beginnings</h3><p>We established our first cultural communication company.</p></article>
        <article><img src="${asset}/about/2.jpg" alt="Toumyou digital business beginning" loading="lazy"><strong>March 2017</strong><h3>A creative digital business is born</h3><p>We developed the company's first digital business and began expanding the service direction.</p></article>
        <article><img src="${asset}/about/3.jpg" alt="Toumyou software development transition" loading="lazy"><strong>December 2023</strong><h3>Transition to full service</h3><p>We officially started the software development business.</p></article>
        <article><img src="${asset}/about/4.jpg" alt="Toumyou overseas business in Japan" loading="lazy"><strong>2025</strong><h3>Phase two expansion</h3><p>We started overseas business in Japan and continue building from Osaka.</p></article>
      </div>
    </section>
    <section id="team" class="section">
      <h2>Professionalism and<br>innovative thinking.</h2>
      <div class="team-panel">
        <div class="team-note"><p>Our design team is a passionate and creative collective dedicated to transforming your vision into captivating visual experiences.</p><div class="logo-row"><img src="${asset}/logos/ld.png" alt="Partner logo" loading="lazy"><img src="${asset}/logos/hc.jpg" alt="Partner logo" loading="lazy"><img src="${asset}/logos/gn.png" alt="Partner logo" loading="lazy"><img src="${asset}/logos/dongchuan.png" alt="Partner logo" loading="lazy"></div></div>
        <div class="team-grid">
          <article class="person"><img src="${asset}/team/1.jpg" alt="Jenny, Lead Designer" loading="lazy"><div><h3>Jenny</h3><p>Lead Designer</p></div></article>
          <article class="person"><img src="${asset}/team/2.jpg" alt="Sunflyer, Lead Marketer" loading="lazy"><div><h3>Sunflyer</h3><p>Lead Marketer</p></div></article>
          <article class="person"><img src="${asset}/team/3.jpg" alt="Lucy, Lead Developer" loading="lazy"><div><h3>Lucy</h3><p>Lead Developer</p></div></article>
        </div>
      </div>
    </section>
    <section id="insights" class="section">
      <div class="insights-head"><div><p class="eyebrow">Notes from Toumyou</p><h2>Useful perspectives,<br><em>not noise.</em></h2></div><a class="text-link" href="/articles">All insights</a></div>
      ${posts.length ? `<div class="article-grid">${posts.map(articleLink).join("")}</div>` : '<div class="empty"><p>Our first notes are in progress.</p><span class="muted">Published articles will appear here immediately after you save them.</span></div>'}
    </section>
    <section id="contact" class="contact">
      <div class="contact-grid">
        <div><p class="eyebrow">Contact us</p><h2>Let us make<br>something <em>useful.</em></h2><a href="mailto:sunflyerjp@gmail.com" class="contact-mail">sunflyerjp@gmail.com</a></div>
        <ul class="contact-list">
          <li><span>Tel</span><a href="tel:+8107018461357">+81 070 1846 1357</a></li>
          <li><span>Email</span><a href="mailto:sunflyerjp@gmail.com">sunflyerjp@gmail.com</a></li>
          <li><span>Address</span><p class="address">2-1-35 Sugimoto, Sumiyoshi-ku<br>Osaka City, Japan</p></li>
        </ul>
      </div>
    </section>
  </main>`;
  return html(shell({
    title: "Toumyou | Digital products, built with clarity",
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
    description: "Useful perspectives on digital products, AI, software, and web platforms from Toumyou.",
    path: "/articles",
    content: `<main class="listing"><h1>Useful perspectives,<br><em>not noise.</em></h1><p class="lead">Notes on product work, digital systems, AI workflows, and the craft of making things clearer.</p><div class="article-grid">${posts.map(articleLink).join("") || '<div class="empty"><p>No published articles yet.</p><span class="muted">Use the editor to publish the first note.</span></div>'}</div></main>`,
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
  const image = product.image_url
    ? `<img src="${escapeHtml(product.image_url)}" alt="${escapeHtml(product.name)}" loading="lazy" style="width:100%;height:190px;object-fit:cover;border-radius:6px;margin-bottom:18px">`
    : "";
  return `<article class="article-card">
    ${image}
    <div class="meta">${escapeHtml(meta)}</div>
    <h3>${escapeHtml(product.name)}</h3>
    <p>${escapeHtml(product.excerpt || product.description || "Industrial supply item available for cross-border sourcing.")}</p>
    <p class="muted">SKU: ${escapeHtml(product.sku || product.slug)} · ${escapeHtml(price)}${product.inventory ? ` · Stock ${escapeHtml(product.inventory)}` : ""}</p>
    <div class="toolbar" style="margin-top:auto">
      <a class="btn secondary" href="/shop/products/${escapeHtml(product.slug)}">Details</a>
      ${
        canCheckout
          ? `<form method="post" action="/api/checkout"><input type="hidden" name="product_id" value="${escapeHtml(product.id)}"><input type="hidden" name="quantity" value="1"><button class="btn" type="submit">Checkout</button></form>`
          : `<a class="btn" href="mailto:sunflyerjp@gmail.com?subject=${encodeURIComponent(`Quote request: ${product.name}`)}">Request quote</a>`
      }
    </div>
  </article>`;
}

async function shopPage(env) {
  const medusaUrl = env.MEDUSA_BACKEND_URL || "";
  const checkoutStatus = env.STRIPE_SECRET_KEY || env.STRIPE_RESTRICTED_KEY ? "Payment gateway ready for Stripe configuration." : "Payment gateway pending merchant configuration.";
  const products = await listProducts(env);
  const categoryCards = SHOP.categories
    .map(
      (item) => `<article class="article-card"><div class="meta">Catalog / ${escapeHtml(item.slug)}</div><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.summary)}</p><b>Request quote</b></article>`,
    )
    .join("");
  const content = `<main>
    <section class="hero">
      <p class="eyebrow">Cross-border fastener supply</p>
      <h1>Fasteners,<br><em>without friction.</em></h1>
      <p class="lead">${escapeHtml(SHOP.description)}</p>
      <div class="toolbar"><a class="btn" href="mailto:sunflyerjp@gmail.com?subject=Fastener%20quote%20request">Request a quote</a><a class="btn secondary" href="#catalog">View catalog</a></div>
      <div class="hero-note">Bolts, screws, nuts, washers and sourcing support</div>
    </section>
    <section id="catalog" class="section">
      <p class="eyebrow">Product direction</p>
      <h2>A practical catalog<br>for global hardware buyers.</h2>
      <div class="intro-strip">
        <p>Browse listed fasteners and industrial accessories, or send a specification for sourcing. Products can be managed in the admin backend and connected to Stripe Checkout when payment keys are configured.</p>
        <ul>
          <li>Metric and inch fastener categories</li>
          <li>Small-batch procurement and distributor supply</li>
          <li>Stripe Checkout route after merchant setup</li>
        </ul>
      </div>
      <div class="article-grid">${products.length ? products.map((p) => productCard(p, env)).join("") : categoryCards}</div>
      ${products.length ? "" : '<div class="notice" style="margin-top:24px">No live products have been published yet. Use <a class="text-link" href="/admin/products">Product Admin</a> to publish the first SKUs.</div>'}
    </section>
    <section class="section">
      <p class="eyebrow">Commerce system</p>
      <h2>Built to connect<br>with Medusa.</h2>
      <div class="service-grid">
        <article><span>Product admin</span><h3>D1-backed product listing is ready.</h3><p>Add products from /admin/products. A full Medusa backend can still be connected later for larger order operations.</p></article>
        <article><span>Storefront</span><h3>Cloudflare stays fast.</h3><p>Products render directly at the edge, with SEO-friendly product pages and checkout actions.</p></article>
        <article><span>Payments</span><h3>${escapeHtml(checkoutStatus)}</h3><p>Use Stripe Checkout first for safer cross-border card payment rollout, then add PayPal or bank-transfer flows if needed.</p></article>
      </div>
      <div class="notice" style="margin-top:34px">
        <strong>Current integration status:</strong>
        ${medusaUrl ? `Backend URL configured: ${escapeHtml(medusaUrl)}` : "Backend URL not configured yet. After Medusa is deployed, add MEDUSA_BACKEND_URL in Cloudflare Pages environment variables."}
      </div>
    </section>
    <section class="contact">
      <div class="contact-grid">
        <div><p class="eyebrow">Start procurement</p><h2>Send the size,<br>material and quantity.</h2><a href="mailto:sunflyerjp@gmail.com?subject=Fastener%20quote%20request" class="contact-mail">sunflyerjp@gmail.com</a></div>
        <ul class="contact-list">
          <li><span>Examples</span><p class="address">M3–M24 screws, stainless bolts, nuts, washers, anchors, pins, rivets, clips, brackets, and custom hardware.</p></li>
          <li><span>Markets</span><p class="address">Japan, Asia, North America, Europe, and cross-border B2B buyers.</p></li>
          <li><span>Next</span><p class="address">Upload SKU catalog, configure Stripe, then enable checkout per product from the product admin.</p></li>
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
        price: item.price_cents ? (item.price_cents / 100).toFixed(2) : undefined,
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
  const content = `<main class="article-page article"><article>
    <div class="meta">${escapeHtml(product.category || "Fasteners")} / ${escapeHtml(product.sku || product.slug)}</div>
    <h1>${escapeHtml(product.name)}</h1>
    <p class="article-dek">${escapeHtml(product.excerpt || "Cross-border fastener and industrial accessory supply.")}</p>
    ${product.image_url ? `<img src="${escapeHtml(product.image_url)}" alt="${escapeHtml(product.name)}" style="width:100%;max-height:460px;object-fit:cover;border-radius:10px;margin:10px 0 34px">` : ""}
    <div class="post-body">${escapeHtml(product.description || "")}</div>
    <div class="notice" style="margin-top:34px">
      <p><strong>Price:</strong> ${escapeHtml(product.price_cents > 0 ? money(product.price_cents, product.currency) : "Quote required")}</p>
      <p><strong>Material:</strong> ${escapeHtml(product.material || "Confirm by order")}</p>
      <p><strong>Size:</strong> ${escapeHtml(product.size || "Confirm by order")}</p>
      <p><strong>Inventory:</strong> ${escapeHtml(product.inventory || "Confirm availability")}</p>
    </div>
  </article>
  <div class="toolbar">
    ${
      canCheckout
        ? `<form method="post" action="/api/checkout"><input type="hidden" name="product_id" value="${escapeHtml(product.id)}"><label>Quantity</label><input name="quantity" type="number" min="1" max="999" value="1" style="max-width:130px"><button class="btn" type="submit">Checkout with Stripe</button></form>`
        : `<a class="btn" href="mailto:sunflyerjp@gmail.com?subject=${encodeURIComponent(`Quote request: ${product.name}`)}">Request quote</a>`
    }
    <a class="btn secondary" href="/shop">Back to shop</a>
  </div></main>`;
  return html(shell({
    title: `${product.name} | Toumyou Shop`,
    description: product.excerpt || product.description || SHOP.description,
    path: `/shop/products/${product.slug}`,
    content,
    schema: {
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.name,
      sku: product.sku || product.slug,
      description: product.excerpt || product.description,
      image: product.image_url || undefined,
      offers: {
        "@type": "Offer",
        price: product.price_cents ? (product.price_cents / 100).toFixed(2) : undefined,
        priceCurrency: product.currency,
        availability: product.inventory ? "https://schema.org/InStock" : "https://schema.org/PreOrder",
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
      function form(p={}){const currentStatus=p.status||'published';return '<label>Title</label><input id="title" value="'+esc(p.title||'')+'"><label>Slug</label><input id="slug" value="'+esc(p.slug||'')+'"><label>Excerpt</label><textarea id="excerpt">'+esc(p.excerpt||'')+'</textarea><label>Body</label><textarea id="body">'+esc(p.body||'')+'</textarea><label>Category</label><input id="category" value="'+esc(p.category||'Insights')+'"><label>Status</label><select id="status"><option value="published" '+(currentStatus==='published'?'selected':'')+'>published</option><option value="draft" '+(currentStatus==='draft'?'selected':'')+'>draft</option></select><div class="editor-actions"><button class="btn" id="save">Save and publish</button>'+(p.id?'<button class="btn danger" id="delete">Delete</button>':'')+'<a class="btn secondary" href="/" target="_blank">Open home</a><a class="btn secondary" href="/articles" target="_blank">Open insights</a></div><p id="saved" class="status"></p>'}
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
      function centsFromPrice(v){const n=Number(String(v||'').replace(/[^0-9.]/g,'')); return Math.round((Number.isFinite(n)?n:0)*100)}
      function priceFromCents(v){return ((Number(v)||0)/100).toFixed(2)}
      function form(p={}){const status=p.status||'draft'; const checkout=Number(p.allow_checkout||0)===1; return '<label>Name</label><input id="name" value="'+esc(p.name||'')+'"><label>Slug</label><input id="slug" value="'+esc(p.slug||'')+'"><label>SKU</label><input id="sku" value="'+esc(p.sku||'')+'"><label>Short excerpt</label><textarea id="excerpt">'+esc(p.excerpt||'')+'</textarea><label>Description</label><textarea id="description">'+esc(p.description||'')+'</textarea><label>Category</label><input id="category" value="'+esc(p.category||'Fasteners')+'"><label>Material</label><input id="material" value="'+esc(p.material||'')+'"><label>Size</label><input id="size" value="'+esc(p.size||'')+'"><label>Image URL</label><input id="image_url" value="'+esc(p.image_url||'')+'"><label>Price</label><input id="price" inputmode="decimal" value="'+esc(priceFromCents(p.price_cents))+'"><label>Currency</label><input id="currency" value="'+esc(p.currency||'USD')+'"><label>Inventory</label><input id="inventory" type="number" min="0" value="'+esc(p.inventory||0)+'"><label>Status</label><select id="status"><option value="draft" '+(status==='draft'?'selected':'')+'>draft</option><option value="published" '+(status==='published'?'selected':'')+'>published</option></select><label><input id="allow_checkout" type="checkbox" style="width:auto" '+(checkout?'checked':'')+'> Enable Stripe Checkout for this product</label><div class="editor-actions"><button class="btn" id="save">Save product</button>'+(p.id?'<button class="btn danger" id="delete">Delete</button>':'')+'<a class="btn secondary" href="/shop" target="_blank">Open shop</a><a class="btn secondary" href="/admin">Articles</a></div><p id="saved" class="status"></p>'}
      async function load(){try{const s=await api('/api/admin/session'); if(!s.authenticated)return login(); const products=await api('/api/admin/products'); app.className='editor'; app.innerHTML='<aside><button class="btn" id="new">New product</button><div class="articles">'+products.map(p=>'<a class="article-link" data-id="'+esc(p.id)+'"><div class="meta">'+esc(p.status)+' / '+esc(p.category||'Fasteners')+'</div><h3>'+esc(p.name)+'</h3><p>'+esc(p.sku||p.slug)+' · '+esc(priceFromCents(p.price_cents))+' '+esc(p.currency||'USD')+'</p></a>').join('')+'</div></aside><section id="edit">'+form()+'</section>'; const edit=document.getElementById('edit'); document.getElementById('new').onclick=()=>{edit.innerHTML=form(); wireSave()}; document.querySelectorAll('[data-id]').forEach(a=>a.onclick=()=>{const p=products.find(x=>x.id===a.dataset.id); edit.innerHTML=form(p); wireSave(p.id)}); wireSave()}catch(e){app.className='notice';app.textContent=e.message}}
      function payload(){return {name:document.getElementById('name').value,slug:document.getElementById('slug').value,sku:document.getElementById('sku').value,excerpt:document.getElementById('excerpt').value,description:document.getElementById('description').value,category:document.getElementById('category').value,material:document.getElementById('material').value,size:document.getElementById('size').value,image_url:document.getElementById('image_url').value,price_cents:centsFromPrice(document.getElementById('price').value),currency:document.getElementById('currency').value,inventory:Number(document.getElementById('inventory').value||0),status:document.getElementById('status').value,allow_checkout:document.getElementById('allow_checkout').checked?1:0}}
      function wireSave(id){document.getElementById('save').onclick=async()=>{const p=payload(); const result=await api(id?'/api/admin/products/'+id:'/api/admin/products',{method:id?'PUT':'POST',body:JSON.stringify(p)}); const slug=result.slug||p.slug; document.getElementById('saved').innerHTML='Saved. <a class="text-link" target="_blank" href="/shop/products/'+encodeURIComponent(slug)+'?fresh='+Date.now()+'">Open product</a> or <a class="text-link" target="_blank" href="/shop?fresh='+Date.now()+'">check shop</a>.'; if(!id)setTimeout(load,700)}; const del=document.getElementById('delete'); if(del)del.onclick=async()=>{if(!confirm('Delete this product?'))return; await api('/api/admin/products/'+id,{method:'DELETE'}); load()}}
      load();
    </script></main>`;
  return html(shell({ title: "Product Admin | Toumyou", description: "Toumyou product admin.", path: "/admin/products", content }), { cache: "no-store" });
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
  const quantity = Math.min(999, Math.max(1, Number.parseInt(body.quantity || "1", 10) || 1));
  const product = await getProduct(env, productId);
  if (!product || product.status !== "published" || !product.allow_checkout || product.price_cents <= 0) {
    return json({ error: "Product is not available for checkout" }, { status: 400 });
  }
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
  params.set("line_items[0][quantity]", String(quantity));
  params.set("line_items[0][price_data][currency]", String(product.currency || "USD").toLowerCase());
  params.set("line_items[0][price_data][unit_amount]", String(product.price_cents));
  params.set("line_items[0][price_data][product_data][name]", product.name);
  params.set("line_items[0][price_data][product_data][description]", product.excerpt || product.description || product.sku || product.slug);
  if (product.image_url) params.set("line_items[0][price_data][product_data][images][0]", product.image_url);
  params.set("metadata[product_id]", product.id);
  params.set("metadata[product_slug]", product.slug);
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
  return Response.redirect(data.url, 303);
}

function checkoutSuccessPage() {
  return html(shell({
    title: "Payment received | Toumyou",
    description: "Thank you for your Toumyou shop order.",
    path: "/shop/success",
    content: '<main class="listing"><h1>Payment received,<br><em>thank you.</em></h1><p class="lead">Your Stripe checkout has completed. We will review the order and contact you about shipping, export handling, and delivery details.</p><div class="toolbar"><a class="btn" href="/shop">Back to shop</a><a class="btn secondary" href="mailto:sunflyerjp@gmail.com">Contact us</a></div></main>',
  }), { cache: "no-store" });
}

async function handleApi(request, env, pathname) {
  if (pathname === "/api/checkout" && request.method === "POST") return stripeCheckout(request, env);
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
  if (pathname === "/api/admin/products" && request.method === "POST") {
    const raw = await request.json();
    const now = Math.floor(Date.now() / 1000);
    const id = crypto.randomUUID();
    const p = normalizeProduct(raw, id);
    await ensureCommerce(env);
    await env.DB.prepare("INSERT INTO products (id,slug,name,sku,excerpt,description,category,material,size,image_url,price_cents,currency,inventory,status,allow_checkout,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
      .bind(id, p.slug, p.name, p.sku, p.excerpt, p.description, p.category, p.material, p.size, p.image_url, p.price_cents, p.currency, p.inventory, p.status, p.allow_checkout, now, now).run();
    return json({ ok: true, id, slug: p.slug });
  }
  const productMatch = pathname.match(/^\/api\/admin\/products\/([^/]+)$/);
  if (productMatch && request.method === "PUT") {
    const existing = await getProduct(env, productMatch[1]);
    if (!existing) return json({ error: "Product not found" }, { status: 404 });
    const p = normalizeProduct(await request.json(), existing.id);
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare("UPDATE products SET slug=?,name=?,sku=?,excerpt=?,description=?,category=?,material=?,size=?,image_url=?,price_cents=?,currency=?,inventory=?,status=?,allow_checkout=?,updated_at=? WHERE id=?")
      .bind(p.slug, p.name, p.sku, p.excerpt, p.description, p.category, p.material, p.size, p.image_url, p.price_cents, p.currency, p.inventory, p.status, p.allow_checkout, now, existing.id).run();
    return json({ ok: true, slug: p.slug });
  }
  if (productMatch && request.method === "DELETE") {
    await ensureCommerce(env);
    await env.DB.prepare("DELETE FROM products WHERE id=?").bind(productMatch[1]).run();
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
    if (url.pathname.startsWith("/api/")) return handleApi(request, env, url.pathname);
    if (url.pathname === "/") return home(env);
    if (url.pathname === "/shop") return shopPage(env);
    if (url.pathname === "/shop/success") return checkoutSuccessPage();
    if (url.pathname.startsWith("/shop/products/")) return productPage(env, decodeURIComponent(url.pathname.split("/").pop()));
    if (url.pathname === "/articles") return articles(env);
    if (url.pathname.startsWith("/articles/")) return article(env, decodeURIComponent(url.pathname.split("/").pop()));
    if (url.pathname === "/admin") return adminPage();
    if (url.pathname === "/admin/products") return adminProductsPage();
    return html(shell({ title: "Not found | Toumyou", description: "Page not found.", content: "<main><h1>Page not found</h1></main>" }), { status: 404 });
  },
};
