import { CharacterTraits } from './traits';

export interface Question {
  id: string;
  text: string;
  category: 'hair' | 'face' | 'accessories' | 'other';
  traitKey: keyof CharacterTraits;
  traitValue: string | boolean;
}

export const QUESTIONS: Question[] = [
  // Hair color
  { id: 'q_hc_black', text: 'Does your character have black hair?', category: 'hair', traitKey: 'hair_color', traitValue: 'black' },
  { id: 'q_hc_brown', text: 'Does your character have brown hair?', category: 'hair', traitKey: 'hair_color', traitValue: 'brown' },
  { id: 'q_hc_blonde', text: 'Does your character have blonde hair?', category: 'hair', traitKey: 'hair_color', traitValue: 'blonde' },
  { id: 'q_hc_red', text: 'Does your character have red hair?', category: 'hair', traitKey: 'hair_color', traitValue: 'red' },
  { id: 'q_hc_white', text: 'Does your character have white hair?', category: 'hair', traitKey: 'hair_color', traitValue: 'white' },
  { id: 'q_hc_blue', text: 'Does your character have blue hair?', category: 'hair', traitKey: 'hair_color', traitValue: 'blue' },

  // Hair style
  { id: 'q_hs_short', text: 'Does your character have short hair?', category: 'hair', traitKey: 'hair_style', traitValue: 'short' },
  { id: 'q_hs_long', text: 'Does your character have long hair?', category: 'hair', traitKey: 'hair_style', traitValue: 'long' },
  { id: 'q_hs_curly', text: 'Does your character have curly hair?', category: 'hair', traitKey: 'hair_style', traitValue: 'curly' },
  { id: 'q_hs_bald', text: 'Is your character bald?', category: 'hair', traitKey: 'hair_style', traitValue: 'bald' },
  { id: 'q_hs_mohawk', text: 'Does your character have a mohawk?', category: 'hair', traitKey: 'hair_style', traitValue: 'mohawk' },
  { id: 'q_hs_ponytail', text: 'Does your character have a ponytail?', category: 'hair', traitKey: 'hair_style', traitValue: 'ponytail' },

  // Face
  { id: 'q_eye_brown', text: 'Does your character have brown eyes?', category: 'face', traitKey: 'eye_color', traitValue: 'brown' },
  { id: 'q_eye_blue', text: 'Does your character have blue eyes?', category: 'face', traitKey: 'eye_color', traitValue: 'blue' },
  { id: 'q_eye_green', text: 'Does your character have green eyes?', category: 'face', traitKey: 'eye_color', traitValue: 'green' },
  { id: 'q_eye_hazel', text: 'Does your character have hazel eyes?', category: 'face', traitKey: 'eye_color', traitValue: 'hazel' },
  { id: 'q_gender_m', text: 'Is your character male?', category: 'face', traitKey: 'gender', traitValue: 'male' },
  { id: 'q_gender_f', text: 'Is your character female?', category: 'face', traitKey: 'gender', traitValue: 'female' },
  { id: 'q_skin_light', text: 'Does your character have light skin?', category: 'face', traitKey: 'skin_tone', traitValue: 'light' },
  { id: 'q_skin_dark', text: 'Does your character have dark skin?', category: 'face', traitKey: 'skin_tone', traitValue: 'dark' },
  { id: 'q_beard', text: 'Does your character have a beard?', category: 'face', traitKey: 'has_beard', traitValue: true },

  // Accessories
  { id: 'q_glasses', text: 'Does your character wear glasses?', category: 'accessories', traitKey: 'has_glasses', traitValue: true },
  { id: 'q_hat', text: 'Does your character wear a hat?', category: 'accessories', traitKey: 'has_hat', traitValue: true },
  { id: 'q_earrings', text: 'Does your character have earrings?', category: 'accessories', traitKey: 'has_earrings', traitValue: true },
];
