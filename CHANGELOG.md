# Changelog

## [1.1.0] - 2026-11-18

### Fixed

- Conversation list: the Malay title and English subtitle no longer run together on one line — the subtitle now sits below the title in muted, smaller text.

### Changed

- Flashcards: the topic chip wall is replaced by a single "Topics" button that opens a panel (bottom sheet on phones, centered dialog on desktop) grouping the set's topics into 8 parent categories, each toggleable as a whole group or expanded to individual subtopics, with All/None and a "Show N cards" action.
- Quiz setup: the flat per-topic button list is now grouped by the same 8 parent categories, with each group startable as a whole-group quiz (distractors drawn from the group first) or expandable to start a single-subtopic quiz as before.
- First visit now defaults to "All weeks" in Flashcards mode instead of Week 1; the last chosen set and mode continue to be remembered after that.
- Flashcards: Malay and English sides now get distinct calm paper tints (sage green for Malay, warm sand for English) with a small "MELAYU"/"ENGLISH" label, so the active language is identifiable regardless of flip direction. The same colour coding is applied, more subtly, to example sentences, conversation lines, and the glossary table.
- Flashcards: the card flip is now a real animated 3D rotation (no DOM re-render on flip), and next/previous moves use a direction-aware slide-and-fade transition; both respect `prefers-reduced-motion` by falling back to a quick opacity crossfade.

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
