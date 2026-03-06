/**
 * LandingPage — placeholder for the marketing landing page.
 * 
 * This component is a placeholder for another agent/developer to build
 * the full landing page. It currently redirects to the game.
 * 
 * To develop the landing page:
 * 1. Edit this file with your landing page design
 * 2. The game itself is available at /play (see App.tsx routing)
 * 3. Use the existing design system: Space Grotesk font, #0f0e17 bg, #E8A444 accent
 */

import { useEffect } from 'react';

export function LandingPage() {
    // For now, auto-redirect to the game
    useEffect(() => {
        // Remove this redirect once the landing page is built
        window.location.hash = '#/play';
    }, []);

    return (
        <div style={{
            width: '100vw',
            height: '100vh',
            background: '#0f0e17',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: "'Space Grotesk', sans-serif",
            color: '#FFFFFE',
        }}>
            <div style={{ textAlign: 'center' }}>
                <img src="/logo.png" alt="guessNFT" style={{ width: 200, marginBottom: 24 }} />
                <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 8 }}>
                    Guess right, win big.
                </h1>
                <p style={{ color: 'rgba(255,255,254,0.5)', marginBottom: 32 }}>
                    Loading game...
                </p>
            </div>
        </div>
    );
}
