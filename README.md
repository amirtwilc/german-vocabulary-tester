# Wort für Wort

Wort für Wort is a browser-based German vocabulary trainer. It generates randomized quizzes from the built-in vocabulary or from custom CSV collections and tests nouns, verb forms, prepositions, adjectives, and adverbs.

Try it online: [Wort für Wort on GitHub Pages](https://amirtwilc.github.io/german-vocabulary-tester/)

## Features

- Choose the number of questions in a quiz.
- Practice with written-answer and multiple-choice questions.
- Review your score, answers, and completion time.
- Import, rename, replace, export, and remove custom CSV vocabulary collections.
- Combine multiple collections into one quiz.
- Keep custom collections in the browser's local storage.

## Technology

The project uses React 19, TypeScript, Tailwind CSS, Vite, vinext, and Cloudflare's local development runtime. Tests are written with Vitest and Testing Library.

## Requirements

- [Node.js](https://nodejs.org/) 22.13.0 or newer
- npm (included with Node.js)

## Run locally

1. Clone the repository and enter the project directory:

   ```bash
   git clone https://github.com/amirtwilc/german-vocabulary-tester.git
   cd german-vocabulary-tester
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the development server:

   ```bash
   npm run dev
   ```

4. Open the local URL printed in the terminal. The development server automatically reloads the app when source files change.

No environment variables or external services are required for the current app.

## Available commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the local development server. |
| `npm run build` | Create a production build. |
| `npm start` | Serve the production build locally with Wrangler. Run `npm run build` first. |
| `npm test` | Run the test suite once. |
| `npm run lint` | Check the code with oxlint. |
| `npm run format` | Format the project with oxfmt. |

## Vocabulary data

The built-in collection is defined in `data/vocabulary.ts`. It contains nouns, verbs, prepositions, adjectives, and adverbs.

Custom collections can be added from the app's **Quiz collections** panel. Download the CSV template from that panel, replace the example rows with your own vocabulary, give the collection a name, and upload the file. Imported collections stay on the current device because they are saved in browser local storage.

## Project structure

```text
app/                 Main page, layout, and global styles
components/ui/       Reusable interface components
data/vocabulary.ts   Built-in German vocabulary
lib/quiz.ts          Quiz generation and answer checking
lib/collections.ts   CSV import/export and collection storage
test/                Shared test setup
```
