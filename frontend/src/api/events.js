import client from './client'

export const getEvents = () =>
    client.get('/api/events')

export const getEvent = (id) =>
    client.get(`/api/events/${id}`)

export const getOrgEvents = (orgId) =>
    client.get(`/api/organizations/${orgId}/events`)

// Admin-only: returns all of the org's events, not just the next 7 days,
// so events further out (e.g. monthly recurrence) or in the past can be edited.
export const getOrgEventsForManage = (orgId) =>
    client.get(`/api/organizations/${orgId}/events/manage`)

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

// Every distinct photo the org has ever uploaded for an event, most
// recent first — lets a new/existing event reuse one instead of
// re-uploading a duplicate file.
export const getOrgEventPhotos = (orgId) =>
    client.get(`/api/organizations/${orgId}/events/photos`)

export const reuseEventPhoto = (orgId, eventId, photoUrl) =>
    client.post(`/api/organizations/${orgId}/events/${eventId}/photo/reuse`, { photo_url: photoUrl })