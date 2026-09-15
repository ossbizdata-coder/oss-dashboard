import { useEffect, useState } from 'react'
import { getBusinessSettings } from '../utils/businessSettings.js'

export default function useBusinessSettings() {
  const [businessSettings, setBusinessSettings] = useState(() => getBusinessSettings())

  useEffect(() => {
    const refresh = () => setBusinessSettings(getBusinessSettings())
    window.addEventListener('focus', refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener('focus', refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])

  return [businessSettings, setBusinessSettings]
}

