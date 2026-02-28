import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWalletStatus, useWalletUsername, useWalletAddress, useOwnedNFTs } from '../starknet/walletStore';
import { useWalletConnection } from '../starknet/hooks';
import type { SchizodioNFT } from '../starknet/types';

/**
 * Persistent wallet status widget — shows in the top-left corner.
 * Clicking it opens a profile modal with address, copy, and NFT gallery.
 * Only visible when connected; login is handled by the Play Online button.
 */
export function WalletButton() {
  const status    = useWalletStatus();
  const username  = useWalletUsername();
  const address   = useWalletAddress();
  const nfts      = useOwnedNFTs();
  const { disconnectWallet } = useWalletConnection();

  const [showProfile, setShowProfile] = useState(false);
  const [copied, setCopied]           = useState(false);

  const isConnected = status === 'connected' || status === 'ready' || status === 'loading_nfts';
  const displayName = username || (address ? `${address.slice(0, 6)}…${address.slice(-4)}` : '');

  if (!isConnected) return null;

  const handleCopy = () => {
    if (!address) return;
    navigator.clipboard.writeText(address).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDisconnect = () => {
    disconnectWallet();
    setShowProfile(false);
  };

  return (
    <>
      {/* ── Status widget (top-left) ─────────────────────────────────── */}
      <div style={{ position: 'fixed', top: 16, left: 16, zIndex: 50, pointerEvents: 'auto' }}>
        <AnimatePresence mode="wait">
          <motion.div
            key="connected"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            whileHover={{ borderColor: 'rgba(124, 58, 237, 0.65)', boxShadow: '0 0 16px rgba(124,58,237,0.2)' }}
            onClick={() => setShowProfile(true)}
            style={{
              background: 'rgba(15, 14, 23, 0.85)',
              border: '1px solid rgba(124, 58, 237, 0.3)',
              borderRadius: 12,
              padding: '8px 14px',
              backdropFilter: 'blur(10px)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              cursor: 'pointer',
              transition: 'border-color 0.2s, box-shadow 0.2s',
            }}
          >
            {/* Green dot */}
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: '#4CAF50',
              boxShadow: '0 0 8px rgba(76, 175, 80, 0.5)',
              flexShrink: 0,
            }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <span style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 600,
                fontSize: 12,
                color: '#FFFFFE',
              }}>
                {displayName}
              </span>
              {status === 'ready' && nfts.length > 0 && (
                <span style={{ fontSize: 10, color: 'rgba(255,255,254,0.4)' }}>
                  {nfts.length} SCHIZO{nfts.length > 1 ? 's' : ''}
                </span>
              )}
              {status === 'loading_nfts' && (
                <span style={{ fontSize: 10, color: 'rgba(124, 58, 237, 0.7)' }}>
                  Loading NFTs…
                </span>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Profile Modal ────────────────────────────────────────────── */}
      <AnimatePresence>
        {showProfile && (
          <ProfileModal
            username={username}
            address={address}
            displayName={displayName}
            nfts={nfts}
            copied={copied}
            onCopy={handleCopy}
            onDisconnect={handleDisconnect}
            onClose={() => setShowProfile(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// ─── Profile Modal ────────────────────────────────────────────────────────────

interface ProfileModalProps {
  username: string | null;
  address: string | null;
  displayName: string;
  nfts: SchizodioNFT[];
  copied: boolean;
  onCopy: () => void;
  onDisconnect: () => void;
  onClose: () => void;
}

function ProfileModal({
  username, address, displayName, nfts, copied, onCopy, onDisconnect, onClose,
}: ProfileModalProps) {
  return (
    <>
      {/* Backdrop */}
      <motion.div
        key="profile-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)',
          zIndex: 200,
          cursor: 'pointer',
        }}
      />

      {/* Modal card */}
      <motion.div
        key="profile-modal"
        initial={{ opacity: 0, scale: 0.92, y: -20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: -20 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 201,
          width: 'min(420px, calc(100vw - 32px))',
          maxHeight: 'min(640px, calc(100vh - 48px))',
          background: 'rgba(15, 14, 23, 0.97)',
          border: '1px solid rgba(124, 58, 237, 0.35)',
          borderRadius: 20,
          boxShadow: '0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 24px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          flexShrink: 0,
        }}>
          <span style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 700,
            fontSize: 16,
            color: '#FFFFFE',
            letterSpacing: '-0.01em',
          }}>
            Your Profile
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8,
              color: 'rgba(255,255,254,0.5)',
              width: 30, height: 30,
              cursor: 'pointer',
              fontSize: 14,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              outline: 'none',
            }}
          >
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '20px 24px 24px' }}>

          {/* Username row */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 20,
          }}>
            {/* Avatar circle */}
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              background: 'linear-gradient(135deg, #7C3AED, #E8A444)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20,
              flexShrink: 0,
            }}>
              🪬
            </div>
            <div>
              <div style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 700,
                fontSize: 18,
                color: '#FFFFFE',
                lineHeight: 1.2,
              }}>
                {username || displayName}
              </div>
              {/* Green badge */}
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                marginTop: 4,
                padding: '2px 8px',
                background: 'rgba(76, 175, 80, 0.12)',
                border: '1px solid rgba(76, 175, 80, 0.3)',
                borderRadius: 20,
              }}>
                <div style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: '#4CAF50',
                  boxShadow: '0 0 6px rgba(76,175,80,0.6)',
                }} />
                <span style={{ fontSize: 11, color: '#81C784', fontFamily: "'Space Grotesk', sans-serif" }}>
                  Connected
                </span>
              </div>
            </div>
          </div>

          {/* Wallet address */}
          {address && (
            <div style={{ marginBottom: 20 }}>
              <div style={{
                fontSize: 11,
                color: 'rgba(255,255,254,0.35)',
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: 8,
              }}>
                Wallet Address
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.09)',
                borderRadius: 10,
                padding: '10px 12px',
              }}>
                <span style={{
                  fontFamily: 'monospace',
                  fontSize: 11,
                  color: 'rgba(255,255,254,0.6)',
                  flex: 1,
                  wordBreak: 'break-all',
                  lineHeight: 1.5,
                }}>
                  {address}
                </span>
                <motion.button
                  onClick={onCopy}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  style={{
                    background: copied
                      ? 'rgba(76, 175, 80, 0.2)'
                      : 'rgba(124, 58, 237, 0.2)',
                    border: `1px solid ${copied ? 'rgba(76,175,80,0.4)' : 'rgba(124,58,237,0.4)'}`,
                    borderRadius: 8,
                    color: copied ? '#81C784' : '#A78BFA',
                    fontSize: 11,
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontWeight: 600,
                    padding: '5px 10px',
                    cursor: 'pointer',
                    outline: 'none',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    transition: 'background 0.2s, border-color 0.2s, color 0.2s',
                  }}
                >
                  {copied ? '✓ Copied' : 'Copy'}
                </motion.button>
              </div>
            </div>
          )}

          {/* NFT gallery */}
          {nfts.length > 0 && (
            <div>
              <div style={{
                fontSize: 11,
                color: 'rgba(255,255,254,0.35)',
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: 10,
              }}>
                SCHIZODIO Collection · {nfts.length} token{nfts.length > 1 ? 's' : ''}
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 8,
              }}>
                {nfts.map((nft) => (
                  <NftCard key={nft.tokenId} nft={nft} />
                ))}
              </div>
            </div>
          )}

          {nfts.length === 0 && (
            <div style={{
              textAlign: 'center',
              padding: '20px 0',
              color: 'rgba(255,255,254,0.25)',
              fontSize: 13,
              fontFamily: "'Space Grotesk', sans-serif",
            }}>
              No SCHIZODIO NFTs detected
            </div>
          )}
        </div>

        {/* Footer — disconnect */}
        <div style={{
          padding: '14px 24px',
          borderTop: '1px solid rgba(255,255,255,0.07)',
          flexShrink: 0,
        }}>
          <motion.button
            onClick={onDisconnect}
            whileHover={{ background: 'rgba(239,68,68,0.18)' }}
            whileTap={{ scale: 0.97 }}
            style={{
              width: '100%',
              background: 'rgba(239,68,68,0.09)',
              border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: 10,
              padding: '11px 16px',
              color: '#FCA5A5',
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
              outline: 'none',
              transition: 'background 0.2s',
            }}
          >
            Disconnect Wallet
          </motion.button>
        </div>
      </motion.div>
    </>
  );
}

// ─── NFT Card ─────────────────────────────────────────────────────────────────

function NftCard({ nft }: { nft: SchizodioNFT }) {
  const [imgError, setImgError] = useState(false);
  const showImage = nft.imageUrl && !imgError;

  // Deterministic accent colour from tokenId
  const hue = (parseInt(nft.tokenId, 10) * 47) % 360;

  return (
    <motion.div
      whileHover={{ scale: 1.04, zIndex: 2 }}
      style={{
        borderRadius: 10,
        overflow: 'hidden',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        flexDirection: 'column',
        cursor: 'default',
      }}
    >
      {/* Image / placeholder */}
      <div style={{
        aspectRatio: '1/1',
        background: showImage
          ? '#000'
          : `linear-gradient(135deg, hsl(${hue},60%,18%), hsl(${hue + 40},50%,12%))`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}>
        {showImage ? (
          <img
            src={nft.imageUrl}
            alt={nft.name}
            onError={() => setImgError(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <span style={{
            fontFamily: "'Space Grotesk', monospace",
            fontWeight: 700,
            fontSize: 18,
            color: `hsla(${hue},70%,70%,0.9)`,
          }}>
            #{nft.tokenId}
          </span>
        )}
      </div>

      {/* Name */}
      <div style={{
        padding: '5px 7px 7px',
        fontFamily: "'Space Grotesk', sans-serif",
        fontSize: 10,
        fontWeight: 600,
        color: 'rgba(255,255,254,0.55)',
        lineHeight: 1.3,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {nft.name}
      </div>
    </motion.div>
  );
}
