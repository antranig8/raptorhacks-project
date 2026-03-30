import styles from '@home/styles/Navbar.module.css'
import useInViewAnimation from '@/hooks/useInViewAnimation'

function Navbar() {
  const { ref, isVisible } = useInViewAnimation({ threshold: 0.1, rootMargin: '0px 0px -40px 0px' })

  return (
    <nav ref={ref} className={`${styles.navbar} ${isVisible ? styles.visible : styles.hidden}`}>
      <div className={styles.leftGroup}>
        <a href="/" className={styles.logo}>CodeMaxxer</a>
      </div>
      <div className={styles.centerGroup}>
        <button className={styles.navButton}>Home</button>
        <button className={styles.navButton}>Our Purpose</button>
        <button className={styles.navButton}>The Team</button>
      </div>
      <div className={styles.rightGroup}>
        <button className={styles.ctaButton}>
          Get Started <span className={styles.ctaArrow}>→</span>
        </button>
      </div>
    </nav>
  )
}

export default Navbar
