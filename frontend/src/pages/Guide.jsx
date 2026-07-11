import { useNavigate } from 'react-router-dom'
import { Calendar, MapPin, Bell, User, Settings } from 'lucide-react'

const SECTIONS = [
    {
        icon: Calendar,
        title: 'Events',
        text: 'The Events tab shows what\'s happening in Studentenstadt over the next week, soonest first. Tap any event for the full details, location, and photo.',
    },
    {
        icon: MapPin,
        title: 'Places',
        text: 'Browse every organisation and club in the dorm. Tap one to see its info, location on the map, and its upcoming events.',
    },
    {
        icon: Bell,
        title: 'Follow for notifications',
        text: 'Open an organisation\'s page and follow it to get notified whenever they post a new event. Enable push notifications in Profile to get them even when the app is closed.',
    },
    {
        icon: User,
        title: 'Profile',
        text: 'Manage your name, notification settings, and which organisations you follow.',
    },
    {
        icon: Settings,
        title: 'Manage (admins only)',
        text: 'If you help run an organisation, a Manage tab appears where you can create and edit events, update your org\'s info, and manage other admins.',
    },
]

export default function Guide() {
    const navigate = useNavigate()

    return (
        <div style={styles.container}>
            <button onClick={() => navigate(-1)} style={styles.backButton}>
                ← Back
            </button>

            <h1 style={styles.heading}>Getting Started</h1>
            <p style={styles.subheading}>
                A quick tour of what you can do in StuStaApp.
            </p>

            <div style={styles.list}>
                {SECTIONS.map((section) => (
                    <div key={section.title} style={styles.card}>
                        <section.icon size={26} color="#0064BC" style={{ flexShrink: 0 }} />
                        <div>
                            <h2 style={styles.cardTitle}>{section.title}</h2>
                            <p style={styles.cardText}>{section.text}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

const styles = {
    container: {
        padding: '16px',
        maxWidth: '600px',
        margin: '0 auto',
    },
    backButton: {
        background: 'none',
        border: 'none',
        color: '#0064BC',
        fontSize: '15px',
        cursor: 'pointer',
        padding: '0 0 16px 0',
    },
    heading: {
        fontSize: '22px',
        fontWeight: '700',
        color: '#1A1C1E',
        margin: '0 0 4px 0',
    },
    subheading: {
        fontSize: '14px',
        color: '#555555',
        margin: '0 0 20px 0',
    },
    list: {
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
    },
    card: {
        display: 'flex',
        gap: '14px',
        alignItems: 'flex-start',
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        padding: '16px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        border: '1px solid #F2F2F7',
    },
    cardTitle: {
        fontSize: '16px',
        fontWeight: '600',
        color: '#1A1C1E',
        margin: '0 0 4px 0',
    },
    cardText: {
        fontSize: '14px',
        color: '#1A1C1E',
        lineHeight: '1.6',
        margin: '0',
    },
}