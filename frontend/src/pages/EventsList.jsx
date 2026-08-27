import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Circle, MapPin, Repeat } from 'lucide-react'
import { getEvents } from '../api/events'
import { mediaUrl } from '../media'

export default function EventsList() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    loadEvents()
  }, [])

  const loadEvents = async () => {
    try {
      const res = await getEvents()
      setEvents(res.data)
    } catch {
      setError('Failed to load events. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const isOngoing = (event) => {
    if (!event.ends_at) return false
    const now = new Date()
    return new Date(event.starts_at) <= now && new Date(event.ends_at) >= now
  }

  if (loading) return <div style={styles.center}>Loading events...</div>
  if (error) return <div style={styles.error}>{error}</div>

  return (
    <div style={styles.container}>
      <h1 style={styles.heading}>Events this week</h1>

      {events.length === 0 ? (
        <div style={styles.empty}>
          <p style={styles.emptyText}>No events this week.</p>
          <p style={styles.emptySubtext}>Check back soon!</p>
        </div>
      ) : (
        <div style={styles.list}>
          {events.map((event) => (
            <div
              key={event.id}
              style={{
                ...styles.card,
                ...(isOngoing(event) ? styles.ongoingCard : {}),
              }}
              onClick={() => navigate(`/events/${event.id}`)}
            >
              {/* Org logo — only shown if the org actually has one */}
              {event.org_logo_url && (
                <div style={styles.logoContainer}>
                  <img
                    src={mediaUrl(event.org_logo_url)}
                    alt={event.org_name}
                    style={styles.logo}
                  />
                </div>
              )}

              {/* Event info */}
              <div style={styles.info}>
                <p style={styles.orgName}>{event.org_name}</p>
                {isOngoing(event) && (
                  <span style={styles.ongoingBadge}>
                    <Circle size={9} fill="#16A34A" color="#16A34A" style={{ verticalAlign: '1px', marginRight: '4px' }} />
                    Happening now
                  </span>
                )}
                <h2 style={styles.title}>{event.title}</h2>
                <p style={styles.date}>
                  {new Date(event.starts_at).toLocaleDateString('de-DE', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
                {event.location && (
                  <p style={styles.location}>
                    <MapPin size={13} color="#555555" style={{ verticalAlign: '-2px', marginRight: '4px' }} />
                    {event.location}
                  </p>
                )}
                {event.recurrence !== 'none' && (
                  <p style={styles.recurrence}>
                    <Repeat size={13} style={{ verticalAlign: '-2px', marginRight: '4px' }} />
                    {event.recurrence === 'weekly' ? 'Every week'
                      : event.recurrence === 'biweekly' ? 'Every two weeks'
                        : 'Every month'}
                  </p>
                )}
              </div>
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
  heading: {
    fontSize: '22px',
    fontWeight: '700',
    color: '#1A1C1E',
    margin: '0 0 16px 0',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  card: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    padding: '14px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
    cursor: 'pointer',
    border: '1px solid #F2F2F7',
  },
  logoContainer: {
    flexShrink: 0,
  },
  logo: {
    width: '52px',
    height: '52px',
    borderRadius: '10px',
    objectFit: 'cover',
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  orgName: {
    fontSize: '12px',
    color: '#555555',
    margin: '0 0 2px 0',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  title: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#1A1C1E',
    margin: '0 0 4px 0',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  date: {
    fontSize: '13px',
    color: '#0064BC',
    margin: '0 0 2px 0',
    fontWeight: '500',
  },
  location: {
    fontSize: '13px',
    color: '#555555',
    margin: '0 0 2px 0',
  },
  recurrence: {
    fontSize: '13px',
    color: '#AAAAAA',
    margin: '0',
  },
  center: {
    display: 'flex',
    justifyContent: 'center',
    padding: '40px 16px',
    color: '#555555',
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
    color: '#1A1C1E',
    margin: '0 0 8px 0',
  },
  emptySubtext: {
    fontSize: '14px',
    color: '#555555',
    margin: '0',
  },
  ongoingCard: {
    borderLeft: '4px solid #16A34A',
    backgroundColor: '#F0FDF4',
  },
  ongoingBadge: {
    fontSize: '11px',
    color: '#16A34A',
    fontWeight: '600',
    display: 'block',
    marginBottom: '2px',
  },
}