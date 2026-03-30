import { useState, useRef } from 'react'
import styles from '@dashboard/styles/Typing.module.css'
import TextArea from './TextArea'

export default function Typing() {
    const keyboard = useRef(null)
    const [input, setInput] = useState('')
    const [isTopActive, setIsTopActive] = useState(false)

    const practiceTemplate = 'hello world'

    return (
        <section className={styles.container}>
            <div className={styles.top}>
                <div className={`${styles.topMain} ${isTopActive ? styles.active : ''}`}>
                    <h1>Practice Typing</h1>
                    <TextArea
                        target={practiceTemplate}
                        onChange={setInput}
                        onActiveChange={setIsTopActive}
                    />
                </div>
                <div className={styles.topSide}>
                    <p>Right panel (30%) for controls.</p>
                </div>
            </div>
            <div className={styles.bottom}>
                <p>Analytics</p>
            </div>
        </section>
    )
}
