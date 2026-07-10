import { useState } from 'react'
import { inviteAdmin, removeAdmin, getOrgMemberships } from '../../api/organizations'
import { styles } from './styles'

export default function AdminManager({ membership }) {
    const [admins, setAdmins] = useState([])
    const [loadingAdmins, setLoadingAdmins] = useState(false)
    const [adminsVisible, setAdminsVisible] = useState(false)
    const [email, setEmail] = useState('')
    const [role, setRole] = useState('org_admin')
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState(null)
    const [error, setError] = useState(null)

    // FUTURE UPDATE
    // const toggleAdmins = async () => {
    //     if (!adminsVisible && admins.length === 0) {
    //         // Only fetch when opening for the first time
    //         setLoadingAdmins(true)
    //         try {
    //             const res = await getOrgMemberships(membership.org_id)
    //             setAdmins(res.data)
    //         } catch {
    //             setError('Failed to load admins.')
    //         } finally {
    //             setLoadingAdmins(false)
    //         }
    //     }
    //     setAdminsVisible(!adminsVisible)
    // }

    const handleInvite = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        setMessage(null)
        try {
            await inviteAdmin(membership.org_id, email, role)
            setMessage(`${role === 'boss_admin' ? 'Boss admin' : 'Admin'} invited successfully.`)
            setEmail('')
            // Refresh the list if it is visible
            if (adminsVisible) {
                const res = await getOrgMemberships(membership.org_id)
                setAdmins(res.data)
            }
        } catch (err) {
            if (err.response?.status === 404) {
                setError('User not found — they must log in to the app first.')
            } else if (err.response?.status === 400) {
                setError('This user is already an admin of this organisation.')
            } else {
                setError('Failed to invite admin.')
            }
        } finally {
            setLoading(false)
        }
    }

    const handleRemove = async (userId) => {
        if (!window.confirm('Remove this admin?')) return
        try {
            await removeAdmin(membership.org_id, userId)
            setAdmins(admins.filter((a) => a.user_id !== userId))
            setMessage('Admin removed.')
        } catch {
            setError('Failed to remove admin.')
        }
    }

    const getDisplayName = (admin) => {
        if (admin.first_name || admin.last_name) {
            return `${admin.first_name || ''} ${admin.last_name || ''}`.trim()
        }
        return admin.email
    }

    return (
        <div style={styles.subSection}>
            <h3 style={styles.subHeading}>Admin Management</h3>

            {error && <p style={styles.error}>{error}</p>}
            {message && <p style={styles.success}>{message}</p>}


            {/* Collapsible admins list */}
            <button
                style={styles.toggleButton}
                onClick={toggleAdmins}
            >
                {adminsVisible ? '▲ Hide Admins' : '▼ Show Admins'}
            </button>

            {adminsVisible && (
                <div style={styles.adminsList}>
                    {loadingAdmins ? (
                        <p style={styles.hint}>Loading admins...</p>
                    ) : admins.length === 0 ? (
                        <p style={styles.hint}>No admins yet.</p>
                    ) : (
                        admins.map((admin) => (
                            <div key={admin.user_id} style={styles.adminCard}>
                                <div style={styles.adminInfo}>
                                    <p style={styles.adminName}>{getDisplayName(admin)}</p>
                                    <p style={styles.adminEmail}>{admin.email}</p>
                                    <span style={styles.adminRoleBadge}>
                                        {admin.role === 'boss_admin' ? 'Boss Admin' : 'Org Admin'}
                                    </span>
                                </div>
                                <button
                                    style={styles.removeButton}
                                    onClick={() => handleRemove(admin.user_id)}
                                >
                                    Remove
                                </button>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Invite form */}
            <h4 style={{ ...styles.formTitle, marginTop: '16px' }}>Invite Admin</h4>
            <form onSubmit={handleInvite} style={styles.form}>
                <input
                    style={styles.input}
                    placeholder="User email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />
                <select
                    style={styles.input}
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                >
                    <option value="org_admin">Org Admin</option>
                    <option value="boss_admin">Boss Admin</option>
                </select>
                <button style={styles.button} type="submit" disabled={loading}>
                    {loading ? 'Inviting...' : 'Invite Admin'}
                </button>
            </form>
        </div>
    )
}