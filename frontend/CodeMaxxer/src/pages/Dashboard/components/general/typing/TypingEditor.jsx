import { useState } from 'react';
import styles from '@dashboard/styles/TypingEditor.module.css';

const LANGUAGES = [
    { id: 'javascript', label: 'JavaScript' },
    { id: 'python', label: 'Python' },
    { id: 'cpp', label: 'C++' },
    { id: 'java', label: 'Java' },
    { id: 'html/css', label: 'HTML/CSS' },
    { id: 'typescript', label: 'TypeScript' }
];

const DURATIONS = [30, 60, 120];

export default function TypingEditor({ onStart }) {
    const [language, setLanguage] = useState(LANGUAGES[0].id);
    const [duration, setDuration] = useState(60);
    const [topic, setTopic] = useState('');
    const [customWords, setCustomWords] = useState('');

    const handleStart = () => {
        if (onStart) {
            onStart({ 
                language, 
                duration, 
                topic, 
                customWords: customWords.split(',').map(w => w.trim()).filter(w => w !== '')
            });
        }
    };

    return (
        <div className={styles.editorContainer}>
            <h2 className={styles.title}>Typing Practice</h2>

            <div className={styles.section}>
                <label className={styles.label}>Language Preset</label>
                <select
                    className={styles.select}
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                >
                    {LANGUAGES.map(lang => (
                        <option key={lang.id} value={lang.id}>{lang.label}</option>
                    ))}
                </select>
            </div>

            <div className={styles.section}>
                <label className={styles.label}>Duration (seconds)</label>
                <div className={styles.grid3}>
                    {DURATIONS.map(d => (
                        <div
                            key={d}
                            className={`${styles.option} ${duration === d ? styles.active : ''}`}
                            onClick={() => setDuration(d)}
                        >
                            {d}s
                        </div>
                    ))}
                </div>
            </div>

            <hr className={styles.spacer} />

            <div className={styles.section}>
                <label className={styles.label}>AI Topic Generation (Optional)</label>
                <textarea
                    className={styles.textarea}
                    placeholder="e.g. Asynchronous programming in JS, or Binary search trees..."
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                />
            </div>

            <div className={styles.lastSection}>
                <label className={styles.label}>Must-include Words (Optional)</label>
                <textarea
                    className={styles.textarea}
                    placeholder="e.g. async, await, promise, fetch..."
                    value={customWords}
                    onChange={(e) => setCustomWords(e.target.value)}
                />
            </div>

            <button
                className={styles.generateBtn}
                onClick={handleStart}
            >
                Start Typing
            </button>
        </div>
    );
}
