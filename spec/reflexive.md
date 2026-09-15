# Reflexive verbs

## Goal

Add questions about reflexive verbs in the quiz

## Support Reflexive questions

Each verb should contain a new field called 'reflexive', which can contain one of these values: no, always, sometimes.
Value can also be empty, which means it will be ignored in reflexive questions.
CSV should also support this new field.

## The Question

Instead of asking "Is this word reflexive?", the question should be "Which of these verbs are ALWAYS reflexive?"/"Which of these verbs are SOMETIMES reflexive?". 4 options would appear, 1 of them is the correct answer and the other 3 are not. If the question was for 'always', then the 3 other answer could be either 'no' or 'sometimes', randomly picked from the pool. Similarily goes for 'sometimes'.

## Questions order

The quiz algorithm currently works as follows: Pick a random word -> if a verb ask for English translation -> generate additional questions randomly from the verb pool.
For Reflexive verbs the order will change: Pick a random word -> if a verb AND reflexive show the reflexive question with the picked word as the correct answer -> ask for English translation -> generate additional questions randomly from the verb pool, but should be one question less than regular if reflexive word was asked (if reflexive word was not mastered).
Clarification: If a verb is not reflexive ('no' or empty value) or its reflexive question was mastered, show translation question first following the required number of related questions.

## Auxiliary Questions

Also make similar change to Auxilary questions. Instead of asking "Which auxilary matches this verb?", the question should be "Which of these words use the Auxiliary 'ist'?". 4 options will appear, 1 of them is the correct answer and the other 3 use the auxiliary 'hat'.
Do not show auxiliary questions if the verb uses 'hat', only use for 'ist'.
If verb is both reflexive AND uses 'ist', pick one randomly (unless one of them is mastered).

## Update Default Collection

Go over all verbs in data\vocabulary.ts and add the new reflexive field. Fill the correct value for each verb (no / always / sometimes)
