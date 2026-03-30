import Navbar from '@home/Components/Navbar'
import Hero from '@home/Components/Hero'
import What from '@home/Components/What'
import styles from '@/App.module.css'

function Home() {
    return (
        <>
            <Navbar />
            <div className={styles.homePageContent}>
                <Hero />
                <What />
            </div>
        </>
    )
}

export default Home
