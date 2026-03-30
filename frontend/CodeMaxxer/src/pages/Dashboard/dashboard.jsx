import DashboardNav from './components/DashboardNav'
import styles from './styles/dashboard.module.css'

export default function Dashboard() {
    return (
        <div className={styles.page}>
            <DashboardNav />
            <main className={styles.content}>
                <header className={styles.header}>
                    <h1>Dashboard</h1>
                    <p>Welcome to your CodeMaxxer dashboard. Bypass is now routed here.</p>
                </header>

                <section className={styles.card}>
                    <h2>Quick Actions</h2>
                    <p>Use this page as your starting point for stats, tools, and insights.</p>
                </section>
            </main>
        </div>
    )
}
