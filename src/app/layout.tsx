import type { Metadata, Viewport } from 'next'
import './globals.css'
import Toaster from '@/components/Toast'
import { AppNameProvider } from '@/components/AppNameProvider'
import { APP_NAME } from '@/lib/appName'

export const metadata: Metadata = {
  title: APP_NAME,
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
        <link rel="apple-touch-icon" href="/icon.svg" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content={APP_NAME} />
      </head>
      <body suppressHydrationWarning>
        <AppNameProvider name={APP_NAME}>{children}<Toaster /></AppNameProvider>
      </body>
    </html>
  )
}
