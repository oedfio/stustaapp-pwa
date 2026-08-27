import axios from 'axios'

// Create an axios instance with the base URL of our backend.
// In production this is set via VITE_API_BASE_URL (see .env.production).
// Locally it's left empty so requests are relative and go through the
// Vite dev server proxy to localhost:8000 (see vite.config.js).
const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '',
})

// Automatically attach the JWT token to every request
// if one is stored in localStorage
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// If the server returns 401 (unauthorized) — token expired or invalid
// clear the token and redirect to login
// But do NOT redirect if we are already on the login page
// since 401 is also returned for wrong OTP codes
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error.response?.status === 401 &&
      !window.location.pathname.includes('/login')
    ) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default client