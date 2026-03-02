import type { QuestionZone } from '@/core/data/questions';

export const ZONE_CONFIG: Record<QuestionZone, {
  label: string;
  icon:  string;
  color: string;
  glow:  string;
}> = {
  hair: { label: 'HAIR',  icon: '💇', color: '#E8A444', glow: 'rgba(232,164,68,0.35)' },
  face: { label: 'FACE',  icon: '👁️', color: '#60CDFF', glow: 'rgba(96,205,255,0.35)'  },
  body: { label: 'BODY',  icon: '👕', color: '#A855F7', glow: 'rgba(168,85,247,0.35)'  },
  gear: { label: 'GEAR',  icon: '⚔️', color: '#EF4444', glow: 'rgba(239,68,68,0.35)'   },
};

export const ZONES: QuestionZone[] = ['hair', 'face', 'body', 'gear'];
