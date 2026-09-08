/** The editable vocabulary pool. Add or remove entries here, then redeploy. */
export type Article = 'der' | 'die' | 'das';
export type Auxiliary = 'hat' | 'ist';
export type VerbCase = 'Akkusativ' | 'Dativ' | 'Akkusativ + Dativ';
export type PresentPerson = 'ich' | 'du' | 'erSieEs' | 'wir' | 'ihr' | 'sieSie';
export type PrepositionCase = 'Akkusativ' | 'Dativ';

export interface Noun {
  id: string;
  german: string;
  english: string;
  plural: string;
  article: Article;
}

export interface Verb {
  id: string;
  infinitive: string;
  english: string;
  present?: Partial<Record<PresentPerson, string>>;
  /** Optional simple-past forms. Every provided person can become a written Präteritum question. */
  preterite?: Partial<Record<PresentPerson, string>>;
  pastParticiple?: string;
  auxiliary?: Auxiliary;
  case?: VerbCase;
  notes?: string;
}

export interface AdjectiveAdverb {
  id: string;
  kind: 'adjective' | 'adverb';
  german: string;
  english: string;
  comparative?: string;
  superlative?: string;
}

export type Preposition =
  | { id: string; german: string; usage: 'fixed'; case: PrepositionCase }
  | { id: string; german: string; usage: 'two-way' };

export interface Vocabulary {
  nouns: readonly Noun[];
  verbs: readonly Verb[];
  prepositions: readonly Preposition[];
  adjectivesAndAdverbs: readonly AdjectiveAdverb[];
}

export const vocabulary = {
  nouns: [
    { id: 'haus', german: 'Haus', english: 'house', plural: 'Häuser', article: 'das' },
    { id: 'freund', german: 'Freund', english: 'friend', plural: 'Freunde', article: 'der' },
    { id: 'zeitung', german: 'Zeitung', english: 'newspaper', plural: 'Zeitungen', article: 'die' },
    { id: 'kind', german: 'Kind', english: 'child', plural: 'Kinder', article: 'das' },
    { id: 'stadt', german: 'Stadt', english: 'city', plural: 'Städte', article: 'die' },
    { id: 'tisch', german: 'Tisch', english: 'table', plural: 'Tische', article: 'der' },
    { id: 'buch', german: 'Buch', english: 'book', plural: 'Bücher', article: 'das' },
    { id: 'wohnung', german: 'Wohnung', english: 'apartment', plural: 'Wohnungen', article: 'die' },
  ],
  verbs: [
    { id: 'fahren', infinitive: 'fahren', english: 'to drive / travel', present: { ich: 'fahre', du: 'fährst', erSieEs: 'fährt', ihr: 'fahrt' }, pastParticiple: 'gefahren', auxiliary: 'ist', notes: 'Uses sein when it describes movement from one place to another.' },
    { id: 'danken', infinitive: 'danken', english: 'to thank', present: { ich: 'danke', du: 'dankst', erSieEs: 'dankt' }, pastParticiple: 'gedankt', auxiliary: 'hat', case: 'Dativ' },
    { id: 'bezahlen', infinitive: 'bezahlen', english: 'to pay', present: { ich: 'bezahle', du: 'bezahlst', erSieEs: 'bezahlt' }, pastParticiple: 'bezahlt', auxiliary: 'hat', case: 'Akkusativ' },
    { id: 'essen', infinitive: 'essen', english: 'to eat', present: { ich: 'esse', du: 'isst', erSieEs: 'isst' }, pastParticiple: 'gegessen', auxiliary: 'hat', case: 'Akkusativ' },
    { id: 'schlafen', infinitive: 'schlafen', english: 'to sleep', present: { ich: 'schlafe', du: 'schläfst', erSieEs: 'schläft' }, pastParticiple: 'geschlafen', auxiliary: 'hat' },
    { id: 'helfen', infinitive: 'helfen', english: 'to help', present: { ich: 'helfe', du: 'hilfst', erSieEs: 'hilft' }, pastParticiple: 'geholfen', auxiliary: 'hat', case: 'Dativ' },
    { id: 'lesen', infinitive: 'lesen', english: 'to read', present: { ich: 'lese', du: 'liest', erSieEs: 'liest' }, pastParticiple: 'gelesen', auxiliary: 'hat', case: 'Akkusativ' },
    { id: 'sprechen', infinitive: 'sprechen', english: 'to speak', present: { ich: 'spreche', du: 'sprichst', erSieEs: 'spricht' }, pastParticiple: 'gesprochen', auxiliary: 'hat' },
    { id: 'wollen', infinitive: 'wollen', english: 'to want', present: { ich: 'will', du: 'willst', erSieEs: 'will', ihr: 'wollt' }, preterite: { ich: 'wollte', du: 'wolltest', erSieEs: 'wollte', wir: 'wollten', ihr: 'wolltet', sieSie: 'wollten' } },
    { id: 'muessen', infinitive: 'müssen', english: 'to have to / must', present: { ich: 'muss', du: 'musst', erSieEs: 'muss', ihr: 'müsst' }, preterite: { ich: 'musste', du: 'musstest', erSieEs: 'musste', wir: 'mussten', ihr: 'musstet', sieSie: 'mussten' } },
    { id: 'koennen', infinitive: 'können', english: 'to be able to / can', present: { ich: 'kann', du: 'kannst', erSieEs: 'kann', ihr: 'könnt' }, preterite: { ich: 'konnte', du: 'konntest', erSieEs: 'konnte', wir: 'konnten', ihr: 'konntet', sieSie: 'konnten' } },
    { id: 'duerfen', infinitive: 'dürfen', english: 'to be allowed to / may', present: { ich: 'darf', du: 'darfst', erSieEs: 'darf', ihr: 'dürft' }, preterite: { ich: 'durfte', du: 'durftest', erSieEs: 'durfte', wir: 'durften', ihr: 'durftet', sieSie: 'durften' } },
    { id: 'sollen', infinitive: 'sollen', english: 'to be supposed to / should', present: { ich: 'soll', du: 'sollst', erSieEs: 'soll', ihr: 'sollt' }, preterite: { ich: 'sollte', du: 'solltest', erSieEs: 'sollte', wir: 'sollten', ihr: 'solltet', sieSie: 'sollten' } },
  ],
  prepositions: [
    { id: 'aus', german: 'aus', usage: 'fixed', case: 'Dativ' },
    { id: 'ausser', german: 'außer', usage: 'fixed', case: 'Dativ' },
    { id: 'bei', german: 'bei', usage: 'fixed', case: 'Dativ' },
    { id: 'mit', german: 'mit', usage: 'fixed', case: 'Dativ' },
    { id: 'nach', german: 'nach', usage: 'fixed', case: 'Dativ' },
    { id: 'seit', german: 'seit', usage: 'fixed', case: 'Dativ' },
    { id: 'von', german: 'von', usage: 'fixed', case: 'Dativ' },
    { id: 'zu', german: 'zu', usage: 'fixed', case: 'Dativ' },
    { id: 'gegenueber', german: 'gegenüber', usage: 'fixed', case: 'Dativ' },
    { id: 'durch', german: 'durch', usage: 'fixed', case: 'Akkusativ' },
    { id: 'fuer', german: 'für', usage: 'fixed', case: 'Akkusativ' },
    { id: 'gegen', german: 'gegen', usage: 'fixed', case: 'Akkusativ' },
    { id: 'ohne', german: 'ohne', usage: 'fixed', case: 'Akkusativ' },
    { id: 'um', german: 'um', usage: 'fixed', case: 'Akkusativ' },
    { id: 'an', german: 'an', usage: 'two-way' },
    { id: 'auf', german: 'auf', usage: 'two-way' },
    { id: 'hinter', german: 'hinter', usage: 'two-way' },
    { id: 'in', german: 'in', usage: 'two-way' },
    { id: 'neben', german: 'neben', usage: 'two-way' },
    { id: 'ueber', german: 'über', usage: 'two-way' },
    { id: 'unter', german: 'unter', usage: 'two-way' },
    { id: 'vor', german: 'vor', usage: 'two-way' },
    { id: 'zwischen', german: 'zwischen', usage: 'two-way' },
  ],
  adjectivesAndAdverbs: [],
} as const satisfies Vocabulary;
