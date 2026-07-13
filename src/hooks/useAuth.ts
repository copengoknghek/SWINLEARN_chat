import { useCallback, useEffect, useState } from 'react'
import { getCurrentAuth, login, logout } from '../features/swinlearn/lib/workspace/api'

export type Role = 'admin' | 'teacher' | 'student'

export type AuthUser = {
  id: string
  email: string
  fullName: string | null
  displayName: string | null
  avatarUrl: string | null
}

type AuthProfile = {
  userId: string
  role: Role | null
  mustChangePassword: boolean
}

type UseAuthReturn = {
  user: AuthUser | null
  role: Role | null
  mustChangePassword: boolean
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [authProfile, setAuthProfile] = useState<AuthProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const applyAuthPayload = useCallback(
    (payload: Awaited<ReturnType<typeof getCurrentAuth>>) => {
      if (!payload.user) {
        setUser(null)
        setAuthProfile(null)
        return
      }

      setUser({
        id: payload.user.id,
        email: payload.user.email,
        fullName: payload.profile?.full_name ?? null,
        displayName: payload.profile?.display_name ?? null,
        avatarUrl: payload.profile?.avatar_url ?? null,
      })
      setAuthProfile({
        userId: payload.user.id,
        role: payload.role ?? null,
        mustChangePassword: payload.mustChangePassword === true,
      })
    },
    [],
  )

  const refreshProfile = useCallback(async () => {
    const payload = await getCurrentAuth()
    applyAuthPayload(payload)
  }, [applyAuthPayload])

  useEffect(() => {
    let isMounted = true

    const loadSession = async () => {
      try {
        const payload = await getCurrentAuth()

        if (isMounted) {
          applyAuthPayload(payload)
        }
      } catch {
        if (isMounted) {
          setUser(null)
          setAuthProfile(null)
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    void loadSession()

    return () => {
      isMounted = false
    }
  }, [applyAuthPayload])

  const signIn = async (email: string, password: string) => {
    try {
      const payload = await login(email, password)
      applyAuthPayload(payload)

      return { error: null }
    } catch {
      setUser(null)
      setAuthProfile(null)

      return { error: 'Invalid email or password' }
    }
  }

  const signOut = async () => {
    try {
      await logout()
    } finally {
      setUser(null)
      setAuthProfile(null)
      setLoading(false)
    }
  }

  const currentAuthProfile = authProfile?.userId === user?.id ? authProfile : null

  return {
    user,
    role: currentAuthProfile?.role ?? null,
    mustChangePassword: currentAuthProfile?.mustChangePassword ?? false,
    loading,
    signIn,
    signOut,
    refreshProfile,
  }
}
