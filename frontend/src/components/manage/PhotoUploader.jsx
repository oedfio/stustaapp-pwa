import { useState } from 'react'
import { Camera, Loader2 } from 'lucide-react'
import { uploadEventPhoto } from '../../api/events'
import { styles } from './styles'

export default function PhotoUploader({ membership, eventId }) {
    const [loading, setLoading] = useState(false)

    const handleUpload = async (e) => {
        const file = e.target.files[0]
        if (!file) return
        setLoading(true)
        try {
            await uploadEventPhoto(membership.org_id, eventId, file)
        } catch {
            alert('Failed to upload photo.')
        } finally {
            setLoading(false)
        }
    }

    return (
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
    )
}