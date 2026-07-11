import { useNavigate } from 'react-router-dom'

export default function Footer() {
    return (
        <div style={styles.footer}>
            <a
                href="https://stustanet.de/de/impressum/"
                target="_blank"
                rel="noopener noreferrer"
                style={styles.link}
            >
                Impressum & Datenschutz
            </a>
            <span style={styles.dot}>·</span>
            <FooterLink to="/guide">Getting Started</FooterLink>
            <span style={styles.dot}>·</span>
            <FooterLink to="/who-created-this">Who created this?</FooterLink>
            <span style={styles.dot}>·</span>
            <FooterLink to="/special-thanks">Special Thanks</FooterLink>
        </div >
    )
}

function FooterLink({ to, children }) {
    const navigate = useNavigate()
    return (
        <button style={styles.link} onClick={() => navigate(to)}>
            {children}
        </button>
    )
}

const styles = {
    footer: {
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        padding: '24px 16px 80px 16px',
        borderTop: '1px solid #E5E7EB',
        marginTop: '32px',
    },
    link: {
        fontSize: '12px',
        color: '#9CA3AF',
        textDecoration: 'none',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '0',
        fontFamily: 'inherit',
    },
    dot: {
        fontSize: '12px',
        color: '#D1D5DB',
    },
}