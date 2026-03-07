import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { sfx } from '@/shared/audio/sfx';
import { useTranslation } from 'react-i18next';

interface LeaderboardEntry {
    address: string;
    wins: number;
}

interface LeaderboardScreenProps {
    onBack: () => void;
}

export function LeaderboardScreen({ onBack }: LeaderboardScreenProps) {
    const { t } = useTranslation();
    const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // In a real Vercel KV setup, this will fetch from the actual DB endpoint.
        // For now, checking the route we're about to build.
        fetch('/api/leaderboard')
            .then(res => res.json())
            .then(data => {
                setEntries(data.entries || []);
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to load leaderboard:", err);
                setLoading(false);
            });
    }, []);

    return (
        <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ type: 'spring', stiffness: 260, damping: 28 }}
            style={{
                position: 'fixed', inset: 0,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                background: 'radial-gradient(ellipse at center, rgba(15,14,23,0.7) 0%, rgba(15,14,23,0.98) 80%)',
                padding: 24, zIndex: 50,
            }}
        >
            <div style={{ width: 'min(520px, 100%)', display: 'flex', flexDirection: 'column', height: '100%', maxHeight: 600 }}>

                {/* Header */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.08)'
                }}>
                    <motion.button
                        onClick={() => { sfx.click(); onBack(); }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        style={{
                            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
                            borderRadius: 10, padding: '8px 14px', cursor: 'pointer', outline: 'none',
                            color: 'rgba(255,255,254,0.6)', fontFamily: "'Space Grotesk', sans-serif",
                            fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
                        }}
                    >
                        ← {t('menu.back', 'Back')}
                    </motion.button>
                    <span style={{
                        fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 800,
                        color: '#E8A444', textShadow: '0 0 12px rgba(232,164,68,0.4)',
                    }}>
                        🏆 LEADERBOARD
                    </span>
                </div>

                {/* List Body */}
                <div style={{
                    flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10,
                    paddingRight: 8,
                }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', marginTop: 40, fontFamily: "'Space Grotesk', sans-serif" }}>
                            Loading rankings...
                        </div>
                    ) : entries.length === 0 ? (
                        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', marginTop: 40, fontFamily: "'Space Grotesk', sans-serif" }}>
                            No matches played yet.
                        </div>
                    ) : (
                        entries.map((entry, index) => (
                            <motion.div
                                key={entry.address}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                                style={{
                                    background: index === 0 ? 'rgba(232,164,68,0.15)' : index === 1 ? 'rgba(167,139,250,0.1)' : 'rgba(255,255,255,0.03)',
                                    border: `1px solid ${index === 0 ? 'rgba(232,164,68,0.4)' : index === 1 ? 'rgba(167,139,250,0.3)' : 'rgba(255,255,255,0.06)'}`,
                                    borderRadius: 12, padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                    <span style={{
                                        fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 800,
                                        color: index === 0 ? '#E8A444' : index === 1 ? '#A78BFA' : 'rgba(255,255,255,0.3)',
                                        width: 24, textAlign: 'center'
                                    }}>
                                        {index + 1}
                                    </span>
                                    <span style={{ fontFamily: 'monospace', fontSize: 14, color: '#FFFFFE', opacity: 0.9 }}>
                                        {entry.address.slice(0, 6)}...{entry.address.slice(-4)}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 800, color: '#4ADE80' }}>
                                        {entry.wins}
                                    </span>
                                    <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 11, fontWeight: 700, color: 'rgba(74,222,128,0.5)', textTransform: 'uppercase' }}>
                                        WINS
                                    </span>
                                </div>
                            </motion.div>
                        ))
                    )}
                </div>
            </div>
        </motion.div>
    );
}
