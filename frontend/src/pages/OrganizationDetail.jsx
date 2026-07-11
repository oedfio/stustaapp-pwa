import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getOrganization } from '../api/organizations'
import { getOrgEvents } from '../api/events'
import MarkdownText from '../components/MarkdownText'

export default function OrganizationDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [org, setOrg] = useState(null)
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadData()
  }, [id])

  const loadData = async () => {
    try {
      const [orgRes, eventsRes] = await Promise.all([
        getOrganization(id),
        getOrgEvents(id),
      ])
      setOrg(orgRes.data)
      setEvents(eventsRes.data)
    } catch {
      setError('Organisation not found.')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div style={styles.center}>Loading...</div>
  if (error) return <div style={styles.center}>{error}</div>
  if (!org) return null

  const mapsUrl = org.latitude && org.longitude
    ? `https://www.google.com/maps?q=${org.latitude},${org.longitude}`
    : null

  return (
    <div style={styles.container}>

      {/* Back button */}
      <button onClick={() => navigate(-1)} style={styles.backButton}>
        ← Back
      </button>

      {/* Header */}
      <div style={styles.header}>
        {org.logo_url && (
          <img
            src={`https://stustaapp.stusta.mhn.de${org.logo_url}`}
            alt={org.name}
            style={styles.logo}
          />
        )}
        <h1 style={styles.name}>{org.name}</h1>
      </div>

      <div style={styles.content}>

        {/* Location */}
        {org.location_name && (
          <div style={styles.infoRow}>
            <span style={styles.infoIcon}>📍</span>
            {mapsUrl ? (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={styles.locationLink}
              >
                {org.location_name} — open in Maps
              </a>
            ) : (
              <span style={styles.infoText}>{org.location_name}</span>
            )}
          </div>
        )}

        {/* Description */}
        {org.description && (
          <div style={styles.descriptionBox}>
            <MarkdownText style={styles.description}>{org.description}</MarkdownText>
          </div>
        )}

        {/* Upcoming events */}
        <h2 style={styles.sectionHeading}>Upcoming events</h2>

        {events.length === 0 ? (
          <p style={styles.noEvents}>No upcoming events this week.</p>
        ) : (
          <div style={styles.eventsList}>
            {events.map((event) => (
              <div
                key={event.id}
                style={styles.eventCard}
                onClick={() => navigate(`/events/${event.id}`)}
              >
                <div style={styles.eventInfo}>
                  <h3 style={styles.eventTitle}>{event.title}</h3>
                  <p style={styles.eventDate}>
                    {new Date(event.starts_at).toLocaleDateString('de-DE', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                  {event.location && (
                    <p style={styles.eventLocation}>📍 {event.location}</p>
                  )}
                </div>
                <span style={styles.arrow}>›</span>
              </div>
            ))}
          </div>
        )}

      </div>
    </div >
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
  header: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '0 16px 24px 16px',
    gap: '16px',
  },
  logo: {
    width: '128px',
    height: '128px',
    borderRadius: '20px',
    objectFit: 'cover',
    boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
  },
  name: {
    fontSize: '26px',
    fontWeight: '700',
    color: '#1E2A3A',
    margin: '0',
    textAlign: 'center',
  },
  content: {
    padding: '0 16px',
  },
  infoRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    marginBottom: '16px',
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
    padding: '16px',
    backgroundColor: '#F9FAFB',
    borderRadius: '12px',
    borderLeft: '4px solid #2563EB',
    marginBottom: '24px',
  },
  description: {
    fontSize: '15px',
    color: '#374151',
    lineHeight: '1.7',
    margin: '0',
    whiteSpace: 'pre-wrap',
  },
  sectionHeading: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#1E2A3A',
    margin: '0 0 12px 0',
  },
  noEvents: {
    fontSize: '14px',
    color: '#6B7280',
    margin: '0',
  },
  eventsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  eventCard: {
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
  eventInfo: {
    flex: 1,
    minWidth: 0,
  },
  eventTitle: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#1E2A3A',
    margin: '0 0 4px 0',
  },
  eventDate: {
    fontSize: '13px',
    color: '#2563EB',
    margin: '0 0 2px 0',
    fontWeight: '500',
  },
  eventLocation: {
    fontSize: '13px',
    color: '#6B7280',
    margin: '0',
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
}