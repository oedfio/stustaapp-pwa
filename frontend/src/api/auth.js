import client from './client'

export const sendOtp = (email) =>
  client.post('/api/auth/send-otp', { email })

export const verifyOtp = (email, code) =>
  client.post('/api/auth/verify-otp', { email, code })

export const getMe = () =>
  client.get('/api/users/me')

export const updateMe = (data) =>
  client.patch('/api/users/me', data)

export const getMyMemberships = () =>
  client.get('/api/users/me/memberships')