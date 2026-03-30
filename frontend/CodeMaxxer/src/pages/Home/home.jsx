import Navbar from './Components/Navbar'
import Hero from './Components/Hero'
import TheStack from './Components/TheStack'
import styles from '../../App.module.css'

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
