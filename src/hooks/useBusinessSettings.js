import { useEffect, useState } from 'react'
import { businessSettingsApi } from '../services/api.js'
import {
  BUSINESS_SETTINGS_UPDATED_EVENT,
  canSyncBusinessSettings,
  extractBusinessSettingsPayload,
  getBusinessSettings,
  getMonthKey,
  saveBusinessSettings,
} from '../utils/businessSettings.js'

export default function useBusinessSettings(targetDate = new Date()) {
  const monthKey = getMonthKey(targetDate)
  const [businessSettings, setBusinessSettings] = useState(() => getBusinessSettings(monthKey))

  useEffect(() => {
    setBusinessSettings(getBusinessSettings(monthKey))

    const [year, month] = monthKey.split('-')
    const canLoadFromApi = canSyncBusinessSettings()

    const loadFromApi = async () => {
      if (!canLoadFromApi) return

      try {
        const response = await businessSettingsApi.get(year, Number(month))
        setBusinessSettings(saveBusinessSettings(extractBusinessSettingsPayload(response.data, monthKey), monthKey))
      } catch (error) {
        const status = error?.response?.status
        if (status === 403 || status === 404) return
        console.error('Failed to load business settings:', error)
      }
    }

    loadFromApi()

    const refreshFromCache = () => setBusinessSettings(getBusinessSettings(monthKey))
    const handleUpdated = (event) => {
      if (!event?.detail?.monthKey || event.detail.monthKey === monthKey) {
        refreshFromCache()
      }
    }

    const handleFocus = () => {
      if (canLoadFromApi) {
        loadFromApi()
        return
      }
      refreshFromCache()
    }

    window.addEventListener(BUSINESS_SETTINGS_UPDATED_EVENT, handleUpdated)
    window.addEventListener('focus', handleFocus)
    window.addEventListener('storage', refreshFromCache)

    return () => {
      window.removeEventListener(BUSINESS_SETTINGS_UPDATED_EVENT, handleUpdated)
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('storage', refreshFromCache)
    }
  }, [monthKey])

  return [businessSettings, setBusinessSettings]
}
