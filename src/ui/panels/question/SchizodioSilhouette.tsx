/**
 * SchizodioSilhouette — interactive SVG body with 4 clickable trait zones.
 *
 * Design language: PFP avatar proportions — large square head, boxy torso,
 * bold geometric features. Inspired by the SCHIZODIO collection aesthetic.
 *
 * Progressive reveal: as YES answers accumulate in each zone, that zone
 * "fills in" with colour highlights and detail overlays — giving a sense
 * that you are uncovering who the hidden character is.
 *
 *  Zone → trait categories
 *  ─────────────────────────────────────────────────
 *  HAIR  → Hair, Headwear, Overlays
 *  FACE  → Eyes, Eyebrows, Mouth, Mask, Eyewear
 *  BODY  → Body, Clothing, Background (chest)
 *  GEAR  → Weapons, Accessories, Sidekick (arms)
 */

import { motion } from 'framer-motion';
import type { QuestionZone } from '@/core/data/questions';
import { ZONE_CONFIG, ZONES } from './zoneConfig';

export interface SilhouetteProps {
  activeZone:  QuestionZone | null;
  hoveredZone: QuestionZone | null;
  /** Confirmed yes/no counts per zone (from question history) */
  zoneBadges: Record<QuestionZone, { yes: number; no: number }>;
  onZoneClick:  (z: QuestionZone) => void;
  onZoneEnter:  (z: QuestionZone) => void;
  onZoneLeave:  () => void;
}

// How strongly a zone is "revealed" — 0 = dark silhouette, 1 = fully revealed
function revealAlpha(yesCount: number): number {
  if (yesCount === 0) return 0;
  return Math.min(0.92, yesCount * 0.38);
}

export function SchizodioSilhouette({
  activeZone, hoveredZone, zoneBadges,
  onZoneClick, onZoneEnter, onZoneLeave,
}: SilhouetteProps) {

  const highlight = (zone: QuestionZone) => ({
    fill:          ZONE_CONFIG[zone].color,
    fillOpacity:   activeZone === zone ? 0.22 : hoveredZone === zone ? 0.12 : 0,
    stroke:        ZONE_CONFIG[zone].color,
    strokeOpacity: activeZone === zone ? 0.85 : hoveredZone === zone ? 0.45 : 0,
    strokeWidth:   1.5,
  });

  const zoneBtn = (zone: QuestionZone) => ({
    onClick:      () => onZoneClick(zone),
    onMouseEnter: () => onZoneEnter(zone),
    onMouseLeave: () => onZoneLeave(),
    style: { cursor: 'pointer' as const, fill: 'transparent', stroke: 'none' },
  });

  const hairReveal = revealAlpha(zoneBadges.hair.yes);
  const faceReveal = revealAlpha(zoneBadges.face.yes);
  const bodyReveal = revealAlpha(zoneBadges.body.yes);
  const gearReveal = revealAlpha(zoneBadges.gear.yes);

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
            <stop offset="0%"   stopColor="#3E3A6A"/>
            <stop offset="100%" stopColor="#2A2650"/>
          </linearGradient>
          <linearGradient id="sg-body" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#38356A"/>
            <stop offset="100%" stopColor="#242244"/>
          </linearGradient>
          <linearGradient id="sg-hair" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#2E2C58"/>
            <stop offset="100%" stopColor="#201F42"/>
          </linearGradient>
          <filter id="sg-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="5" result="blur"/>
            <feComposite in="SourceGraphic" in2="blur" operator="over"/>
          </filter>
        </defs>

        {/* Ambient glow behind figure */}
        <ellipse cx="65" cy="120" rx="56" ry="105"
          fill="rgba(90,80,180,0.06)" filter="url(#sg-glow)"/>

        {/* ══════════════════════════════════════════
            LEGS  (bottom anchor, always visible)
        ════════════════════════════════════════════ */}
        <rect x="30" y="192" width="30" height="38" rx="7"
          fill="url(#sg-body)" stroke="rgba(255,255,255,0.07)" strokeWidth="1"/>
        <rect x="70" y="192" width="30" height="38" rx="7"
          fill="url(#sg-body)" stroke="rgba(255,255,255,0.07)" strokeWidth="1"/>

        {/* ══════════════════════════════════════════
            GEAR ZONE — arms
        ════════════════════════════════════════════ */}
        {/* Left arm */}
        <rect x="1" y="122" width="24" height="68" rx="9"
          fill="url(#sg-body)" stroke="rgba(255,255,255,0.09)" strokeWidth="1"/>
        {/* Right arm */}
        <rect x="105" y="122" width="24" height="68" rx="9"
          fill="url(#sg-body)" stroke="rgba(255,255,255,0.09)" strokeWidth="1"/>
        {/* Hands */}
        <ellipse cx="13"  cy="193" rx="10" ry="8" fill="url(#sg-head)"/>
        <ellipse cx="117" cy="193" rx="10" ry="8" fill="url(#sg-head)"/>

        {/* GEAR reveal — glowing cuff + arm tint */}
        {gearReveal > 0 && (
          <g opacity={gearReveal}>
            <rect x="1"   y="122" width="24" height="68" rx="9"
              fill="#EF4444" fillOpacity={0.14}/>
            <rect x="105" y="122" width="24" height="68" rx="9"
              fill="#EF4444" fillOpacity={0.14}/>
            {/* Cuff / bracelet details */}
            <rect x="2"   y="154" width="22" height="7" rx="3"
              fill="#EF4444" fillOpacity={0.28} stroke="#EF4444" strokeWidth="0.6" strokeOpacity={0.55}/>
            <rect x="106" y="154" width="22" height="7" rx="3"
              fill="#EF4444" fillOpacity={0.28} stroke="#EF4444" strokeWidth="0.6" strokeOpacity={0.55}/>
            {/* Item stub on dominant hand */}
            {zoneBadges.gear.yes >= 2 && (
              <path d="M106 178 L118 168 L122 172 L110 182 Z"
                fill="#EF4444" fillOpacity={0.35} stroke="#EF4444" strokeWidth="0.8" strokeOpacity={0.6}/>
            )}
          </g>
        )}

        {/* ══════════════════════════════════════════
            BODY ZONE — torso
        ════════════════════════════════════════════ */}
        {/* Wide shoulders */}
        <rect x="14" y="116" width="102" height="18" rx="7"
          fill="url(#sg-body)" stroke="rgba(255,255,255,0.10)" strokeWidth="1"/>
        {/* Torso */}
        <rect x="26" y="128" width="78" height="66" rx="9"
          fill="url(#sg-body)" stroke="rgba(255,255,255,0.11)" strokeWidth="1"/>
        {/* Neck */}
        <rect x="52" y="114" width="26" height="16" rx="6" fill="url(#sg-head)"/>
        {/* Shirt collar hint */}
        <path d="M52 130 Q65 143 78 130"
          stroke="rgba(255,255,255,0.10)" strokeWidth="1.5" fill="none"/>

        {/* BODY reveal — clothing colour + pocket + seam */}
        {bodyReveal > 0 && (
          <g opacity={bodyReveal}>
            <rect x="26" y="128" width="78" height="66" rx="9"
              fill="#A855F7" fillOpacity={0.14}/>
            <path d="M52 130 Q65 143 78 130"
              stroke="#A855F7" strokeWidth="2" fill="none" strokeOpacity={0.65}/>
            {/* Center seam */}
            <line x1="65" y1="144" x2="65" y2="194"
              stroke="#A855F7" strokeWidth="1" strokeOpacity={0.35}/>
            {/* Chest pocket */}
            {zoneBadges.body.yes >= 2 && (
              <rect x="38" y="148" width="16" height="14" rx="3"
                fill="#A855F7" fillOpacity={0.22}
                stroke="#A855F7" strokeWidth="0.7" strokeOpacity={0.5}/>
            )}
          </g>
        )}

        {/* ══════════════════════════════════════════
            HAIR / HEADWEAR ZONE
        ════════════════════════════════════════════ */}
        {/* Hair mass — flat-top PFP style */}
        <rect x="12" y="4" width="106" height="48" rx="18"
          fill="url(#sg-hair)" stroke="rgba(255,255,255,0.09)" strokeWidth="1"/>
        {/* Spiky silhouette top — three spikes */}
        <path d="M44 36 L48 10 L56 32" fill="#26244C" strokeLinejoin="round"/>
        <path d="M57 26 L65  6 L73 24" fill="#26244C" strokeLinejoin="round"/>
        <path d="M74 30 L84 10 L90 34" fill="#26244C" strokeLinejoin="round"/>
        {/* Side hair hang */}
        <rect x="12" y="32" width="14" height="32" rx="6"
          fill="url(#sg-hair)" stroke="rgba(255,255,255,0.07)" strokeWidth="1"/>
        <rect x="104" y="32" width="14" height="32" rx="6"
          fill="url(#sg-hair)" stroke="rgba(255,255,255,0.07)" strokeWidth="1"/>

        {/* HAIR reveal — colour highlight + streak lines */}
        {hairReveal > 0 && (
          <g opacity={hairReveal}>
            <rect x="12" y="4" width="106" height="48" rx="18"
              fill="#E8A444" fillOpacity={0.16}/>
            {/* Hair highlight streaks */}
            <path d="M38 38 Q65 18 92 38"
              stroke="#E8A444" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity={0.55}/>
            <path d="M28 22 Q65  8 102 22"
              stroke="#E8A444" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity={0.35}/>
            {/* Side hair tint */}
            <rect x="12"  y="32" width="14" height="32" rx="6" fill="#E8A444" fillOpacity={0.16}/>
            <rect x="104" y="32" width="14" height="32" rx="6" fill="#E8A444" fillOpacity={0.16}/>
            {/* Headwear hint at 2+ */}
            {zoneBadges.hair.yes >= 2 && (
              <rect x="22" y="2" width="86" height="12" rx="5"
                fill="#E8A444" fillOpacity={0.3}
                stroke="#E8A444" strokeWidth="0.8" strokeOpacity={0.6}/>
            )}
          </g>
        )}

        {/* ══════════════════════════════════════════
            HEAD — base shape (renders above hair for correct z-order)
        ════════════════════════════════════════════ */}
        <rect x="20" y="34" width="90" height="84" rx="13"
          fill="url(#sg-head)" stroke="rgba(255,255,255,0.13)" strokeWidth="1"/>
        {/* Ears */}
        <rect x="7"  y="52" width="15" height="24" rx="6"
          fill="url(#sg-head)" stroke="rgba(255,255,255,0.09)" strokeWidth="1"/>
        <rect x="108" y="52" width="15" height="24" rx="6"
          fill="url(#sg-head)" stroke="rgba(255,255,255,0.09)" strokeWidth="1"/>

        {/* ══════════════════════════════════════════
            FACE ZONE — eyes, brows, nose, mouth
        ════════════════════════════════════════════ */}
        {/* Eye sockets — rectangular PFP style */}
        <rect x="30" y="55" width="28" height="22" rx="6" fill="#0E0D1C"/>
        <rect x="72" y="55" width="28" height="22" rx="6" fill="#0E0D1C"/>
        {/* Eye shine */}
        <circle cx="35" cy="60" r="4"  fill="rgba(255,255,255,0.6)"/>
        <circle cx="77" cy="60" r="4"  fill="rgba(255,255,255,0.6)"/>
        {/* Pupils / iris */}
        <ellipse cx="46" cy="66" rx="5"   ry="4.5" fill="rgba(255,255,255,0.12)"/>
        <ellipse cx="88" cy="66" rx="5"   ry="4.5" fill="rgba(255,255,255,0.12)"/>
        {/* Eyebrows */}
        <path d="M29 52 Q44 47 59 52"
          stroke="rgba(255,255,255,0.28)" strokeWidth="2.2" fill="none" strokeLinecap="round"/>
        <path d="M71 52 Q86 47 101 52"
          stroke="rgba(255,255,255,0.28)" strokeWidth="2.2" fill="none" strokeLinecap="round"/>
        {/* Nose — minimal */}
        <path d="M61 80 Q65 89 69 80"
          stroke="rgba(255,255,255,0.13)" strokeWidth="1.5" fill="none"/>
        {/* Mouth — subtle curve */}
        <path d="M50 94 Q65 105 80 94"
          stroke="rgba(255,255,255,0.22)" strokeWidth="2.2" fill="none" strokeLinecap="round"/>

        {/* FACE reveal — eye colour tints + expression */}
        {faceReveal > 0 && (
          <g opacity={faceReveal}>
            {/* Eye glow */}
            <rect x="30" y="55" width="28" height="22" rx="6"
              fill="none" stroke="#60CDFF" strokeWidth="1.5"/>
            <rect x="72" y="55" width="28" height="22" rx="6"
              fill="none" stroke="#60CDFF" strokeWidth="1.5"/>
            <ellipse cx="44" cy="66" rx="8" ry="7" fill="#60CDFF" fillOpacity={0.18}/>
            <ellipse cx="86" cy="66" rx="8" ry="7" fill="#60CDFF" fillOpacity={0.18}/>
            {/* Highlighted brows */}
            <path d="M29 52 Q44 47 59 52"
              stroke="#60CDFF" strokeWidth="1.8" fill="none" strokeLinecap="round" opacity={0.55}/>
            <path d="M71 52 Q86 47 101 52"
              stroke="#60CDFF" strokeWidth="1.8" fill="none" strokeLinecap="round" opacity={0.55}/>
            {/* Mask / eyewear hint at 2+ */}
            {zoneBadges.face.yes >= 2 && (
              <path d="M24 50 Q65 43 106 50 L106 80 Q65 87 24 80 Z"
                fill="#60CDFF" fillOpacity={0.07}
                stroke="#60CDFF" strokeWidth="0.7" strokeOpacity={0.4}/>
            )}
          </g>
        )}

        {/* ══════════════════════════════════════════
            ZONE HOVER / ACTIVE HIGHLIGHT OVERLAYS
        ════════════════════════════════════════════ */}

        {/* HAIR zone overlay */}
        {(activeZone === 'hair' || hoveredZone === 'hair') && (
          <>
            <rect x="12" y="4" width="106" height="48" rx="18" {...highlight('hair')}/>
            <rect x="12" y="32" width="14" height="32" rx="6" {...highlight('hair')}/>
            <rect x="104" y="32" width="14" height="32" rx="6" {...highlight('hair')}/>
          </>
        )}

        {/* FACE zone overlay */}
        {(activeZone === 'face' || hoveredZone === 'face') && (
          <rect x="20" y="34" width="90" height="84" rx="13" {...highlight('face')}/>
        )}

        {/* BODY zone overlay */}
        {(activeZone === 'body' || hoveredZone === 'body') && (
          <>
            <rect x="14" y="116" width="102" height="18" rx="7" {...highlight('body')}/>
            <rect x="26" y="128" width="78" height="66" rx="9" {...highlight('body')}/>
          </>
        )}

        {/* GEAR zone overlay */}
        {(activeZone === 'gear' || hoveredZone === 'gear') && (
          <>
            <rect x="1"   y="122" width="24" height="68" rx="9" {...highlight('gear')}/>
            <rect x="105" y="122" width="24" height="68" rx="9" {...highlight('gear')}/>
          </>
        )}

        {/* ══════════════════════════════════════════
            ZONE BADGE DOTS  (confirmed YES count)
        ════════════════════════════════════════════ */}
        {ZONES.map((zone) => {
          const yes = zoneBadges[zone].yes;
          if (yes === 0) return null;
          const pos: Record<QuestionZone, { x: number; y: number }> = {
            hair: { x: 114, y: 18  },
            face: { x: 110, y: 60  },
            body: { x: 116, y: 134 },
            gear: { x: 116, y: 168 },
          };
          const { x, y } = pos[zone];
          return (
            <g key={zone}>
              <circle cx={x} cy={y} r={9.5}
                fill={ZONE_CONFIG[zone].color} opacity={0.92}/>
              <text x={x} y={y + 4}
                textAnchor="middle" fontSize="9" fontWeight="800"
                fill="#0F0E17" fontFamily="Space Grotesk, sans-serif">
                {yes}
              </text>
            </g>
          );
        })}

        {/* ══════════════════════════════════════════
            INTERACTIVE HIT AREAS  (transparent, on top)
        ════════════════════════════════════════════ */}
        {/* HAIR */}
        <rect x="10" y="2"   width="110" height="54" rx="18" {...zoneBtn('hair')}/>
        {/* FACE */}
        <rect x="18" y="32"  width="94"  height="88" rx="13" {...zoneBtn('face')}/>
        {/* BODY */}
        <rect x="12" y="112" width="106" height="84" rx="8"  {...zoneBtn('body')}/>
        {/* GEAR — left arm */}
        <rect x="0"  y="118" width="28"  height="78" rx="9"  {...zoneBtn('gear')}/>
        {/* GEAR — right arm */}
        <rect x="102" y="118" width="28" height="78" rx="9"  {...zoneBtn('gear')}/>
      </svg>

      {/* Zone label pills — positioned to the left of the figure */}
      {ZONES.map((zone) => {
        const cfg      = ZONE_CONFIG[zone];
        const isActive = activeZone  === zone;
        const isHover  = hoveredZone === zone;
        const yPos: Record<QuestionZone, number> = {
          hair:  8, face: 56, body: 124, gear: 156,
        };
        return (
          <motion.div
            key={zone}
            onClick={() => onZoneClick(zone)}
            onMouseEnter={() => onZoneEnter(zone)}
            onMouseLeave={() => onZoneLeave()}
            animate={{ opacity: isActive ? 1 : isHover ? 0.85 : 0.42 }}
            style={{
              position:  'absolute',
              top:       yPos[zone],
              left:      -56,
              display:   'flex',
              alignItems:'center',
              gap:        4,
              cursor:    'pointer',
              userSelect:'none',
              background: isActive
                ? `linear-gradient(135deg, ${cfg.color}26, ${cfg.color}12)`
                : 'transparent',
              border: isActive
                ? `1px solid ${cfg.color}55`
                : '1px solid transparent',
              borderRadius: 20,
              padding: '3px 8px',
              transition: 'all 0.18s',
            }}
          >
            <span style={{ fontSize: 10 }}>{cfg.icon}</span>
            <span style={{
              fontSize:   9,
              fontWeight: 700,
              color: isActive ? cfg.color : 'rgba(255,255,255,0.4)',
              fontFamily: "'Space Grotesk', sans-serif",
              letterSpacing: '0.06em',
            }}>
              {cfg.label}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}
