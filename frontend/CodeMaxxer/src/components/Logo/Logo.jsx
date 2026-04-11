import { Link } from 'react-router-dom'
import styles from './Logo.module.css'

export default function Logo({ className = '', fontSize = '1.5rem' }) {
    return (
        <Link to="/" className={`${styles.logo} ${className}`.trim()} style={{ fontSize }}>
            CodeMaxxing
        </Link>
    )
}
