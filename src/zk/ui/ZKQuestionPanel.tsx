/**
 * ZKQuestionPanel — Schizodio category-based question selection.
 *
 * This is a reference implementation of the question panel that uses
 * SCHIZODIO_QUESTIONS with numeric IDs (bit indices). Post-merge,
 * the main QuestionPanel already uses this data — this file serves
 * as documentation/backup.
 *
 * The key insight: question.id IS the bit index, which IS the circuit's
 * question_id, which IS what goes on-chain. No mapping needed.
 */
import { SCHIZODIO_QUESTIONS, SchizodioCategory } from '../schizodioQuestions';

export const CATEGORIES: Array<{ key: SchizodioCategory; label: string; icon: string }> = [
  { key: 'hair',        label: 'Hair',       icon: '💇' },
  { key: 'clothing',    label: 'Clothing',   icon: '👕' },
  { key: 'eyes',        label: 'Eyes',       icon: '👁\uFE0F'  },
  { key: 'weapons',     label: 'Weapons',    icon: '⚔\uFE0F'  },
  { key: 'sidekick',    label: 'Sidekick',   icon: '🐉' },
  { key: 'headwear',    label: 'Headwear',   icon: '🎩' },
  { key: 'mouth',       label: 'Mouth',      icon: '👄' },
  { key: 'background',  label: 'Background', icon: '🌄' },
  { key: 'accessories', label: 'Extras',     icon: '✨' },
];

export function getQuestionsForCategory(category: SchizodioCategory) {
  return SCHIZODIO_QUESTIONS.filter((q) => q.category === category);
}

export function getAskedCount(category: SchizodioCategory, askedIds: Set<number>) {
  const catQuestions = getQuestionsForCategory(category);
  return catQuestions.filter((q) => askedIds.has(q.id)).length;
}
