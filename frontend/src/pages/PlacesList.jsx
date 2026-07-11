import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin } from 'lucide-react'
import { getOrganizations } from '../api/organizations'

export default function PlacesList() {
    const [organizations, setOrganizations] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const navigate = useNavigate()

    useEffect(() => {
        loadOrganizations()
    }, [])

    const loadOrganizations = async () => {
        try {
            const res = await getOrganizations()
            setOrganizations(res.data)
        } catch {
            setError('Failed to load places. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    if (loading) return <div style={styles.center}>Loading places...</div>
    if (error) return <div style={styles.center}>{error}</div>

    return (
        <div style={styles.container}>
            <h1 style={styles.heading}>Places</h1>

            {organizations.length === 0 ? (
                <div style={styles.empty}>
                    <p style={styles.emptyText}>No places yet.</p>
                    <p style={styles.emptySubtext}>Check back soon!</p>
                </div>
            ) : (
                <div style={styles.list}>
                    {organizations.map((org) => (
                        <div
                            key={org.id}
                            style={styles.card}
                            onClick={() => navigate(`/places/${org.id}`)}
                        >
                            {/* Logo — only shown if available */}
                            {org.logo_url && (
                                <div style={styles.logoContainer}>
                                    <img
                                        src={`https://stustaapp.stusta.mhn.de${org.logo_url}`}
                                        alt={org.name}
                                        style={styles.logo}
                                    />
                                </div>
                            )}

                            {/* Info */}
                            <div style={styles.info}>
                                <h2 style={styles.name}>{org.name}</h2>
                                {org.location_name && (
                                    <p style={styles.location}>
                                        <MapPin size={13} color="#6B7280" style={{ verticalAlign: '-2px', marginRight: '4px' }} />
                                        {org.location_name}
                                    </p>
                                )}
                                {org.short_description && (
                                    <p style={styles.description}>{org.short_description}</p>
                                )}
                            </div>

                            {/* Arrow */}
                            <span style={styles.arrow}>›</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

const styles = {
    container: {
        padding: '16px',
        maxWidth: '600px',
        margin: '0 auto',
    },
    heading: {
        fontSize: '22px',
        fontWeight: '700',
        color: '#1E2A3A',
        margin: '0 0 16px 0',
    },
    list: {
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
    },
    card: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        padding: '14px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        cursor: 'pointer',
        border: '1px solid #F3F4F6',
    },
    logoContainer: {
        flexShrink: 0,
    },
    logo: {
        width: '56px',
        height: '56px',
        borderRadius: '12px',
        objectFit: 'cover',
    },
    logoPlaceholder: {
        width: '56px',
        height: '56px',
        borderRadius: '12px',
        backgroundColor: '#EFF6FF',
        color: '#2563EB',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '24px',
        fontWeight: '700',
    },
    info: {
        flex: 1,
        minWidth: 0,
    },
    name: {
        fontSize: '16px',
        fontWeight: '600',
        color: '#1E2A3A',
        margin: '0 0 4px 0',
    },
    location: {
        fontSize: '13px',
        color: '#6B7280',
        margin: '0 0 4px 0',
    },
    description: {
        fontSize: '13px',
        color: '#6B7280',
        margin: '0',
        overflow: 'hidden',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
    },
    arrow: {
        fontSize: '24px',
        color: '#D1D5DB',
        flexShrink: 0,
    },
    center: {
        display: 'flex',
        justifyContent: 'center',
        padding: '40px 16px',
        color: '#6B7280',
    },
    empty: {
        textAlign: 'center',
        padding: '60px 16px',
    },
    emptyText: {
        fontSize: '18px',
        fontWeight: '600',
        color: '#1E2A3A',
        margin: '0 0 8px 0',
    },
    emptySubtext: {
        fontSize: '14px',
        color: '#6B7280',
        margin: '0',
    },
}