import { useState } from 'react';
import styles from '@dashboard/styles/QuizEditor.module.css';

const LANGUAGES = [
    'haskell',
    'sqlite3',
    'forth',
    'nasm64',
    'bash',
    'fsharp.net',
    'swift',
    'ponylang',
    'crystal',
    'elixir',
    'yeethon',
    'vlang',
    'c++',
    'nasm',
    'pascal',
    'raku',
    'japt',
    'powershell',
    'jelly',
    'vyxal',
    'llvm_ir',
    'iverilog',
    'emacs',
    'lolcode',
    'python',
    'fortran',
    'typescript',
    'rockstar',
    'befunge93',
    'csharp',
    'ruby',
    'php',
    'coffeescript',
    'd',
    'lisp',
    'groovy',
    'cow',
    'julia',
    'freebasic',
    'javascript',
    'racket',
    'dart',
    'nim',
    'samarium',
    'octave',
    'fsi',
    'lua',
    'basic',
    'retina',
    'perl',
    'golfscript',
    'csharp.net',
    'emojicode',
    'kotlin',
    'husk',
    'scala',
    'paradoc',
    'zig',
    'dash',
    'awk',
    'ocaml',
    'cjam',
    'java',
    'cobol',
    'prolog',
    'rscript',
    'file',
    'forte',
    'python2',
    'erlang',
    'basic.net',
    'pure',
    'clojure',
    'smalltalk',
    'go',
    'dragon',
    'brachylog',
    'osabie',
    'bqn',
    'rust',
    'matl',
    'pyth',
    'c',
    'brainfuck',
];

const QUESTION_AMOUNTS = [5, 10, 15, 20];

const CONFIG_OPTIONS = [
    { id: 'hints', label: 'Allow Hints' },
    { id: 'explanations', label: 'Show Explanations' },
    { id: 'timing', label: 'Timed Quiz' },
    { id: 'hard', label: 'Hard Mode' }
];

export default function QuizEditor({ onGenerate, isGenerating = false, error = "" }) {
    const [language, setLanguage] = useState('python');
    const [amount, setAmount] = useState(10);
    const [configs, setConfigs] = useState(['explanations']);
    const [prompt, setPrompt] = useState('');
    const [localError, setLocalError] = useState('');

    const toggleConfig = (id) => {
        setConfigs(prev =>
            prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
        );
    };

    const handleGenerate = () => {
        const normalizedLanguage = language.trim().toLowerCase();
        if (!normalizedLanguage || !prompt.trim()) {
            setLocalError('Enter both a language and a topic before generating a quiz.');
            return;
        }
        setLocalError('');
        if (onGenerate) {
            onGenerate({ language: normalizedLanguage, amount, configs, prompt });
        }
    };

    return (
        <div className={styles.editorContainer}>
            <h2 className={styles.title}>Create Quiz</h2>

            <div className={styles.section}>
                <label className={styles.label}>Programming Language</label>
                <input
                    className={styles.searchInput}
                    type="text"
                    list="quiz-language-options"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    placeholder="Search or enter a language, e.g. python or rust"
                    autoComplete="off"
                    spellCheck={false}
                />
                <datalist id="quiz-language-options">
                    {LANGUAGES.map((lang) => (
                        <option key={lang} value={lang} />
                    ))}
                </datalist>
            </div>

            <div className={styles.section}>
                <label className={styles.label}>Number of Questions</label>
                <div className={styles.amountGrid}>
                    {QUESTION_AMOUNTS.map(num => (
                        <div
                            key={num}
                            className={`${styles.amountOption} ${amount === num ? styles.active : ''}`}
                            onClick={() => setAmount(num)}
                        >
                            {num}
                        </div>
                    ))}
                </div>
            </div>

            <div className={styles.section}>
                <label className={styles.label}>Configurations</label>
                <div className={styles.configGrid}>
                    {CONFIG_OPTIONS.map(opt => (
                        <div
                            key={opt.id}
                            className={`${styles.configOption} ${configs.includes(opt.id) ? styles.active : ''}`}
                            onClick={() => toggleConfig(opt.id)}
                        >
                            {opt.label}
                        </div>
                    ))}
                </div>
            </div>

            <div className={`${styles.section} ${styles.textareaSection}`}>
                <label className={styles.label}>Topic / Prompt</label>
                <textarea
                    className={styles.textarea}
                    placeholder="e.g. Memory Management or React Hooks..."
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                />
            </div>

            <button
                className={styles.generateBtn}
                onClick={handleGenerate}
                disabled={isGenerating}
            >
                {isGenerating ? 'Generating...' : "I'm Ready!"}
            </button>
            {(localError || error) && <p className={styles.errorText}>{localError || error}</p>}
        </div>
    );
}
