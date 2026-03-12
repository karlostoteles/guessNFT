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
    <div style={{ background: '#050505', color: '#FFFFFE', width: '100%', overflowX: 'hidden', paddingTop: 60 }}>
      
      {/* 1. Hero-style Section Opener */}
      <Section style={{ minHeight: '80vh', justifyContent: 'center', textAlign: 'center' }}>
        <motion.div
            animate={{ opacity: 1, scale: 1 }}
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
                TRAIT META ENGINE
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
                NFTs aren't dead,<br />
                <span style={{ color: '#E8A444' }}>they were just waiting for us.</span>
            </h2>
            <p style={{ 
                fontSize: 'clamp(16px, 1.5vw, 20px)', 
                color: 'rgba(255,255,254,0.6)', 
                maxWidth: 700, 
                margin: '0 auto 16px' 
            }}>
                The first game that turns NFT traits into real economic utility and spins a perpetual volume flywheel.
            </p>
            <div style={{ 
                fontFamily: "'Space Grotesk', sans-serif", 
                fontSize: 12, 
                fontWeight: 700, 
                color: 'rgba(255,255,254,0.3)', 
                letterSpacing: '0.1em',
                maxWidth: 600,
                margin: '0 auto'
            }}>
                ZK private end to end. Using Dojo, Cairo, Noir and Garaga to make this game terribly possible.
            </div>
        </motion.div>
      </Section>

      {/* 2. Old World vs New World */}
      <Section style={{ background: 'linear-gradient(180deg, #050505 0%, #0A0A0A 100%)' }}>
        <div style={{ 
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            alignItems: 'stretch',
            gap: 40, 
            width: '100%', 
            maxWidth: 1100,
            margin: '0 auto',
            position: 'relative'
        }}>
            {/* Old World */}
            <motion.div 
                animate={{ x: 0, opacity: 1 }}
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
                animate={{ x: 0, opacity: 1 }}
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
                        <span style={{ color: '#22D3EE' }}>✓</span> Betting Mode: Stake your NFT + Winner Unlock Fee
                    </li>
                    <li style={{ display: 'flex', gap: 12, fontSize: 15, color: 'rgba(255,255,254,0.7)' }}>
                        <span style={{ color: '#22D3EE' }}>✓</span> Rare/weird trait combos = Win-rate advantage
                    </li>
                </ul>
            </motion.div>

            {/* Continuous Reinforcement Arrow */}
            <motion.div 
                animate={{ opacity: 1, scale: 1 }}
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

      {/* 4. Market Impact & Value Creation */}
      <Section style={{ background: 'linear-gradient(180deg, #050505 0%, #080C08 100%)' }}>
        <ValueCards />
      </Section>

      {/* 3. The Volume Flywheel */}
      <Section style={{ background: '#050505' }}>
        <FlywheelDiagram />
      </Section>

      {/* 5. Closing Vision Block */}
      <Section style={{ paddingBottom: 160 }}>
        <motion.div 
            animate={{ y: 0, opacity: 1 }}
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
                Not just a game.
            </h3>
            <p style={{ fontSize: 18, color: 'rgba(255,255,254,0.65)', lineHeight: 1.6, marginBottom: 40 }}>
                Solid IP Foundation economy. Where speculation meets real demand usage, P2E mechanics, PMF and community endeavor. Making liquid assets that currently sit dormant in the space, we are building the rails for every major blue-chip IP.
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
                    onClick={() => window.open('https://x.com/carldlfr', '_blank')}
                    whileHover={{ scale: 1.05, background: 'rgba(255,255,255,0.1)' }}
                    whileTap={{ scale: 0.95 }}
                    style={{ 
                        padding: '16px 32px', borderRadius: 12, background: 'rgba(255,255,255,0.05)', 
                        color: '#FFFFFE', fontWeight: 700, border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' 
                    }}
                >
                    For Collections & Partnerships — Let's Talk
                </motion.button>
            </div>
        </motion.div>
      </Section>

      {/* 6. Legal & Social Footer overlay */}
      <footer style={{ 
        width: '100%', 
        padding: '60px 20px', 
        borderTop: '1px solid rgba(255,255,255,0.05)',
        background: '#050505',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 32
      }}>
        <motion.div 
          whileHover={{ scale: 1.1 }}
          style={{ cursor: 'pointer' }}
          onClick={() => window.open('https://x.com/carldlfr', '_blank')}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="#FFFFFE">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.045 4.126H5.078z"/>
          </svg>
        </motion.div>

        <div style={{ textAlign: 'center', maxWidth: 800 }}>
            <div style={{ 
                fontFamily: "'Space Grotesk', sans-serif", 
                fontSize: 12, 
                fontWeight: 700, 
                color: 'rgba(255,255,254,0.3)', 
                letterSpacing: '0.1em',
                marginBottom: 16
            }}>
                ZK private end to end. Using Dojo, Cairo, Noir and Garaga to make this game terribly possible.
            </div>
          <div style={{ 
            fontSize: 11, 
            color: 'rgba(255,255,254,0.15)', 
            lineHeight: 1.6 
          }}>
            © 2026 GuessNFT™. All rights reserved. GuessNFT, Trait Meta Engine and registered marks are trademarks of the protocol. 
            NFT assets remain property of their respective IP holders. Experimental software. Use at your own risk.
          </div>
        </div>
      </footer>
    </div>
  );
}
