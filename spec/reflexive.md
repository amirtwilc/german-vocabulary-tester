# Reflexive translation forms

## Goal

Teach lexicalized `sich` forms as vocabulary without asking learners to classify
verbs as always or sometimes reflexive.

## Vocabulary model

Every verb keeps one bare `infinitive` for conjugation and other grammar
questions. Its primary translation question normally uses that infinitive, but
`translationGerman` can override only the displayed German form. This is used
for verbs learned together with `sich`, such as `sich beeilen`.

A verb can also define one `alternateTranslation` with its own German and
English text. This is reserved for a stable lexical meaning change, such as
`erinnern` (to remind) versus `sich erinnern` (to remember). It is not used for
ordinary self-directed objects, reciprocal uses, optional forms, or meanings
that depend on context.

## Quiz behavior

Primary and alternate translations are independent meaning questions with
separate mastery keys. Alternate questions are shuffled separately from the
verb's main question block. Translation distractors come from every primary and
alternate meaning in the selected verb pool.

Conjugation, Präteritum, participle, auxiliary, and case questions always use
the bare infinitive and the verb's existing grammatical forms.

There are no questions asking whether a verb is always or sometimes reflexive.

## CSV compatibility

CSV files can use `translation_german`, `alternate_german`, and
`alternate_english`. Both alternate fields must be supplied together. New
exports do not contain the former `reflexive` column, but imports tolerate and
ignore that column in older files.
