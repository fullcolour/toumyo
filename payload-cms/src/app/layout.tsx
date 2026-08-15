import type { Metadata } from 'next'
import React from 'react'

export const metadata: Metadata = {
  title: 'Toumyou Payload CMS',
  description: 'Payload CMS for Toumyou articles, products, and media.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
