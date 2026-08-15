import Link from 'next/link'

export default function HomePage() {
  return (
    <main style={{ fontFamily: 'Arial, sans-serif', padding: '8vw' }}>
      <p style={{ letterSpacing: '.12em', textTransform: 'uppercase', fontSize: 12 }}>Toumyou CMS</p>
      <h1 style={{ fontSize: 'clamp(48px, 7vw, 96px)', letterSpacing: '-.06em', lineHeight: 0.95 }}>
        Payload content and product management.
      </h1>
      <p style={{ color: '#5f6670', maxWidth: 620, fontSize: 20 }}>
        Manage articles, products, and media here. Stripe, cart, customers, and orders remain in the existing storefront Worker.
      </p>
      <Link href="/admin" style={{ display: 'inline-block', marginTop: 24, padding: '14px 18px', background: '#121417', color: '#fff', textDecoration: 'none', borderRadius: 6 }}>
        Open admin
      </Link>
    </main>
  )
}
