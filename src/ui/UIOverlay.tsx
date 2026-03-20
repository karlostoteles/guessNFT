import { AnimatePresence, motion } from 'framer-motion';
import { usePhase, useGameMode, useGameActions } from '@/core/store/selectors';
import { GamePhase } from '@/core/store/types';
import { COLORS } from '@/core/rules/constants';
import { Button } from './common/Button';
import { Card } from './common/Card';
import { finishGame } from '@/services/supabase/gameService';
import { useOnlineGameId, useOnlinePlayerNum } from '@/core/store/selectors';
import { MenuScreen } from './screens/MenuScreen';
import { CharacterSelectScreen } from './screens/CharacterSelectScreen';
import { OnlineWaitingScreen } from './screens/OnlineWaitingScreen';
import { ResultScreen } from './screens/ResultScreen';
import { QuestionPanel } from './panels/QuestionPanel';
import { AnswerPanel } from './panels/AnswerPanel';
import { AnswerRevealed } from './panels/AnswerRevealed';
import { EliminationPrompt } from './panels/EliminationPrompt';
import { GuessPanel } from './panels/GuessPanel';
import { SecretCardPanel } from './panels/SecretCardPanel';
import { PhaseTransition } from './overlays/PhaseTransition';
import { AutoEliminatingOverlay } from './overlays/AutoEliminatingOverlay';
import { GuessWrongOverlay } from './overlays/GuessWrongOverlay';
import { TurnIndicator } from './widgets/TurnIndicator';
import { HeaderMenu } from './widgets/HeaderMenu';
import { CPUThinkingIndicator } from './widgets/CPUThinkingIndicator';
import { OpponentCounter } from './widgets/OpponentCounter';
import { ConfirmedTraits } from './widgets/ConfirmedTraits';
import { EndGameVignette } from './widgets/EndGameVignette';
import { useOnlineGameSync } from '@/shared/hooks/useOnlineGameSync';
import { useNFTTraitLoader } from '@/shared/hooks/useNFTTraitLoader';

export function UIOverlay() {
  const phase = usePhase();
  const mode = useGameMode();
  const onlineGameId = useOnlineGameId();
  const onlinePlayerNum = useOnlinePlayerNum();
  const { resetGame } = useGameActions();

  // Mount the online sync hook for the lifetime of the overlay
  const { opponentDisconnected } = useOnlineGameSync();
  // Enrich stub NFT characters with real traits when owned NFTs are available
  useNFTTraitLoader();

  const showDisconnectWarning = opponentDisconnected && mode === 'online' &&
    phase !== GamePhase.MENU && phase !== GamePhase.GAME_OVER && phase !== GamePhase.GUESS_RESULT;

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
      zIndex: 10,
      touchAction: 'manipulation',
    }}>
      <EndGameVignette />
      <TurnIndicator />

      {/* Opponent disconnect warning */}
      <AnimatePresence>
        {showDisconnectWarning && (
          <motion.div
            key="disconnect-warning"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            style={{
              position: 'fixed',
              top: 60,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 90,
              pointerEvents: 'auto',
            }}
          >
            <Card style={{ padding: '16px 24px', textAlign: 'center', maxWidth: 340 }}>
              <div style={{ fontSize: 13, color: COLORS.no, fontWeight: 700, marginBottom: 8 }}>
                Opponent disconnected
              </div>
              <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 16 }}>
                They may have closed the tab. You can wait or claim the win.
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                <Button variant="secondary" size="sm" onClick={() => { /* just dismiss — presence may reconnect */ }}>
                  Wait
                </Button>
                <Button variant="accent" size="sm" onClick={() => {
                  if (onlineGameId && onlinePlayerNum) {
                    finishGame(onlineGameId, onlinePlayerNum).catch(console.error);
                  }
                  resetGame();
                }}>
                  Claim Win
                </Button>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Unified Settings / Wallet Menu — top-left corner */}
      <HeaderMenu />


      {/* CPU thinking indicator — free mode only */}
      <CPUThinkingIndicator />
      <OpponentCounter />
      <ConfirmedTraits />
      <SecretCardPanel />

      <AnimatePresence mode="wait">
        {phase === GamePhase.MENU && <MenuScreen key="menu" />}

        {(phase === GamePhase.SETUP_P1 || phase === GamePhase.SETUP_P2) && (
          <CharacterSelectScreen key="select" />
        )}

        {/* Online: waiting for opponent to commit character */}
        {phase === GamePhase.ONLINE_WAITING && <OnlineWaitingScreen key="online-waiting" />}

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
