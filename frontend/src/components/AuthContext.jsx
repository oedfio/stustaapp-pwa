import { createContext, useContext, useState, useEffect } from 'react'
import { getMe, getMyMemberships } from '../api/auth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [memberships, setMemberships] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // On app load check if a token exists and restore the session
    const token = localStorage.getItem('token')
    if (token) {
      loadUser()
    } else {
      setLoading(false)
    }
  }, [])

  const loadUser = async () => {
    try {
      const [meRes, membershipsRes] = await Promise.all([
        getMe(),
        getMyMemberships(),
      ])
      setUser(meRes.data)
      setMemberships(membershipsRes.data)
    } catch {
      // Token is invalid or expired — clear it
      localStorage.removeItem('token')
    } finally {
      setLoading(false)
    }
  }

  const login = async (token) => {
    // Store the token and load the user data
    localStorage.setItem('token', token)
    await loadUser()
  }

  const logout = () => {
    localStorage.removeItem('token')
    setUser(null)
    setMemberships([])
  }

  // Helper — does the user have any admin role at all
  const isAdmin = user?.is_dev_admin || memberships.length > 0

  // Helper — is the user a dev admin
  const isDevAdmin = user?.is_dev_admin === true

  // Helper — what role does the user have in a specific org
  const getRoleInOrg = (orgId) => {
    const membership = memberships.find((m) => m.org_id === orgId)
    return membership?.role || null
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        memberships,
        loading,
        login,
        logout,
        isAdmin,
        isDevAdmin,
        getRoleInOrg,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// Custom hook — any component can call useAuth() to get the context
export function useAuth() {
  return useContext(AuthContext)
}