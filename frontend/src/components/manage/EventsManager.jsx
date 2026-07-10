import { useState, useEffect } from 'react'
import { getOrgEventsForManage, deleteEvent } from '../../api/events'
import EventForm from './EventForm'
import PhotoUploader from './PhotoUploader'
import { styles } from './styles'

export default function EventsManager({ membership }) {
    const [events, setEvents] = useState([])
    const [loading, setLoading] = useState(true)
    const [showCreateForm, setShowCreateForm] = useState(false)
    const [editingEvent, setEditingEvent] = useState(null)
    const [message, setMessage] = useState(null)
    const [error, setError] = useState(null)

    useEffect(() => {
        loadEvents()
    }, [membership.org_id])

    const loadEvents = async () => {
        try {
            const res = await getOrgEventsForManage(membership.org_id)
            setEvents(res.data)
        } catch {
            setError('Failed to load events.')
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async (eventId) => {
        if (!window.confirm('Delete this event?')) return
        try {
            await deleteEvent(membership.org_id, eventId)
            setEvents(events.filter((e) => e.id !== eventId))
            setMessage('Event deleted.')
        } catch {
            setError('Failed to delete event.')
        }
    }

    return (
        <div style={styles.subSection}>
            <div style={styles.subSectionHeader}>
                <h3 style={styles.subHeading}>Events</h3>
                <button
                    style={styles.smallButton}
                    onClick={() => { setShowCreateForm(true); setEditingEvent(null) }}
                >
                    + New Event
                </button>
            </div>

            {error && <p style={styles.error}>{error}</p>}
            {message && <p style={styles.success}>{message}</p>}

            {(showCreateForm || editingEvent) && (
                <EventForm
                    membership={membership}
                    event={editingEvent}
                    onSaved={() => {
                        setShowCreateForm(false)
                        setEditingEvent(null)
                        loadEvents()
                        setMessage('Event saved.')
                    }}
                    onCancel={() => {
                        setShowCreateForm(false)
                        setEditingEvent(null)
                    }}
                />
            )}

            {loading ? (
                <p style={styles.hint}>Loading events...</p>
            ) : events.length === 0 ? (
                <p style={styles.hint}>No events yet.</p>
            ) : (
                <div style={styles.eventsList}>
                    {events.map((event) => (
                        <div key={event.id} style={styles.manageEventCard}>
                            <div style={styles.manageEventInfo}>
                                <p style={styles.manageEventTitle}>{event.title}</p>
                                <p style={styles.manageEventDate}>
                                    {new Date(event.starts_at).toLocaleDateString('de-DE', {
                                        weekday: 'short',
                                        day: 'numeric',
                                        month: 'short',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                    })}
                                </p>
                            </div>
                            <div style={styles.manageEventActions}>
                                <button
                                    style={styles.iconButton}
                                    onClick={() => { setEditingEvent(event); setShowCreateForm(false) }}
                                >
                                    ✏️
                                </button>
                                <PhotoUploader membership={membership} eventId={event.id} />
                                <button
                                    style={{ ...styles.iconButton, color: '#DC2626' }}
                                    onClick={() => handleDelete(event.id)}
                                >
                                    🗑️
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}