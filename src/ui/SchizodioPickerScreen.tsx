/**
 * Schizodio picker — shown when a player has NFTs and clicks "Play for Real".
 * Displays owned NFTs as a grid; player selects one to play as their secret character.
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { SchizodioNFT } from '../starknet/types';
import { sfx } from '../audio/sfx';

interface SchizodioPickerScreenProps {
  nfts: SchizodioNFT[];
  onSelect: (nft: SchizodioNFT) => void;
  onBack: () => void;
}

export function SchizodioPickerScreen({ nfts, onSelect, onBack }: SchizodioPickerScreenProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const handleSelect = (nft: SchizodioNFT) => {
    sfx.click();
    onSelect(nft);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        pointerEvents: 'auto',
        zIndex: 30,
        background: 'radial-gradient(ellipse at center, rgba(15,14,23,0.7) 0%, rgba(15,14,23,0.97) 70%)',
        overflowY: 'auto',
        padding: '40px 24px',
      }}
    >
      {/* Header */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        style={{ textAlign: 'center', marginBottom: 32 }}
      >
        {/* Back button */}
        <motion.button
          onClick={() => { sfx.click(); onBack(); }}
          whileHover={{ x: -3 }}
          style={{
            position: 'absolute',
            left: 24,
            top: 24,
            background: 'none',
            border: 'none',
            color: 'rgba(255,255,254,0.4)',
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 600,
            fontSize: 14,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 12px',
          }}
        >
          ← Back
        </motion.button>

        <div style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: 28,
          fontWeight: 800,
          background: 'linear-gradient(135deg, #A78BFA 0%, #7C3AED 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: 6,
        }}>
          Choose your Schizodio
        </div>
        <div style={{
          fontSize: 14,
          color: 'rgba(255,255,254,0.4)',
        }}>
          This will be your secret character — your opponent must guess who you are
        </div>
        <div style={{
          marginTop: 8,
          fontSize: 12,
          color: 'rgba(167,139,250,0.5)',
        }}>
          {nfts.length} SCHIZODIO{nfts.length !== 1 ? 'S' : ''} in wallet
        </div>
      </motion.div>

      {/* NFT Grid */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: 12,
          width: '100%',
          maxWidth: 720,
        }}
      >
        {nfts.map((nft, i) => (
          <NFTCard
            key={nft.tokenId}
            nft={nft}
            index={i}
            isHovered={hoveredId === nft.tokenId}
            onHover={(id) => setHoveredId(id)}
            onSelect={handleSelect}
          />
        ))}
      </motion.div>
    </motion.div>
  );
}

function NFTCard({
  nft,
  index,
  isHovered,
  onHover,
  onSelect,
}: {
  nft: SchizodioNFT;
  index: number;
  isHovered: boolean;
  onHover: (id: string | null) => void;
  onSelect: (nft: SchizodioNFT) => void;
}) {
  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.03, type: 'spring', stiffness: 300, damping: 25 }}
      onClick={() => onSelect(nft)}
      onMouseEnter={() => onHover(nft.tokenId)}
      onMouseLeave={() => onHover(null)}
      style={{
        background: isHovered
          ? 'linear-gradient(135deg, rgba(124,58,237,0.25), rgba(91,33,182,0.2))'
          : 'rgba(255,255,255,0.04)',
        border: isHovered
          ? '1px solid rgba(124,58,237,0.6)'
          : '1px solid rgba(255,255,255,0.08)',
        borderRadius: 12,
        padding: 0,
        cursor: 'pointer',
        overflow: 'hidden',
        textAlign: 'left',
        transition: 'background 0.2s, border-color 0.2s, box-shadow 0.2s',
        boxShadow: isHovered
          ? '0 0 24px rgba(124,58,237,0.2)'
          : 'none',
      }}
    >
      {/* NFT Image */}
      <div style={{
        width: '100%',
        aspectRatio: '1',
        background: 'rgba(255,255,255,0.03)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {nft.imageUrl ? (
          <img
            src={nft.imageUrl}
            alt={nft.name}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
              filter: isHovered ? 'brightness(1.1)' : 'brightness(1)',
              transition: 'filter 0.2s, transform 0.3s',
              transform: isHovered ? 'scale(1.05)' : 'scale(1)',
            }}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          /* Placeholder if no image */
          <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 32,
            color: 'rgba(255,255,254,0.15)',
          }}>
            🎭
          </div>
        )}

        {/* Selection shimmer overlay */}
        <AnimatePresence>
          {isHovered && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(135deg, rgba(124,58,237,0.15), transparent)',
                pointerEvents: 'none',
              }}
            />
          )}
        </AnimatePresence>
      </div>

      {/* NFT info */}
      <div style={{ padding: '8px 10px' }}>
        <div style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontWeight: 700,
          fontSize: 12,
          color: isHovered ? '#A78BFA' : '#FFFFFE',
          transition: 'color 0.2s',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {nft.name}
        </div>
        <div style={{
          fontSize: 11,
          color: 'rgba(255,255,254,0.3)',
          marginTop: 2,
        }}>
          #{nft.tokenId}
        </div>
      </div>
    </motion.button>
  );
}
