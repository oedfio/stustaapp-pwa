import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    getNotifications,
    markNotificationRead,
    markAllNotificationsRead,
} from '../api/notifications'

export default function Notifications() {
    const [notifications, setNotifications] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const navigate = useNavigate()

    useEffect(() => {
        loadNotifications()
    }, [])

    const loadNotifications = async () => {
        try {
            const res = await getNotifications()
            setNotifications(res.data)
        } catch {
            setError('Failed to load notifications. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    const handleClick = async (notification) => {
        if (!notification.read_at) {
            try {
                await markNotificationRead(notification.id)
                setNotifications((prev) =>
                    prev.map((n) =>
                        n.id === notification.id ? { ...n, read_at: new Date().toISOString() } : n
                    )
                )
            } catch {
                // Ignore — navigation still proceeds even if marking read failed
            }
        }
        if (notification.url) {
            navigate(notification.url)
        }
    }

    const handleMarkAllRead = async () => {
        try {
            await markAllNotificationsRead()
            setNotifications((prev) =>
                prev.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() }))
            )
        } catch {
            setError('Failed to mark all as read.')
        }
    }

    const hasUnread = notifications.some((n) => !n.read_at)

    if (loading) return <div style={styles.center}>Loading notifications...</div>
    if (error) return <div style={styles.error}>{error}</div>

    return (
        <div style={styles.container}>
            <div style={styles.headerRow}>
                <h1 style={styles.heading}>Notifications</h1>
                {hasUnread && (
                    <button style={styles.markAllButton} onClick={handleMarkAllRead}>
                        Mark all read
                    </button>
                )}
            </div>

            {notifications.length === 0 ? (
                <div style={styles.empty}>
                    <p style={styles.emptyText}>No notifications yet.</p>
                    <p style={styles.emptySubtext}>
                        Follow an organisation to hear about their new events.
                    </p>
                </div>
            ) : (
                <div style={styles.list}>
                    {notifications.map((notification) => (
                        <div
                            key={notification.id}
                            style={{
                                ...styles.card,
                                ...(notification.read_at ? {} : styles.unreadCard),
                            }}
                            onClick={() => handleClick(notification)}
                        >
                            <div style={styles.cardHeader}>
                                <p style={styles.title}>{notification.title}</p>
                                {!notification.read_at && <span style={styles.dot} />}
                            </div>
                            <p style={styles.body}>{notification.body}</p>
                            <p style={styles.time}>
                                {new Date(notification.created_at).toLocaleString('de-DE', {
                                    day: 'numeric',
                                    month: 'short',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                })}
                            </p>
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
    headerRow: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '16px',
    },
    heading: {
        fontSize: '22px',
        fontWeight: '700',
        color: '#1E2A3A',
        margin: '0',
    },
    markAllButton: {
        background: 'none',
        border: 'none',
        color: '#2563EB',
        fontSize: '13px',
        fontWeight: '600',
        cursor: 'pointer',
        padding: '0',
    },
    list: {
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
    },
    card: {
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        padding: '14px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        cursor: 'pointer',
        border: '1px solid #F3F4F6',
    },
    unreadCard: {
        borderLeft: '4px solid #2563EB',
        backgroundColor: '#F9FAFB',
    },
    cardHeader: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px',
    },
    title: {
        fontSize: '15px',
        fontWeight: '600',
        color: '#1E2A3A',
        margin: '0',
    },
    dot: {
        width: '8px',
        height: '8px',
        borderRadius: '999px',
        backgroundColor: '#2563EB',
        flexShrink: 0,
    },
    body: {
        fontSize: '14px',
        color: '#374151',
        margin: '4px 0 0 0',
    },
    time: {
        fontSize: '12px',
        color: '#9CA3AF',
        margin: '6px 0 0 0',
    },
    center: {
        display: 'flex',
        justifyContent: 'center',
        padding: '40px 16px',
        color: '#6B7280',
    },
    error: {
        padding: '16px',
        color: '#DC2626',
        textAlign: 'center',
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