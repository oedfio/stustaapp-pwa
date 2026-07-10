import client from './client'

export const getEvents = () =>
    client.get('/api/events')

export const getEvent = (id) =>
    client.get(`/api/events/${id}`)

export const getOrgEvents = (orgId) =>
    client.get(`/api/organizations/${orgId}/events`)

export const createEvent = (orgId, data) =>
    client.post(`/api/organizations/${orgId}/events`, data)

export const updateEvent = (orgId, eventId, data) =>
    client.patch(`/api/organizations/${orgId}/events/${eventId}`, data)

export const deleteEvent = (orgId, eventId) =>
    client.delete(`/api/organizations/${orgId}/events/${eventId}`)

export const uploadEventPhoto = (orgId, eventId, file) => {
    const formData = new FormData()
    formData.append('file', file)
    return client.post(
        `/api/organizations/${orgId}/events/${eventId}/photo`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
    )
}