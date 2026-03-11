import React from 'react';
import { motion } from 'framer-motion';

const IMPACT_CARDS = [
  {
    title: 'Trait Premiums',
    desc: 'Players chase & pay premium for anti-guess trait builds.',
    stat: '+15–40% instantly',
    icon: '🎯'
  },
  {
    title: 'Trait Sub-markets',
    desc: 'Niche trait combinations explode in value as players optimize win-rates.',
    stat: '+25–50%',
    icon: '📈'
  },
  {
    title: 'Liquidity Uplift',
    desc: 'Entire collections gain real liquidity — floor prices rise with gamified volume.',
    stat: '+20–60% Floors',
    icon: '⚡'
  },
  {
    title: 'Discovery Layers',
    desc: 'New opportunities emerge (trait lending, meta trading, price discovery).',
    stat: 'Day 1 Utility',
    icon: '💎'
  }
];

export function ValueCards() {
  return (
    <div style={{ width: '100%', maxWidth: 1100 }}>
        <div style={{ textAlign: 'center', marginBottom: 60 }}>
            <h3 style={{ 
                fontFamily: "'Space Grotesk', sans-serif", 
                fontSize: 32, 
                fontWeight: 800, 
                color: '#4ADE80',
                marginBottom: 16
            }}>
                Market Impact & Value Creation
            </h3>
            <p style={{ color: 'rgba(255,255,254,0.4)', fontSize: 16 }}>
                Turning non-productive assets into yield-bearing game pieces
            </p>
        </div>

        <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', 
            gap: 24 
        }}>
            {IMPACT_CARDS.map((card, i) => (
                <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    whileHover={{ y: -5, background: 'rgba(74, 222, 128, 0.05)', border: '1px solid rgba(74, 222, 128, 0.2)' }}
                    style={{
                        padding: 32,
                        borderRadius: 24,
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 16,
                        transition: 'all 0.3s ease'
                    }}
                >
                    <div style={{ fontSize: 28 }}>{card.icon}</div>
                    <div>
                        <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 8 }}>{card.title}</div>
                        <div style={{ fontSize: 14, color: 'rgba(255,255,254,0.5)', lineHeight: 1.5, marginBottom: 16 }}>{card.desc}</div>
                    </div>
                    <div style={{ marginTop: 'auto' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#4ADE80', letterSpacing: '0.05em' }}>EST. IMPACT</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: '#4ADE80' }}>{card.stat}</div>
                    </div>
                </motion.div>
            ))}
        </div>
    </div>
  );
}
