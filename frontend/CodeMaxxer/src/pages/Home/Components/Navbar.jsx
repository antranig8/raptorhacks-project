import styles from '@home/styles/Navbar.module.css'

function Navbar() {
  return (
    <nav className={styles.navbar}>
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
