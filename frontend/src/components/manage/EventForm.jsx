import { useState } from 'react'
import { createEvent, updateEvent } from '../../api/events'
import { styles } from './styles'

// Convert an ISO UTC string to a local datetime-local input value
const toLocalInput = (isoString) => {
    if (!isoString) return ''
    const date = new Date(isoString)
    const offset = date.getTimezoneOffset()
    const local = new Date(date.getTime() - offset * 60000)
    return local.toISOString().slice(0, 16)
}

// Convert a datetime-local input value (local time) to a UTC ISO string
const toUTCString = (localString) => {
    if (!localString) return null
    return new Date(localString).toISOString()
}

export default function EventForm({ membership, event, onSaved, onCancel }) {
    const [title, setTitle] = useState(event?.title || '')
    const [description, setDescription] = useState(event?.description || '')
    const [startsAt, setStartsAt] = useState(
        event?.starts_at ? toLocalInput(event.starts_at) : ''
    )
    const [endsAt, setEndsAt] = useState(
        event?.ends_at ? toLocalInput(event.ends_at) : ''
    )
    const [location, setLocation] = useState(event?.location || '')
    const [recurrence, setRecurrence] = useState(event?.recurrence || 'none')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        // Validate ends_at is after starts_at
        if (endsAt && startsAt && new Date(endsAt) <= new Date(startsAt)) {
            setError('End time must be after start time.')
            setLoading(false)
            return
        }

        try {
            const data = {
                title,
                description: description || null,
                starts_at: toUTCString(startsAt),
                ends_at: toUTCString(endsAt),
                location: location || null,
                recurrence,
            }
            if (event) {
                await updateEvent(membership.org_id, event.id, data)
            } else {
                await createEvent(membership.org_id, data)
            }
            onSaved()
        } catch {
            setError('Failed to save event.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={styles.formBox}>
            <h4 style={styles.formTitle}>{event ? 'Edit Event' : 'New Event'}</h4>
            <form onSubmit={handleSubmit} style={styles.form}>
                <input
                    style={styles.input}
                    placeholder="Title *"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                />
                <textarea
                    style={styles.textarea}
                    placeholder="Description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                />
                <label style={styles.fieldLabel}>Start time *</label>
                <input
                    style={styles.input}
                    type="datetime-local"
                    value={startsAt}
                    onChange={(e) => setStartsAt(e.target.value)}
                    required
                />
                <label style={styles.fieldLabel}>End time (optional)</label>
                <input
                    style={styles.input}
                    type="datetime-local"
                    value={endsAt}
                    onChange={(e) => setEndsAt(e.target.value)}
                />
                <input
                    style={styles.input}
                    placeholder="Location"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                />
                <select
                    style={styles.input}
                    value={recurrence}
                    onChange={(e) => setRecurrence(e.target.value)}
                >
                    <option value="none">Does not repeat</option>
                    <option value="weekly">Every week</option>
                    <option value="biweekly">Every two weeks</option>
                    <option value="monthly">Every month</option>
                </select>
                {error && <p style={styles.error}>{error}</p>}
                <div style={styles.row}>
                    <button style={styles.button} type="submit" disabled={loading}>
                        {loading ? 'Saving...' : 'Save'}
                    </button>
                    <button
                        style={styles.secondaryButton}
                        type="button"
                        onClick={onCancel}
                    >
                        Cancel
                    </button>
                </div>
            </form>
        </div>
    )
}