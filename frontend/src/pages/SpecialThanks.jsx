import { useNavigate } from 'react-router-dom'

const people = [
    {
        name: 'Leo Fahrbach',
        note: 'For the support and guidance throughout the project.',
    },
    {
        name: 'Ivan Adamovich',
        note: 'For testing the app, providing valuable feedback, and suggesting improvements to the codebase.',
    },
    {
        name: 'Egon von Brüning',
        note: 'For setting up the server infrastructure and TLS certificates.',
    },
]

export default function SpecialThanks() {
    const navigate = useNavigate()

    return (
        <div style={styles.container}>
            <button onClick={() => navigate(-1)} style={styles.backButton}>
                ← Back
            </button>

            <div style={styles.header}>
                <span style={styles.emoji}>🙏</span>
                <h1 style={styles.heading}>Special Thanks</h1>
                <p style={styles.intro}>
                    StuStaApp would not exist without the support and help of some
                    truly wonderful people. A heartfelt thank you to everyone who
                    advised, and believed in this project.
                </p>
            </div>

            <div style={styles.list}>
                {people.map((person) => (
                    <div key={person.name} style={styles.card}>
                        <div style={styles.avatar}>
                            {person.name.charAt(0)}
                        </div>
                        <div style={styles.info}>
                            <h2 style={styles.name}>{person.name}</h2>
                            <p style={styles.note}>{person.note}</p>
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
        paddingBottom: '32px',
    },
    backButton: {
        background: 'none',
        border: 'none',
        color: '#2563EB',
        fontSize: '16px',
        cursor: 'pointer',
        padding: '0 0 16px 0',
        display: 'block',
    },
    header: {
        textAlign: 'center',
        marginBottom: '32px',
    },
    emoji: {
        fontSize: '48px',
        display: 'block',
        marginBottom: '12px',
    },
    heading: {
        fontSize: '28px',
        fontWeight: '700',
        color: '#1E2A3A',
        margin: '0 0 16px 0',
    },
    intro: {
        fontSize: '15px',
        color: '#6B7280',
        lineHeight: '1.7',
        margin: '0',
    },
    list: {
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
    },
    card: {
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        padding: '20px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        border: '1px solid #F3F4F6',
    },
    avatar: {
        width: '52px',
        height: '52px',
        borderRadius: '50%',
        backgroundColor: '#EFF6FF',
        color: '#2563EB',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '22px',
        fontWeight: '700',
        flexShrink: 0,
    },
    info: {
        flex: 1,
    },
    name: {
        fontSize: '17px',
        fontWeight: '700',
        color: '#1E2A3A',
        margin: '0 0 4px 0',
    },
    note: {
        fontSize: '14px',
        color: '#6B7280',
        margin: '0',
        lineHeight: '1.5',
    },
}