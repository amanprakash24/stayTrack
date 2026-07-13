'use client'
import { createContext, useContext } from 'react'

const AppNameContext = createContext('StayTrack')

export function AppNameProvider({ name, children }: { name: string; children: React.ReactNode }) {
  return <AppNameContext.Provider value={name}>{children}</AppNameContext.Provider>
}

export function useAppName() {
  return useContext(AppNameContext)
}

// App name with only alphanumerics, for Excel filenames (e.g. "StayTrack")
export function useAppFileName() {
  return useAppName().replace(/[^A-Za-z0-9]+/g, '') || 'StayTrack'
}

// Two-tone logo text: "StayTrack" splits as Stay|Track, custom names split first word | rest
export function BrandName() {
  const name = useAppName()
  const splitAt = name === 'StayTrack' ? 4 : name.indexOf(' ')
  if (splitAt <= 0) return <>{name}</>
  return <>{name.slice(0, splitAt)}<span style={{ color: '#C9A84C' }}>{name.slice(splitAt)}</span></>
}
