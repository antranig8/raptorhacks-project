import Navbar from '@/pages/Home/components/Navbar'
import Hero from '@/pages/Home/components/Hero'
import What from '@/pages/Home/components/What'
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
