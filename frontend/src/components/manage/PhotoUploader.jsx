import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Camera, Images, Loader2 } from 'lucide-react'
import { uploadEventPhoto, getOrgEventPhotos, reuseEventPhoto } from '../../api/events'
import { mediaUrl } from '../../media'
import { styles } from './styles'

export default function PhotoUploader({ membership, eventId, onUploaded, onError }) {
    const [loading, setLoading] = useState(false)
    const [showPicker, setShowPicker] = useState(false)
    const [panelPos, setPanelPos] = useState(null)
    const [photos, setPhotos] = useState([])
    const [photosLoading, setPhotosLoading] = useState(false)
    const reuseButtonRef = useRef(null)

    const handleUpload = async (e) => {
        const file = e.target.files[0]
        if (!file) return
        setLoading(true)
        try {
            await uploadEventPhoto(membership.org_id, eventId, file)
            onUploaded?.()
        } catch {
            onError?.()
        } finally {
            setLoading(false)
        }
    }

    const openPicker = async () => {
        // Rendered in a portal so it can't be clipped by an ancestor's
        // overflow:hidden (the manage event card/list use that for layout).
        const rect = reuseButtonRef.current.getBoundingClientRect()
        setPanelPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right })
        setShowPicker(true)
        setPhotosLoading(true)
        try {
            const res = await getOrgEventPhotos(membership.org_id)
            setPhotos(res.data)
        } catch {
            onError?.()
        } finally {
            setPhotosLoading(false)
        }
    }

    const handleReuse = async (photoUrl) => {
        setShowPicker(false)
        setLoading(true)
        try {
            await reuseEventPhoto(membership.org_id, eventId, photoUrl)
            onUploaded?.()
        } catch {
            onError?.()
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={{ display: 'flex' }}>
            <label style={styles.iconButton}>
                {loading ? (
                    <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                ) : (
                    <Camera size={18} />
                )}
                <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
                <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleUpload}
                    style={{ display: 'none' }}
                />
            </label>

            <button
                ref={reuseButtonRef}
                type="button"
                style={styles.iconButton}
                onClick={openPicker}
                title="Reuse an existing photo"
            >
                <Images size={18} />
            </button>

            {showPicker && panelPos && createPortal(
                <>
                    <div style={pickerStyles.backdrop} onClick={() => setShowPicker(false)} />
                    <div style={{ ...pickerStyles.panel, top: panelPos.top, right: panelPos.right }}>
                        <p style={pickerStyles.title}>Reuse a photo</p>
                        {photosLoading ? (
                            <p style={styles.hint}>Loading photos...</p>
                        ) : photos.length === 0 ? (
                            <p style={styles.hint}>No photos uploaded yet.</p>
                        ) : (
                            <div style={pickerStyles.grid}>
                                {photos.map((photo) => (
                                    <img
                                        key={photo.photo_url}
                                        src={mediaUrl(photo.photo_url)}
                                        alt={photo.event_title}
                                        title={photo.event_title}
                                        style={pickerStyles.thumb}
                                        onClick={() => handleReuse(photo.photo_url)}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </>,
                document.body
            )}
        </div>
    )
}

const pickerStyles = {
    backdrop: {
        position: 'fixed',
        inset: 0,
        zIndex: 200,
    },
    panel: {
        position: 'fixed',
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        border: '1px solid #E3E3E4',
        boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
        padding: '12px',
        width: '220px',
        zIndex: 201,
    },
    title: {
        fontSize: '13px',
        fontWeight: '700',
        color: '#1A1C1E',
        margin: '0 0 8px 0',
    },
    grid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '6px',
        maxHeight: '220px',
        overflowY: 'auto',
    },
    thumb: {
        width: '100%',
        aspectRatio: '1',
        objectFit: 'cover',
        borderRadius: '6px',
        cursor: 'pointer',
        border: '1px solid #E3E3E4',
    },
}
