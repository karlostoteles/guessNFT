/**
 * SchizodioSilhouette — interactive SVG body with 4 clickable trait zones.
 * 
 * Identity Construction:
 * As questions are answered "YES", the silhouette "populates" its 
 * appearance with confirmed traits (Skin, Hair, Eyes, accessories).
 */

import { motion } from 'framer-motion';
import type { QuestionZone } from '@/core/data/questions';
import { SKIN_COLORS, HAIR_COLORS, EYE_COLORS, type SkinTone, type HairColor, type EyeColor } from '@/core/data/traits';
import { ZONE_CONFIG, ZONES } from './zoneConfig';

export interface SilhouetteProps {
  activeZone: QuestionZone | null;
  hoveredZone: QuestionZone | null;
  /** Confirmed yes/no counts per zone (from question history) */
  zoneBadges: Record<QuestionZone, { yes: number; no: number }>;
  /** Confirmed trait values (e.g., { hair_color: 'red' }) */
  revealedTraits: Record<string, any>;
  onZoneClick: (z: QuestionZone) => void;
  onZoneEnter: (z: QuestionZone) => void;
  onZoneLeave: () => void;
}

export function SchizodioSilhouette({
  activeZone, hoveredZone, zoneBadges, revealedTraits,
  onZoneClick, onZoneEnter, onZoneLeave,
}: SilhouetteProps) {

  // Dynamic colors based on revealed traits
  const skinColor = revealedTraits.skin_tone
    ? SKIN_COLORS[revealedTraits.skin_tone as SkinTone]
    : 'url(#sg-head)';

  const hairColor = revealedTraits.hair_color
    ? HAIR_COLORS[revealedTraits.hair_color as HairColor]
    : 'url(#sg-hair)';

  const eyeColor = revealedTraits.eye_color
    ? EYE_COLORS[revealedTraits.eye_color as EyeColor]
    : '#0E0D1C';

  const highlight = (zone: QuestionZone) => ({
    fill: ZONE_CONFIG[zone].color,
    fillOpacity: activeZone === zone ? 0.22 : hoveredZone === zone ? 0.12 : 0,
    stroke: ZONE_CONFIG[zone].color,
    strokeOpacity: activeZone === zone ? 0.85 : hoveredZone === zone ? 0.45 : 0,
    strokeWidth: 1.5,
  });

  const zoneBtn = (zone: QuestionZone) => ({
    onClick: () => onZoneClick(zone),
    onMouseEnter: () => onZoneEnter(zone),
    onMouseLeave: () => onZoneLeave(),
    style: { cursor: 'pointer' as const, fill: 'transparent', stroke: 'none' },
  });

  return (
    <div style={{ position: 'relative', width: 130, flexShrink: 0 }}>
      <svg
        viewBox="0 0 130 230"
        width={130}
        height={230}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: 'block', overflow: 'visible' }}
      >
        <defs>
          <linearGradient id="sg-head" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3E3A6A" />
            <stop offset="100%" stopColor="#2A2650" />
          </linearGradient>
          <linearGradient id="sg-body" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38356A" />
            <stop offset="100%" stopColor="#242244" />
          </linearGradient>
          <linearGradient id="sg-hair" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2E2C58" />
            <stop offset="100%" stopColor="#201F42" />
          </linearGradient>
        </defs>

        {/* LEGS */}
        <rect x="30" y="192" width="30" height="38" rx="7" fill="url(#sg-body)" />
        <rect x="70" y="192" width="30" height="38" rx="7" fill="url(#sg-body)" />

        {/* GEAR ZONE — arms */}
        <rect x="1" y="122" width="24" height="68" rx="9" fill="url(#sg-body)" stroke="rgba(255,255,255,0.09)" />
        <rect x="105" y="122" width="24" height="68" rx="9" fill="url(#sg-body)" stroke="rgba(255,255,255,0.09)" />

        {/* Hands — use revealed skin color */}
        <ellipse cx="13" cy="193" rx="10" ry="8" fill={skinColor} />
        <ellipse cx="117" cy="193" rx="10" ry="8" fill={skinColor} />

        {/* BODY ZONE — torso */}
        <rect x="14" y="116" width="102" height="18" rx="7" fill="url(#sg-body)" stroke="rgba(255,255,255,0.10)" />
        <rect x="26" y="128" width="78" height="66" rx="9" fill="url(#sg-body)" stroke="rgba(255,255,255,0.11)" />
        <rect x="52" y="114" width="26" height="16" rx="6" fill={skinColor} />

        {/* HAIR mass — use revealed hair color */}
        <rect x="12" y="4" width="106" height="48" rx="18" fill={hairColor} stroke="rgba(255,255,255,0.09)" />

        {/* Spiky top (Hair revealed styles) */}
        {revealedTraits.hair_style === 'mohawk' && (
          <path d="M60 4 L65 -15 L70 4" fill={hairColor} stroke={hairColor} strokeWidth="2" />
        )}
        {(revealedTraits.hair_style === 'short' || revealedTraits.hair_style === 'spiky') && (
          <g>
            <path d="M44 36 L48 10 L56 32" fill={hairColor} />
            <path d="M57 26 L65  6 L73 24" fill={hairColor} />
            <path d="M74 30 L84 10 L90 34" fill={hairColor} />
          </g>
        )}

        {/* HEAD — base shape with revealed skin color */}
        <rect x="20" y="34" width="90" height="84" rx="13" fill={skinColor} stroke="rgba(255,255,255,0.13)" />

        {/* Eyes with revealed eye color */}
        <rect x="30" y="55" width="28" height="22" rx="6" fill={eyeColor} />
        <rect x="72" y="55" width="28" height="22" rx="6" fill={eyeColor} />
        <circle cx="35" cy="62" r="3" fill="white" opacity="0.5" />
        <circle cx="77" cy="62" r="3" fill="white" opacity="0.5" />

        {/* ACCESSORIES (Construction layer) */}
        {revealedTraits.has_glasses && (
          <g stroke="#FFFFFE" strokeWidth="2" fill="none">
            <rect x="25" y="52" width="38" height="28" rx="4" />
            <rect x="67" y="52" width="38" height="28" rx="4" />
            <line x1="63" y1="66" x2="67" y2="66" />
          </g>
        )}

        {revealedTraits.has_beard && (
          <path d="M30 90 Q65 125 100 90 L100 80 L30 80 Z" fill={hairColor} opacity="0.8" />
        )}

        {/* ZONE HOVER / ACTIVE HIGHLIGHTS */}
        <rect x="12" y="4" width="106" height="48" rx="18" {...highlight('hair')} />
        <rect x="20" y="34" width="90" height="84" rx="13" {...highlight('face')} />
        <rect x="14" y="116" width="102" height="18" rx="7" {...highlight('body')} />
        <rect x="26" y="128" width="78" height="66" rx="9" {...highlight('body')} />
        <rect x="0" y="118" width="130" height="80" rx="10" {...highlight('gear')} />

        {/* ZONE BADGES */}
        {ZONES.map((zone) => {
          const yes = zoneBadges[zone].yes;
          if (yes === 0) return null;
          const pos: Record<QuestionZone, { x: number; y: number }> = {
            hair: { x: 114, y: 18 }, face: { x: 110, y: 60 },
            body: { x: 116, y: 134 }, gear: { x: 116, y: 168 },
          };
          const { x, y } = pos[zone];
          return (
            <g key={zone}>
              <circle cx={x} cy={y} r={9.5} fill={ZONE_CONFIG[zone].color} />
              <text x={x} y={y + 4} textAnchor="middle" fontSize="9" fontWeight="800" fill="#0F0E17">
                {yes}
              </text>
            </g>
          );
        })}

        {/* INTERACTIVE HIT AREAS */}
        <rect x="10" y="2" width="110" height="54" rx="18" {...zoneBtn('hair')} />
        <rect x="18" y="32" width="94" height="88" rx="13" {...zoneBtn('face')} />
        <rect x="12" y="112" width="106" height="84" rx="8"  {...zoneBtn('body')} />
        <rect x="0" y="118" width="28" height="78" rx="9"  {...zoneBtn('gear')} />
        <rect x="102" y="118" width="28" height="78" rx="9"  {...zoneBtn('gear')} />
      </svg>

      {/* Zone labels */}
      {ZONES.map((zone) => {
        const cfg = ZONE_CONFIG[zone];
        const isActive = activeZone === zone;
        const isHover = hoveredZone === zone;
        const yPos: Record<QuestionZone, number> = {
          hair: 8, face: 56, body: 124, gear: 156,
        };
        return (
          <motion.div
            key={zone}
            onClick={() => onZoneClick(zone)}
            onMouseEnter={() => onZoneEnter(zone)}
            onMouseLeave={() => onZoneLeave()}
            animate={{ opacity: isActive ? 1 : isHover ? 0.85 : 0.42 }}
            style={{
              position: 'absolute',
              top: yPos[zone],
              left: -56,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              cursor: 'pointer',
              userSelect: 'none',
              borderRadius: 20,
              padding: '3px 8px',
              border: isActive ? `1px solid ${cfg.color}55` : '1px solid transparent',
              background: isActive ? `linear-gradient(135deg, ${cfg.color}26, ${cfg.color}12)` : 'transparent',
            }}
          >
            <span style={{ fontSize: 10 }}>{cfg.icon}</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: isActive ? cfg.color : 'rgba(255,255,255,0.4)' }}>
              {cfg.label}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}
