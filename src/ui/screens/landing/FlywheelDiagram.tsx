import React from 'react';
import { motion } from 'framer-motion';

export function FlywheelDiagram() {
  return (
    <div style={{ 
        width: '100%', 
        maxWidth: 800, 
        padding: '40px 20px', 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center',
        gap: 60
    }}>
        <motion.h3 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            style={{ 
                fontFamily: "'Space Grotesk', sans-serif", 
                fontSize: 32, 
                fontWeight: 800, 
                color: '#E8A444',
                textAlign: 'center',
                textShadow: '0 0 20px rgba(232,164,68,0.3)'
            }}
        >
            The Volume Flywheel
        </motion.h3>

        <div style={{ 
            position: 'relative', 
            width: '100%', 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            gap: 40 
        }}>
            {/* Top Node */}
            <FlywheelNode 
                title="Winner pays X% of floor price fee" 
                color="#E8A444" 
                delay={0.1}
            />

            <Connector delay={0.3} />

            {/* Middle Node */}
            <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.5 }}
                style={{ 
                    padding: '30px 50px', 
                    borderRadius: 20, 
                    background: 'rgba(255,255,255,0.03)', 
                    border: '1px solid rgba(255,255,255,0.1)',
                    textAlign: 'center',
                    boxShadow: '0 0 40px rgba(0,0,0,0.4)',
                    position: 'relative',
                    zIndex: 2
                }}
            >
                <div style={{ fontSize: 12, fontWeight: 800, color: 'rgba(255,255,254,0.4)', letterSpacing: '0.1em', marginBottom: 12 }}>FEE SPLIT</div>
                <div style={{ display: 'flex', gap: 40, alignItems: 'center' }}>
                    <div>
                        <div style={{ fontSize: 28, fontWeight: 800, color: '#4ADE80' }}>90%</div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,254,0.5)', fontWeight: 600 }}>Collection Treasury</div>
                        <div style={{ fontSize: 9, color: 'rgba(74,222,128,0.5)', marginTop: 4 }}>Auto-snipes floor NFTs</div>
                    </div>
                    <div style={{ width: 1, height: 40, background: 'rgba(255,255,255,0.1)' }} />
                    <div>
                        <div style={{ fontSize: 28, fontWeight: 800, color: '#FFF' }}>10%</div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,254,0.5)', fontWeight: 600 }}>Platform Treasury</div>
                    </div>
                </div>
            </motion.div>

            <Connector delay={0.7} />

            {/* Bottom Node */}
            <FlywheelNode 
                title="VOLUME FLYWHEEL" 
                subtitle="More bets → Stronger floors → More players"
                color="#E8A444" 
                delay={0.9}
                pulse
            />

            {/* Closing Loop Path (Mobile might stack, desktop could be side-curve) */}
            <svg style={{ 
                position: 'absolute', 
                top: '10%', 
                left: 'calc(50% + 140px)', 
                width: 200, 
                height: '80%', 
                overflow: 'visible',
                pointerEvents: 'none',
                display: 'none' // We'll simplify with a pulsing arrow for mobile-first
            }}>
                {/* Visual loop would be great here on desktop */}
            </svg>
            
            <motion.div 
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 1.2 }}
                style={{ 
                    fontSize: 11, 
                    fontWeight: 700, 
                    color: 'rgba(232,164,68,0.4)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 8,
                    marginTop: 20
                }}
            >
                <motion.span animate={{ x: [-5, 5, -5] }} transition={{ repeat: Infinity, duration: 2 }}>↺</motion.span> Back to reality
            </motion.div>
        </div>
    </div>
  );
}

function FlywheelNode({ title, subtitle, color, delay, pulse = false }: { title: string; subtitle?: string; color: string; delay: number; pulse?: boolean }) {
  return (
    <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ delay, type: 'spring', stiffness: 200 }}
        animate={pulse ? { boxShadow: [`0 0 20px ${color}22`, `0 0 50px ${color}44`, `0 0 20px ${color}22`] } : {}}
        style={{
            padding: '24px 32px',
            borderRadius: 16,
            background: 'rgba(0,0,0,0.8)',
            border: `1px solid ${color}44`,
            textAlign: 'center',
            position: 'relative',
            zIndex: 2,
            minWidth: 280
        }}
    >
        <div style={{ color: color, fontWeight: 800, fontSize: 16, letterSpacing: '0.02em' }}>{title}</div>
        {subtitle && <div style={{ color: 'rgba(255,255,254,0.4)', fontSize: 12, marginTop: 4 }}>{subtitle}</div>}
    </motion.div>
  );
}

function Connector({ delay }: { delay: number }) {
  return (
    <div style={{ height: 40, width: 2, position: 'relative' }}>
        <motion.div 
            initial={{ height: 0 }}
            whileInView={{ height: '100%' }}
            viewport={{ once: true }}
            transition={{ delay, duration: 0.6 }}
            style={{ 
                width: '100%', 
                background: 'linear-gradient(to bottom, #E8A444, #FFF)',
                position: 'absolute',
                top: 0,
                left: 0
            }}
        />
        <motion.div 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: delay + 0.4 }}
            style={{ 
                position: 'absolute', 
                bottom: -5, 
                left: '50%', 
                transform: 'translateX(-50%) rotate(45deg)',
                width: 8, 
                height: 8, 
                borderRight: '2px solid #FFF',
                borderBottom: '2px solid #FFF'
            }}
        />
    </div>
  );
}
