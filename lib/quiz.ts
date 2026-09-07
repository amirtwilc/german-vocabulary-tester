import type { Noun, PresentPerson, Verb, Vocabulary } from '@/data/vocabulary';

export type QuestionMode = 'choice' | 'text';

export interface QuizQuestion {
  id: string;
  wordId: string;
  wordType: 'noun' | 'verb';
  word: string;
  prompt: string;
  eyebrow: string;
  mode: QuestionMode;
  correctAnswer: string;
  options?: string[];
  notes?: string;
}

const people: Record<PresentPerson, string> = {
  ich: 'ich', du: 'du', erSieEs: 'er / sie / es', wir: 'wir', ihr: 'ihr', sieSie: 'sie / Sie',
};

export const shuffle = <T,>(items: readonly T[], random: () => number = Math.random): T[] => {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
};

const translationOptions = (correct: string, pool: readonly { english: string }[], random: () => number) => {
  const distractors = [...new Set(pool.map((item) => item.english).filter((answer) => answer !== correct))];
  return shuffle([correct, ...shuffle(distractors, random).slice(0, 3)], random);
};

const nounBlock = (noun: Noun, pool: readonly Noun[], random: () => number): QuizQuestion[] => [
  { id: `${noun.id}-translation`, wordId: noun.id, wordType: 'noun', word: noun.german, eyebrow: 'Noun · meaning', prompt: `What does “${noun.german}” mean?`, mode: 'choice', correctAnswer: noun.english, options: translationOptions(noun.english, pool, random) },
  { id: `${noun.id}-article`, wordId: noun.id, wordType: 'noun', word: noun.german, eyebrow: 'Noun · article', prompt: `Which article belongs to “${noun.german}”?`, mode: 'choice', correctAnswer: noun.article, options: shuffle(['der', 'die', 'das'], random) },
  { id: `${noun.id}-plural`, wordId: noun.id, wordType: 'noun', word: noun.german, eyebrow: 'Noun · plural', prompt: `Write the plural of “${noun.german}”.`, mode: 'text', correctAnswer: noun.plural },
];

const verbCandidates = (verb: Verb, random: () => number): QuizQuestion[] => {
  const candidates: QuizQuestion[] = [];
  for (const [person, answer] of Object.entries(verb.present ?? {}) as [PresentPerson, string][]) {
    candidates.push({ id: `${verb.id}-present-${person}`, wordId: verb.id, wordType: 'verb', word: verb.infinitive, eyebrow: 'Verb · present tense', prompt: `Conjugate “${verb.infinitive}” for ${people[person]}.`, mode: 'text', correctAnswer: answer, notes: verb.notes });
  }
  if (verb.pastParticiple) candidates.push({ id: `${verb.id}-participle`, wordId: verb.id, wordType: 'verb', word: verb.infinitive, eyebrow: 'Verb · past participle', prompt: `Write the past participle of “${verb.infinitive}”.`, mode: 'text', correctAnswer: verb.pastParticiple, notes: verb.notes });
  if (verb.auxiliary) candidates.push({ id: `${verb.id}-auxiliary`, wordId: verb.id, wordType: 'verb', word: verb.infinitive, eyebrow: 'Verb · auxiliary', prompt: `Which auxiliary does “${verb.infinitive}” use?`, mode: 'choice', correctAnswer: verb.auxiliary, options: shuffle(['hat', 'ist'], random), notes: verb.notes });
  if (verb.case) candidates.push({ id: `${verb.id}-case`, wordId: verb.id, wordType: 'verb', word: verb.infinitive, eyebrow: 'Verb · grammatical case', prompt: `Which case does “${verb.infinitive}” take?`, mode: 'choice', correctAnswer: verb.case, options: shuffle(['Akkusativ', 'Dativ', 'Akkusativ + Dativ'], random), notes: verb.notes });
  return shuffle(candidates, random).slice(0, 3);
};

const verbBlock = (verb: Verb, pool: readonly Verb[], random: () => number): QuizQuestion[] => [
  { id: `${verb.id}-translation`, wordId: verb.id, wordType: 'verb', word: verb.infinitive, eyebrow: 'Verb · meaning', prompt: `What does “${verb.infinitive}” mean?`, mode: 'choice', correctAnswer: verb.english, options: translationOptions(verb.english, pool, random), notes: verb.notes },
  ...verbCandidates(verb, random),
];

const verbFactCount = (verb: Verb) => Object.keys(verb.present ?? {}).length + Number(Boolean(verb.pastParticiple)) + Number(Boolean(verb.auxiliary)) + Number(Boolean(verb.case));

export const getMaximumQuestionCount = (source: Vocabulary) => source.nouns.length * 3 + source.verbs.reduce((sum, verb) => sum + 1 + Math.min(3, verbFactCount(verb)), 0);

export const createQuiz = (source: Vocabulary, amount: number, random: () => number = Math.random): QuizQuestion[] => {
  const words = shuffle([
    ...source.nouns.map((noun) => ({ type: 'noun' as const, value: noun })),
    ...source.verbs.map((verb) => ({ type: 'verb' as const, value: verb })),
  ], random);
  const questions = words.flatMap((entry) => entry.type === 'noun' ? nounBlock(entry.value, source.nouns, random) : verbBlock(entry.value, source.verbs, random));
  return questions.slice(0, Math.max(0, Math.min(Math.floor(amount), questions.length)));
};

export const normalizeAnswer = (answer: string) => answer.trim().toLocaleLowerCase('de-DE');
export const isCorrectAnswer = (answer: string, correct: string) => normalizeAnswer(answer) === normalizeAnswer(correct);
