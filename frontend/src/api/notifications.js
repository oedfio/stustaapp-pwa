import client from './client'

export const getVapidPublicKey = () =>
    client.get('/api/notifications/vapid-public-key')

export const subscribePush = (subscription) =>
    client.post('/api/notifications/subscribe', subscription)

export const unsubscribePush = (subscription) =>
    client.delete('/api/notifications/unsubscribe', { data: subscription })

export const followOrganization = (id) =>
    client.post(`/api/organizations/${id}/follow`)

export const unfollowOrganization = (id) =>
    client.delete(`/api/organizations/${id}/follow`)

export const getMyFollows = () =>
    client.get('/api/organizations/me/follows')

export const getNotifications = () =>
    client.get('/api/notifications')

export const getUnreadNotificationCount = () =>
    client.get('/api/notifications/unread-count')

export const markNotificationRead = (id) =>
    client.post(`/api/notifications/${id}/read`)

export const markAllNotificationsRead = () =>
    client.post('/api/notifications/read-all')