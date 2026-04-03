import { useState, useRef } from 'react'
import styles from '@dashboard/styles/Typing.module.css'
import TextArea from '@d_general/typing/TextArea'
import TypingEditor from './TypingEditor'

export default function Typing() {
    const keyboard = useRef(null)
    const [input, setInput] = useState('')
    const [isTopActive, setIsTopActive] = useState(false)

    const handleStart = (config) => {
        console.log('Starting typing with config:', config);
    };

    const practiceTemplate = 'hello world'

    return (
        <section className={styles.container}>
            <div className={styles.leftColumn}>
                <div className={`${styles.typingArea} ${isTopActive ? styles.active : ''}`}>
                    <h1>Practice Typing</h1>
                    <TextArea
                        target={practiceTemplate}
                        onChange={setInput}
                        onActiveChange={setIsTopActive}
                    />
                </div>
                <div className={styles.analyticsArea}>
                    <p>Analytics</p>
                </div>
            </div>
            <div className={styles.rightColumn}>
                <TypingEditor onStart={handleStart} />
            </div>
        </section>
    )
}
