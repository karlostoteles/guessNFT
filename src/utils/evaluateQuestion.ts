import { Character } from '../data/characters';
import { Question } from '../data/questions';

export function evaluateQuestion(question: Question, character: Character): boolean {
  const traitValue = character.traits[question.traitKey];
  return traitValue === question.traitValue;
}
