import { useAuth } from '../components/AuthContext'
import { updateMe } from '../api/auth'
import { useNavigate } from 'react-router-dom'
import { getVapidPublicKey, subscribePush, unsubscribePush } from '../api/notifications'
import { useState, useEffect } from 'react'
import { getOrganizations, getMyFollows, followOrganization, unfollowOrganization } from '../api/organizations'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return window.btoa(binary)
}

export default function Profile() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [firstName, setFirstName] = useState(user?.first_name || '')
  const [lastName, setLastName] = useState(user?.last_name || '')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)

  const [pushSupported, setPushSupported] = useState(false)
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushLoading, setPushLoading] = useState(false)

  const [organizations, setOrganizations] = useState([])
  const [follows, setFollows] = useState([])
  const [followsLoading, setFollowsLoading] = useState(true)
  const [followToggling, setFollowToggling] = useState(null)

  useEffect(() => {
    const check = async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
      setPushSupported(true)
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      setPushEnabled(!!subscription)
    }
    check()
  }, [])

  const handleTogglePush = async () => {
    setPushLoading(true)
    try {
      const registration = await navigator.serviceWorker.ready

      if (pushEnabled) {
        // Unsubscribe
        const subscription = await registration.pushManager.getSubscription()
        if (subscription) {
          await unsubscribePush({
            endpoint: subscription.endpoint,
            keys: {
              p256dh: arrayBufferToBase64(subscription.getKey('p256dh')),
              auth: arrayBufferToBase64(subscription.getKey('auth')),
            },
          })
          await subscription.unsubscribe()
        }
        setPushEnabled(false)
      } else {
        // Subscribe
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') {
          setError('Notification permission was denied.')
          setPushLoading(false)
          return
        }

        const { data } = await getVapidPublicKey()
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(data.public_key),
        })

        await subscribePush({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: arrayBufferToBase64(subscription.getKey('p256dh')),
            auth: arrayBufferToBase64(subscription.getKey('auth')),
          },
        })
        setPushEnabled(true)
      }
    } catch (err) {
      setError('Failed to update notification settings.')
    } finally {
      setPushLoading(false)
    }
  }

  useEffect(() => {
    if (!user) return
    loadFollowsData()
  }, [user])

  const loadFollowsData = async () => {
    try {
      const [orgsRes, followsRes] = await Promise.all([
        getOrganizations(),
        getMyFollows(),
      ])
      setOrganizations(orgsRes.data)
      setFollows(followsRes.data)
    } catch {
      // ignore
    } finally {
      setFollowsLoading(false)
    }
  }

  const handleToggleFollow = async (orgId) => {
    setFollowToggling(orgId)
    try {
      if (follows.includes(orgId)) {
        await unfollowOrganization(orgId)
        setFollows(follows.filter((id) => id !== orgId))
      } else {
        await followOrganization(orgId)
        setFollows([...follows, orgId])
      }
    } catch {
      // ignore
    } finally {
      setFollowToggling(null)
    }
  }

  // Not logged in — show login prompt
  if (!user) {
    return (
      <div style={styles.container}>
        <h1 style={styles.heading}>Profile</h1>
        <div style={styles.loginPrompt}>
          <span style={styles.loginIcon}>👋</span>
          <h2 style={styles.loginTitle}>Welcome to StuStaApp</h2>
          <p style={styles.loginText}>
            Log in to manage your profile, save your preferences,
            and access admin features if you have them.
          </p>
          <button
            style={styles.loginButton}
            onClick={() => navigate('/login')}
          >
            Log in
          </button>
        </div>
      </div>
    )
  }

  const handleUpdate = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)
    try {
      await updateMe({
        first_name: firstName || null,
        last_name: lastName || null,
      })
      setMessage('Profile updated successfully.')
    } catch {
      setError('Failed to update profile.')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to log out?')) {
      logout()
    }
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.heading}>Profile</h1>

      {/* User card */}
      <div style={styles.card}>
        <div style={styles.avatar}>
          {(user?.first_name || user?.email || '?').charAt(0).toUpperCase()}
        </div>
        <p style={styles.email}>{user?.email}</p>
      </div>

      {/* Edit name form */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Personal Info</h2>
        <form onSubmit={handleUpdate} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>First name</label>
            <input
              style={styles.input}
              placeholder="First name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Last name</label>
            <input
              style={styles.input}
              placeholder="Last name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>
          {error && <p style={styles.error}>{error}</p>}
          {message && <p style={styles.success}>{message}</p>}
          <button style={styles.button} type="submit" disabled={loading}>
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>

      {/* Notifications */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Notifications</h2>
        <div style={styles.notificationRow}>
          <span style={styles.notificationLabel}>Push notifications</span>
          {pushSupported ? (
            <button
              style={pushEnabled ? styles.toggleOn : styles.toggleOff}
              onClick={handleTogglePush}
              disabled={pushLoading}
            >
              {pushLoading ? '...' : pushEnabled ? 'Enabled' : 'Enable'}
            </button>
          ) : (
            <div style={styles.toggleDisabled}>Not supported</div>
          )}
        </div>
      </div>

      {/* Per-organisation notification settings */}
      {pushEnabled && (
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Notify me about</h2>
          {followsLoading ? (
            <p style={styles.hint}>Loading organisations...</p>
          ) : (
            <div style={styles.followsList}>
              {organizations.map((org) => (
                <div key={org.id} style={styles.followRow}>
                  <div style={styles.followInfo}>
                    {org.logo_url && (
                      <img
                        src={`https://stustaapp.stusta.mhn.de${org.logo_url}`}
                        alt={org.name}
                        style={styles.followLogo}
                      />
                    )}
                    <span style={styles.followName}>{org.name}</span>
                  </div>
                  <button
                    style={follows.includes(org.id) ? styles.toggleOn : styles.toggleOff}
                    onClick={() => handleToggleFollow(org.id)}
                    disabled={followToggling === org.id}
                  >
                    {followToggling === org.id
                      ? '...'
                      : follows.includes(org.id)
                        ? 'On'
                        : 'Off'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Getting Started guide */}
      <button style={styles.guideButton} onClick={() => navigate('/guide')}>
        Getting Started
      </button>

      {/* Logout */}
      <button style={styles.logoutButton} onClick={handleLogout}>
        Log out
      </button>
    </div>
  )
}

const styles = {
  container: {
    padding: '16px',
    maxWidth: '600px',
    margin: '0 auto',
    paddingBottom: '32px',
  },
  heading: {
    fontSize: '22px',
    fontWeight: '700',
    color: '#1E2A3A',
    margin: '0 0 20px 0',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '20px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
    border: '1px solid #F3F4F6',
  },
  avatar: {
    width: '72px',
    height: '72px',
    borderRadius: '50%',
    backgroundColor: '#2563EB',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '32px',
    fontWeight: '700',
  },
  email: {
    fontSize: '15px',
    color: '#6B7280',
    margin: '0',
  },
  section: {
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    padding: '20px',
    marginBottom: '16px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
    border: '1px solid #F3F4F6',
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#1E2A3A',
    margin: '0 0 16px 0',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#374151',
  },
  input: {
    padding: '12px 14px',
    borderRadius: '8px',
    border: '1.5px solid #E5E7EB',
    fontSize: '15px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  },
  button: {
    padding: '13px',
    borderRadius: '8px',
    backgroundColor: '#2563EB',
    color: '#ffffff',
    fontSize: '15px',
    fontWeight: '600',
    border: 'none',
    cursor: 'pointer',
    marginTop: '4px',
  },
  notificationRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  notificationLabel: {
    fontSize: '15px',
    color: '#374151',
  },
  toggleDisabled: {
    fontSize: '12px',
    color: '#9CA3AF',
    backgroundColor: '#F3F4F6',
    padding: '4px 10px',
    borderRadius: '20px',
  },
  guideButton: {
    width: '100%',
    padding: '14px',
    borderRadius: '12px',
    backgroundColor: '#EFF6FF',
    color: '#2563EB',
    fontSize: '15px',
    fontWeight: '600',
    border: '1px solid #BFDBFE',
    cursor: 'pointer',
    marginTop: '24px',
  },
  logoutButton: {
    width: '100%',
    padding: '14px',
    borderRadius: '12px',
    backgroundColor: '#FEF2F2',
    color: '#DC2626',
    fontSize: '15px',
    fontWeight: '600',
    border: '1px solid #FECACA',
    cursor: 'pointer',
    marginTop: '8px',
  },
  error: {
    fontSize: '13px',
    color: '#DC2626',
    backgroundColor: '#FEF2F2',
    padding: '8px 12px',
    borderRadius: '8px',
    margin: '0',
  },
  success: {
    fontSize: '13px',
    color: '#16A34A',
    backgroundColor: '#F0FDF4',
    padding: '8px 12px',
    borderRadius: '8px',
    margin: '0',
  },
  loginPrompt: {
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    padding: '40px 24px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
    border: '1px solid #F3F4F6',
  },
  loginIcon: {
    fontSize: '48px',
    marginBottom: '12px',
  },
  loginTitle: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#1E2A3A',
    margin: '0 0 12px 0',
  },
  loginText: {
    fontSize: '14px',
    color: '#6B7280',
    lineHeight: '1.6',
    margin: '0 0 24px 0',
    maxWidth: '320px',
  },
  loginButton: {
    padding: '14px 32px',
    borderRadius: '8px',
    backgroundColor: '#2563EB',
    color: '#ffffff',
    fontSize: '15px',
    fontWeight: '600',
    border: 'none',
    cursor: 'pointer',
  },
  toggleOn: {
    fontSize: '13px',
    color: '#16A34A',
    backgroundColor: '#F0FDF4',
    padding: '6px 14px',
    borderRadius: '20px',
    border: '1px solid #BBF7D0',
    cursor: 'pointer',
    fontWeight: '600',
  },
  toggleOff: {
    fontSize: '13px',
    color: '#2563EB',
    backgroundColor: '#EFF6FF',
    padding: '6px 14px',
    borderRadius: '20px',
    border: '1px solid #BFDBFE',
    cursor: 'pointer',
    fontWeight: '600',
  },
  hint: {
    fontSize: '13px',
    color: '#9CA3AF',
    margin: '0',
  },
  followsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  followRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 0',
    borderBottom: '1px solid #F3F4F6',
  },
  followInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  followLogo: {
    width: '28px',
    height: '28px',
    borderRadius: '6px',
    objectFit: 'cover',
  },
  followName: {
    fontSize: '14px',
    color: '#1E2A3A',
    fontWeight: '500',
  },
}