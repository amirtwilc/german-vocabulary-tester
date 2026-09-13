import {
  CANONICAL_PREPOSITION_GROUPS,
  type CanonicalPrepositionCategory,
} from '@/data/vocabulary';

/* oxlint-disable jsx-a11y/prefer-tag-over-role -- This composite visual is exposed as one image while its answer-bearing children stay hidden. */

interface PrepositionDiagramProps {
  hiddenWords?: readonly string[];
  className?: string;
  highlightedCategory?: CanonicalPrepositionCategory;
}

export function PrepositionDiagram({
  hiddenWords = [],
  className = '',
  highlightedCategory,
}: PrepositionDiagramProps) {
  const hidden = new Set(hiddenWords);
  const accessibleDescription = CANONICAL_PREPOSITION_GROUPS.map((group) => {
    const label =
      group.category === 'Accusative + Dative'
        ? 'Accusative plus Dative'
        : group.category;
    const highlight =
      highlightedCategory === group.category ? ', highlighted' : '';
    const words = group.words
      .map((word) => (hidden.has(word) ? 'missing word' : word))
      .join(', ');
    return `${label}${highlight}: ${words}.`;
  }).join(' ');

  return (
    <div
      className={`preposition-diagram ${className}`.trim()}
      role="img"
      aria-label={`German prepositions grouped by grammatical case. ${accessibleDescription}`}
    >
      {CANONICAL_PREPOSITION_GROUPS.map((group) => (
        <section
          className={`preposition-group preposition-group-${group.category
            .toLocaleLowerCase()
            .replace(/[^a-z]+/g, '-')
            .replace(
              /-$/,
              '',
            )} ${highlightedCategory === group.category ? 'is-highlighted' : ''}`}
          key={group.category}
          aria-hidden="true"
        >
          <h2>
            {group.category === 'Accusative + Dative'
              ? 'Accusative (Wohin?) + Dative (Wo?)'
              : group.category}
          </h2>
          <div className="preposition-words">
            {group.words.map((word) => {
              const isHidden = hidden.has(word);
              return (
                <span
                  className={`preposition-word ${isHidden ? 'is-missing' : ''}`}
                  key={word}
                >
                  {isHidden ? <span className="missing-line" /> : word}
                </span>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
