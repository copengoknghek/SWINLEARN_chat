import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase/client'

export type Role = 'admin' | 'teacher' | 'student'

type AuthProfile = {
  userId: string
  role: Role | null
  mustChangePassword: boolean
}

type UseAuthReturn = {
  user: User | null
  role: Role | null
  mustChangePassword: boolean
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const isRole = (value: unknown): value is Role =>
  value === 'admin' || value === 'teacher' || value === 'student'

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null)
  const [authProfile, setAuthProfile] = useState<AuthProfile | null>(null)
  const [sessionLoading, setSessionLoading] = useState(true)

  const userId = user?.id ?? null
  const role = userId !== null && authProfile?.userId === userId ? authProfile.role : null
  const mustChangePassword =
    userId !== null && authProfile?.userId === userId ? authProfile.mustChangePassword : false
  const loading = sessionLoading || (userId !== null && authProfile?.userId !== userId)

  useEffect(() => {
    let isMounted = true

    const getCurrentSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession()

        if (!isMounted) {
          return
        }

        setUser(error ? null : data.session?.user ?? null)
      } catch {
        if (!isMounted) {
          return
        }

        setUser(null)
      } finally {
        if (isMounted) {
          setSessionLoading(false)
        }
      }
    }

    getCurrentSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) {
        return
      }

      setUser(session?.user ?? null)
      setSessionLoading(false)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  const getAuthProfile = async (nextUserId: string): Promise<AuthProfile> => {
    let nextRole: Role | null
    let nextMustChangePassword = false

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role,must_change_password,status')
        .eq('id', nextUserId)
        .maybeSingle()

      nextRole = !error && data?.status !== 'inactive' && isRole(data?.role) ? data.role : null
      nextMustChangePassword = !error && data?.must_change_password === true
    } catch {
      nextRole = null
    }

    return {
      userId: nextUserId,
      role: nextRole,
      mustChangePassword: nextMustChangePassword,
    }
  }

  useEffect(() => {
    let isCurrent = true

    if (userId === null) {
      return () => {
        isCurrent = false
      }
    }

    const loadProfile = async () => {
      const nextProfile = await getAuthProfile(userId)

      if (!isCurrent) {
        return
      }

      setAuthProfile(nextProfile)
    }

    void loadProfile()

    return () => {
      isCurrent = false
    }
  }, [userId])

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })

      if (error) {
        return { error: 'Invalid email or password' }
      }

      return { error: null }
    } catch {
      return { error: 'Invalid email or password' }
    }
  }

  const signOut = async () => {
    try {
      await supabase.auth.signOut()
    } finally {
      setUser(null)
      setAuthProfile(null)
      setSessionLoading(false)
    }
  }

  const refreshProfile = async () => {
    if (userId === null) {
      return
    }

    setAuthProfile(await getAuthProfile(userId))
  }

  return {
    user,
    role,
    mustChangePassword,
    loading,
    signIn,
    signOut,
    refreshProfile,
  }
}
