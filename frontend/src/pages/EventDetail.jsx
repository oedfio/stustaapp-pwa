import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getEvent } from '../api/events'

export default function EventDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadEvent()
  }, [id])

  const loadEvent = async () => {
    try {
      const res = await getEvent(id)
      setEvent(res.data)
    } catch {
      setError('Event not found.')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div style={styles.center}>Loading...</div>
  if (error) return <div style={styles.center}>{error}</div>
  if (!event) return null

  const mapsUrl = event.org_latitude && event.org_longitude
    ? `https://www.google.com/maps?q=${event.org_latitude},${event.org_longitude}`
    : null

  const formattedDate = new Date(event.starts_at).toLocaleDateString('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div style={styles.container}>

      {/* Back button */}
      <button onClick={() => navigate(-1)} style={styles.backButton}>
        ← Back
      </button>

      {/* Event photo */}
      {event.photo_url && (
        <img
          src={`https://stustaapp.stusta.mhn.de${event.photo_url}`}
          alt={event.title}
          style={styles.photo}
        />
      )}

      <div style={styles.content}>

        {/* Org info */}
        <div style={styles.orgRow}>
          {event.org_logo_url ? (
            <img
              src={`https://stustaapp.stusta.mhn.de${event.org_logo_url}`}
              alt={event.org_name}
              style={styles.orgLogo}
            />
          ) : (
            <div style={styles.orgLogoPlaceholder}>
              {event.org_name.charAt(0)}
            </div>
          )}
          <span style={styles.orgName}>{event.org_name}</span>
        </div>

        {/* Title */}
        <h1 style={styles.title}>{event.title}</h1>

        {/* Recurrence badge */}
        {event.recurrence !== 'none' && (
          <div style={styles.badge}>
            🔁 {event.recurrence === 'weekly' ? 'Every week'
              : event.recurrence === 'biweekly' ? 'Every two weeks'
                : 'Every month'}
          </div>
        )}

        {/* Date */}
        <div style={styles.infoRow}>
          <span style={styles.infoIcon}>📅</span>
          <div>
            <span style={styles.infoText}>{formattedDate}</span>
            {event.ends_at && (
              <span style={styles.endDate}>
                {' '}— until {new Date(event.ends_at).toLocaleDateString('de-DE', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            )}
          </div>
        </div>

        {/* Ongoing badge */}
        {event.ends_at && new Date(event.starts_at) <= new Date() && new Date(event.ends_at) >= new Date() && (
          <div style={{ ...styles.badge, backgroundColor: '#F0FDF4', color: '#16A34A' }}>
            🟢 Happening now
          </div>
        )}

        {/* Location */}
        {event.location && (
          <div style={styles.infoRow}>
            <span style={styles.infoIcon}>📍</span>
            {mapsUrl ? (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={styles.locationLink}
              >
                {event.location} — open in Maps
              </a>
            ) : (
              <span style={styles.infoText}>{event.location}</span>
            )}
          </div>
        )}

        {/* Description */}
        {event.description && (
          <div style={styles.descriptionBox}>
            <p style={styles.description}>{event.description}</p>
          </div>
        )}

      </div>
    </div>
  )
}

const styles = {
  container: {
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
    padding: '16px',
    display: 'block',
  },
  photo: {
    width: '100%',
    objectFit: 'contain',
    backgroundColor: '#F9FAFB',
  },
  content: {
    padding: '16px',
  },
  orgRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '12px',
  },
  orgLogo: {
    width: '32px',
    height: '32px',
    borderRadius: '6px',
    objectFit: 'cover',
  },
  orgLogoPlaceholder: {
    width: '32px',
    height: '32px',
    borderRadius: '6px',
    backgroundColor: '#EFF6FF',
    color: '#2563EB',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    fontWeight: '700',
  },
  orgName: {
    fontSize: '20px',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  title: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#1E2A3A',
    margin: '0 0 12px 0',
    lineHeight: '1.3',
  },
  badge: {
    display: 'inline-block',
    backgroundColor: '#EFF6FF',
    color: '#2563EB',
    fontSize: '13px',
    padding: '4px 10px',
    borderRadius: '20px',
    marginBottom: '16px',
  },
  infoRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    marginBottom: '10px',
  },
  infoIcon: {
    fontSize: '18px',
    flexShrink: 0,
  },
  infoText: {
    fontSize: '15px',
    color: '#374151',
    lineHeight: '1.5',
  },
  locationLink: {
    fontSize: '15px',
    color: '#2563EB',
    textDecoration: 'none',
    lineHeight: '1.5',
  },
  descriptionBox: {
    marginTop: '20px',
    padding: '16px',
    backgroundColor: '#F9FAFB',
    borderRadius: '12px',
    borderLeft: '4px solid #2563EB',
  },
  description: {
    fontSize: '15px',
    color: '#374151',
    lineHeight: '1.7',
    margin: '0',
    whiteSpace: 'pre-wrap',
  },
  center: {
    display: 'flex',
    justifyContent: 'center',
    padding: '40px 16px',
    color: '#6B7280',
  },
  endDate: {
    fontSize: '14px',
    color: '#6B7280',
  },
}