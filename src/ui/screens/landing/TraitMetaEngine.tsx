import React from 'react';
import { motion } from 'framer-motion';
import { FlywheelDiagram } from './FlywheelDiagram';
import { ValueCards } from './ValueCards';

const Section = ({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <section style={{ 
    width: '100%', 
    padding: 'clamp(60px, 10vh, 120px) 20px', 
    display: 'flex', 
    flexDirection: 'column', 
    alignItems: 'center',
    position: 'relative',
    ...style 
  }}>
    {children}
  </section>
);

export function TraitMetaEngine({ onPlay }: { onPlay: () => void }) {
  return (
    <div style={{ background: '#050505', color: '#FFFFFE', width: '100%', overflowX: 'hidden' }}>
      
      {/* 1. Hero-style Section Opener */}
      <Section style={{ minHeight: '80vh', justifyContent: 'center', textAlign: 'center' }}>
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
        >
            <span style={{ 
                color: '#E8A444', 
                fontSize: 12, 
                fontWeight: 800, 
                letterSpacing: '0.2em', 
                textTransform: 'uppercase',
                marginBottom: 24,
                display: 'block'
            }}>
                The Trait Meta Engine activates Day 1 • Built for every blue-chip IP
            </span>
            <h2 style={{ 
                fontFamily: "'Space Grotesk', sans-serif", 
                fontSize: 'clamp(32px, 6vw, 72px)', 
                fontWeight: 800, 
                lineHeight: 1.1,
                maxWidth: 1000,
                margin: '0 auto 24px',
                background: 'linear-gradient(to right, #FFF 20%, #AAA 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
            }}>
                Static JPEGs Are Dead.<br />
                <span style={{ color: '#E8A444' }}>Welcome to the Trait Meta Engine.</span>
            </h2>
            <p style={{ 
                fontSize: 'clamp(16px, 1.5vw, 20px)', 
                color: 'rgba(255,255,254,0.6)', 
                maxWidth: 700, 
                margin: '0 auto' 
            }}>
                The first game that turns NFT traits into real economic utility and spins a perpetual volume flywheel.
            </p>
        </motion.div>
      </Section>

      {/* 2. Old World vs New World */}
      <Section style={{ background: 'linear-gradient(180deg, #050505 0%, #0A0A0A 100%)' }}>
        <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', 
            gap: 40, 
            width: '100%', 
            maxWidth: 1100,
            position: 'relative'
        }}>
            {/* Old World */}
            <motion.div 
                initial={{ x: -50, opacity: 0 }}
                whileInView={{ x: 0, opacity: 1 }}
                viewport={{ once: true, margin: "-100px" }}
                style={{ 
                    padding: 40, 
                    borderRadius: 24, 
                    background: 'rgba(220, 38, 38, 0.03)', 
                    border: '1px solid rgba(220, 38, 38, 0.1)',
                    boxShadow: 'inset 0 0 40px rgba(220, 38, 38, 0.02)',
                    position: 'relative'
                }}
            >
                <div style={{ position: 'absolute', top: 20, right: 20, fontSize: 10, fontWeight: 700, color: 'rgba(220, 38, 38, 0.4)', letterSpacing: '0.1em' }}>PAST</div>
                <h4 style={{ color: '#F87171', fontSize: 13, fontWeight: 800, marginBottom: 20, letterSpacing: '0.1em' }}>OLD WORLD: STATIC NFT MARKET</h4>
                <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <li style={{ display: 'flex', gap: 12, fontSize: 15, color: 'rgba(255,255,254,0.7)' }}>
                        <span style={{ color: '#F87171' }}>✕</span> Traits = pure visual rarity (speculation only)
                    </li>
                    <li style={{ display: 'flex', gap: 12, fontSize: 15, color: 'rgba(255,255,254,0.7)' }}>
                        <span style={{ color: '#F87171' }}>✕</span> Low trait liquidity (only floor price matters)
                    </li>
                    <li style={{ display: 'flex', gap: 12, fontSize: 15, color: 'rgba(255,255,254,0.7)' }}>
                        <span style={{ color: '#F87171' }}>✕</span> Many collections stay dead or low-volume
                    </li>
                </ul>
            </motion.div>

            {/* New World */}
            <motion.div 
                initial={{ x: 50, opacity: 0 }}
                whileInView={{ x: 0, opacity: 1 }}
                viewport={{ once: true, margin: "-100px" }}
                style={{ 
                    padding: 40, 
                    borderRadius: 24, 
                    background: 'rgba(34, 211, 238, 0.03)', 
                    border: '1px solid rgba(34, 211, 238, 0.1)',
                    boxShadow: 'inset 0 0 40px rgba(34, 211, 238, 0.02)',
                    position: 'relative'
                }}
            >
                <div style={{ position: 'absolute', top: 20, right: 20, fontSize: 10, fontWeight: 700, color: '#22D3EE', letterSpacing: '0.1em' }}>ACTIVE DAY 1</div>
                <h4 style={{ color: '#22D3EE', fontSize: 13, fontWeight: 800, marginBottom: 20, letterSpacing: '0.1em' }}>NEW WORLD: THE GAME CATALYST</h4>
                <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <li style={{ display: 'flex', gap: 12, fontSize: 15, color: 'rgba(255,255,254,0.7)' }}>
                        <span style={{ color: '#22D3EE' }}>✓</span> Classic Guess Who + NFT traits (real utility)
                    </li>
                    <li style={{ display: 'flex', gap: 12, fontSize: 15, color: 'rgba(255,255,254,0.7)' }}>
                        <span style={{ color: '#22D3EE' }}>✓</span> Betting Mode: Stake your NFT + Floor Unlock Fee
                    </li>
                    <li style={{ display: 'flex', gap: 12, fontSize: 15, color: 'rgba(255,255,254,0.7)' }}>
                        <span style={{ color: '#22D3EE' }}>✓</span> Rare/weird trait combos = Win-rate advantage
                    </li>
                </ul>
            </motion.div>

            {/* Continuous Reinforcement Arrow */}
            <motion.div 
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                style={{ 
                    gridColumn: '1 / -1', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    gap: 12,
                    marginTop: 20 
                }}
            >
                <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.15em' }}>CONTINUOUS REINFORCEMENT</div>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#22D3EE" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <motion.path 
                        d="M7 13l5 5 5-5M7 6l5 5 5-5"
                        initial={{ pathLength: 0 }}
                        whileInView={{ pathLength: 1 }}
                        transition={{ duration: 1, repeat: Infinity }}
                    />
                </svg>
            </motion.div>
        </div>
      </Section>

      {/* 3. The Volume Flywheel */}
      <Section style={{ background: '#050505' }}>
        <FlywheelDiagram />
      </Section>

      {/* 4. Market Impact & Value Creation */}
      <Section style={{ background: 'linear-gradient(180deg, #050505 0%, #080C08 100%)' }}>
        <ValueCards />
      </Section>

      {/* 5. Closing Vision Block */}
      <Section style={{ paddingBottom: 160 }}>
        <motion.div 
            initial={{ y: 40, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            style={{ 
                width: '100%', 
                maxWidth: 900, 
                padding: '60px 40px', 
                borderRadius: 32, 
                background: 'linear-gradient(135deg, rgba(167, 139, 250, 0.08) 0%, rgba(124, 58, 237, 0.05) 100%)',
                border: '1px solid rgba(167, 139, 250, 0.15)',
                textAlign: 'center',
                position: 'relative',
                overflow: 'hidden'
            }}
        >
            <div style={{ 
                position: 'absolute', inset: 0, 
                background: 'radial-gradient(circle at center, rgba(167, 139, 250, 0.1) 0%, transparent 70%)',
                pointerEvents: 'none'
            }} />
            
            <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(24px, 4vw, 42px)', fontWeight: 800, marginBottom: 24 }}>
                GuessNFT is not just a game.
            </h3>
            <p style={{ fontSize: 18, color: 'rgba(255,255,254,0.65)', lineHeight: 1.6, marginBottom: 40 }}>
                It’s the solid foundation of the future IP economy — where speculation meets real demand usage, P2E mechanics, PMF and community endeavor. This model unlocks dozens of liquid opportunity layers that currently sit dormant in the NFT space. We start with one collection and are building the rails for every major blue-chip IP to join crosschain.
            </p>

            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
                <motion.button 
                    onClick={onPlay}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    style={{ 
                        padding: '16px 32px', borderRadius: 12, background: '#E8A444', 
                        color: '#050505', fontWeight: 800, border: 'none', cursor: 'pointer' 
                    }}
                >
                    Play the Beta Now
                </motion.button>
                <motion.button 
                    whileHover={{ scale: 1.05, background: 'rgba(255,255,255,0.1)' }}
                    whileTap={{ scale: 0.95 }}
                    style={{ 
                        padding: '16px 32px', borderRadius: 12, background: 'rgba(255,255,255,0.05)', 
                        color: '#FFFFFE', fontWeight: 700, border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' 
                    }}
                >
                    For Collections & Investors — Let's Talk
                </motion.button>
            </div>
        </motion.div>
      </Section>
    </div>
  );
}
