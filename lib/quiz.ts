import type { AdjectiveAdverb, Noun, Preposition, PresentPerson, Verb, Vocabulary } from '@/data/vocabulary';

export type QuestionMode = 'choice' | 'text';

export interface QuizQuestion {
  id: string;
  questionKey: string;
  wordId: string;
  wordType: 'noun' | 'verb' | 'preposition' | 'adjective' | 'adverb';
  word: string;
  prompt: string;
  eyebrow: string;
  mode: QuestionMode;
  correctAnswer: string;
  answerPrefix?: string;
  options?: string[];
  notes?: string;
}
type RawQuizQuestion = Omit<QuizQuestion, 'questionKey'>;

const people: Record<PresentPerson, string> = {
  ich: 'ich', du: 'du', erSieEs: 'er / sie / es', wir: 'wir', ihr: 'ihr', sieSie: 'sie / Sie',
};
const supportedPresentPeople = new Set<PresentPerson>(['ich', 'du', 'erSieEs', 'ihr']);
const normalizeQuestionWord = (word: string) => word.trim().toLocaleLowerCase('de-DE').normalize('NFC');

const questionFacet = (id: string) => {
  const person = id.match(/-(present|preterite)-(ich|du|erSieEs|wir|ihr|sieSie)$/);
  if (person) return `${person[1]}:${person[2]}`;
  return ['translation', 'article', 'plural', 'participle', 'auxiliary', 'case', 'movement', 'location', 'comparative', 'superlative'].find((facet) => id.endsWith(`-${facet}`)) ?? id;
};

const keyQuestion = (question: RawQuizQuestion): QuizQuestion => ({
  ...question,
  questionKey: `v1:${question.wordType}:${encodeURIComponent(normalizeQuestionWord(question.word))}:${questionFacet(question.id)}`,
});

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

const nounBlock = (noun: Noun, pool: readonly Noun[], random: () => number): RawQuizQuestion[] => [
  { id: `${noun.id}-translation`, wordId: noun.id, wordType: 'noun', word: noun.german, eyebrow: 'Noun · meaning', prompt: `What does “${noun.german}” mean?`, mode: 'choice', correctAnswer: noun.english, options: translationOptions(noun.english, pool, random) },
  { id: `${noun.id}-article`, wordId: noun.id, wordType: 'noun', word: noun.german, eyebrow: 'Noun · article', prompt: `Which article belongs to “${noun.german}”?`, mode: 'choice', correctAnswer: noun.article, options: shuffle(['der', 'die', 'das'], random) },
  { id: `${noun.id}-plural`, wordId: noun.id, wordType: 'noun', word: noun.german, eyebrow: 'Noun · plural', prompt: `Write the plural of “${noun.german}”.`, mode: 'text', correctAnswer: noun.plural },
];

const verbCandidates = (verb: Verb, random: () => number, excludedQuestionKeys: ReadonlySet<string>): RawQuizQuestion[] => {
  const candidates: RawQuizQuestion[] = [];
  for (const [person, answer] of Object.entries(verb.present ?? {}) as [PresentPerson, string][]) {
    if (!supportedPresentPeople.has(person)) continue;
    candidates.push({ id: `${verb.id}-present-${person}`, wordId: verb.id, wordType: 'verb', word: verb.infinitive, eyebrow: 'Verb · present tense', prompt: `Conjugate “${verb.infinitive}” for ${people[person]}.`, mode: 'text', correctAnswer: answer, notes: verb.notes });
  }
  for (const [person, answer] of Object.entries(verb.preterite ?? {}) as [PresentPerson, string][]) {
    candidates.push({ id: `${verb.id}-preterite-${person}`, wordId: verb.id, wordType: 'verb', word: verb.infinitive, eyebrow: 'Verb · Präteritum', prompt: `Conjugate “${verb.infinitive}” in Präteritum for ${people[person]}.`, mode: 'text', correctAnswer: answer, notes: verb.notes });
  }
  if (verb.pastParticiple) candidates.push({ id: `${verb.id}-participle`, wordId: verb.id, wordType: 'verb', word: verb.infinitive, eyebrow: 'Verb · past participle', prompt: `Write the past participle of “${verb.infinitive}”.`, mode: 'text', correctAnswer: verb.pastParticiple, notes: verb.notes });
  if (verb.auxiliary) candidates.push({ id: `${verb.id}-auxiliary`, wordId: verb.id, wordType: 'verb', word: verb.infinitive, eyebrow: 'Verb · auxiliary', prompt: `Which auxiliary does “${verb.infinitive}” use?`, mode: 'choice', correctAnswer: verb.auxiliary, options: shuffle(['hat', 'ist'], random), notes: verb.notes });
  if (verb.case) candidates.push({ id: `${verb.id}-case`, wordId: verb.id, wordType: 'verb', word: verb.infinitive, eyebrow: 'Verb · grammatical case', prompt: `Which case does “${verb.infinitive}” take?`, mode: 'choice', correctAnswer: verb.case, options: shuffle(['Akkusativ', 'Dativ', 'Akkusativ + Dativ'], random), notes: verb.notes });
  return shuffle(candidates.filter((question) => !excludedQuestionKeys.has(keyQuestion(question).questionKey)), random).slice(0, 3);
};

const adjectiveAdverbBlock = (item: AdjectiveAdverb, pool: readonly AdjectiveAdverb[], random: () => number): RawQuizQuestion[] => {
  const label = item.kind === 'adjective' ? 'Adjective' : 'Adverb';
  const superlativeAnswer = item.superlative?.replace(/^am\s+/i, '') ?? '';
  return [
    { id: `${item.id}-translation`, wordId: item.id, wordType: item.kind, word: item.german, eyebrow: `${label} · meaning`, prompt: `What does “${item.german}” mean?`, mode: 'choice', correctAnswer: item.english, options: translationOptions(item.english, pool, random) },
    ...(item.comparative ? [{ id: `${item.id}-comparative`, wordId: item.id, wordType: item.kind, word: item.german, eyebrow: `${label} · comparative`, prompt: `Write the comparative form of “${item.german}”.`, mode: 'text' as const, correctAnswer: item.comparative }] : []),
    ...(item.superlative ? [{ id: `${item.id}-superlative`, wordId: item.id, wordType: item.kind, word: item.german, eyebrow: `${label} · superlative`, prompt: `Write the superlative form of “${item.german}”.`, mode: 'text' as const, answerPrefix: 'am', correctAnswer: superlativeAnswer }] : []),
  ];
};

const verbBlock = (verb: Verb, pool: readonly Verb[], random: () => number, excludedQuestionKeys: ReadonlySet<string>): RawQuizQuestion[] => [
  { id: `${verb.id}-translation`, wordId: verb.id, wordType: 'verb', word: verb.infinitive, eyebrow: 'Verb · meaning', prompt: `What does “${verb.infinitive}” mean?`, mode: 'choice', correctAnswer: verb.english, options: translationOptions(verb.english, pool, random), notes: verb.notes },
  ...verbCandidates(verb, random, excludedQuestionKeys),
];

const prepositionBlock = (preposition: Preposition, random: () => number): RawQuizQuestion[] => {
  const base = { wordId: preposition.id, wordType: 'preposition' as const, word: preposition.german, mode: 'choice' as const, options: shuffle(['Akkusativ', 'Dativ'], random) };
  if (preposition.usage === 'fixed') {
    return [{ ...base, id: `${preposition.id}-case`, eyebrow: 'Preposition · grammatical case', prompt: `Which case does “${preposition.german}” take?`, correctAnswer: preposition.case }];
  }
  return [
    { ...base, id: `${preposition.id}-movement`, eyebrow: 'Two-way preposition · movement', prompt: `Which case does “${preposition.german}” take with movement toward a destination?`, correctAnswer: 'Akkusativ' },
    { ...base, id: `${preposition.id}-location`, eyebrow: 'Two-way preposition · no movement', prompt: `Which case does “${preposition.german}” take for a fixed location?`, correctAnswer: 'Dativ', options: shuffle(['Akkusativ', 'Dativ'], random) },
  ];
};

export const createQuiz = (source: Vocabulary, amount: number, random: () => number = Math.random, excludedQuestionKeys: ReadonlySet<string> = new Set()): QuizQuestion[] => {
  const blocks = shuffle([
    ...source.nouns.map((noun) => nounBlock(noun, source.nouns, random)),
    ...source.verbs.map((verb) => verbBlock(verb, source.verbs, random, excludedQuestionKeys)),
    ...source.prepositions.flatMap((preposition) => prepositionBlock(preposition, random).map((question) => [question])),
    ...source.adjectivesAndAdverbs.map((item) => adjectiveAdverbBlock(item, source.adjectivesAndAdverbs, random)),
  ], random);
  const questions = blocks.flat().map(keyQuestion).filter((question) => !excludedQuestionKeys.has(question.questionKey));
  return questions.slice(0, Math.max(0, Math.min(Math.floor(amount), questions.length)));
};

export const getMaximumQuestionCount = (source: Vocabulary, excludedQuestionKeys: ReadonlySet<string> = new Set()) => createQuiz(source, Number.MAX_SAFE_INTEGER, () => 0.5, excludedQuestionKeys).length;

export const normalizeAnswer = (answer: string) => answer
  .trim()
  .toLocaleLowerCase('de-DE')
  .replace(/ä/g, 'ae')
  .replace(/ö/g, 'oe')
  .replace(/ü/g, 'ue')
  .replace(/ß/g, 'ss');
export const isCorrectAnswer = (answer: string, correct: string) => normalizeAnswer(answer) === normalizeAnswer(correct);
