import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { useAuth } from './AuthContext'
import { getUnreadNotificationCount } from '../api/notifications'

const POLL_INTERVAL_MS = 30000

export default function Header() {
    const { user } = useAuth()
    const navigate = useNavigate()
    const [unreadCount, setUnreadCount] = useState(0)

    useEffect(() => {
        if (!user) {
            setUnreadCount(0)
            return
        }

        const fetchUnreadCount = async () => {
            try {
                const res = await getUnreadNotificationCount()
                setUnreadCount(res.data.count)
            } catch {
                // Silently ignore — the bell just won't update this cycle
            }
        }

        fetchUnreadCount()
        const interval = setInterval(fetchUnreadCount, POLL_INTERVAL_MS)
        return () => clearInterval(interval)
    }, [user])

    if (!user) return null

    return (
        <header style={styles.header}>
            <div style={styles.brand}>
                <img src="/pwa-192x192.png" alt="" style={styles.appIcon} />
                <span style={styles.appName}>StuStaApp</span>
            </div>
            <button
                style={styles.bellButton}
                onClick={() => navigate('/notifications')}
                aria-label="Notifications"
            >
                <Bell size={20} color="#1A1C1E" />
                {unreadCount > 0 && (
                    <span style={styles.badge}>{unreadCount > 9 ? '9+' : unreadCount}</span>
                )}
            </button>
        </header>
    )
}

const styles = {
    header: {
        position: 'sticky',
        top: 0,
        left: 0,
        right: 0,
        height: '48px',
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #E3E3E4',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        zIndex: 100,
    },
    brand: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    },
    appIcon: {
        width: '22px',
        height: '22px',
    },
    appName: {
        fontSize: '15px',
        fontWeight: '600',
        color: '#1A1C1E',
    },
    bellButton: {
        position: 'relative',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '4px',
        display: 'flex',
        alignItems: 'center',
    },
    badge: {
        position: 'absolute',
        top: '-2px',
        right: '-2px',
        backgroundColor: '#DC2626',
        color: '#ffffff',
        fontSize: '10px',
        fontWeight: '700',
        borderRadius: '999px',
        minWidth: '16px',
        height: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 3px',
        lineHeight: '1',
    },
}