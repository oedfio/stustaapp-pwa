import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../components/AuthContext'
import { sendOtp, verifyOtp } from '../api/auth'

export default function Login() {
  const [step, setStep] = useState(1)       // 1 = email, 2 = code
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)

  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSendOtp = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      await sendOtp(email)
      setMessage('Code sent — check your email.')
      setStep(2)
    } catch (err) {
      if (err.response?.status === 429) {
        setError('Too many requests. Please wait 10 minutes before trying again.')
      } else {
        setError('Something went wrong. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await verifyOtp(email, code)
      await login(res.data.access_token)
      navigate('/')
    } catch (err) {
      if (err.response?.status === 429) {
        setError('Too many failed attempts. Please request a new code.')
        setStep(1)
        setCode('')
      } else if (err.response?.status === 401) {
        setError('Invalid or expired code. Please try again.')
      } else {
        setError('Something went wrong. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>

        {/* Logo and title */}
        <img
          src="/pwa-192x192.png"
          alt="StuStaApp"
          style={styles.logo}
        />
        <h1 style={styles.title}>StuStaApp</h1>
        <p style={styles.subtitle}>Studentenstadt München</p>

        {/* Step 1 — Email form */}
        {step === 1 && (
          <form onSubmit={handleSendOtp} style={styles.form}>
            <label style={styles.label}>Email address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              style={styles.input}
            />
            <button
              type="submit"
              disabled={loading}
              style={styles.button}
            >
              {loading ? 'Sending...' : 'Send Code'}
            </button>
          </form>
        )}

        {/* Step 2 — Code form */}
        {step === 2 && (
          <form onSubmit={handleVerifyOtp} style={styles.form}>
            <p style={styles.hint}>
              We sent a 6-digit code to <strong>{email}</strong>
            </p>
            <label style={styles.label}>Enter code</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              maxLength={6}
              required
              style={styles.input}
              autoFocus
            />
            <button
              type="submit"
              disabled={loading}
              style={styles.button}
            >
              {loading ? 'Verifying...' : 'Verify Code'}
            </button>
            <button
              type="button"
              onClick={() => { setStep(1); setError(null); setCode('') }}
              style={styles.secondaryButton}
            >
              Use a different email
            </button>
          </form>
        )}

        {/* Error message */}
        {error && (
          <p style={styles.error}>{error}</p>
        )}

        {/* Success message */}
        {message && !error && (
          <p style={styles.success}>{message}</p>
        )}

      </div>
    </div>
  )
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    padding: '20px',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    padding: '40px 32px',
    width: '100%',
    maxWidth: '400px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  logo: {
    width: '80px',
    height: '80px',
    borderRadius: '16px',
    marginBottom: '16px',
  },
  title: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#1E2A3A',
    margin: '0 0 4px 0',
  },
  subtitle: {
    fontSize: '14px',
    color: '#6B7280',
    margin: '0 0 32px 0',
  },
  form: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  label: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#374151',
  },
  input: {
    padding: '12px 16px',
    borderRadius: '8px',
    border: '1.5px solid #E5E7EB',
    fontSize: '16px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  },
  button: {
    padding: '14px',
    borderRadius: '8px',
    backgroundColor: '#2563EB',
    color: '#ffffff',
    fontSize: '16px',
    fontWeight: '600',
    border: 'none',
    cursor: 'pointer',
    marginTop: '8px',
  },
  secondaryButton: {
    padding: '12px',
    borderRadius: '8px',
    backgroundColor: 'transparent',
    color: '#6B7280',
    fontSize: '14px',
    border: '1.5px solid #E5E7EB',
    cursor: 'pointer',
  },
  hint: {
    fontSize: '14px',
    color: '#6B7280',
    textAlign: 'center',
    margin: '0',
  },
  error: {
    marginTop: '16px',
    padding: '12px',
    borderRadius: '8px',
    backgroundColor: '#FEF2F2',
    color: '#DC2626',
    fontSize: '14px',
    textAlign: 'center',
    width: '100%',
    boxSizing: 'border-box',
  },
  success: {
    marginTop: '16px',
    padding: '12px',
    borderRadius: '8px',
    backgroundColor: '#F0FDF4',
    color: '#16A34A',
    fontSize: '14px',
    textAlign: 'center',
    width: '100%',
    boxSizing: 'border-box',
  },
}