import { useNavigate } from 'react-router-dom'
import { Calendar, MapPin, Bell, User, Settings, ShieldCheck, Wrench, Smartphone, Share } from 'lucide-react'

const INSTALL_SECTIONS = [
    {
        icon: Smartphone,
        title: 'Android (Chrome)',
        text: 'Open stustaapp.stusta.mhn.de in Chrome. Tap the menu (⋮) in the top right and choose "Add to Home screen" — or just wait for Chrome\'s install banner to pop up. It opens fullscreen from your home screen from then on, just like any other app.',
    },
    {
        icon: Share,
        title: 'iPhone / iPad (Safari)',
        text: 'Open stustaapp.stusta.mhn.de in Safari — it has to be Safari, other browsers on iOS can\'t install it. Tap the Share button, scroll down, and choose "Add to Home Screen".',
    },
]

// Same colors as the tab bar (src/components/TabBar.jsx) and the
// notification bell (src/components/Header.jsx), so a section here
// visually matches the tab/icon it explains.
const SECTIONS = [
    {
        icon: Calendar,
        title: 'Events',
        text: 'The Events tab shows what\'s happening in Studentenstadt over the next week, soonest first. Tap any event for the full details, location, and photo.',
        color: '#d32f2f',
    },
    {
        icon: MapPin,
        title: 'Places',
        text: 'Browse every organisation and club in the dorm. Tap one to see its info, location on the map, and its upcoming events.',
        color: '#f9a825',
    },
    {
        icon: Bell,
        title: 'Follow for notifications',
        text: 'Open an organisation\'s page and follow it to get notified whenever they post a new event. Enable push notifications in Profile to get them even when the app is closed.',
        color: '#f9a825',
    },
    {
        icon: User,
        title: 'Profile',
        text: 'Manage your name, notification settings, and which organisations you follow.',
        color: '#1976d2',
    },
]

const ADMIN_SECTIONS = [
    {
        icon: Settings,
        title: 'Org Admin',
        text: 'The Manage tab shows a section for each organisation you help run. Create, edit, and delete its events, and upload a photo for each one.',
        color: '#388e3c',
    },
    {
        icon: ShieldCheck,
        title: 'Boss Admin',
        text: 'Everything an org admin can do, plus edit your organisation\'s info and logo, and invite or remove other admins — including other boss admins — for your org.',
        color: '#388e3c',
    },
    {
        icon: Wrench,
        title: 'Dev Admin',
        text: 'Full access across every organisation: create new organisations and assign their first boss admin, edit or delete any organisation, and broadcast a notification to every user in the app.',
        color: '#388e3c',
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

            <h2 style={{ ...styles.sectionHeading, margin: '0 0 4px 0' }}>Install the App</h2>
            <p style={styles.subheading}>
                StuStaApp works right in your browser, but installing it gives you a real
                home-screen icon, a fullscreen view, and push notifications.
            </p>

            <div style={styles.list}>
                {INSTALL_SECTIONS.map((section) => (
                    <div key={section.title} style={styles.card}>
                        <section.icon size={26} color="#0064BC" style={{ flexShrink: 0 }} />
                        <div>
                            <h2 style={styles.cardTitle}>{section.title}</h2>
                            <p style={styles.cardText}>{section.text}</p>
                        </div>
                    </div>
                ))}
            </div>

            <h2 style={styles.sectionHeading}>Using the App</h2>

            <div style={styles.list}>
                {SECTIONS.map((section) => (
                    <div key={section.title} style={styles.card}>
                        <section.icon size={26} color={section.color} style={{ flexShrink: 0 }} />
                        <div>
                            <h2 style={styles.cardTitle}>{section.title}</h2>
                            <p style={styles.cardText}>{section.text}</p>
                        </div>
                    </div>
                ))}
            </div>

            <h2 style={styles.sectionHeading}>For Admins</h2>
            <p style={styles.subheading}>
                If you help run an organisation, a Manage tab appears with the tools below for your role.
            </p>

            <div style={styles.list}>
                {ADMIN_SECTIONS.map((section) => (
                    <div key={section.title} style={styles.card}>
                        <section.icon size={26} color={section.color} style={{ flexShrink: 0 }} />
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
    sectionHeading: {
        fontSize: '18px',
        fontWeight: '700',
        color: '#1A1C1E',
        margin: '28px 0 4px 0',
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