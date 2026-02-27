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
import { AutoEliminatingOverlay } from './AutoEliminatingOverlay';
import { EliminationPrompt } from './EliminationPrompt';
import { GuessPanel } from './GuessPanel';
import { GuessWrongOverlay } from './GuessWrongOverlay';
import { ResultScreen } from './ResultScreen';
import { RiskItButton } from './RiskItButton';
import { WalletButton } from './WalletButton';
import { CPUThinkingIndicator } from './CPUThinkingIndicator';

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

      {/* Wallet connection status — always visible */}
      <WalletButton />

      {/* Always-visible Risk It button during gameplay */}
      <RiskItButton />

      {/* CPU thinking indicator — free mode only */}
      <CPUThinkingIndicator />

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

        {phase === GamePhase.AUTO_ELIMINATING && <AutoEliminatingOverlay key="auto-elim" />}

        {phase === GamePhase.ELIMINATION && <EliminationPrompt key="elimination" />}

        {phase === GamePhase.GUESS_SELECT && <GuessPanel key="guess" />}

        {phase === GamePhase.GUESS_WRONG && <GuessWrongOverlay key="guess-wrong" />}

        {(phase === GamePhase.GUESS_RESULT || phase === GamePhase.GAME_OVER) && (
          <ResultScreen key="result" />
        )}
      </AnimatePresence>
    </div>
  );
}
