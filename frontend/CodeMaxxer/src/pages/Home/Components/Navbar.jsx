import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FaBars, FaTimes } from 'react-icons/fa'
import Logo from '@/components/Logo/Logo'
import styles from '@home/styles/Navbar.module.css'
import useInViewAnimation from '@/hooks/useInViewAnimation'

function Navbar() {
  const { ref, isVisible } = useInViewAnimation({ threshold: 0.1, rootMargin: '0px 0px -40px 0px' })
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)

  const toggleMenu = () => setIsOpen(!isOpen)

  return (
    <nav ref={ref} className={`${styles.navbar} ${isVisible ? styles.visible : styles.hidden}`}>
      <div className={styles.leftGroup}>
        <Logo />
      </div>

      <div className={styles.centerGroup}>
        {/* <button className={styles.navButton}>Home</button>
        <button className={styles.navButton}>Our Purpose</button>
        <button className={styles.navButton}>The Team</button> */}
      </div>

      <div className={styles.rightGroup}>
        <button className={styles.ctaButton} onClick={() => navigate('/login')}>
          Get Started <span className={styles.ctaArrow}>→</span>
        </button>
      </div>

      <button className={`${styles.menuIcon} ${isOpen ? styles.isOpen : ''}`} onClick={toggleMenu} aria-label="Toggle menu">
        {isOpen ? <FaTimes /> : <FaBars />}
      </button>

      <div className={`${styles.mobileMenu} ${isOpen ? styles.menuVisible : styles.menuHidden}`}>
        {/* <button className={styles.navButton} onClick={() => setIsOpen(false)}>Home</button>
        <button className={styles.navButton} onClick={() => setIsOpen(false)}>Our Purpose</button>
        <button className={styles.navButton} onClick={() => setIsOpen(false)}>The Team</button> */}
        <button className={styles.ctaButton} onClick={() => { setIsOpen(false); navigate('/login'); }}>
          Get Started <span className={styles.ctaArrow}>→</span>
        </button>
      </div>
    </nav>
  )
}

export default Navbar
