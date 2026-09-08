import type { Article, Auxiliary, Noun, Preposition, PresentPerson, Verb, VerbCase, Vocabulary } from '@/data/vocabulary';

export interface VocabularyCollection {
  id: string;
  name: string;
  vocabulary: Vocabulary;
  createdAt: string;
  updatedAt: string;
}

export interface CsvImportResult {
  vocabulary?: Vocabulary;
  errors: string[];
  wordCount: number;
}

export interface MergedVocabularyResult {
  vocabulary: Vocabulary;
  duplicateCount: number;
}

export const COLLECTIONS_STORAGE_KEY = 'wort-fuer-wort.collections.v1';
export const MAX_CSV_BYTES = 2 * 1024 * 1024;

export const CSV_COLUMNS = [
  'type', 'german', 'english', 'article', 'plural', 'usage', 'case',
  'present_ich', 'present_du', 'present_er_sie_es', 'present_wir', 'present_ihr', 'present_sie_sie',
  'preterite_ich', 'preterite_du', 'preterite_er_sie_es', 'preterite_wir', 'preterite_ihr', 'preterite_sie_sie',
  'past_participle', 'auxiliary', 'notes',
] as const;

type CsvColumn = typeof CSV_COLUMNS[number];
type CsvRecord = Record<CsvColumn, string>;

const personColumns: Record<PresentPerson, string> = {
  ich: 'ich', du: 'du', erSieEs: 'er_sie_es', wir: 'wir', ihr: 'ihr', sieSie: 'sie_sie',
};

const emptyVocabulary = (): Vocabulary => ({ nouns: [], verbs: [], prepositions: [] });
const normalize = (value: string) => value.trim().toLocaleLowerCase('de-DE').normalize('NFC');
const makeId = (value: string, index: number) => `${normalize(value).replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'word'}-${index + 1}`;

const parseRows = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') { field += '"'; index += 1; }
      else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"') quoted = true;
    else if (character === ',') { row.push(field); field = ''; }
    else if (character === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (character !== '\r') field += character;
  }
  if (quoted) throw new Error('An opening quote is missing its closing quote.');
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((cells) => cells.some((cell) => cell.trim()));
};

const pickForms = (row: CsvRecord, tense: 'present' | 'preterite') => {
  const forms: Partial<Record<PresentPerson, string>> = {};
  for (const [person, suffix] of Object.entries(personColumns) as [PresentPerson, string][]) {
    const value = row[`${tense}_${suffix}` as CsvColumn]?.trim();
    if (value) forms[person] = value;
  }
  return Object.keys(forms).length ? forms : undefined;
};

export const parseVocabularyCsv = (text: string): CsvImportResult => {
  let rows: string[][];
  try { rows = parseRows(text.replace(/^\uFEFF/, '')); }
  catch (error) { return { errors: [(error as Error).message], wordCount: 0 }; }
  if (!rows.length) return { errors: ['The CSV file is empty.'], wordCount: 0 };

  const headers = rows[0].map((cell) => normalize(cell));
  const duplicateHeaders = headers.filter((header, index) => headers.indexOf(header) !== index);
  if (duplicateHeaders.length) return { errors: [`Duplicate column heading: ${duplicateHeaders[0]}.`], wordCount: 0 };
  const missing = CSV_COLUMNS.filter((column) => !headers.includes(column));
  const unknown = headers.filter((header) => !CSV_COLUMNS.includes(header as CsvColumn));
  if (missing.length || unknown.length) {
    const errors = [
      ...(missing.length ? [`Missing column${missing.length === 1 ? '' : 's'}: ${missing.join(', ')}.`] : []),
      ...(unknown.length ? [`Unknown column${unknown.length === 1 ? '' : 's'}: ${unknown.join(', ')}.`] : []),
    ];
    return { errors, wordCount: 0 };
  }

  const nouns: Noun[] = [];
  const verbs: Verb[] = [];
  const prepositions: Preposition[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();

  rows.slice(1).forEach((cells, rowIndex) => {
    const line = rowIndex + 2;
    if (cells.length > headers.length) { errors.push(`Row ${line}: too many columns.`); return; }
    const values = Object.fromEntries(headers.map((header, index) => [header, cells[index]?.trim() ?? ''])) as CsvRecord;
    const type = normalize(values.type);
    const german = values.german.trim();
    if (!['noun', 'verb', 'preposition'].includes(type)) { errors.push(`Row ${line}: type must be noun, verb, or preposition.`); return; }
    if (!german) { errors.push(`Row ${line}: german is required.`); return; }
    const duplicateKey = `${type}:${normalize(german)}`;
    if (seen.has(duplicateKey)) { errors.push(`Row ${line}: duplicate ${type} “${german}” in this file.`); return; }
    seen.add(duplicateKey);
    const id = makeId(german, rowIndex);

    if (type === 'noun') {
      if (!values.english || !values.plural) { errors.push(`Row ${line}: nouns require english and plural.`); return; }
      if (!['der', 'die', 'das'].includes(normalize(values.article))) { errors.push(`Row ${line}: noun article must be der, die, or das.`); return; }
      nouns.push({ id, german, english: values.english, plural: values.plural, article: normalize(values.article) as Article });
      return;
    }
    if (type === 'verb') {
      if (!values.english) { errors.push(`Row ${line}: verbs require english.`); return; }
      if (values.auxiliary && !['hat', 'ist'].includes(normalize(values.auxiliary))) { errors.push(`Row ${line}: auxiliary must be hat or ist.`); return; }
      const verbCase = values.case.trim();
      if (verbCase && !['Akkusativ', 'Dativ', 'Akkusativ + Dativ'].includes(verbCase)) { errors.push(`Row ${line}: verb case must be Akkusativ, Dativ, or Akkusativ + Dativ.`); return; }
      verbs.push({
        id, infinitive: german, english: values.english,
        present: pickForms(values, 'present'), preterite: pickForms(values, 'preterite'),
        pastParticiple: values.past_participle || undefined,
        auxiliary: normalize(values.auxiliary) as Auxiliary || undefined,
        case: verbCase as VerbCase || undefined, notes: values.notes || undefined,
      });
      return;
    }
    const usage = normalize(values.usage);
    if (!['fixed', 'two-way'].includes(usage)) { errors.push(`Row ${line}: preposition usage must be fixed or two-way.`); return; }
    if (usage === 'fixed' && !['Akkusativ', 'Dativ'].includes(values.case)) { errors.push(`Row ${line}: a fixed preposition requires case Akkusativ or Dativ.`); return; }
    if (usage === 'fixed') prepositions.push({ id, german, usage: 'fixed', case: values.case as 'Akkusativ' | 'Dativ' });
    else prepositions.push({ id, german, usage: 'two-way' });
  });

  const wordCount = nouns.length + verbs.length + prepositions.length;
  if (!wordCount && !errors.length) errors.push('The CSV has headings but contains no vocabulary rows.');
  return errors.length ? { errors, wordCount } : { vocabulary: { nouns, verbs, prepositions }, errors: [], wordCount };
};

const csvCell = (value: string | undefined) => {
  const text = value == null ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export const vocabularyToCsv = (source: Vocabulary) => {
  const records: Partial<CsvRecord>[] = [];
  for (const noun of source.nouns) records.push({ type: 'noun', german: noun.german, english: noun.english, article: noun.article, plural: noun.plural });
  for (const verb of source.verbs) {
    const record: Partial<CsvRecord> = { type: 'verb', german: verb.infinitive, english: verb.english, past_participle: verb.pastParticiple, auxiliary: verb.auxiliary, case: verb.case, notes: verb.notes };
    for (const [person, suffix] of Object.entries(personColumns) as [PresentPerson, string][]) {
      record[`present_${suffix}` as CsvColumn] = verb.present?.[person];
      record[`preterite_${suffix}` as CsvColumn] = verb.preterite?.[person];
    }
    records.push(record);
  }
  for (const preposition of source.prepositions) records.push({ type: 'preposition', german: preposition.german, usage: preposition.usage, case: preposition.usage === 'fixed' ? preposition.case : '' });
  return [CSV_COLUMNS.join(','), ...records.map((record) => CSV_COLUMNS.map((column) => csvCell(record[column])).join(','))].join('\r\n');
};

export const vocabularyTemplateCsv = () => vocabularyToCsv({
  nouns: [{ id: 'example-noun', german: 'Apfel', english: 'apple', article: 'der', plural: 'Äpfel' }],
  verbs: [{ id: 'example-verb', infinitive: 'lernen', english: 'to learn', present: { ich: 'lerne', du: 'lernst', erSieEs: 'lernt', wir: 'lernen', ihr: 'lernt', sieSie: 'lernen' }, pastParticiple: 'gelernt', auxiliary: 'hat', case: 'Akkusativ', notes: 'Replace or remove these example rows.' }],
  prepositions: [{ id: 'example-preposition', german: 'mit', usage: 'fixed', case: 'Dativ' }],
});

export const loadCollections = (): VocabularyCollection[] => {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(COLLECTIONS_STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item.id === 'string' && typeof item.name === 'string' && item.vocabulary) : [];
  } catch { return []; }
};

export const saveCollections = (collections: VocabularyCollection[]) => {
  window.localStorage.setItem(COLLECTIONS_STORAGE_KEY, JSON.stringify(collections));
};

export const mergeVocabularies = (sources: { id: string; vocabulary: Vocabulary }[]): MergedVocabularyResult => {
  const merged = emptyVocabulary() as { nouns: Noun[]; verbs: Verb[]; prepositions: Preposition[] };
  const seen = new Set<string>();
  let duplicateCount = 0;
  const add = <T extends Noun | Verb | Preposition>(type: 'noun' | 'verb' | 'preposition', item: T, target: T[], sourceId: string, german: string) => {
    const key = `${type}:${normalize(german)}`;
    if (seen.has(key)) { duplicateCount += 1; return; }
    seen.add(key);
    target.push({ ...item, id: `${sourceId}-${item.id}` });
  };
  for (const source of sources) {
    source.vocabulary.nouns.forEach((item) => add('noun', item, merged.nouns, source.id, item.german));
    source.vocabulary.verbs.forEach((item) => add('verb', item, merged.verbs, source.id, item.infinitive));
    source.vocabulary.prepositions.forEach((item) => add('preposition', item, merged.prepositions, source.id, item.german));
  }
  return { vocabulary: merged, duplicateCount };
};

export const collectionWordCount = (source: Vocabulary) => source.nouns.length + source.verbs.length + source.prepositions.length;
