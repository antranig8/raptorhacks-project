import Navbar from '@home/Components/Navbar'
import Hero from '@home/Components/Hero'
import styles from '@/App.module.css'

function Home() {
    return (
        <>
            <Navbar />
            <div className={styles.homePageContent}>
                <Hero />
            </div>
        </>
    )
}

export default Home
