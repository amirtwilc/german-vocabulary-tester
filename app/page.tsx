'use client';

import { type ChangeEvent, type SyntheticEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronDown, Clock3, Download, Eye, EyeOff, FileSpreadsheet, Languages, Pencil, RotateCcw, Trash2, Upload, X, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { vocabulary } from '@/data/vocabulary';
import { collectionWordCount, loadCollections, MAX_CSV_BYTES, mergeVocabularies, parseVocabularyCsv, saveCollections, vocabularyTemplateCsv, vocabularyToCsv, type VocabularyCollection } from '@/lib/collections';
import { hiddenQuestionFrom, loadHiddenQuestions, saveHiddenQuestions, type HiddenQuestion } from '@/lib/learning-preferences';
import { createQuiz, getMaximumQuestionCount, isCorrectAnswer, type QuizQuestion } from '@/lib/quiz';

declare global {
  interface Document {
    modelContext?: { registerTool(tool: { name: string; title: string; description: string; inputSchema: object; annotations: { readOnlyHint: boolean; untrustedContentHint: boolean }; execute(input: unknown): unknown }, options?: { signal: AbortSignal }): void | Promise<void> };
  }
}

type Screen = 'setup' | 'quiz' | 'results';
interface AnswerRecord { question: QuizQuestion; answer: string; correct: boolean }
interface ImportMessage { kind: 'success' | 'error'; title: string; details?: string[] }

const formatTime = (milliseconds: number) => {
  const seconds = Math.floor(milliseconds / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

const withAnswerPrefix = (question: QuizQuestion, value: string) => question.answerPrefix ? `${question.answerPrefix} ${value}` : value;
const withoutAnswerPrefix = (question: QuizQuestion, value: string) => question.answerPrefix
  ? value.trim().replace(new RegExp(`^${question.answerPrefix}\\s+`, 'i'), '')
  : value;

export const getCompletionHeading = (correct: number, total: number) => correct === total && total > 0 ? 'Amazing.' : 'Nice work.';

function BrandMark() {
  return <div className="brand-mark" aria-hidden="true"><span /><span /><span /></div>;
}

export default function Home() {
  const [collections, setCollections] = useState<VocabularyCollection[]>([]);
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<string[]>(['default']);
  const [collectionName, setCollectionName] = useState('');
  const [editingCollectionId, setEditingCollectionId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [collectionOpen, setCollectionOpen] = useState(false);
  const [hiddenQuestionsOpen, setHiddenQuestionsOpen] = useState(false);
  const [hiddenQuestions, setHiddenQuestions] = useState<HiddenQuestion[]>([]);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<ImportMessage | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const replacingCollectionId = useRef<string | null>(null);
  const merged = useMemo(() => mergeVocabularies([
    ...(selectedCollectionIds.includes('default') ? [{ id: 'default', vocabulary }] : []),
    ...collections.filter((collection) => selectedCollectionIds.includes(collection.id)).map((collection) => ({ id: collection.id, vocabulary: collection.vocabulary })),
  ]), [collections, selectedCollectionIds]);
  const activeVocabulary = merged.vocabulary;
  const hiddenQuestionKeys = useMemo(() => new Set(hiddenQuestions.map((question) => question.key)), [hiddenQuestions]);
  const maximum = useMemo(() => getMaximumQuestionCount(activeVocabulary, hiddenQuestionKeys), [activeVocabulary, hiddenQuestionKeys]);
  const hiddenQuestionGroups = useMemo(() => {
    const groups = new Map<string, { word: string; wordType: HiddenQuestion['wordType']; questions: HiddenQuestion[] }>();
    for (const question of hiddenQuestions) {
      const groupKey = `${question.wordType}:${question.word.toLocaleLowerCase('de-DE')}`;
      const group = groups.get(groupKey) ?? { word: question.word, wordType: question.wordType, questions: [] };
      group.questions.push(question);
      groups.set(groupKey, group);
    }
    return [...groups.values()].sort((a, b) => a.word.localeCompare(b.word, 'de-DE'));
  }, [hiddenQuestions]);
  const defaultAmount = Math.min(20, maximum);
  const [screen, setScreen] = useState<Screen>('setup');
  const [amount, setAmount] = useState(defaultAmount);
  const quizAmount = maximum > 0 ? Math.max(1, Math.min(amount, maximum)) : 0;
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [feedback, setFeedback] = useState<boolean | null>(null);
  const [locked, setLocked] = useState(false);
  const [exitDialogOpen, setExitDialogOpen] = useState(false);
  const [emptyError, setEmptyError] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const activeStartedAt = useRef<number | null>(null);
  const accumulatedTime = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = loadCollections();
      setCollections(saved);
      setSelectedCollectionIds(['default', ...saved.map((collection) => collection.id)]);
      setHiddenQuestions(loadHiddenQuestions());
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const startQuiz = useCallback((requestedAmount = amount) => {
    const safeAmount = Math.max(1, Math.min(maximum, Math.floor(requestedAmount)));
    const nextQuestions = createQuiz(activeVocabulary, safeAmount, Math.random, hiddenQuestionKeys);
    if (!nextQuestions.length) return false;
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    setAmount(safeAmount);
    setQuestions(nextQuestions);
    setQuestionIndex(0);
    setAnswer('');
    setAnswers([]);
    setFeedback(null);
    setLocked(false);
    setExitDialogOpen(false);
    setEmptyError(false);
    accumulatedTime.current = 0;
    activeStartedAt.current = performance.now();
    setElapsed(0);
    setScreen('quiz');
    return true;
  }, [activeVocabulary, amount, hiddenQuestionKeys, maximum]);

  const updateHiddenQuestions = (next: HiddenQuestion[]) => {
    setHiddenQuestions(next);
    saveHiddenQuestions(next);
  };

  const toggleQuestionHidden = (question: QuizQuestion) => {
    updateHiddenQuestions(hiddenQuestionKeys.has(question.questionKey)
      ? hiddenQuestions.filter((item) => item.key !== question.questionKey)
      : [...hiddenQuestions, hiddenQuestionFrom(question)]);
  };

  const restoreHiddenQuestion = (key: string) => updateHiddenQuestions(hiddenQuestions.filter((question) => question.key !== key));

  const updateCollections = (next: VocabularyCollection[]) => {
    setCollections(next);
    saveCollections(next);
  };

  const downloadCsv = (filename: string, contents: string) => {
    const url = URL.createObjectURL(new Blob([contents], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const toggleCollection = (id: string) => {
    setSelectedCollectionIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const readCsvFile = async (file: File, replacingId?: string) => {
    if (!file.name.toLocaleLowerCase().endsWith('.csv')) {
      setImportMessage({ kind: 'error', title: 'Choose a CSV file.', details: ['The file name must end in .csv.'] });
      return;
    }
    if (file.size > MAX_CSV_BYTES) {
      setImportMessage({ kind: 'error', title: 'This CSV is too large.', details: ['The maximum file size is 2 MB.'] });
      return;
    }
    const result = parseVocabularyCsv(await file.text());
    if (!result.vocabulary) {
      setImportMessage({ kind: 'error', title: 'This CSV could not be imported.', details: result.errors.slice(0, 8) });
      return;
    }
    const now = new Date().toISOString();
    if (replacingId) {
      const current = collections.find((collection) => collection.id === replacingId);
      if (!current) return;
      updateCollections(collections.map((collection) => collection.id === replacingId ? { ...collection, vocabulary: result.vocabulary!, updatedAt: now } : collection));
      setImportMessage({ kind: 'success', title: `“${current.name}” was replaced with ${result.wordCount} valid ${result.wordCount === 1 ? 'word' : 'words'}.` });
      return;
    }
    const name = collectionName.trim();
    if (!name) {
      setImportMessage({ kind: 'error', title: 'Give this collection a name before uploading.' });
      return;
    }
    if (collections.some((collection) => collection.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      setImportMessage({ kind: 'error', title: 'A collection with that name already exists.' });
      return;
    }
    const id = `collection-${crypto.randomUUID()}`;
    const next = [...collections, { id, name, vocabulary: result.vocabulary, createdAt: now, updatedAt: now }];
    updateCollections(next);
    setSelectedCollectionIds((current) => [...current, id]);
    setCollectionName('');
    setImportMessage({ kind: 'success', title: `“${name}” was added with ${result.wordCount} valid ${result.wordCount === 1 ? 'word' : 'words'}.` });
  };

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) await readCsvFile(file);
  };

  const handleReplace = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const id = replacingCollectionId.current;
    event.target.value = '';
    replacingCollectionId.current = null;
    if (file && id) await readCsvFile(file, id);
  };

  const removeCollection = (id: string) => {
    const collection = collections.find((item) => item.id === id);
    if (!collection) return;
    updateCollections(collections.filter((item) => item.id !== id));
    setSelectedCollectionIds((current) => current.filter((item) => item !== id));
    setPendingDeleteId(null);
    setImportMessage({ kind: 'success', title: `“${collection.name}” was removed.` });
  };

  const saveCollectionName = (id: string) => {
    const name = editingName.trim();
    if (!name || collections.some((collection) => collection.id !== id && collection.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      setImportMessage({ kind: 'error', title: !name ? 'Collection names cannot be empty.' : 'A collection with that name already exists.' });
      return;
    }
    updateCollections(collections.map((collection) => collection.id === id ? { ...collection, name, updatedAt: new Date().toISOString() } : collection));
    setEditingCollectionId(null);
    setImportMessage({ kind: 'success', title: `Collection renamed to “${name}”.` });
  };

  useEffect(() => {
    if (screen !== 'quiz' || locked || exitDialogOpen) return;
    const interval = window.setInterval(() => {
      const active = activeStartedAt.current === null ? 0 : performance.now() - activeStartedAt.current;
      setElapsed(accumulatedTime.current + active);
    }, 250);
    return () => window.clearInterval(interval);
  }, [screen, locked, exitDialogOpen]);

  useEffect(() => {
    if (questions[questionIndex]?.mode === 'text' && !locked) inputRef.current?.focus();
  }, [questionIndex, questions, locked]);

  useEffect(() => () => { if (advanceTimer.current) clearTimeout(advanceTimer.current); }, []);

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool || maximum < 1) return;
    const lifecycle = new AbortController();
    try {
      void Promise.resolve(context.registerTool({
        name: 'start_vocabulary_quiz',
        title: 'Start vocabulary quiz',
        description: `Start a new visible German vocabulary quiz with 1 to ${maximum} questions.`,
        inputSchema: { type: 'object', properties: { questionCount: { type: 'integer', minimum: 1, maximum } }, required: ['questionCount'], additionalProperties: false },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute(input) {
          const count = (input as { questionCount?: unknown })?.questionCount;
          if (!Number.isInteger(count) || (count as number) < 1 || (count as number) > maximum) throw new Error(`questionCount must be an integer from 1 to ${maximum}`);
          startQuiz(count as number);
          return { status: 'started', questionCount: count };
        },
      }, { signal: lifecycle.signal })).catch(() => undefined);
    } catch { /* WebMCP is optional in unsupported browsers. */ }
    return () => lifecycle.abort();
  }, [maximum, startQuiz]);

  const submitAnswer = useCallback((submitted: string) => {
    if (locked) return;
    const current = questions[questionIndex];
    if (!current) return;
    if (!submitted.trim()) { setEmptyError(true); inputRef.current?.focus(); return; }
    setEmptyError(false);
    const submittedAnswer = withoutAnswerPrefix(current, submitted);
    setAnswer(submittedAnswer);
    const correct = isCorrectAnswer(submittedAnswer, current.correctAnswer);
    const now = performance.now();
    const nextElapsed = accumulatedTime.current + (activeStartedAt.current === null ? 0 : now - activeStartedAt.current);
    accumulatedTime.current = nextElapsed;
    activeStartedAt.current = null;
    setElapsed(nextElapsed);
    const nextAnswers = [...answers, { question: current, answer: withAnswerPrefix(current, submittedAnswer), correct }];
    setAnswers(nextAnswers);
    setFeedback(correct);
    setLocked(true);
    advanceTimer.current = setTimeout(() => {
      if (questionIndex === questions.length - 1) {
        setScreen('results');
      } else {
        setQuestionIndex((index) => index + 1);
        setAnswer('');
        setFeedback(null);
        setLocked(false);
        activeStartedAt.current = performance.now();
      }
    }, 1000);
  }, [answers, locked, questionIndex, questions]);

  useEffect(() => {
    const current = questions[questionIndex];
    if (screen !== 'quiz' || locked || exitDialogOpen || current?.mode !== 'choice') return;
    const handleNumberKey = (event: KeyboardEvent) => {
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || !['1', '2', '3', '4'].includes(event.key)) return;
      const option = current.options?.[Number(event.key) - 1];
      if (!option) return;
      event.preventDefault();
      submitAnswer(option);
    };
    window.addEventListener('keydown', handleNumberKey);
    return () => window.removeEventListener('keydown', handleNumberKey);
  }, [exitDialogOpen, locked, questionIndex, questions, screen, submitAnswer]);

  const handleTextSubmit = (event: SyntheticEvent<HTMLFormElement>) => { event.preventDefault(); submitAnswer(answer); };

  const editAtCursor = (character: string) => {
    if (locked) return;
    const input = inputRef.current;
    const start = input?.selectionStart ?? answer.length;
    const end = input?.selectionEnd ?? start;
    const next = character === 'Backspace'
      ? start === end && start > 0 ? answer.slice(0, start - 1) + answer.slice(end) : answer.slice(0, start) + answer.slice(end)
      : answer.slice(0, start) + character + answer.slice(end);
    const cursor = character === 'Backspace' ? (start === end ? Math.max(0, start - 1) : start) : start + character.length;
    setAnswer(next);
    setEmptyError(false);
    requestAnimationFrame(() => { inputRef.current?.focus(); inputRef.current?.setSelectionRange(cursor, cursor); });
  };

  const returnToSetup = () => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    activeStartedAt.current = null;
    setExitDialogOpen(false);
    setScreen('setup');
  };

  const handleExitDialogChange = (open: boolean) => {
    if (open === exitDialogOpen) return;
    if (open) {
      const now = performance.now();
      accumulatedTime.current += activeStartedAt.current === null ? 0 : now - activeStartedAt.current;
      activeStartedAt.current = null;
      setElapsed(accumulatedTime.current);
    } else if (screen === 'quiz') {
      activeStartedAt.current = performance.now();
    }
    setExitDialogOpen(open);
  };

  if (screen === 'setup') {
    return (
      <main className="app-shell">
        <section className="setup-card" aria-labelledby="page-title">
          <BrandMark />
          <div className="eyebrow"><Languages size={16} /> German vocabulary</div>
          <h1 id="page-title">Wort für Wort</h1>
          <p className="lede">A focused quiz for the words you’re learning.</p>
          {maximum > 0 ? <>
            <div className="quiz-size-panel">
              <div className="size-heading"><label htmlFor="quiz-size">Questions</label><output htmlFor="quiz-size">{quizAmount}</output></div>
              <Slider id="quiz-size" min={1} max={maximum} step={1} value={[quizAmount]} onValueChange={(value) => setAmount(Number(Array.isArray(value) ? value[0] : value) || 1)} aria-label="Number of questions" />
              <div className="range-labels"><span>1</span><span>{maximum} available{hiddenQuestions.length ? ` · ${hiddenQuestions.length} hidden` : ''}</span></div>
            </div>
            <Button size="lg" className="start-button" onClick={() => startQuiz()} data-testid="start-quiz">Start quiz <ArrowRight size={18} /></Button>
          </> : <div className="empty-state"><p>No collection selected.</p><span>Select the default collection or import and select a CSV collection.</span></div>}
          <Collapsible className="collections-collapsible" open={collectionOpen} onOpenChange={setCollectionOpen}>
            <CollapsibleTrigger className="collection-toggle"><span>{collectionOpen ? 'Hide word collection' : 'Expand word collection'}</span><ChevronDown className={collectionOpen ? 'open' : ''} size={18} aria-hidden="true" /></CollapsibleTrigger>
            <CollapsibleContent>
          <section className="collections-panel" aria-labelledby="collections-heading">
            <div className="collections-heading-row">
              <div><h2 id="collections-heading">Quiz collections</h2><p>Choose one or more sources for this quiz.</p></div>
              <button className="csv-link" type="button" onClick={() => downloadCsv('wort-fuer-wort-template.csv', vocabularyTemplateCsv())}><Download size={15} /> Template</button>
            </div>
            <div className="collection-list">
              <div className="collection-row">
                <label className="collection-choice" aria-label="Use default collection"><input type="checkbox" checked={selectedCollectionIds.includes('default')} onChange={() => toggleCollection('default')} /><span><strong>Default collection</strong><small>{collectionWordCount(vocabulary)} words · read-only</small></span></label>
                <button className="icon-action" type="button" aria-label="Download default collection" title="Download default collection" onClick={() => downloadCsv('wort-fuer-wort-default.csv', vocabularyToCsv(vocabulary))}><Download size={17} /></button>
              </div>
              {collections.map((collection) => <div className="collection-row custom-collection" key={collection.id}>
                {editingCollectionId === collection.id ? <form className="rename-form" onSubmit={(event) => { event.preventDefault(); saveCollectionName(collection.id); }}>
                  <input aria-label="Collection name" value={editingName} onChange={(event) => setEditingName(event.target.value)} />
                  <button type="submit">Save</button><button type="button" onClick={() => setEditingCollectionId(null)}>Cancel</button>
                </form> : <>
                  <label className="collection-choice" aria-label={`Use ${collection.name}`}><input type="checkbox" checked={selectedCollectionIds.includes(collection.id)} onChange={() => toggleCollection(collection.id)} /><span><strong>{collection.name}</strong><small>{collectionWordCount(collection.vocabulary)} words</small></span></label>
                  <div className="collection-actions">
                    <button className="icon-action" type="button" aria-label={`Download ${collection.name}`} title="Download CSV" onClick={() => downloadCsv(`${collection.name.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-') || 'vocabulary'}.csv`, vocabularyToCsv(collection.vocabulary))}><Download size={16} /></button>
                    <button className="icon-action" type="button" aria-label={`Rename ${collection.name}`} title="Rename" onClick={() => { setEditingCollectionId(collection.id); setEditingName(collection.name); setImportMessage(null); }}><Pencil size={16} /></button>
                    <button className="icon-action" type="button" aria-label={`Replace ${collection.name} from CSV`} title="Replace from CSV" onClick={() => { replacingCollectionId.current = collection.id; replaceInputRef.current?.click(); }}><Upload size={16} /></button>
                    <button className="icon-action destructive-action" type="button" aria-label={`Remove ${collection.name}`} title="Remove" onClick={() => setPendingDeleteId(collection.id)}><Trash2 size={16} /></button>
                  </div>
                </>}
              </div>)}
            </div>
            <input ref={replaceInputRef} className="visually-hidden" type="file" accept=".csv,text/csv" onChange={handleReplace} />
            <div className="csv-import-box">
              <FileSpreadsheet size={20} aria-hidden="true" />
              <div><strong>Add a collection from CSV</strong><p>Rows can be nouns, verbs, prepositions, adjectives, or adverbs. Download the template, replace its examples, then upload it here. Collections stay in this browser; download a copy to move them to another device.</p></div>
              <label className="collection-name-label">Collection name<input value={collectionName} maxLength={60} placeholder="e.g. Chapter 4" onChange={(event) => { setCollectionName(event.target.value); setImportMessage(null); }} /></label>
              <input ref={importInputRef} className="visually-hidden" type="file" accept=".csv,text/csv" onChange={handleImport} />
              <Button type="button" variant="outline" className="upload-button" onClick={() => importInputRef.current?.click()}><Upload size={16} /> Choose CSV file</Button>
            </div>
            {importMessage && <div className={`import-message ${importMessage.kind}`} role={importMessage.kind === 'error' ? 'alert' : 'status'}>
              <strong>{importMessage.kind === 'success' ? <CheckCircle2 size={17} /> : <XCircle size={17} />}{importMessage.title}</strong>
              {importMessage.details?.length ? <ul>{importMessage.details.map((detail) => <li key={detail}>{detail}</li>)}</ul> : null}
            </div>}
            {merged.duplicateCount > 0 && <p className="duplicate-note">{merged.duplicateCount} duplicate {merged.duplicateCount === 1 ? 'word was' : 'words were'} skipped. The first selected version will be used.</p>}
            <AlertDialog open={Boolean(pendingDeleteId)} onOpenChange={(open) => { if (!open) setPendingDeleteId(null); }}>
              <AlertDialogContent className="exit-dialog">
                <AlertDialogHeader><AlertDialogTitle>Remove this collection?</AlertDialogTitle><AlertDialogDescription>“{collections.find((collection) => collection.id === pendingDeleteId)?.name}” will be removed from this device. Download it first if you want a backup.</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter><AlertDialogCancel>Keep collection</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => pendingDeleteId && removeCollection(pendingDeleteId)}>Remove collection</AlertDialogAction></AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </section>
            </CollapsibleContent>
          </Collapsible>
          <Collapsible className="hidden-questions-collapsible" open={hiddenQuestionsOpen} onOpenChange={setHiddenQuestionsOpen}>
            <CollapsibleTrigger className="collection-toggle"><span>Hidden questions ({hiddenQuestions.length})</span><ChevronDown className={hiddenQuestionsOpen ? 'open' : ''} size={18} aria-hidden="true" /></CollapsibleTrigger>
            <CollapsibleContent>
              <section className="hidden-questions-panel" aria-label="Hidden questions">
                <div className="hidden-heading"><div><h2>Questions you won’t see</h2><p>Restore any question when you want to practise it again.</p></div>{hiddenQuestions.length > 0 && <button type="button" onClick={() => updateHiddenQuestions([])}>Restore all</button>}</div>
                {hiddenQuestionGroups.length ? <div className="hidden-groups">{hiddenQuestionGroups.map((group) => <article className="hidden-group" key={`${group.wordType}:${group.word}`}>
                  <div className="hidden-word"><strong>{group.word}</strong><span>{group.wordType}</span></div>
                  <ul>{group.questions.map((question) => <li key={question.key}><span>{question.prompt}</span><button type="button" onClick={() => restoreHiddenQuestion(question.key)}><Eye size={15} /> Restore</button></li>)}</ul>
                </article>)}</div> : <p className="hidden-empty">No questions are hidden yet. You can hide individual questions from a quiz’s results page.</p>}
              </section>
            </CollapsibleContent>
          </Collapsible>
          <p className="setup-note">Quiz results aren’t saved. Your imported collections are stored on this device.</p>
        </section>
      </main>
    );
  }

  if (screen === 'results') {
    const correctCount = answers.filter((item) => item.correct).length;
    return (
      <main className="results-shell">
        <header className="results-header">
          <BrandMark />
          <div className="results-kicker"><CheckCircle2 size={18} /> Quiz complete</div>
          <h1>{getCompletionHeading(correctCount, answers.length)}</h1>
          <div className="score-line">
            <div className="score-stat"><span>Score</span><strong>{correctCount} / {answers.length}</strong></div>
            <div className="elapsed-stat"><span>Time it took</span><strong><Clock3 aria-hidden="true" /> {formatTime(elapsed)}</strong></div>
          </div>
          <p>Review each answer while it’s still fresh.</p>
          <Button onClick={returnToSetup} className="restart-button"><RotateCcw size={17} /> Start another quiz</Button>
        </header>
        <section className="review-list" aria-label="Answer review">
          {answers.map((record, index) => <article key={record.question.id} className={`review-card ${record.correct ? 'review-correct' : 'review-wrong'}`}>
            <div className="review-top"><span>Question {index + 1}</span>{record.correct ? <span className="status correct"><Check size={15} /> Correct</span> : <span className="status wrong"><X size={15} /> Review</span>}</div>
            <h2>{record.question.prompt}</h2>
            <dl><div><dt>Your answer</dt><dd>{record.answer}</dd></div>{!record.correct && <div><dt>Correct answer</dt><dd>{withAnswerPrefix(record.question, record.question.correctAnswer)}</dd></div>}</dl>
            {record.question.notes && <p className="review-note">{record.question.notes}</p>}
            <button type="button" className={`hide-question-button ${hiddenQuestionKeys.has(record.question.questionKey) ? 'is-hidden' : ''}`} aria-pressed={hiddenQuestionKeys.has(record.question.questionKey)} onClick={() => toggleQuestionHidden(record.question)}>
              {hiddenQuestionKeys.has(record.question.questionKey) ? <><Eye size={17} /> Ask this question again</> : <><EyeOff size={17} /> Don’t ask this question again</>}
            </button>
          </article>)}
        </section>
      </main>
    );
  }

  const current = questions[questionIndex];
  const progress = ((questionIndex + 1) / questions.length) * 100;

  return (
    <main className="quiz-shell">
      <header className="quiz-header">
        <AlertDialog open={exitDialogOpen} onOpenChange={handleExitDialogChange}>
          <AlertDialogTrigger render={<button className="back-button" aria-label="Leave quiz"><ArrowLeft size={19} /></button>} />
          <AlertDialogContent className="exit-dialog">
            <AlertDialogHeader>
              <AlertDialogTitle>Leave this quiz?</AlertDialogTitle>
              <AlertDialogDescription>Your answers and progress in this quiz will be lost.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep studying</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={returnToSetup}>Leave quiz</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <div className="progress-wrap"><div><span>Question {questionIndex + 1}</span><span>of {questions.length}</span></div><Progress value={progress} /></div>
        <div className="timer" aria-label={`Elapsed time ${formatTime(elapsed)}`}><Clock3 size={14} /> {formatTime(elapsed)}</div>
      </header>
      <section className={`question-card ${feedback === true ? 'feedback-correct' : feedback === false ? 'feedback-wrong' : ''}`} aria-labelledby="question-heading">
        <div className="question-eyebrow">{current.eyebrow}</div>
        <h1 id="question-heading">{current.prompt}</h1>
        {current.mode === 'choice' ? <div className="choice-grid">
          {current.options?.map((option, optionIndex) => {
            const selected = answer === option;
            const revealCorrect = locked && option === current.correctAnswer;
            return <button key={option} disabled={locked} className={`choice-button ${selected ? 'selected' : ''} ${revealCorrect ? 'choice-correct' : ''} ${locked && selected && !feedback ? 'choice-wrong' : ''}`} onClick={() => submitAnswer(option)}><span className="choice-content"><span className="choice-number" aria-hidden="true">{optionIndex + 1}</span><span>{option}</span></span>{revealCorrect && <CheckCircle2 size={20} />}{locked && selected && !feedback && <XCircle size={20} />}</button>;
          })}
        </div> : <form onSubmit={handleTextSubmit} className="answer-form">
          <label htmlFor="written-answer">Your answer</label>
          <div className={`answer-input ${current.answerPrefix ? 'has-prefix' : ''}`}>
            {current.answerPrefix && <span className="answer-prefix" aria-hidden="true">{current.answerPrefix}</span>}
            <input ref={inputRef} id="written-answer" value={answer} disabled={locked} onChange={(event) => { setAnswer(event.target.value); setEmptyError(false); }} autoComplete="off" autoCapitalize="none" spellCheck={false} aria-invalid={emptyError} aria-describedby={emptyError ? 'answer-error' : undefined} />
          </div>
          {emptyError && <p id="answer-error" className="answer-error">Enter an answer first.</p>}
          <div className="keyboard" aria-label="German character keys">{['ä', 'ö', 'ü', 'ß'].map((key) => <button key={key} type="button" disabled={locked} onPointerDown={(event) => event.preventDefault()} onClick={() => editAtCursor(key)}>{key}</button>)}<button type="button" disabled={locked} className="delete-key" aria-label="Backspace" onPointerDown={(event) => event.preventDefault()} onClick={() => editAtCursor('Backspace')}>⌫</button></div>
          <p className="keyboard-hint">Hint: You can also type ae, oe, ue, or ss.</p>
          <Button type="submit" size="lg" disabled={locked} className="submit-button">Check answer <ArrowRight size={18} /></Button>
        </form>}
        <div className="feedback-slot" aria-live="assertive">{feedback !== null && <div className={feedback ? 'feedback-message correct' : 'feedback-message wrong'}>{feedback ? <><CheckCircle2 /> Correct</> : <><XCircle /> {withAnswerPrefix(current, current.correctAnswer)}</>}</div>}</div>
      </section>
    </main>
  );
}
