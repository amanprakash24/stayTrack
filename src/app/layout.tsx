import type { Metadata, Viewport } from 'next'
import './globals.css'
import Toaster from '@/components/Toast'

export const metadata: Metadata = {
  title: 'Happy & Panorama Groups of Hotel — Booking Manager',
  description: 'Hotel booking management for Happy & Panorama Groups of Hotel',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#1B3A2D',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon.svg" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="H&P Hotels" />
      </head>
      <body suppressHydrationWarning>{children}<Toaster /></body>
    </html>
  )
}
