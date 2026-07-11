import { useState, useEffect } from 'react'
import { createOrganization, updateOrganization, uploadLogo, inviteAdmin, removeAdmin, getOrganizations, getOrgMemberships, deleteOrganization } from '../../api/organizations'
import { broadcastNotification } from '../../api/notifications'
import { styles } from './styles'

export default function DevAdminSection() {
    const [organizations, setOrganizations] = useState([])
    const [loadingOrgs, setLoadingOrgs] = useState(true)
    const [showCreateForm, setShowCreateForm] = useState(false)
    const [name, setName] = useState('')
    const [shortDescription, setShortDescription] = useState('')
    const [description, setDescription] = useState('')
    const [locationName, setLocationName] = useState('')
    const [latitude, setLatitude] = useState('')
    const [longitude, setLongitude] = useState('')
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState(null)
    const [error, setError] = useState(null)


    useEffect(() => {
        loadOrgs()
    }, [])

    const loadOrgs = async () => {
        try {
            const res = await getOrganizations()
            setOrganizations(res.data)
        } catch {
            setError('Failed to load organisations.')
        } finally {
            setLoadingOrgs(false)
        }
    }

    const handleCreate = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        setMessage(null)
        try {
            await createOrganization({
                name,
                short_description: shortDescription || null,
                description: description || null,
                location_name: locationName || null,
                latitude: latitude ? parseFloat(latitude) : null,
                longitude: longitude ? parseFloat(longitude) : null,
            })
            setMessage('Organisation created successfully.')
            setName('')
            setShortDescription('')
            setDescription('')
            setLocationName('')
            setLatitude('')
            setLongitude('')
            setShowCreateForm(false)
            loadOrgs()
        } catch {
            setError('Failed to create organisation.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={styles.section}>
            <div style={styles.sectionHeader}>
                <span style={styles.sectionTitle}>All Organisations</span>
                <span style={styles.roleBadge}>Dev Admin</span>
            </div>

            <BroadcastForm />

            <div style={styles.subSection}>
                <div style={styles.subSectionHeader}>
                    <h3 style={styles.subHeading}>Organisations</h3>
                    <button
                        style={styles.smallButton}
                        onClick={() => setShowCreateForm(!showCreateForm)}
                    >
                        {showCreateForm ? 'Cancel' : '+ New Organisation'}
                    </button>
                </div>

                {showCreateForm && (
                    <div style={styles.formBox}>
                        <h4 style={styles.formTitle}>New Organisation</h4>
                        <form onSubmit={handleCreate} style={styles.form}>
                            <input
                                style={styles.input}
                                placeholder="Name *"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                            />
                            <input
                                style={styles.input}
                                placeholder="Short description"
                                value={shortDescription}
                                onChange={(e) => setShortDescription(e.target.value)}
                            />
                            <textarea
                                style={styles.textarea}
                                placeholder="Full description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={3}
                            />
                            <input
                                style={styles.input}
                                placeholder="Location name"
                                value={locationName}
                                onChange={(e) => setLocationName(e.target.value)}
                            />
                            <div style={styles.row}>
                                <input
                                    style={{ ...styles.input, flex: 1 }}
                                    placeholder="Latitude"
                                    value={latitude}
                                    onChange={(e) => setLatitude(e.target.value)}
                                    type="number"
                                    step="any"
                                />
                                <input
                                    style={{ ...styles.input, flex: 1 }}
                                    placeholder="Longitude"
                                    value={longitude}
                                    onChange={(e) => setLongitude(e.target.value)}
                                    type="number"
                                    step="any"
                                />
                            </div>
                            {error && <p style={styles.error}>{error}</p>}
                            {message && <p style={styles.success}>{message}</p>}
                            <button style={styles.button} type="submit" disabled={loading}>
                                {loading ? 'Creating...' : 'Create Organisation'}
                            </button>
                        </form>
                    </div>
                )}

                {loadingOrgs ? (
                    <p style={styles.hint}>Loading organisations...</p>
                ) : organizations.length === 0 ? (
                    <p style={styles.hint}>No organisations yet.</p>
                ) : (
                    <div style={styles.eventsList}>
                        {organizations.map((org) => (
                            <DevOrgItem
                                key={org.id}
                                org={org}
                                onUpdated={loadOrgs}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

function BroadcastForm() {
    const [showForm, setShowForm] = useState(false)
    const [title, setTitle] = useState('')
    const [body, setBody] = useState('')
    const [url, setUrl] = useState('')
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState(null)
    const [error, setError] = useState(null)

    const handleSend = async (e) => {
        e.preventDefault()
        if (!window.confirm('Send this notification to every user?')) return
        setLoading(true)
        setError(null)
        setMessage(null)
        try {
            await broadcastNotification({ title, body, url: url || '/' })
            setMessage('Broadcast queued — it will reach everyone shortly.')
            setTitle('')
            setBody('')
            setUrl('')
        } catch {
            setError('Failed to send broadcast.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={styles.subSection}>
            <div style={styles.subSectionHeader}>
                <h3 style={styles.subHeading}>Broadcast Notification</h3>
                <button
                    style={styles.smallButton}
                    onClick={() => setShowForm(!showForm)}
                >
                    {showForm ? 'Cancel' : '+ New Broadcast'}
                </button>
            </div>

            {showForm && (
                <div style={styles.formBox}>
                    <p style={{ ...styles.hint, margin: '0 0 12px 0' }}>
                        Sends an in-app notification (and a push, for anyone with
                        notifications enabled) to every user — use sparingly.
                    </p>
                    <form onSubmit={handleSend} style={styles.form}>
                        <input
                            style={styles.input}
                            placeholder="Title *"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            required
                        />
                        <textarea
                            style={styles.textarea}
                            placeholder="Message *"
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                            rows={3}
                            required
                        />
                        <input
                            style={styles.input}
                            placeholder="Link (optional, defaults to /)"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                        />
                        {error && <p style={styles.error}>{error}</p>}
                        {message && <p style={styles.success}>{message}</p>}
                        <button style={styles.button} type="submit" disabled={loading}>
                            {loading ? 'Sending...' : 'Send to Everyone'}
                        </button>
                    </form>
                </div>
            )}
        </div>
    )
}

function DevOrgItem({ org, onUpdated }) {
    const [admins, setAdmins] = useState([])
    const [loadingAdmins, setLoadingAdmins] = useState(false)
    const [adminsVisible, setAdminsVisible] = useState(false)
    const [expanded, setExpanded] = useState(false)
    const [activeTab, setActiveTab] = useState('info')
    const [name, setName] = useState(org.name)
    const [shortDescription, setShortDescription] = useState(org.short_description || '')
    const [description, setDescription] = useState(org.description || '')
    const [locationName, setLocationName] = useState(org.location_name || '')
    const [latitude, setLatitude] = useState(org.latitude || '')
    const [longitude, setLongitude] = useState(org.longitude || '')
    const [email, setEmail] = useState('')
    const [role, setRole] = useState('boss_admin')
    const [loading, setLoading] = useState(false)
    const [logoLoading, setLogoLoading] = useState(false)
    const [message, setMessage] = useState(null)
    const [error, setError] = useState(null)

    const toggleAdmins = async () => {
        if (!adminsVisible && admins.length === 0) {
            setLoadingAdmins(true)
            try {
                const res = await getOrgMemberships(org.id)
                setAdmins(res.data)
            } catch {
                setError('Failed to load admins.')
            } finally {
                setLoadingAdmins(false)
            }
        }
        setAdminsVisible(!adminsVisible)
    }

    const handleRemove = async (userId) => {
        if (!window.confirm('Remove this admin?')) return
        try {
            await removeAdmin(org.id, userId)
            setAdmins(admins.filter((a) => a.user_id !== userId))
            setMessage('Admin removed.')
        } catch {
            setError('Failed to remove admin.')
        }
    }

    const getDisplayName = (admin) => {
        if (admin.first_name || admin.last_name) {
            return `${admin.first_name || ''} ${admin.last_name || ''}`.trim()
        }
        return admin.email
    }

    const handleUpdate = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        setMessage(null)
        try {
            await updateOrganization(org.id, {
                name: name || undefined,
                short_description: shortDescription || undefined,
                description: description || undefined,
                location_name: locationName || undefined,
                latitude: latitude ? parseFloat(latitude) : undefined,
                longitude: longitude ? parseFloat(longitude) : undefined,
            })
            setMessage('Organisation updated successfully.')
            onUpdated()
        } catch {
            setError('Failed to update organisation.')
        } finally {
            setLoading(false)
        }
    }

    const handleLogoUpload = async (e) => {
        const file = e.target.files[0]
        if (!file) return
        setLogoLoading(true)
        setError(null)
        try {
            await uploadLogo(org.id, file)
            setMessage('Logo uploaded successfully.')
            onUpdated()
        } catch {
            setError('Failed to upload logo.')
        } finally {
            setLogoLoading(false)
        }
    }

    const handleInvite = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        setMessage(null)
        try {
            await inviteAdmin(org.id, email, role)
            setMessage('Admin invited successfully.')
            setEmail('')
        } catch (err) {
            if (err.response?.status === 404) {
                setError('User not found — they must log in to the app first.')
            } else if (err.response?.status === 400) {
                setError('This user is already an admin of this organisation.')
            } else {
                setError('Failed to invite admin.')
            }
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async () => {
        if (!window.confirm(`Are you sure you want to delete "${org.name}"? This will also delete all its events and admins. This cannot be undone.`)) return
        try {
            await deleteOrganization(org.id)
            onUpdated()
        } catch {
            setError('Failed to delete organisation.')
        }
    }

    return (
        <div style={styles.devOrgItem}>
            <div
                style={styles.devOrgHeader}
                onClick={() => setExpanded(!expanded)}
            >
                {org.logo_url && (
                    <img
                        src={`https://stustaapp.stusta.mhn.de${org.logo_url}`}
                        alt={org.name}
                        style={styles.devOrgLogo}
                    />
                )}
                <span style={styles.devOrgName}>{org.name}</span>
                <button
                    style={styles.deleteOrgButton}
                    onClick={(e) => { e.stopPropagation(); handleDelete() }}
                >
                    🗑️
                </button>
                <span style={styles.arrow}>{expanded ? '∨' : '›'}</span>
            </div>

            {expanded && (
                <div style={styles.devOrgExpanded}>
                    <div style={styles.tabRow}>
                        <button
                            style={activeTab === 'info' ? styles.tabActive : styles.tab}
                            onClick={() => setActiveTab('info')}
                        >
                            Info
                        </button>
                        <button
                            style={activeTab === 'admins' ? styles.tabActive : styles.tab}
                            onClick={() => setActiveTab('admins')}
                        >
                            Admins
                        </button>
                    </div>

                    {error && <p style={styles.error}>{error}</p>}
                    {message && <p style={styles.success}>{message}</p>}

                    {activeTab === 'info' && (
                        <form onSubmit={handleUpdate} style={styles.form}>
                            <input style={styles.input} placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
                            <input style={styles.input} placeholder="Short description" value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} />
                            <textarea style={styles.textarea} placeholder="Full description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
                            <input style={styles.input} placeholder="Location name" value={locationName} onChange={(e) => setLocationName(e.target.value)} />
                            <div style={styles.row}>
                                <input style={{ ...styles.input, flex: 1 }} placeholder="Latitude" value={latitude} onChange={(e) => setLatitude(e.target.value)} type="number" step="any" />
                                <input style={{ ...styles.input, flex: 1 }} placeholder="Longitude" value={longitude} onChange={(e) => setLongitude(e.target.value)} type="number" step="any" />
                            </div>
                            <button style={styles.button} type="submit" disabled={loading}>
                                {loading ? 'Saving...' : 'Save Changes'}
                            </button>
                            <div style={styles.uploadRow}>
                                <span style={styles.uploadLabel}>Logo</span>
                                <label style={styles.uploadButton}>
                                    {logoLoading ? 'Uploading...' : 'Upload Logo'}
                                    <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleLogoUpload} style={{ display: 'none' }} />
                                </label>
                            </div>
                            {org.logo_url && (
                                <img src={`https://stustaapp.stusta.mhn.de${org.logo_url}`} alt="Current logo" style={styles.currentLogo} />
                            )}
                        </form>
                    )}

                    {activeTab === 'admins' && (
                        <div>
                            <button style={styles.toggleButton} onClick={toggleAdmins}>
                                {adminsVisible ? '▲ Hide Admins' : '▼ Show Admins'}
                            </button>

                            {adminsVisible && (
                                <div style={styles.adminsList}>
                                    {loadingAdmins ? (
                                        <p style={styles.hint}>Loading admins...</p>
                                    ) : admins.length === 0 ? (
                                        <p style={styles.hint}>No admins yet.</p>
                                    ) : (
                                        admins.map((admin) => (
                                            <div key={admin.user_id} style={styles.adminCard}>
                                                <div style={styles.adminInfo}>
                                                    <p style={styles.adminName}>
                                                        {admin.first_name || admin.last_name
                                                            ? `${admin.first_name || ''} ${admin.last_name || ''}`.trim()
                                                            : admin.email}
                                                    </p>
                                                    <p style={styles.adminEmail}>{admin.email}</p>
                                                    <span style={styles.adminRoleBadge}>
                                                        {admin.role === 'boss_admin' ? 'Boss Admin' : 'Org Admin'}
                                                    </span>
                                                </div>
                                                <button
                                                    style={styles.removeButton}
                                                    onClick={() => handleRemove(admin.user_id)}
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}

                            <h4 style={{ ...styles.formTitle, marginTop: '16px' }}>Invite Admin</h4>
                            <form onSubmit={handleInvite} style={styles.form}>
                                <input style={styles.input} placeholder="User email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                                <select style={styles.input} value={role} onChange={(e) => setRole(e.target.value)}>
                                    <option value="org_admin">Org Admin</option>
                                    <option value="boss_admin">Boss Admin</option>
                                </select>
                                <button style={styles.button} type="submit" disabled={loading}>
                                    {loading ? 'Inviting...' : 'Invite Admin'}
                                </button>
                            </form>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}