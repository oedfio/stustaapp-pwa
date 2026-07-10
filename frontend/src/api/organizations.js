import client from './client'

export const getOrganizations = () =>
    client.get('/api/organizations')

export const getOrganization = (id) =>
    client.get(`/api/organizations/${id}`)

export const createOrganization = (data) =>
    client.post('/api/organizations', data)

export const updateOrganization = (id, data) =>
    client.patch(`/api/organizations/${id}`, data)

export const uploadLogo = (id, file) => {
    const formData = new FormData()
    formData.append('file', file)
    return client.post(
        `/api/organizations/${id}/logo`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
    )
}

export const inviteAdmin = (orgId, email, role) =>
    client.post(`/api/organizations/${orgId}/admins`, null, {
        params: { email, role }
    })

export const removeAdmin = (orgId, userId) =>
    client.delete(`/api/organizations/${orgId}/admins/${userId}`)

export const getOrgMemberships = (orgId) =>
    client.get(`/api/organizations/${orgId}/memberships`)

export const deleteOrganization = (id) =>
    client.delete(`/api/organizations/${id}`)

export const followOrganization = (id) =>
    client.post(`/api/organizations/${id}/follow`)

export const unfollowOrganization = (id) =>
    client.delete(`/api/organizations/${id}/follow`)

export const getMyFollows = () =>
    client.get('/api/organizations/me/follows')