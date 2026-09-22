import { describe, expect, it } from 'vitest';
import type { Vocabulary } from '@/data/vocabulary';
import { CANONICAL_PREPOSITION_GROUPS, vocabulary } from '@/data/vocabulary';
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

const specialSource = {
  nouns: [],
  verbs: [
    {
      id: 'move',
      infinitive: 'umziehen',
      english: 'to move',
      reflexive: 'sometimes',
      auxiliary: 'ist',
      present: { ich: 'ziehe um', du: 'ziehst um' },
      pastParticiple: 'umgezogen',
      case: 'Akkusativ',
    },
    {
      id: 'hurry',
      infinitive: 'sich beeilen',
      english: 'to hurry',
      reflexive: 'always',
      auxiliary: 'hat',
    },
    {
      id: 'read',
      infinitive: 'lesen',
      english: 'to read',
      reflexive: 'no',
      auxiliary: 'hat',
    },
    {
      id: 'help',
      infinitive: 'helfen',
      english: 'to help',
      reflexive: 'no',
      auxiliary: 'hat',
    },
    {
      id: 'learn',
      infinitive: 'lernen',
      english: 'to learn',
      reflexive: 'no',
      auxiliary: 'hat',
    },
  ],
  prepositions: [],
  adjectivesAndAdverbs: [],
} satisfies Vocabulary;

const moveBlock = (quiz: ReturnType<typeof createQuiz>) =>
  quiz.filter((question) => question.wordId === 'move');

describe('quiz generation', () => {
  it('omits plural questions for nouns without a plural in their meaning', () => {
    const pech = vocabulary.nouns.find((noun) => noun.id === 'pech')!;
    const quiz = createQuiz(
      { nouns: [pech], verbs: [], prepositions: [], adjectivesAndAdverbs: [] },
      99,
      () => 0,
    );
    expect(quiz.map((question) => question.id)).toEqual([
      'pech-translation',
      'pech-article',
    ]);
  });

  it('uses four distinct verbs with valid labels for reflexive and ist questions', () => {
    for (const randomValue of [0, 0.99]) {
      const first = moveBlock(
        createQuiz(specialSource, 99, () => randomValue),
      )[0];
      expect(first.mode).toBe('choice');
      expect(first.options).toHaveLength(4);
      expect(
        new Set(first.options?.map((option) => option.toLowerCase())).size,
      ).toBe(4);
      expect(first.correctAnswer).toBe('umziehen');
      expect(first.options).toContain('umziehen');
      expect(first.options).not.toContain('sich beeilen');
      expect(first.id).toBe(
        randomValue === 0 ? 'move-reflexive' : 'move-auxiliary',
      );
      expect(first.prompt).toBe(
        randomValue === 0
          ? 'Which of these verbs is SOMETIMES reflexive?'
          : "Which of these words use the Auxiliary 'ist'?",
      );
      for (const option of first.options!.filter(
        (item) => item !== 'umziehen',
      )) {
        const distractor = specialSource.verbs.find(
          (item) => item.infinitive.replace(/^sich\s+/, '') === option,
        )!;
        expect(
          randomValue === 0
            ? distractor.reflexive !== 'sometimes'
            : distractor.auxiliary === 'hat',
        ).toBe(true);
      }
    }
    const hurry = createQuiz(specialSource, 99, () => 0).find(
      (question) => question.id === 'hurry-reflexive',
    );
    expect(hurry?.prompt).toBe('Which of these verbs is ALWAYS reflexive?');
    expect(hurry?.options).toHaveLength(4);
    expect(hurry?.correctAnswer).toBe('beeilen');
    expect(hurry?.options).toContain('beeilen');
    expect(hurry?.options).not.toContain('sich beeilen');
    expect(hurry?.questionKey).toBe('v1:verb:sich%20beeilen:reflexive');
  });

  it('treats infinitives with and without sich as the same option', () => {
    const withDuplicate = {
      ...specialSource,
      verbs: [
        ...specialSource.verbs,
        {
          id: 'hurry-duplicate',
          infinitive: 'beeilen',
          english: 'to hurry',
          reflexive: 'no',
          auxiliary: 'hat',
        },
      ],
    } satisfies Vocabulary;
    const hurry = createQuiz(withDuplicate, 99, () => 0).find(
      (question) => question.id === 'hurry-reflexive',
    );
    expect(hurry?.options).toHaveLength(4);
    expect(
      hurry?.options?.filter((option) => option === 'beeilen'),
    ).toHaveLength(1);
  });

  it('identifies the strong meaning in the wiegen participle question', () => {
    const wiegen = vocabulary.verbs.find((verb) => verb.id === 'wiegen')!;
    expect(wiegen.reflexive).toBe('no');
    const participleOnly = { ...wiegen, present: undefined, case: undefined };
    const quiz = createQuiz(
      {
        nouns: [],
        verbs: [participleOnly],
        prepositions: [],
        adjectivesAndAdverbs: [],
      },
      99,
      () => 0,
    );
    const participle = quiz.find(
      (question) => question.id === 'wiegen-participle',
    );
    expect(participle?.prompt).toBe(
      'Write the past participle of “wiegen” (to weigh).',
    );
    expect(participle?.correctAnswer).toBe('gewogen');
  });

  it('places one eligible question before translation and leaves two follow-ups', () => {
    const block = moveBlock(createQuiz(specialSource, 99, () => 0));
    expect(block.map((question) => question.id).slice(0, 2)).toEqual([
      'move-reflexive',
      'move-translation',
    ]);
    expect(block).toHaveLength(4);
    expect(
      block
        .slice(2)
        .every(
          (question) =>
            !question.id.endsWith('-auxiliary') &&
            !question.id.endsWith('-reflexive'),
        ),
    ).toBe(true);
    const plain = createQuiz(specialSource, 99, () => 0).filter(
      (question) => question.wordId === 'read',
    );
    expect(plain.map((question) => question.id)).toEqual(['read-translation']);
  });

  it('offers the other special question when one is mastered', () => {
    const first = moveBlock(createQuiz(specialSource, 99, () => 0))[0];
    const withReflexiveMastered = moveBlock(
      createQuiz(specialSource, 99, () => 0, new Set([first.questionKey])),
    );
    expect(withReflexiveMastered[0].id).toBe('move-auxiliary');
    const withBothMastered = moveBlock(
      createQuiz(
        specialSource,
        99,
        () => 0,
        new Set([first.questionKey, withReflexiveMastered[0].questionKey]),
      ),
    );
    expect(withBothMastered[0].id).toBe('move-translation');
    expect(withBothMastered).toHaveLength(4);
  });

  it('skips special questions without three valid distractors', () => {
    const scarce = {
      ...specialSource,
      verbs: specialSource.verbs.slice(0, 3),
    } satisfies Vocabulary;
    expect(moveBlock(createQuiz(scarce, 99, () => 0))[0].id).toBe(
      'move-translation',
    );
    expect(moveBlock(createQuiz(scarce, 99, () => 0))).toHaveLength(4);
  });

  it('labels each existing default verb', () => {
    const sometimes = new Set([
      'umziehen',
      'leihen',
      'wünschen',
      'anbieten',
      'empfehlen',
      'erklären',
      'zeigen',
      'verstehen',
      'merken',
      'entscheiden',
    ]);
    expect(vocabulary.verbs).toHaveLength(165);
    for (const verb of vocabulary.verbs.slice(0, 86))
      expect(verb.reflexive).toBe(
        sometimes.has(verb.infinitive) ? 'sometimes' : 'no',
      );
  });
  it('calculates the available unique questions', () => {
    expect(getMaximumQuestionCount(source)).toBe(13);
  });

  it('returns the exact requested total and trims a final block', () => {
    expect(createQuiz(source, 1, () => 0.5)).toHaveLength(1);
    expect(createQuiz(source, 9, () => 0.5)).toHaveLength(9);
    expect(createQuiz(source, 99, () => 0.5)).toHaveLength(13);
  });

  it('keeps each word translation unique and limits verb follow-ups to three', () => {
    const quiz = createQuiz(source, 13, () => 0.25);
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
    const quiz = createQuiz(source, 13, () => 0.75);
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

  it('generates one visual category question for each canonical preposition', () => {
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
    expect(getMaximumQuestionCount(prepositionOnly)).toBe(2);
    expect(quiz).toHaveLength(2);
    expect(
      quiz.every(
        (question) =>
          question.wordType === 'preposition' && question.mode === 'choice',
      ),
    ).toBe(true);
    const mit = quiz.find((question) => question.id === 'mit-category')!;
    expect(mit.correctAnswer).toBe('mit');
    expect(mit.prompt).toContain('Dative');
    expect(mit.options).toHaveLength(3);
    expect(mit.prepositionDiagram?.hiddenWords).toEqual(
      expect.arrayContaining(mit.options!),
    );
    expect(mit.prepositionDiagram?.hiddenWords).toHaveLength(3);
    const auf = quiz.find((question) => question.id === 'auf-category')!;
    expect(auf.correctAnswer).toBe('auf');
    expect(auf.prompt).toContain('Accusative + Dative');
  });

  it('uses canonical metadata for known imports and legacy questions for unknown imports', () => {
    const mixedPrepositions = {
      nouns: [],
      verbs: [],
      prepositions: [
        { id: 'wrong-mit', german: 'MIT', usage: 'fixed', case: 'Akkusativ' },
        { id: 'along', german: 'entlang', usage: 'fixed', case: 'Akkusativ' },
        { id: 'inside', german: 'innerhalb', usage: 'two-way' },
      ],
      adjectivesAndAdverbs: [],
    } satisfies Vocabulary;
    const quiz = createQuiz(mixedPrepositions, 10, () => 0.5);
    expect(quiz).toHaveLength(4);
    expect(
      quiz.find((question) => question.id === 'wrong-mit-category'),
    ).toMatchObject({
      word: 'mit',
      correctAnswer: 'mit',
    });
    expect(
      quiz.find((question) => question.id === 'along-case'),
    ).not.toHaveProperty('prepositionDiagram');
    expect(quiz.map((question) => question.id)).toEqual(
      expect.arrayContaining(['inside-movement', 'inside-location']),
    );
  });

  it('defines the complete 25-word canonical preposition diagram', () => {
    expect(CANONICAL_PREPOSITION_GROUPS).toEqual([
      {
        category: 'Accusative',
        words: ['bis', 'durch', 'für', 'gegen', 'ohne', 'um'],
      },
      {
        category: 'Accusative + Dative',
        words: [
          'an',
          'auf',
          'hinter',
          'in',
          'neben',
          'über',
          'unter',
          'vor',
          'zwischen',
        ],
      },
      {
        category: 'Dative',
        words: [
          'ab',
          'aus',
          'außer',
          'bei',
          'gegenüber',
          'mit',
          'nach',
          'seit',
          'von',
          'zu',
        ],
      },
    ]);
    expect(vocabulary.prepositions).toHaveLength(25);
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
