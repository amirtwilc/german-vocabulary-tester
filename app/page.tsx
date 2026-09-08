'use client';

import { type SyntheticEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Clock3, Languages, RotateCcw, X, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { vocabulary } from '@/data/vocabulary';
import { createQuiz, getMaximumQuestionCount, isCorrectAnswer, type QuizQuestion } from '@/lib/quiz';

declare global {
  interface Document {
    modelContext?: { registerTool(tool: { name: string; title: string; description: string; inputSchema: object; annotations: { readOnlyHint: boolean; untrustedContentHint: boolean }; execute(input: unknown): unknown }, options?: { signal: AbortSignal }): void | Promise<void> };
  }
}

type Screen = 'setup' | 'quiz' | 'results';
interface AnswerRecord { question: QuizQuestion; answer: string; correct: boolean }

const formatTime = (milliseconds: number) => {
  const seconds = Math.floor(milliseconds / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

export const getCompletionHeading = (correct: number, total: number) => correct === total && total > 0 ? 'Amazing.' : 'Nice work.';

function BrandMark() {
  return <div className="brand-mark" aria-hidden="true"><span /><span /><span /></div>;
}

export default function Home() {
  const maximum = useMemo(() => getMaximumQuestionCount(vocabulary), []);
  const defaultAmount = Math.min(20, maximum);
  const [screen, setScreen] = useState<Screen>('setup');
  const [amount, setAmount] = useState(defaultAmount);
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

  const startQuiz = useCallback((requestedAmount = amount) => {
    const safeAmount = Math.max(1, Math.min(maximum, Math.floor(requestedAmount)));
    const nextQuestions = createQuiz(vocabulary, safeAmount);
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
  }, [amount, maximum]);

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
    setAnswer(submitted);
    const correct = isCorrectAnswer(submitted, current.correctAnswer);
    const now = performance.now();
    const nextElapsed = accumulatedTime.current + (activeStartedAt.current === null ? 0 : now - activeStartedAt.current);
    accumulatedTime.current = nextElapsed;
    activeStartedAt.current = null;
    setElapsed(nextElapsed);
    const nextAnswers = [...answers, { question: current, answer: submitted, correct }];
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
              <div className="size-heading"><label htmlFor="quiz-size">Questions</label><output htmlFor="quiz-size">{amount}</output></div>
              <Slider id="quiz-size" min={1} max={maximum} step={1} value={[amount]} onValueChange={(value) => setAmount(Number(Array.isArray(value) ? value[0] : value) || 1)} aria-label="Number of questions" />
              <div className="range-labels"><span>1</span><span>{maximum} available</span></div>
            </div>
            <Button size="lg" className="start-button" onClick={() => startQuiz()} data-testid="start-quiz">Start quiz <ArrowRight size={18} /></Button>
            <p className="setup-note">Your results aren’t saved. Refreshing starts over.</p>
          </> : <div className="empty-state"><p>No vocabulary yet.</p><span>Add words to <code>data/vocabulary.ts</code> and redeploy.</span></div>}
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
            <dl><div><dt>Your answer</dt><dd>{record.answer}</dd></div>{!record.correct && <div><dt>Correct answer</dt><dd>{record.question.correctAnswer}</dd></div>}</dl>
            {record.question.notes && <p className="review-note">{record.question.notes}</p>}
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
          {current.options?.map((option) => {
            const selected = answer === option;
            const revealCorrect = locked && option === current.correctAnswer;
            return <button key={option} disabled={locked} className={`choice-button ${selected ? 'selected' : ''} ${revealCorrect ? 'choice-correct' : ''} ${locked && selected && !feedback ? 'choice-wrong' : ''}`} onClick={() => submitAnswer(option)}><span>{option}</span>{revealCorrect && <CheckCircle2 size={20} />}{locked && selected && !feedback && <XCircle size={20} />}</button>;
          })}
        </div> : <form onSubmit={handleTextSubmit} className="answer-form">
          <label htmlFor="written-answer">Your answer</label>
          <input ref={inputRef} id="written-answer" value={answer} disabled={locked} onChange={(event) => { setAnswer(event.target.value); setEmptyError(false); }} autoComplete="off" autoCapitalize="none" spellCheck={false} aria-invalid={emptyError} aria-describedby={emptyError ? 'answer-error' : undefined} />
          {emptyError && <p id="answer-error" className="answer-error">Enter an answer first.</p>}
          <div className="keyboard" aria-label="German character keys">{['ä', 'ö', 'ü', 'ß'].map((key) => <button key={key} type="button" disabled={locked} onPointerDown={(event) => event.preventDefault()} onClick={() => editAtCursor(key)}>{key}</button>)}<button type="button" disabled={locked} className="delete-key" aria-label="Backspace" onPointerDown={(event) => event.preventDefault()} onClick={() => editAtCursor('Backspace')}>⌫</button></div>
          <Button type="submit" size="lg" disabled={locked} className="submit-button">Check answer <ArrowRight size={18} /></Button>
        </form>}
        <div className="feedback-slot" aria-live="assertive">{feedback !== null && <div className={feedback ? 'feedback-message correct' : 'feedback-message wrong'}>{feedback ? <><CheckCircle2 /> Correct</> : <><XCircle /> {current.correctAnswer}</>}</div>}</div>
      </section>
    </main>
  );
}
