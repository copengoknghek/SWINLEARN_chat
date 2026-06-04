/* eslint-disable react-refresh/only-export-components */
import React, { useContext } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from '../hooks/useAuth'

type AuthContextValue = ReturnType<typeof useAuth>

const AuthContext = React.createContext<AuthContextValue | null>(null)

type AuthProviderProps = {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const auth = useAuth()

  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
}

export function useAuthContext() {
  const context = useContext(AuthContext)

  if (context === null) {
    throw new Error('useAuthContext must be used within an AuthProvider')
  }

  return context
}
