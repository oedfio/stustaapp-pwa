import { useState, useEffect } from 'react'
import { updateOrganization, uploadLogo, getOrganization } from '../../api/organizations'
import { mediaUrl } from '../../media'
import { styles } from './styles'

export default function OrgInfoEditor({ membership }) {
    const [name, setName] = useState('')
    const [shortDescription, setShortDescription] = useState('')
    const [description, setDescription] = useState('')
    const [locationName, setLocationName] = useState('')
    const [latitude, setLatitude] = useState('')
    const [longitude, setLongitude] = useState('')
    const [loading, setLoading] = useState(false)
    const [logoLoading, setLogoLoading] = useState(false)
    const [fetchLoading, setFetchLoading] = useState(true)
    const [message, setMessage] = useState(null)
    const [error, setError] = useState(null)

    useEffect(() => {
        loadOrg()
    }, [membership.org_id])

    const loadOrg = async () => {
        try {
            const res = await getOrganization(membership.org_id)
            const org = res.data
            setName(org.name || '')
            setShortDescription(org.short_description || '')
            setDescription(org.description || '')
            setLocationName(org.location_name || '')
            setLatitude(org.latitude || '')
            setLongitude(org.longitude || '')
        } catch {
            setError('Failed to load organisation info.')
        } finally {
            setFetchLoading(false)
        }
    }

    const handleUpdate = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        setMessage(null)
        try {
            await updateOrganization(membership.org_id, {
                name: name || undefined,
                short_description: shortDescription || undefined,
                description: description || undefined,
                location_name: locationName || undefined,
                latitude: latitude ? parseFloat(latitude) : undefined,
                longitude: longitude ? parseFloat(longitude) : undefined,
            })
            setMessage('Organisation updated successfully.')
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
            await uploadLogo(membership.org_id, file)
            setMessage('Logo uploaded successfully.')
        } catch {
            setError('Failed to upload logo.')
        } finally {
            setLogoLoading(false)
        }
    }

    if (fetchLoading) return <div style={styles.subSection}><p style={styles.hint}>Loading...</p></div>

    return (
        <div style={styles.subSection}>
            <h3 style={styles.subHeading}>Organisation Info</h3>
            <form onSubmit={handleUpdate} style={styles.form}>
                <input
                    style={styles.input}
                    placeholder="Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                />
                <input
                    style={styles.input}
                    placeholder="Short description"
                    value={shortDescription}
                    onChange={(e) => setShortDescription(e.target.value)}
                />
                <textarea
                    style={styles.textarea}
                    placeholder="Full description (supports **bold**, *italic*, links, lists)"
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
                    {loading ? 'Saving...' : 'Save Changes'}
                </button>
            </form>

            <div style={styles.uploadRow}>
                <span style={styles.uploadLabel}>Organisation Logo</span>
                <label style={styles.uploadButton}>
                    {logoLoading ? 'Uploading...' : 'Upload Logo'}
                    <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleLogoUpload}
                        style={{ display: 'none' }}
                    />
                </label>
            </div>
            {membership.org_logo_url && (
                <img
                    src={mediaUrl(membership.org_logo_url)}
                    alt="Current logo"
                    style={styles.currentLogo}
                />
            )}
        </div>
    )
}