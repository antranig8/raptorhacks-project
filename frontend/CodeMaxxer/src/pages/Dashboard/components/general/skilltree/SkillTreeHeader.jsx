import React from 'react';
import styles from '@dashboard/styles/SkillTreeHeader.module.css';

export default function SkillTreeHeader({ onZoomIn, onZoomOut, onReset, onUndo, onRedo, onTreesClick }) {
    return (
        <div className={styles.headerContainer}>
            <h2 className={styles.title}>Skill Tree</h2>
            <div className={styles.controls}>
                <button className={styles.controlButton} onClick={onUndo} title="Undo (Ctrl+Z)">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 7v6h6"></path>
                        <path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13"></path>
                    </svg>
                </button>
                <button className={styles.controlButton} onClick={onRedo} title="Redo (Ctrl+Y)">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 7v6h-6"></path>
                        <path d="M3 17a9 9 0 019-9 9 9 0 016 2.3l3 2.7"></path>
                    </svg>
                </button>
                <div className={styles.divider}></div>
                <button className={styles.controlButton} onClick={onZoomIn} title="Zoom In">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        <line x1="11" y1="8" x2="11" y2="14"></line>
                        <line x1="8" y1="11" x2="14" y2="11"></line>
                    </svg>
                </button>
                <button className={styles.controlButton} onClick={onZoomOut} title="Zoom Out">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        <line x1="8" y1="11" x2="14" y2="11"></line>
                    </svg>
                </button>
                <button className={styles.controlButton} onClick={onReset} title="Reset View">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
                        <polyline points="3 3 3 8 8 8"></polyline>
                    </svg>
                </button>
                <div className={styles.divider}></div>
                <button className={`${styles.controlButton} ${styles.textButton}`} onClick={onTreesClick} title="View saved trees">
                    Trees
                </button>
            </div>
        </div>
    );
}
