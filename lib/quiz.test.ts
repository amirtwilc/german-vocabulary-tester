import { describe, expect, it } from 'vitest';
import type { Vocabulary } from '@/data/vocabulary';
import { vocabulary } from '@/data/vocabulary';
import {
  createQuiz,
  getMaximumQuestionCount,
  isCorrectAnswer,
} from '@/lib/quiz';

const source = {
  nouns: [
    {
      id: 'book',
      german: 'Buch',
      english: 'book',
      plural: 'Bücher',
      article: 'das',
    },
    {
      id: 'city',
      german: 'Stadt',
      english: 'city',
      plural: 'Städte',
      article: 'die',
    },
  ],
  verbs: [
    {
      id: 'read',
      infinitive: 'lesen',
      english: 'to read',
      present: { ich: 'lese', wir: 'lesen' },
      pastParticiple: 'gelesen',
      auxiliary: 'hat',
      case: 'Akkusativ',
    },
    {
      id: 'help',
      infinitive: 'helfen',
      english: 'to help',
      present: { ich: 'helfe' },
      auxiliary: 'hat',
      case: 'Dativ',
    },
  ],
  prepositions: [],
  adjectivesAndAdverbs: [],
} satisfies Vocabulary;

describe('quiz generation', () => {
  it('calculates the available unique questions', () => {
    expect(getMaximumQuestionCount(source)).toBe(14);
  });

  it('returns the exact requested total and trims a final block', () => {
    expect(createQuiz(source, 1, () => 0.5)).toHaveLength(1);
    expect(createQuiz(source, 9, () => 0.5)).toHaveLength(9);
    expect(createQuiz(source, 99, () => 0.5)).toHaveLength(14);
  });

  it('keeps each word translation unique and limits verb follow-ups to three', () => {
    const quiz = createQuiz(source, 14, () => 0.25);
    const translations = quiz.filter((question) =>
      question.id.endsWith('-translation'),
    );
    expect(new Set(translations.map((question) => question.wordId)).size).toBe(
      4,
    );
    expect(quiz.filter((question) => question.wordId === 'read')).toHaveLength(
      4,
    );
  });

  it('uses unique, same-category translation options and supports small pools', () => {
    const quiz = createQuiz(source, 14, () => 0.75);
    for (const question of quiz.filter((item) =>
      item.id.endsWith('-translation'),
    )) {
      expect(new Set(question.options).size).toBe(question.options?.length);
      expect(question.options).toContain(question.correctAnswer);
      expect(question.options).toHaveLength(2);
    }
  });

  it('grades case-insensitively and accepts German character substitutions', () => {
    expect(isCorrectAnswer('  BÜCHER ', 'Bücher')).toBe(true);
    expect(isCorrectAnswer('Buecher', 'Bücher')).toBe(true);
    expect(isCorrectAnswer('schoen', 'schön')).toBe(true);
    expect(isCorrectAnswer('gruen', 'grün')).toBe(true);
    expect(isCorrectAnswer('Strasse', 'Straße')).toBe(true);
    expect(isCorrectAnswer('Bucher', 'Bücher')).toBe(false);
  });

  it('creates written Präteritum questions from optional per-person forms', () => {
    const modalOnly = {
      nouns: [],
      verbs: [
        {
          id: 'can',
          infinitive: 'können',
          english: 'can',
          preterite: {
            ich: 'konnte',
            du: 'konntest',
            wir: 'konnten',
            ihr: 'konntet',
          },
        },
      ],
      prepositions: [],
      adjectivesAndAdverbs: [],
    } satisfies Vocabulary;
    const quiz = createQuiz(modalOnly, 10, () => 0.5);
    expect(quiz).toHaveLength(4);
    expect(
      quiz
        .slice(1)
        .every(
          (question) =>
            question.mode === 'text' &&
            question.eyebrow === 'Verb · Präteritum',
        ),
    ).toBe(true);
    expect(
      quiz.slice(1).every((question) => question.id.includes('-preterite-')),
    ).toBe(true);
  });

  it('adds Präteritum only to the requested modal verbs', () => {
    const modalIds = ['wollen', 'muessen', 'koennen', 'duerfen', 'sollen'];
    const existingIds = [
      'fahren',
      'danken',
      'bezahlen',
      'essen',
      'schlafen',
      'helfen',
      'lesen',
      'sprechen',
    ];
    expect(
      vocabulary.verbs
        .filter((verb) => modalIds.includes(verb.id))
        .every(
          (verb) =>
            'preterite' in verb && Object.keys(verb.preterite).length === 6,
        ),
    ).toBe(true);
    expect(
      vocabulary.verbs
        .filter((verb) => existingIds.includes(verb.id))
        .every((verb) => !('preterite' in verb)),
    ).toBe(true);
  });

  it('generates one fixed-case question and two movement questions for prepositions', () => {
    const prepositionOnly = {
      nouns: [],
      verbs: [],
      prepositions: [
        { id: 'mit', german: 'mit', usage: 'fixed', case: 'Dativ' },
        { id: 'auf', german: 'auf', usage: 'two-way' },
      ],
      adjectivesAndAdverbs: [],
    } satisfies Vocabulary;
    const quiz = createQuiz(prepositionOnly, 10, () => 0.5);
    expect(getMaximumQuestionCount(prepositionOnly)).toBe(3);
    expect(quiz).toHaveLength(3);
    expect(
      quiz.every(
        (question) =>
          question.wordType === 'preposition' && question.mode === 'choice',
      ),
    ).toBe(true);
    expect(
      quiz.find((question) => question.id === 'mit-case')?.correctAnswer,
    ).toBe('Dativ');
    expect(
      quiz.find((question) => question.id === 'auf-movement')?.correctAnswer,
    ).toBe('Akkusativ');
    expect(
      quiz.find((question) => question.id === 'auf-location')?.correctAnswer,
    ).toBe('Dativ');
  });

  it('shuffles the two halves of a two-way preposition independently', () => {
    const mixedPrepositions = {
      nouns: [],
      verbs: [],
      prepositions: [
        { id: 'mit', german: 'mit', usage: 'fixed', case: 'Dativ' },
        { id: 'durch', german: 'durch', usage: 'fixed', case: 'Akkusativ' },
        { id: 'vor', german: 'vor', usage: 'two-way' },
      ],
      adjectivesAndAdverbs: [],
    } satisfies Vocabulary;
    const quiz = createQuiz(mixedPrepositions, 4, () => 0.5);
    const movementIndex = quiz.findIndex(
      (question) => question.id === 'vor-movement',
    );
    const locationIndex = quiz.findIndex(
      (question) => question.id === 'vor-location',
    );
    expect(Math.abs(movementIndex - locationIndex)).toBeGreaterThan(1);
  });

  it('creates written comparative and superlative questions for adjectives and adverbs', () => {
    const modifiers = {
      nouns: [],
      verbs: [],
      prepositions: [],
      adjectivesAndAdverbs: [
        {
          id: 'good',
          kind: 'adjective',
          german: 'gut',
          english: 'good',
          comparative: 'besser',
          superlative: 'am besten',
        },
        {
          id: 'often',
          kind: 'adverb',
          german: 'oft',
          english: 'often',
          comparative: 'öfter',
        },
      ],
    } satisfies Vocabulary;
    const quiz = createQuiz(modifiers, 10, () => 0.5);
    expect(getMaximumQuestionCount(modifiers)).toBe(5);
    expect(quiz).toHaveLength(5);
    expect(
      quiz
        .filter((question) => question.id.includes('comparative'))
        .every((question) => question.mode === 'text'),
    ).toBe(true);
    expect(
      quiz.find((question) => question.id === 'good-superlative'),
    ).toMatchObject({
      mode: 'text',
      answerPrefix: 'am',
      correctAnswer: 'besten',
      wordType: 'adjective',
    });
  });

  it('does not create present-tense questions for wir or sie / Sie', () => {
    const verb = {
      nouns: [],
      verbs: [
        {
          id: 'pay',
          infinitive: 'bezahlen',
          english: 'to pay',
          present: { wir: 'bezahlen', sieSie: 'bezahlen' },
        },
      ],
      prepositions: [],
      adjectivesAndAdverbs: [],
    } satisfies Vocabulary;
    const quiz = createQuiz(verb, 10, () => 0.5);
    expect(quiz).toHaveLength(1);
    expect(quiz[0].id).toBe('pay-translation');
  });

  it('includes the requested default comparison forms', () => {
    expect(vocabulary.adjectivesAndAdverbs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          german: 'schön',
          comparative: 'schöner',
          superlative: 'am schönsten',
        }),
        expect.objectContaining({
          german: 'kurz',
          comparative: 'kürzer',
          superlative: 'am kürzesten',
        }),
        expect.objectContaining({
          german: 'gut',
          comparative: 'besser',
          superlative: 'am besten',
        }),
        expect.objectContaining({
          german: 'gern',
          kind: 'adverb',
          comparative: 'lieber',
          superlative: 'am liebsten',
        }),
        expect.objectContaining({
          german: 'viel',
          comparative: 'mehr',
          superlative: 'am meisten',
        }),
        expect.objectContaining({
          german: 'nah',
          comparative: 'näher',
          superlative: 'am nächsten',
        }),
      ]),
    );
  });

  it('excludes a specific hidden question before calculating quiz size', () => {
    const small = {
      nouns: [],
      verbs: [
        {
          id: 'help',
          infinitive: 'helfen',
          english: 'to help',
          present: { ich: 'helfe', du: 'hilfst', erSieEs: 'hilft' },
        },
      ],
      prepositions: [],
      adjectivesAndAdverbs: [],
    } satisfies Vocabulary;
    const allQuestions = createQuiz(small, 10, () => 0.5);
    const hiddenKey = allQuestions.find(
      (question) => question.id === 'help-present-ich',
    )!.questionKey;
    const hidden = new Set([hiddenKey]);
    const filtered = createQuiz(small, 10, () => 0.5, hidden);
    expect(getMaximumQuestionCount(small, hidden)).toBe(3);
    expect(filtered).toHaveLength(3);
    expect(
      filtered.some((question) => question.questionKey === hiddenKey),
    ).toBe(false);
    expect(filtered.some((question) => question.id === 'help-present-du')).toBe(
      true,
    );
  });

  it('uses the same question key for duplicate words from different collections', () => {
    const first = {
      nouns: [],
      verbs: [
        {
          id: 'default-help',
          infinitive: 'helfen',
          english: 'to help',
          present: { ich: 'helfe' },
        },
      ],
      prepositions: [],
      adjectivesAndAdverbs: [],
    } satisfies Vocabulary;
    const second = {
      nouns: [],
      verbs: [
        {
          id: 'custom-row-9',
          infinitive: 'Helfen',
          english: 'to help',
          present: { ich: 'helfe' },
        },
      ],
      prepositions: [],
      adjectivesAndAdverbs: [],
    } satisfies Vocabulary;
    const firstQuestion = createQuiz(first, 10, () => 0.5).find((question) =>
      question.id.endsWith('present-ich'),
    )!;
    const secondQuestion = createQuiz(second, 10, () => 0.5).find((question) =>
      question.id.endsWith('present-ich'),
    )!;
    expect(firstQuestion.questionKey).toBe(secondQuestion.questionKey);
  });
});
