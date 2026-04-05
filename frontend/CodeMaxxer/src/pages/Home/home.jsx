import Navbar from '@/pages/Home/components/Navbar'
import Hero from '@/pages/Home/components/Hero'
import OurPurpose from '@/pages/Home/components/OurPurpose'
import What from '@/pages/Home/components/What'
import styles from '@/App.module.css'

function Home() {
    return (
        <>
            <Navbar />
            <div className={styles.homePageContent}>
                <Hero />
                <OurPurpose />
                <What />
            </div>
        </>
    )
}

export default Home
