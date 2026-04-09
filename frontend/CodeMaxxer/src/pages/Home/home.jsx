import Navbar from '@/pages/Home/Components/Navbar'
import Hero from '@/pages/Home/Components/Hero'
import OurPurpose from '@/pages/Home/Components/OurPurpose'
import What from '@/pages/Home/Components/What'
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
