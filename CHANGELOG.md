# Changelog

## [1.0.0] - 2026-11-18

### Added

- Set picker covering Week 1 through Week 6, House Visit Guide, and a combined "All weeks" set, with a live "N terms" count. Picking House Visit Guide opens Table view by default; every other set opens Flashcards.
- Four study modes: Flashcards, Quiz, Conversation, and Table (Quiz is hidden for House Visit Guide, which has no quiz content).
- Flashcards: topic filter chips with All/None, a shuffled deck, BM→EN / EN→BM direction toggle, 3D flip (tap, click, Space/Enter, or swipe), prev/next with wraparound, and example sentences shown under the card.
- Quiz: per-set topic list plus Random topic and All topics (with a Shorter/Recommended/Longer length picker), 4-option multiple choice with distractors drawn from the same topic, check/next flow, and a results screen with score and guidance message.
- Conversation: a list of the set's dialogues plus Random conversation and All conversations, a reading view with an English show/hide toggle, and a comprehension quiz built from the shown conversation(s).
- Table: a searchable glossary across all 7 sets — Week 1–6 plus House Visit Guide (grouped by set · topic) — or just the House Visit Guide's topics when that set is active; matches Malay or English text.
- Last chosen set and mode are remembered between visits via localStorage.

### Design

- Full redesign to a calm, editorial reading surface: warm-paper background, dark ink text, a single deep-green accent, hairline borders, no gradients or glow effects.
- Mobile-first layout for 390px screens with a compact set selector and a 4-item segmented mode control, 44px minimum tap targets, and no horizontal overflow.
- System font stack for UI with a serif face for the featured Malay term on flashcards.
- Accessibility pass: AA contrast throughout, visible focus rings, real buttons with `aria-pressed`/`aria-live`, `lang="ms"` on Malay text, and `prefers-reduced-motion` support for the flip animation.
