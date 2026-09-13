# Prepositions

## Intro

This spec revamps the current prepositions part of the quiz. The current layout for prepositions does not give a proper way for users to remember which prepositions are Dative/Accusative/both, which is the point of the quiz.

## Visualized questions

Whenever a canonical preposition question appears in the quiz, the user should see an image of all the prepositions, divided into Accusative, Accusative + Dative, and Dative columns, in that order. The middle column title should be "Accusative (Wohin?) + Dative (Wo?)".
This image illustrates the required concept well: C:\Users\Amir\Desktop\accusative-or-dativ.jpg, but image should be created from scratch so it is unique for this app.
Seeing the image each time will allow to user to slowly memorize which prepositions belong to the appropriate Dative/Accusative/both.

The column being questioned should be visually highlighted. Questions for the middle column should use the wording "Accusative + Dative".

When quiz randomly picks a preposition word it will show the image, but will remove that word from the image (so there is an obvious gap in the image where the word was supposed to be). In addition, for each OTHER column (Dative/Accusative/both), a word will be removed and will act as the possible answers for the questions.
Example: The word randomly picked the word "ohne", which is an Accusative word. The displayed image would not show the word "ohne", and in addition will randomly pick words from Dative and Both columns (let's say it picked "auf" and "nach"). "auf" and "nach" would also be removed from the image.
The quiz question will be "What is the missing word that takes the Accusative case?", and 3 options would be available: ohne, auf, nach. Ohne is the correct answer.

## Quiz summary

When showing the quiz summary at the end of the quiz, the complete and correct image should be shown, and not the image with the missing words.
The user's pick and whether it was correct or not will be shown, same as for any other question.

## Mobile alignment

Image should be visually clear and aligned in both large the mobile screens, with no need for for scrolling or zooming in/out

## CSV import

CSV import should continue to allow prepositions. Imported prepositions that match one of the 25 canonical words should use the canonical diagram spelling and category, even when the imported metadata conflicts. Imported prepositions outside the canonical set should use the existing case or movement/location questions without showing the diagram.
