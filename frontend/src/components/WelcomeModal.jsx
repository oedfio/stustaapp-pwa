import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { PartyPopper } from 'lucide-react'

const STORAGE_KEY = 'stustaapp_seen_welcome'

export default function WelcomeModal() {
    const [visible, setVisible] = useState(false)
    const navigate = useNavigate()

    useEffect(() => {
        if (!localStorage.getItem(STORAGE_KEY)) {
            setVisible(true)
        }
    }, [])

    const dismiss = () => {
        localStorage.setItem(STORAGE_KEY, 'true')
        setVisible(false)
    }

    const openGuide = () => {
        dismiss()
        navigate('/guide')
    }

    if (!visible) return null

    return (
        <div style={styles.overlay}>
            <div style={styles.modal}>
                <PartyPopper size={40} color="#2563EB" />
                <h2 style={styles.title}>Welcome to StuStaApp!</h2>
                <p style={styles.text}>
                    Browse events and organisations across Studentenstadt, follow
                    the ones you care about, and get notified when something new
                    is posted.
                </p>
                <div style={styles.actions}>
                    <button style={styles.secondaryButton} onClick={dismiss}>
                        Got it
                    </button>
                    <button style={styles.primaryButton} onClick={openGuide}>
                        Show me around
                    </button>
                </div>
            </div>
        </div>
    )
}

const styles = {
    overlay: {
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px',
    },
    modal: {
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        padding: '28px 24px',
        maxWidth: '360px',
        textAlign: 'center',
        boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
    },
    title: {
        fontSize: '20px',
        fontWeight: '700',
        color: '#1E2A3A',
        margin: '12px 0 8px 0',
    },
    text: {
        fontSize: '14px',
        color: '#374151',
        lineHeight: '1.6',
        margin: '0 0 20px 0',
    },
    actions: {
        display: 'flex',
        gap: '10px',
        justifyContent: 'center',
    },
    primaryButton: {
        backgroundColor: '#2563EB',
        color: '#ffffff',
        border: 'none',
        borderRadius: '10px',
        padding: '10px 16px',
        fontSize: '14px',
        fontWeight: '600',
        cursor: 'pointer',
    },
    secondaryButton: {
        backgroundColor: '#F3F4F6',
        color: '#374151',
        border: 'none',
        borderRadius: '10px',
        padding: '10px 16px',
        fontSize: '14px',
        fontWeight: '600',
        cursor: 'pointer',
    },
}