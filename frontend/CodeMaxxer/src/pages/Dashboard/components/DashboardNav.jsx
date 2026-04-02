import { Link } from 'react-router-dom'
import { FaHome, FaSeedling, FaGraduationCap, FaCog, FaQuestionCircle, FaKeyboard, FaAddressBook } from 'react-icons/fa'
import Logo from '@/components/Logo/Logo'
import styles from '@dashboard/styles/DashboardNav.module.css'

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
            { section: 'General', label: 'Study', route: '/dashboard/study', icon: <FaGraduationCap /> },
            { section: 'General', label: 'BackendTest', route: '/dashboard/test', icon: <FaAddressBook /> },
            { section: 'General', label: 'Typing', route: '/dashboard/typing', icon: <FaKeyboard /> },
        ],
    },
    {
        title: 'Support',
        items: [
            { section: 'Support', label: 'Settings', route: '/dashboard/settings', icon: <FaCog /> },
            { section: 'Support', label: 'Help', route: '/dashboard/help', icon: <FaQuestionCircle /> },
        ],
    },
]

export default function DashboardNav() {
    return (
        <aside className={styles.sidebar}>
            <Logo fontSize={'1.2rem'} />
            <nav className={styles.nav}>
                {navSections.map((section, sectionIndex) => (
                    <div key={section.title} className={styles.sectionGroup}>
                        <div className={styles.sectionTitle}>{section.title}</div>
                        {section.items.map((item) => (
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
                        ))}
                        {sectionIndex < navSections.length - 1 && <div className={styles.separator} />}
                    </div>
                ))}
            </nav>
        </aside>
    )
}