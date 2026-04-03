import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FaHome, FaSeedling, FaGraduationCap, FaCog, FaQuestionCircle, FaKeyboard, FaClipboardList, FaAddressBook, FaUser, FaSignOutAlt } from 'react-icons/fa'
import Logo from '@/components/Logo/Logo'
import styles from '@dashboard/styles/DashboardNav.module.css'
import supabase from '@utils/supabase'

const navSections = [
    {
        title: 'General',
        items: [
            {
                section: 'General',
                label: 'Dashboard',
                route: '/dashboard',
                icon: <FaHome />,
                notification: {
                    enabled: true,
                    color: '#ef4444',
                    size: '0.35rem',
                },
            },
            { section: 'General', label: 'Skill Tree', route: '/dashboard/skill-tree', icon: <FaSeedling /> },
            { section: 'General', label: 'BackendTest', route: '/dashboard/test', icon: <FaAddressBook /> },
        ],
    },
    {
        title: 'Study',
        items: [
            { section: 'Study', label: 'Typing', route: '/dashboard/typing', icon: <FaKeyboard /> },
            { section: 'Study', label: 'Coding', route: '/dashboard/coding', icon: <FaGraduationCap /> },
            { section: 'Study', label: 'Quizzes', route: '/dashboard/quizzes', icon: <FaClipboardList /> },
        ],
    },
    {
        title: 'Support',
        items: [
            { section: 'Support', label: 'Settings', route: '/dashboard/settings', icon: <FaCog /> },
            { section: 'Support', label: 'Help', route: '/dashboard/help', icon: <FaQuestionCircle /> },
            { section: 'Support', label: 'Logout', route: null, icon: <FaSignOutAlt />, isLogout: true },
        ],
    },
]

export default function DashboardNav() {
    const [user, setUser] = useState(null)
    const navigate = useNavigate()

    const handleLogout = async () => {
        const { error } = await supabase.auth.signOut()
        if (error) {
            console.error('Error logging out:', error.message)
        } else {
            navigate('/login')
        }
    }

    const formatTimestamp = (value) => {
        if (!value) return 'Unknown'
        const date = new Date(value)
        if (Number.isNaN(date.getTime())) return 'Invalid date'
        return date.toLocaleString()
    }

    useEffect(() => {
        const fetchUser = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            setUser(user)
        }
        fetchUser()
    }, [])

    return (
        <aside className={styles.sidebar}>
            <Logo fontSize={'1.2rem'} />
            <nav className={styles.nav}>
                {navSections.map((section, sectionIndex) => (
                    <div key={section.title} className={styles.sectionGroup}>
                        <div className={styles.sectionTitle}>{section.title}</div>
                        {section.items.map((item) => (
                            item.isLogout ? (
                                <button key={item.label} onClick={handleLogout} className={styles.navItem} type="button">
                                    <span className={styles.iconWrapper}>
                                        <span className={styles.icon}>{item.icon}</span>
                                    </span>
                                    <span>{item.label}</span>
                                </button>
                            ) : (
                                <Link key={item.label} to={item.route} className={styles.navItem}>
                                    <span className={styles.iconWrapper}>
                                        <span className={styles.icon}>{item.icon}</span>
                                        {item.notification?.enabled && (
                                            <span
                                                className={styles.notificationDot}
                                                style={{
                                                    backgroundColor: item.notification.color || '#ef4444',
                                                    width: item.notification.size || '0.35rem',
                                                    height: item.notification.size || '0.35rem',
                                                }}
                                            />
                                        )}
                                    </span>
                                    <span>{item.label}</span>
                                </Link>
                            )
                        ))}
                        {sectionIndex < navSections.length - 1 && <div className={styles.separator} />}
                    </div>
                ))}
            </nav>

            <div className={styles.userSection}>
                <div className={styles.separator} />
                {user ? (
                    <div className={styles.userInfo}>
                        <div className={styles.userDetails}>
                            {user.user_metadata?.full_name && (
                                <span className={styles.userName}>{user.user_metadata.full_name}</span>
                            )}
                            <span className={styles.userEmail}>{user.email}</span>
                            <span className={styles.userSession}>Session started: {formatTimestamp(user.last_sign_in_at || user.created_at)}</span>
                        </div>
                    </div>
                ) : (
                    <div className={styles.userInfo}>
                        <span className={styles.userEmail}>Not logged in</span>
                    </div>
                )}
            </div>
        </aside>
    )
}
