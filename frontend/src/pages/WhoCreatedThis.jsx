import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

export default function WhoCreatedThis() {
    const canvasRef = useRef(null)
    const navigate = useNavigate()

    useEffect(() => {
        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')
        canvas.width = window.innerWidth
        canvas.height = window.innerHeight

        const confetti = Array.from({ length: 150 }, () => ({
            x: Math.random() < 0.5 ? 0 : canvas.width,
            y: Math.random() * canvas.height,
            size: Math.random() * 8 + 4,
            color: ['#0064BC', '#16A34A', '#D97706', '#DC2626', '#7C3AED', '#DB2777'][
                Math.floor(Math.random() * 6)
            ],
            speedX: Math.random() * 4 + 2,
            speedY: Math.random() * 3 - 1.5,
            rotation: Math.random() * 360,
            rotationSpeed: Math.random() * 5 - 2.5,
            fromLeft: Math.random() < 0.5,
        }))

        let animationId

        const animate = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height)

            confetti.forEach((c) => {
                ctx.save()
                ctx.translate(c.x, c.y)
                ctx.rotate((c.rotation * Math.PI) / 180)
                ctx.fillStyle = c.color
                ctx.fillRect(-c.size / 2, -c.size / 2, c.size, c.size)
                ctx.restore()

                // Move from left side or right side
                c.x += c.fromLeft ? c.speedX : -c.speedX
                c.y += c.speedY + 1
                c.rotation += c.rotationSpeed

                // Reset when off screen
                if (c.y > canvas.height || c.x > canvas.width + 50 || c.x < -50) {
                    c.x = c.fromLeft ? 0 : canvas.width
                    c.y = Math.random() * -100
                }
            })

            animationId = requestAnimationFrame(animate)
        }

        animate()

        return () => cancelAnimationFrame(animationId)
    }, [])

    return (
        <div style={styles.container}>
            {/* Confetti canvas */}
            <canvas
                ref={canvasRef}
                style={styles.canvas}
            />

            {/* Content */}
            <div style={styles.content}>
                <button onClick={() => navigate(-1)} style={styles.backButton}>
                    ← Back
                </button>

                <h1 style={styles.legend}>LEGEND!</h1>

                <img
                    src="https://stustaapp.stusta.mhn.de/media/legend.jpg"
                    alt="The Legend"
                    style={styles.photo}
                />

                <h2 style={styles.name}>Nikita</h2>

                <p style={styles.description}>
                    The one and only creator of StuStaApp. Built this entire app
                    from scratch to make life in Studentenstadt a little better
                    for everyone. Truly a legend.
                </p>
            </div>
        </div>
    )
}

const styles = {
    container: {
        minHeight: '100vh',
        backgroundColor: '#1A1C1E',
        position: 'relative',
        overflow: 'hidden',
    },
    canvas: {
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 1,
    },
    content: {
        position: 'relative',
        zIndex: 2,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '20px 24px 80px 24px',
    },
    backButton: {
        alignSelf: 'flex-start',
        background: 'none',
        border: 'none',
        color: '#93C5FD',
        fontSize: '16px',
        cursor: 'pointer',
        padding: '0 0 24px 0',
    },
    legend: {
        fontSize: '64px',
        fontWeight: '900',
        color: '#FFD700',
        margin: '0 0 32px 0',
        textAlign: 'center',
        textShadow: '0 0 30px rgba(255, 215, 0, 0.5)',
        letterSpacing: '4px',
    },
    photo: {
        width: '100%',
        maxWidth: '400px',
        borderRadius: '20px',
        objectFit: 'contain',
        border: '4px solid #FFD700',
        boxShadow: '0 0 40px rgba(255, 215, 0, 0.4)',
        marginBottom: '24px',
    },
    name: {
        fontSize: '24px',
        fontWeight: '700',
        color: '#ffffff',
        margin: '0 0 16px 0',
        textAlign: 'center',
    },
    description: {
        fontSize: '16px',
        color: '#93C5FD',
        textAlign: 'center',
        lineHeight: '1.7',
        maxWidth: '360px',
        margin: '0',
    },
}