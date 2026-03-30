import { Outlet } from 'react-router-dom'
import DashboardNav from './components/DashboardNav'
import styles from '@dashboard/styles/dashboard.module.css'

export default function Dashboard() {
    return (
        <div className={styles.page}>
            <DashboardNav />
            <main className={styles.content}>
                <Outlet />
            </main>
        </div>
    )
}
