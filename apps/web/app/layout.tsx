import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const sans = Geist({ subsets: ['latin'], variable: '--font-geist', display: 'swap' })
const mono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono', display: 'swap' })
export const metadata: Metadata = { title: 'ALTAIR — Logistics workspace', description: 'B2B shipping and supply chain intelligence.' }

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className={`dark ${sans.variable} ${mono.variable}`}><body>{children}</body></html>
}
