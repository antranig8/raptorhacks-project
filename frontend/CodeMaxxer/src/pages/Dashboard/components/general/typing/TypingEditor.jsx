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

export default function TypingEditor({ onStart, isTablet }) {
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

    if (isTablet) {
        return (
            <div className={styles.tabletEditorContainer}>
                <div className={styles.tabletGrid}>
                    <div className={styles.tabletCol}>
                        <div className={styles.tabletSection}>
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

                        <div className={styles.tabletSection}>
                            <label className={styles.label}>Duration (seconds)</label>
                            <select
                                className={styles.select}
                                value={duration}
                                onChange={(e) => setDuration(Number(e.target.value))}
                            >
                                {DURATIONS.map(d => (
                                    <option key={d} value={d}>{d}s</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className={styles.tabletCol}>
                        <div className={styles.tabletSection}>
                            <label className={styles.label}>AI Topic Generation</label>
                            <textarea
                                className={styles.textarea}
                                placeholder="e.g. JS Async..."
                                value={topic}
                                onChange={(e) => setTopic(e.target.value)}
                            />
                        </div>

                        <div className={styles.tabletSection}>
                            <label className={styles.label}>Must-include Words</label>
                            <textarea
                                className={styles.textarea}
                                placeholder="e.g. async, await..."
                                value={customWords}
                                onChange={(e) => setCustomWords(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
                <div className={styles.tabletBtnCenter}>
                    <button
                        className={styles.tabletGenerateBtn}
                        onClick={handleStart}
                    >
                        Start
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.editorContainer}>
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
