import axios from 'axios'

// Create an axios instance with the base URL of our backend
const client = axios.create({
  baseURL: 'https://stustaapp.stusta.mhn.de',
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