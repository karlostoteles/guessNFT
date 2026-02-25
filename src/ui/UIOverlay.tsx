import { AnimatePresence } from 'framer-motion';
import { usePhase } from '../store/selectors';
import { GamePhase } from '../store/types';
import { MenuScreen } from './MenuScreen';
import { CharacterSelectScreen } from './CharacterSelectScreen';
import { PhaseTransition } from './PhaseTransition';
import { TurnIndicator } from './TurnIndicator';
import { QuestionPanel } from './QuestionPanel';
import { AnswerPanel } from './AnswerPanel';
import { AnswerRevealed } from './AnswerRevealed';
import { EliminationPrompt } from './EliminationPrompt';
import { GuessPanel } from './GuessPanel';
import { ResultScreen } from './ResultScreen';

export function UIOverlay() {
  const phase = usePhase();

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
      zIndex: 1,
    }}>
      <TurnIndicator />

      <AnimatePresence mode="wait">
        {phase === GamePhase.MENU && <MenuScreen key="menu" />}

        {(phase === GamePhase.SETUP_P1 || phase === GamePhase.SETUP_P2) && (
          <CharacterSelectScreen key="select" />
        )}

        {(phase === GamePhase.HANDOFF_P1_TO_P2 ||
          phase === GamePhase.HANDOFF_START ||
          phase === GamePhase.HANDOFF_TO_OPPONENT ||
          phase === GamePhase.TURN_TRANSITION) && (
          <PhaseTransition key={`transition-${phase}`} />
        )}

        {phase === GamePhase.QUESTION_SELECT && <QuestionPanel key="question" />}

        {phase === GamePhase.ANSWER_PENDING && <AnswerPanel key="answer" />}

        {phase === GamePhase.ANSWER_REVEALED && <AnswerRevealed key="revealed" />}

        {phase === GamePhase.ELIMINATION && <EliminationPrompt key="elimination" />}

        {phase === GamePhase.GUESS_SELECT && <GuessPanel key="guess" />}

        {(phase === GamePhase.GUESS_RESULT || phase === GamePhase.GAME_OVER) && (
          <ResultScreen key="result" />
        )}
      </AnimatePresence>
    </div>
  );
}
