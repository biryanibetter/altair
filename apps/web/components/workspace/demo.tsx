'use client'
import { DataProvider } from './data'
import { Workspace } from './shell'
import Link from 'next/link'

export function DemoWorkspace() {
  return <><div className="demo-banner" role="status">Demo Mode · Fictional records and simulated traffic · Changes saved only in this browser <Link href="/">Exit demo</Link></div><DataProvider><Workspace email="demo@altair.example" signOut={async () => { window.location.href = '/' }} /></DataProvider></>
}
