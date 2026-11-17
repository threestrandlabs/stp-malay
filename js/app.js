(function () {
  "use strict";

  var SET_KEY = "stpMalay.setId";
  var MODE_KEY = "stpMalay.mode";

  var pillBtn = document.getElementById("filter-pill-btn");
  var pillLabel = document.getElementById("filter-pill-label");
  var progressRow = document.getElementById("progress-row");
  var progressFill = document.getElementById("progress-fill");
  var progressCount = document.getElementById("progress-count");
  var viewEl = document.getElementById("view");
  var footerEl = document.getElementById("footer-controls");
  var tabbarEl = document.getElementById("tabbar");
  var sheetRootEl = document.getElementById("sheet-root");
  var appEl = document.querySelector(".app");

  var allSets = [];
  var topicGroups = [];
  var state = {
    setId: null,
    mode: null,
    activeQuiz: null,
    flash: { topics: new Set(), deck: [], pos: 0, flipped: false, direction: "ms-en" },
    filterSheet: { open: false, week: null, topics: new Set(), direction: "ms-en", expanded: new Set() },
    quizSetup: { screen: "setup", expanded: new Set() },
    conv: { screen: "list", selection: null, mode: "both", index: 0 },
    table: { query: "" }
  };

  function tplHtml(id) {
    var t = document.getElementById(id);
    return t ? t.innerHTML : "";
  }

  var ICONS = {
    chevronLeft: tplHtml("tpl-icon-chevron-left"),
    chevronRight: tplHtml("tpl-icon-chevron-right"),
    shuffle: tplHtml("tpl-icon-shuffle"),
    rotate: tplHtml("tpl-icon-rotate"),
    rotateSm: tplHtml("tpl-icon-rotate-sm"),
    check: tplHtml("tpl-icon-check"),
    x: tplHtml("tpl-icon-x"),
    search: tplHtml("tpl-icon-search"),
    layers: tplHtml("tpl-icon-layers"),
    question: tplHtml("tpl-icon-question"),
    chat: tplHtml("tpl-icon-chat"),
    grid: tplHtml("tpl-icon-grid")
  };

  function esc(value) {
    return String(value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  function setById(id) {
    var set = allSets.filter(function (s) { return s.id === id; })[0];
    return set || allSets[0];
  }

  function currentSet() {
    return setById(state.setId);
  }

  function getTopics(set) {
    var seen = [];
    set.cards.forEach(function (c) { if (seen.indexOf(c.topic) === -1) seen.push(c.topic); });
    return seen;
  }

  function groupCardsByTopic(cards) {
    var topics = [];
    cards.forEach(function (c) { if (topics.indexOf(c.topic) === -1) topics.push(c.topic); });
    return topics.map(function (topic) {
      return { topic: topic, cards: cards.filter(function (c) { return c.topic === topic; }) };
    });
  }

  function getPresentGroups(set) {
    var allTopics = getTopics(set);
    var mapped = [];
    var present = topicGroups.map(function (g) {
      var topics = g.topics.filter(function (t) { return allTopics.indexOf(t) !== -1; });
      mapped = mapped.concat(topics);
      return { id: g.id, label: g.label, topics: topics };
    }).filter(function (g) { return g.topics.length; });
    var leftover = allTopics.filter(function (t) { return mapped.indexOf(t) === -1; });
    if (leftover.length) present = present.concat([{ id: "other", label: "Other", topics: leftover }]);
    return present;
  }

  function weekLabel(set) {
    return set.label;
  }

  function topicsLabel(set, selected) {
    var allTopics = getTopics(set);
    if (!allTopics.length) return "No topics";
    if (selected.size === allTopics.length) return "All topics";
    if (selected.size === 0) return "No topics";
    var groups = getPresentGroups(set);
    var fullGroups = groups.filter(function (g) { return g.topics.every(function (t) { return selected.has(t); }); });
    var anyPartial = groups.some(function (g) {
      var n = g.topics.filter(function (t) { return selected.has(t); }).length;
      return n > 0 && n < g.topics.length;
    });
    if (!anyPartial && fullGroups.length) return fullGroups.length + (fullGroups.length === 1 ? " group" : " groups");
    return selected.size + (selected.size === 1 ? " topic" : " topics");
  }

  function updatePillLabel() {
    var set = currentSet();
    pillLabel.textContent = weekLabel(set) + " · " + topicsLabel(set, state.flash.topics);
  }

  // ---------- Flashcards ----------

  function resetFlashState() {
    var set = currentSet();
    state.flash.topics = new Set(getTopics(set));
    state.flash.direction = "ms-en";
    recomputeFlashDeck();
  }

  function recomputeFlashDeck() {
    var set = currentSet();
    var filtered = set.cards.filter(function (c) { return state.flash.topics.has(c.topic); });
    state.flash.deck = shuffle(filtered);
    state.flash.pos = 0;
    state.flash.flipped = false;
  }

  function flashMove(delta) {
    var deck = state.flash.deck;
    if (!deck.length) return;
    state.flash.pos = (state.flash.pos + delta + deck.length) % deck.length;
    state.flash.flipped = false;
    render();
  }

  var flashAnimating = false;

  function reducedMotion() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function flashVisibleSide() {
    var msFirst = state.flash.direction === "ms-en";
    var frontSide = msFirst ? "ms" : "en";
    var backSide = msFirst ? "en" : "ms";
    return state.flash.flipped ? backSide : frontSide;
  }

  function toggleFlashFlip() {
    var cardEl = viewEl.querySelector(".flashcard");
    state.flash.flipped = !state.flash.flipped;
    if (!cardEl) { render(); return; }
    cardEl.classList.toggle("is-flipped", state.flash.flipped);
    cardEl.setAttribute("aria-pressed", String(state.flash.flipped));
    cardEl.setAttribute("data-side", flashVisibleSide());
  }

  function animateFlashMove(delta) {
    var deck = state.flash.deck;
    if (!deck.length || flashAnimating) return;
    var cardEl = viewEl.querySelector(".flashcard");
    if (!cardEl) { flashMove(delta); return; }
    flashAnimating = true;
    var dir = delta > 0 ? "next" : "prev";
    var outDuration = reducedMotion() ? 120 : 220;
    cardEl.classList.add("anim-out-" + dir);
    setTimeout(function () {
      flashMove(delta);
      var newCardEl = viewEl.querySelector(".flashcard");
      if (newCardEl) {
        newCardEl.classList.add("anim-in-" + dir);
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            newCardEl.classList.remove("anim-in-" + dir);
          });
        });
      }
      flashAnimating = false;
    }, outDuration);
  }

  function renderFlashcards() {
    var set = currentSet();
    var topics = getTopics(set);
    if (!topics.length) return '<p class="empty-state">No topics in this set.</p>';

    var deck = state.flash.deck;
    if (!deck.length) return '<p class="empty-state">No topics selected. Open the filter to choose a topic.</p>';

    var card = deck[state.flash.pos];
    var msFirst = state.flash.direction === "ms-en";
    var frontLangCode = msFirst ? "ms" : "en";
    var backLangCode = msFirst ? "en" : "ms";
    var frontText = msFirst ? card.ms : card.en;
    var frontLang = msFirst ? ' lang="ms"' : "";
    var backText = msFirst ? card.en : card.ms;
    var backSubText = msFirst ? card.ms : card.en;
    var backLang = msFirst ? "" : ' lang="ms"';
    var backSubLang = msFirst ? ' lang="ms"' : "";
    var visibleSide = state.flash.flipped ? backLangCode : frontLangCode;

    var examplesHtml = "";
    if (card.examples && card.examples.length) {
      examplesHtml = '<div class="card-examples"><p class="card-examples-title">Examples</p>' +
        card.examples.map(function (ex) {
          return '<div class="example-row"><span class="example-ms" lang="ms">' + esc(ex.ms) + '</span><span class="example-en">' + esc(ex.en) + "</span></div>";
        }).join("") + "</div>";
    }

    return '<div class="card-stage">' +
      '<div class="flashcard' + (state.flash.flipped ? " is-flipped" : "") + '" tabindex="0" role="button" aria-pressed="' + state.flash.flipped + '" aria-label="Flashcard, tap to flip" data-action="flash-flip-card" data-side="' + visibleSide + '">' +
      '<div class="flashcard-inner">' +
      '<div class="card-face card-face-front card-face-' + frontLangCode + '">' +
      '<div class="card-face-head"><p class="card-lang-label">' + (frontLangCode === "ms" ? "MELAYU" : "ENGLISH") + '</p><p class="card-topic">' + esc(card.topic) + "</p></div>" +
      '<div class="card-body"><p class="card-term-front"' + frontLang + ">" + esc(frontText) + "</p></div>" +
      '<div class="card-hint">' + ICONS.rotateSm + " Tap card to flip</div>" +
      "</div>" +
      '<div class="card-face card-face-back card-face-' + backLangCode + '">' +
      '<div class="card-face-head"><p class="card-lang-label">' + (backLangCode === "ms" ? "MELAYU" : "ENGLISH") + '</p><p class="card-topic">' + esc(card.topic) + "</p></div>" +
      '<div class="card-body"><p class="card-term-back"' + backLang + ">" + esc(backText) + '</p><p class="card-term-sub"' + backSubLang + ">" + esc(backSubText) + "</p></div>" +
      (card.note ? '<p class="card-note">' + esc(card.note) + "</p>" : "") +
      examplesHtml +
      "</div>" +
      "</div>" +
      "</div>" +
      "</div>";
  }

  function renderFlashFooter() {
    return '<div class="thumb-zone" style="display:flex;gap:8px;">' +
      '<button type="button" class="icon-btn shuffle-btn" data-action="flash-shuffle" aria-label="Shuffle">' + ICONS.shuffle + "</button>" +
      '<button type="button" class="icon-btn" data-action="flash-prev" aria-label="Previous card">' + ICONS.chevronLeft + "</button>" +
      '<button type="button" class="btn btn-primary flip-btn" data-action="flash-flip">' + ICONS.rotate + " Flip</button>" +
      '<button type="button" class="icon-btn" data-action="flash-next" aria-label="Next card">' + ICONS.chevronRight + "</button>" +
      "</div>";
  }

  // ---------- Quiz question building ----------

  function dedupeByEn(cards, excludeEn, excludeSet) {
    var seen = new Set();
    var out = [];
    cards.forEach(function (c) {
      if (c.en === excludeEn) return;
      if (seen.has(c.en)) return;
      if (excludeSet && excludeSet.has(c.en)) return;
      seen.add(c.en);
      out.push(c);
    });
    return out;
  }

  function buildCardQuestion(card, allCards, distractorPool) {
    var pool = distractorPool || allCards.filter(function (c) { return c.topic === card.topic; });
    var sameTopicPool = dedupeByEn(pool, card.en);
    var distractors = shuffle(sameTopicPool).slice(0, 3);
    if (distractors.length < 3) {
      var used = new Set([card.en].concat(distractors.map(function (d) { return d.en; })));
      var fallbackPool = dedupeByEn(allCards, card.en, used);
      distractors = distractors.concat(shuffle(fallbackPool).slice(0, 3 - distractors.length));
    }
    var optionCards = shuffle([card].concat(distractors));
    var options = optionCards.map(function (c) { return c.en; });
    var correctIndex = optionCards.indexOf(card);
    return { kind: "term", prompt: card.ms, topic: card.topic, options: options, correctIndex: correctIndex, correctText: card.en };
  }

  function buildConvQuestion(q) {
    var tagged = q.options.map(function (text, i) { return { text: text, isCorrect: i === q.correct }; });
    var shuffled = shuffle(tagged);
    var correctIndex = -1;
    shuffled.forEach(function (o, i) { if (o.isCorrect) correctIndex = i; });
    return { kind: "question", prompt: q.q, options: shuffled.map(function (o) { return o.text; }), correctIndex: correctIndex, correctText: shuffled[correctIndex].text };
  }

  function computeCounts(n) {
    var e = n * 0.3;
    var mid = Math.max(10, Math.round(e / 10) * 10);
    var low = Math.max(10, Math.floor((mid * 0.75) / 10) * 10);
    if (low >= mid) low = Math.max(10, mid - 10);
    var high = Math.ceil((mid * 1.25) / 10) * 10;
    if (high <= mid) high = mid + 10;
    low = Math.min(low, n);
    mid = Math.min(mid, n);
    high = Math.min(high, n);
    return { low: low, mid: mid, high: high };
  }

  function startCardsQuiz(kind, topicOrGroup, countOverride) {
    var set = currentSet();
    var pool, title, distractorPool;
    if (kind === "all") {
      pool = set.cards;
      title = "All topics";
      distractorPool = null;
    } else if (kind === "group") {
      pool = set.cards.filter(function (c) { return topicOrGroup.topics.indexOf(c.topic) !== -1; });
      title = topicOrGroup.label;
      distractorPool = pool;
    } else {
      pool = set.cards.filter(function (c) { return c.topic === topicOrGroup; });
      title = topicOrGroup;
      distractorPool = pool;
    }
    var count = kind === "all" ? countOverride : Math.min(20, pool.length);
    var chosen = shuffle(pool).slice(0, Math.min(count, pool.length));
    var questions = chosen.map(function (card) { return buildCardQuestion(card, set.cards, distractorPool); });
    state.activeQuiz = { source: "cards", title: title, questions: questions, index: 0, selected: null, checked: false, score: 0, screen: "run" };
    render();
  }

  function startConversationQuiz() {
    var pool = [];
    state.conv.selection.forEach(function (c) { c.questions.forEach(function (q) { pool.push(q); }); });
    var chosen = shuffle(pool).slice(0, Math.min(20, pool.length));
    var questions = chosen.map(buildConvQuestion);
    var title = state.conv.selection.length === 1 ? state.conv.selection[0].title : "All conversations";
    state.activeQuiz = { source: "conversation", title: title, questions: questions, index: 0, selected: null, checked: false, score: 0, screen: "run" };
    render();
  }

  // ---------- Quiz setup screen ----------

  function renderQuizSetup() {
    var set = currentSet();

    if (state.quizSetup.screen === "count") {
      var counts = computeCounts(set.cards.length);
      return '<div class="back-row"><button type="button" class="back-link" data-action="quiz-setup-back">' + ICONS.chevronLeft + " Back</button></div>" +
        '<p class="section-label">All topics &middot; choose length</p>' +
        '<div class="count-picker">' +
        '<button type="button" class="count-option" data-action="quiz-start-all" data-count="' + counts.low + '"><strong>' + counts.low + "</strong><span>Shorter</span></button>" +
        '<button type="button" class="count-option" data-action="quiz-start-all" data-count="' + counts.mid + '"><strong>' + counts.mid + "</strong><span>Recommended</span></button>" +
        '<button type="button" class="count-option" data-action="quiz-start-all" data-count="' + counts.high + '"><strong>' + counts.high + "</strong><span>Longer</span></button>" +
        "</div>";
    }

    var groups = getPresentGroups(set);
    var expanded = state.quizSetup.expanded;

    var groupsHtml = groups.map(function (g) {
      var n = set.cards.filter(function (c) { return g.topics.indexOf(c.topic) !== -1; }).length;
      var isExpanded = expanded.has(g.id);
      var subItems = !isExpanded ? "" : '<div class="setup-group-subitems">' + g.topics.map(function (t) {
        var tn = set.cards.filter(function (c) { return c.topic === t; }).length;
        return '<button type="button" class="setup-item" data-action="quiz-topic" data-topic="' + esc(t) + '"><span class="setup-item-title">' + esc(t) + "</span><span class=\"setup-item-meta\">" + tn + " terms</span></button>";
      }).join("") + "</div>";

      return '<div class="setup-group">' +
        '<div class="setup-group-row">' +
        '<button type="button" class="setup-item" data-action="quiz-group" data-group="' + esc(g.id) + '"><span class="setup-item-title">' + esc(g.label) + "</span><span class=\"setup-item-meta\">" + n + " terms</span></button>" +
        '<button type="button" class="setup-group-expand" data-action="quiz-group-expand" data-group="' + esc(g.id) + '" aria-expanded="' + isExpanded + '" aria-label="' + (isExpanded ? "Collapse " : "Expand ") + esc(g.label) + ' topics">' + ICONS.chevronRight + "</button>" +
        "</div>" +
        subItems +
        "</div>";
    }).join("");

    return '<p class="section-label">' + esc(set.label) + " quiz</p>" +
      '<div class="setup-list">' +
      '<button type="button" class="setup-item" data-action="quiz-random-topic"><span class="setup-item-title">Random topic</span></button>' +
      '<button type="button" class="setup-item" data-action="quiz-all-topics"><span class="setup-item-title">All topics</span><span class="setup-item-meta">' + set.cards.length + " terms</span></button>" +
      '<hr class="setup-divider">' +
      groupsHtml +
      "</div>";
  }

  // ---------- Quiz run / results ----------

  function renderQuizFlow() {
    var aq = state.activeQuiz;
    return aq.screen === "results" ? renderQuizResults(aq) : renderQuizRun(aq);
  }

  function renderQuizRun(aq) {
    var total = aq.questions.length;
    var q = aq.questions[aq.index];

    var termMarkup = q.kind === "term" ?
      '<p class="quiz-term" lang="ms">' + esc(q.prompt) + "</p>" :
      '<p class="quiz-term">' + esc(q.prompt) + "</p>";
    var promptLabel = q.kind === "term" ? "What does this mean?" : "Answer the question";

    var optionsMarkup = q.options.map(function (opt, i) {
      var cls = "quiz-option";
      var pressed = aq.selected === i;
      var icon = "";
      if (aq.checked) {
        if (i === q.correctIndex) { cls += " is-correct"; icon = '<span class="quiz-option-icon">' + ICONS.check + "</span>"; }
        else if (i === aq.selected) { cls += " is-wrong"; icon = '<span class="quiz-option-icon">' + ICONS.x + "</span>"; }
        else { cls += " is-dimmed"; }
      }
      return '<button type="button" class="' + cls + '" data-action="quiz-select" data-index="' + i + '" aria-pressed="' + pressed + '"' + (aq.checked ? " disabled" : "") + '><span class="quiz-option-badge">' + String.fromCharCode(65 + i) + '</span><span class="quiz-option-text">' + esc(opt) + "</span>" + icon + "</button>";
    }).join("");

    var feedback = '<p class="quiz-feedback" aria-live="polite"></p>';
    if (aq.checked) {
      var correct = aq.selected === q.correctIndex;
      feedback = '<p class="quiz-feedback ' + (correct ? "is-correct" : "") + '" aria-live="polite">' +
        (correct ? "Correct." : 'Not quite. ' + esc(q.kind === "term" ? q.prompt : "") + (q.kind === "term" ? " means “" + esc(q.correctText) + "”." : "The correct answer is “" + esc(q.correctText) + "”.")) + "</p>";
    }

    return '<div class="quiz-prompt-card">' +
      '<div class="quiz-prompt-head"><p class="quiz-prompt-label">' + esc(promptLabel.toUpperCase()) + '</p><p class="card-topic">' + esc(aq.title) + "</p></div>" +
      termMarkup +
      "</div>" +
      '<div class="quiz-options">' + optionsMarkup + "</div>" +
      feedback;
  }

  function renderQuizFooter() {
    var aq = state.activeQuiz;
    if (!aq || aq.screen !== "run") return "";
    var total = aq.questions.length;
    var actionButton = !aq.checked ?
      '<button type="button" class="btn btn-primary btn-block" data-action="quiz-check"' + (aq.selected === null ? " disabled" : "") + ">Check</button>" :
      '<button type="button" class="btn btn-primary btn-block" data-action="quiz-next">' + (aq.index + 1 >= total ? "See results" : "Next question") + " " + ICONS.chevronRight + "</button>";
    return '<div class="quiz-score-box"><span class="quiz-score-label">Score</span><span class="quiz-score-value">' + aq.score + " / " + total + "</span></div>" +
      actionButton;
  }

  function renderQuizResults(aq) {
    var total = aq.questions.length;
    var pct = total ? aq.score / total : 0;
    var isConv = aq.source === "conversation";
    var message = pct >= 0.8 ?
      (isConv ? "You know this well." : "Great work, you're ready.") :
      (isConv ? "Reread the dialogue and try again." : "Keep going — run it again to lock it in.");
    var actions = isConv ?
      '<button type="button" class="btn btn-primary" data-action="quiz-results-back-conv">Back to conversation</button>' +
      '<button type="button" class="btn btn-ghost" data-action="quiz-results-new-selection">New selection</button>' :
      '<button type="button" class="btn btn-primary" data-action="quiz-results-new-topic">Choose new topic</button>';

    return '<div class="quiz-results">' +
      '<p class="quiz-results-score">' + aq.score + " / " + total + "</p>" +
      '<p class="quiz-results-message">' + esc(message) + "</p>" +
      '<div class="quiz-results-actions">' + actions + "</div>" +
      "</div>";
  }

  // ---------- Conversation ----------

  function renderConversation() {
    var set = currentSet();

    if (!set.conversations.length) {
      return '<p class="empty-state">No conversations in this set.</p>';
    }

    if (state.conv.screen === "reading" && state.conv.selection) {
      var all = set.conversations;
      var conv = all[state.conv.index];
      var mode = state.conv.mode;
      var showMs = mode !== "en";
      var showEn = mode !== "ms";

      var heading = '<div class="conv-head"><p class="conv-dialogue-label">Dialogue ' + (state.conv.index + 1) + " of " + all.length + '</p><h2 class="conv-title">' + esc(conv.title) + '</h2><p class="conv-subtitle">' + esc(conv.subtitle) + "</p></div>";
      var lines = conv.lines.map(function (line, i) {
        var side = i % 2 === 0 ? "is-left" : "is-right";
        return '<div class="conv-bubble-wrap ' + side + '"><span class="conv-speaker">' + esc(line.speaker) + '</span><div class="conv-bubble">' +
          (showMs ? '<p class="conv-ms" lang="ms">' + esc(line.ms) + "</p>" : "") +
          (showEn ? '<p class="conv-en">' + esc(line.en) + "</p>" : "") +
          "</div></div>";
      }).join("");

      return '<div class="back-row"><button type="button" class="back-link" data-action="conv-back">' + ICONS.chevronLeft + " Back to list</button></div>" +
        '<div class="conv-reading">' +
        heading +
        '<div class="conv-messages">' + lines +
        '<div class="conv-take-quiz-row"><button type="button" class="btn btn-primary btn-block" data-action="conv-take-quiz">Take quiz</button></div>' +
        "</div>" +
        "</div>";
    }

    return '<p class="section-label">' + esc(set.label) + " conversations</p>" +
      '<div class="setup-list">' +
      '<button type="button" class="setup-item" data-action="conv-random"><span class="setup-item-title">Random conversation</span></button>' +
      '<button type="button" class="setup-item" data-action="conv-all"><span class="setup-item-title">All conversations</span><span class="setup-item-meta">' + set.conversations.length + "</span></button>" +
      '<hr class="setup-divider">' +
      set.conversations.map(function (c) {
        return '<button type="button" class="setup-item" data-action="conv-pick" data-id="' + esc(c.id) + '"><span class="setup-item-text"><span class="setup-item-title">' + esc(c.title) + '</span><span class="setup-item-sub">' + esc(c.subtitle) + "</span></span></button>";
      }).join("") +
      "</div>";
  }

  function renderConvFooter() {
    if (state.conv.screen !== "reading" || !state.conv.selection) return "";
    var mode = state.conv.mode;
    return '<div class="conv-controls">' +
      '<button type="button" class="icon-btn" data-action="conv-prev" aria-label="Previous dialogue">' + ICONS.chevronLeft + "</button>" +
      '<div class="segmented segmented-sm" role="group" aria-label="Show language">' +
      '<button type="button" data-action="conv-mode" data-mode="ms" aria-pressed="' + (mode === "ms") + '">BM</button>' +
      '<button type="button" data-action="conv-mode" data-mode="both" aria-pressed="' + (mode === "both") + '">BM + EN</button>' +
      '<button type="button" data-action="conv-mode" data-mode="en" aria-pressed="' + (mode === "en") + '">EN</button>' +
      "</div>" +
      '<button type="button" class="icon-btn" data-action="conv-next" aria-label="Next dialogue">' + ICONS.chevronRight + "</button>" +
      "</div>";
  }

  // ---------- Table ----------

  function buildGlossaryGroups() {
    var set = currentSet();
    if (set.id === "visit") {
      return groupCardsByTopic(set.cards).map(function (g) { return { heading: g.topic, cards: g.cards }; });
    }
    if (set.id !== "all") {
      return groupCardsByTopic(set.cards).map(function (g) { return { heading: g.topic, cards: g.cards }; });
    }
    var groups = [];
    allSets.filter(function (s) { return s.id !== "all"; }).forEach(function (s) {
      groupCardsByTopic(s.cards).forEach(function (g) {
        groups.push({ heading: g.topic, cards: g.cards });
      });
    });
    return groups;
  }

  function renderGlossaryResultsHTML(query) {
    var q = query.trim().toLowerCase();
    var groups = buildGlossaryGroups();
    var filtered = groups.map(function (g) {
      var cards = !q ? g.cards : g.cards.filter(function (c) {
        return c.ms.toLowerCase().indexOf(q) !== -1 || c.en.toLowerCase().indexOf(q) !== -1;
      });
      return { heading: g.heading, cards: cards };
    }).filter(function (g) { return g.cards.length; });

    if (!filtered.length) return '<p class="empty-state">No matches found.</p>';

    return filtered.map(function (g) {
      return '<div class="glossary-group-title"><span class="glossary-group-heading">' + esc(g.heading.toUpperCase()) + '</span><span class="glossary-group-count">' + g.cards.length + " word" + (g.cards.length === 1 ? "" : "s") + "</span></div>" +
        '<div class="glossary-card">' +
        g.cards.map(function (c) {
          return '<div class="glossary-row"><p class="glossary-ms" lang="ms">' + esc(c.ms) + '</p><p class="glossary-en">' + esc(c.en) + "</p>" +
            (c.note ? '<p class="glossary-note">' + esc(c.note) + "</p>" : "") +
            "</div>";
        }).join("") +
        "</div>";
    }).join("");
  }

  function renderTableView() {
    return '<div id="glossary-results">' + renderGlossaryResultsHTML(state.table.query) + "</div>";
  }

  function renderTableFooter() {
    var set = currentSet();
    return '<div class="table-search-row"><span class="table-search-icon">' + ICONS.search + '</span>' +
      '<input type="search" class="table-search" id="table-search-input" placeholder="Search ' + set.cards.length + ' words in BM or English" value="' + esc(state.table.query) + '" aria-label="Search glossary"></div>';
  }

  // ---------- Filter sheet ----------

  function openFilterSheet() {
    state.filterSheet = {
      open: true,
      week: state.setId,
      topics: new Set(state.flash.topics),
      direction: state.flash.direction,
      expanded: new Set()
    };
    render();
    var sheet = document.getElementById("filter-sheet");
    if (sheet) sheet.focus();
  }

  function closeFilterSheet() {
    state.filterSheet.open = false;
    render();
    pillBtn.focus();
  }

  function filterSheetDraftSet() {
    return setById(state.filterSheet.week);
  }

  function filterSheetWeekChanged(newWeek) {
    state.filterSheet.week = newWeek;
    var draftSet = filterSheetDraftSet();
    state.filterSheet.topics = new Set(getTopics(draftSet));
    state.filterSheet.expanded = new Set();
    render();
  }

  function renderFilterSheet() {
    var fs = state.filterSheet;
    var draftSet = filterSheetDraftSet();
    var groups = getPresentGroups(draftSet);
    var selected = fs.topics;
    var expanded = fs.expanded;
    var count = draftSet.cards.filter(function (c) { return selected.has(c.topic); }).length;

    var weekChips = allSets.filter(function (s) { return s.id !== "visit"; }).sort(function (a, b) {
      return (a.id === "all" ? -1 : 0) - (b.id === "all" ? -1 : 0);
    }).map(function (s) {
      var label = s.id === "all" ? "All" : s.id;
      return '<button type="button" class="week-chip" data-action="filter-week" data-week="' + esc(s.id) + '" aria-pressed="' + (fs.week === s.id) + '">' + esc(label) + "</button>";
    }).join("");
    var visitSet = setById("visit");
    var visitChip = '<button type="button" class="week-chip week-chip-wide" data-action="filter-week" data-week="visit" aria-pressed="' + (fs.week === "visit") + '">' + esc(visitSet.label) + "</button>";

    var topicChips = groups.map(function (g) {
      var selectedCount = g.topics.filter(function (t) { return selected.has(t); }).length;
      var state2 = selectedCount === 0 ? "none" : selectedCount === g.topics.length ? "all" : "mixed";
      var rowClass = "topic-chip-row" + (state2 === "all" ? " is-active" : state2 === "mixed" ? " is-mixed" : "");
      var n = draftSet.cards.filter(function (c) { return g.topics.indexOf(c.topic) !== -1; }).length;
      var isExpanded = expanded.has(g.id);
      var subRows = !isExpanded ? "" : '<div class="subtopic-list">' + g.topics.map(function (t) {
        var tn = draftSet.cards.filter(function (c) { return c.topic === t; }).length;
        return '<button type="button" class="subtopic-row" role="checkbox" aria-checked="' + selected.has(t) + '" data-action="filter-subtopic-toggle" data-topic="' + esc(t) + '">' +
          '<span class="topic-check" aria-hidden="true"></span>' +
          '<span style="flex:1">' + esc(t) + "</span>" +
          '<span class="setup-item-meta">' + tn + "</span>" +
          "</button>";
      }).join("") + "</div>";

      var ariaChecked = state2 === "all" ? "true" : state2 === "mixed" ? "mixed" : "false";
      return '<div class="' + rowClass + '">' +
        '<button type="button" class="topic-chip-toggle" role="checkbox" aria-checked="' + ariaChecked + '" data-action="filter-group-toggle" data-group="' + esc(g.id) + '">' +
        '<span>' + esc(g.label) + '</span><span class="chip-count">' + n + "</span>" +
        "</button>" +
        '<button type="button" class="topic-chip-expand" data-action="filter-group-expand" data-group="' + esc(g.id) + '" aria-expanded="' + isExpanded + '" aria-label="' + (isExpanded ? "Collapse " : "Expand ") + esc(g.label) + ' topics">' + ICONS.chevronRight + "</button>" +
        "</div>" +
        subRows;
    }).join("");

    return '<div class="sheet-scrim" data-action="filter-backdrop"></div>' +
      '<div class="sheet" id="filter-sheet" role="dialog" aria-modal="true" aria-labelledby="filter-sheet-title" tabindex="-1">' +
      '<div class="sheet-body">' +
      '<div class="sheet-handle-row"><span class="sheet-handle" aria-hidden="true"></span></div>' +
      '<div class="sheet-header"><h2 class="sheet-title" id="filter-sheet-title">Filter cards</h2>' +
      '<button type="button" class="sheet-reset" data-action="filter-reset">Reset</button></div>' +
      '<div class="sheet-section"><p class="sheet-label">Week</p><div class="week-chips">' + weekChips + "</div>" + visitChip + "</div>" +
      '<div class="sheet-section"><p class="sheet-label">Topics</p><div class="topic-chip-list">' + topicChips + "</div></div>" +
      '<div class="sheet-section"><p class="sheet-label">Direction</p>' +
      '<div class="segmented" role="group" aria-label="Direction">' +
      '<button type="button" data-action="filter-direction" data-direction="ms-en" aria-pressed="' + (fs.direction === "ms-en") + '">BM &rarr; EN</button>' +
      '<button type="button" data-action="filter-direction" data-direction="en-ms" aria-pressed="' + (fs.direction === "en-ms") + '">EN &rarr; BM</button>' +
      "</div></div>" +
      "</div>" +
      '<div class="sheet-footer">' +
      '<button type="button" class="btn btn-primary btn-block" data-action="filter-apply">Show ' + count + " card" + (count === 1 ? "" : "s") + "</button>" +
      "</div>" +
      "</div>";
  }

  function applyFilterSheet() {
    var fs = state.filterSheet;
    var weekChanged = fs.week !== state.setId;
    state.setId = fs.week;
    localStorage.setItem(SET_KEY, state.setId);
    state.flash.topics = fs.topics;
    state.flash.direction = fs.direction;
    recomputeFlashDeck();
    if (weekChanged) {
      state.quizSetup = { screen: "setup", expanded: new Set() };
      state.conv = { screen: "list", selection: null, mode: "both", index: 0 };
      state.table = { query: "" };
      if (state.mode === "quiz" && state.setId === "visit") state.mode = "flashcards";
      localStorage.setItem(MODE_KEY, state.mode);
    }
    state.filterSheet.open = false;
    render();
    pillBtn.focus();
  }

  function resetFilterSheet() {
    var draftSet = filterSheetDraftSet();
    state.filterSheet.topics = new Set(getTopics(draftSet));
    state.filterSheet.direction = "ms-en";
    render();
  }

  // ---------- Tab bar ----------

  var TABS = [
    { mode: "flashcards", label: "Flashcards", icon: "layers" },
    { mode: "quiz", label: "Quiz", icon: "question" },
    { mode: "conversation", label: "Conversation", icon: "chat" },
    { mode: "table", label: "Table", icon: "grid" }
  ];

  function renderTabbar() {
    return TABS.map(function (t) {
      var hidden = t.mode === "quiz" && state.setId === "visit";
      return '<button type="button" class="tab-btn" data-action="tab" data-mode="' + t.mode + '" aria-pressed="' + (state.mode === t.mode) + '"' + (hidden ? " hidden" : "") + '>' +
        '<span class="tab-icon">' + ICONS[t.icon] + '</span><span class="tab-label">' + t.label + "</span>" +
        "</button>";
    }).join("");
  }

  // ---------- Top-level render / navigation ----------

  function render() {
    updatePillLabel();
    tabbarEl.innerHTML = renderTabbar();
    sheetRootEl.innerHTML = state.filterSheet.open ? renderFilterSheet() : "";

    var showProgress = !state.filterSheet.open && (
      (!state.activeQuiz && state.mode === "flashcards") ||
      (state.activeQuiz && state.activeQuiz.screen === "run")
    );
    progressRow.hidden = !showProgress;
    if (showProgress) {
      if (state.activeQuiz) {
        var aq = state.activeQuiz;
        var total = aq.questions.length;
        progressFill.style.width = Math.round((aq.index / total) * 100) + "%";
        progressCount.textContent = (aq.index + 1) + " / " + total;
      } else {
        var deck = state.flash.deck;
        progressFill.style.width = deck.length ? Math.round(((state.flash.pos + 1) / deck.length) * 100) + "%" : "0%";
        progressCount.textContent = deck.length ? (state.flash.pos + 1) + " / " + deck.length : "0 / 0";
      }
    }

    if (state.activeQuiz) {
      viewEl.innerHTML = renderQuizFlow();
      setFooter(renderQuizFooter());
      return;
    }

    if (state.mode === "flashcards") {
      viewEl.innerHTML = renderFlashcards();
      setFooter(state.flash.deck.length ? renderFlashFooter() : "");
    } else if (state.mode === "quiz") {
      viewEl.innerHTML = renderQuizSetup();
      setFooter("");
    } else if (state.mode === "conversation") {
      viewEl.innerHTML = renderConversation();
      setFooter(renderConvFooter());
    } else {
      viewEl.innerHTML = renderTableView();
      setFooter(renderTableFooter());
    }
  }

  function setFooter(html) {
    footerEl.innerHTML = html;
    footerEl.hidden = !html;
  }

  function enterMode(mode) {
    if (mode === "quiz" && state.setId === "visit") mode = "flashcards";
    state.mode = mode;
    localStorage.setItem(MODE_KEY, mode);
    state.activeQuiz = null;
    state.quizSetup = { screen: "setup", expanded: new Set() };
    state.conv = { screen: "list", selection: null, mode: "both", index: 0 };
    state.table = { query: "" };
    render();
  }

  function handleModeClick(mode) {
    if (mode === "quiz" && state.setId === "visit") return;
    enterMode(mode);
  }

  // ---------- Events ----------

  function handleClick(e) {
    var el = e.target.closest ? e.target.closest("[data-action]") : null;
    if (!el) return;
    var action = el.dataset.action;
    var aq = state.activeQuiz;

    switch (action) {
      case "tab":
        handleModeClick(el.dataset.mode);
        break;

      case "filter-open":
        openFilterSheet();
        break;
      case "filter-close":
      case "filter-backdrop":
        closeFilterSheet();
        break;
      case "filter-reset":
        resetFilterSheet();
        break;
      case "filter-apply":
        applyFilterSheet();
        break;
      case "filter-week":
        filterSheetWeekChanged(el.dataset.week);
        break;
      case "filter-direction":
        state.filterSheet.direction = el.dataset.direction;
        render();
        break;
      case "filter-group-toggle":
        var toggleGroup = getPresentGroups(filterSheetDraftSet()).filter(function (g) { return g.id === el.dataset.group; })[0];
        if (toggleGroup) {
          var allSelected = toggleGroup.topics.every(function (t) { return state.filterSheet.topics.has(t); });
          toggleGroup.topics.forEach(function (t) {
            if (allSelected) state.filterSheet.topics.delete(t); else state.filterSheet.topics.add(t);
          });
          render();
        }
        break;
      case "filter-subtopic-toggle":
        var subtopic = el.dataset.topic;
        if (state.filterSheet.topics.has(subtopic)) state.filterSheet.topics.delete(subtopic); else state.filterSheet.topics.add(subtopic);
        render();
        break;
      case "filter-group-expand":
        var expandId = el.dataset.group;
        if (state.filterSheet.expanded.has(expandId)) state.filterSheet.expanded.delete(expandId); else state.filterSheet.expanded.add(expandId);
        render();
        break;

      case "flash-flip":
      case "flash-flip-card":
        toggleFlashFlip();
        break;
      case "flash-prev":
        animateFlashMove(-1);
        break;
      case "flash-next":
        animateFlashMove(1);
        break;
      case "flash-shuffle":
        state.flash.deck = shuffle(state.flash.deck);
        state.flash.pos = 0;
        state.flash.flipped = false;
        render();
        break;

      case "quiz-topic":
        startCardsQuiz("topic", el.dataset.topic);
        break;
      case "quiz-group":
        var quizGroup = getPresentGroups(currentSet()).filter(function (g) { return g.id === el.dataset.group; })[0];
        if (quizGroup) startCardsQuiz("group", quizGroup);
        break;
      case "quiz-group-expand":
        var quizExpandId = el.dataset.group;
        if (state.quizSetup.expanded.has(quizExpandId)) state.quizSetup.expanded.delete(quizExpandId); else state.quizSetup.expanded.add(quizExpandId);
        render();
        break;
      case "quiz-random-topic":
        var topics = getTopics(currentSet());
        startCardsQuiz("topic", topics[Math.floor(Math.random() * topics.length)]);
        break;
      case "quiz-all-topics":
        state.quizSetup.screen = "count";
        render();
        break;
      case "quiz-setup-back":
        state.quizSetup.screen = "setup";
        render();
        break;
      case "quiz-start-all":
        startCardsQuiz("all", null, Number(el.dataset.count));
        break;

      case "quiz-select":
        if (!aq.checked) { aq.selected = Number(el.dataset.index); render(); }
        break;
      case "quiz-check":
        if (aq.selected !== null && !aq.checked) {
          aq.checked = true;
          if (aq.selected === aq.questions[aq.index].correctIndex) aq.score++;
          render();
        }
        break;
      case "quiz-next":
        aq.index++;
        if (aq.index >= aq.questions.length) {
          aq.screen = "results";
        } else {
          aq.selected = null;
          aq.checked = false;
        }
        render();
        break;
      case "quiz-results-new-topic":
        state.activeQuiz = null;
        state.mode = "quiz";
        state.quizSetup = { screen: "setup", expanded: new Set() };
        render();
        break;
      case "quiz-results-back-conv":
        state.activeQuiz = null;
        state.mode = "conversation";
        state.conv.screen = "reading";
        render();
        break;
      case "quiz-results-new-selection":
        state.activeQuiz = null;
        state.mode = "conversation";
        state.conv.screen = "list";
        state.conv.selection = null;
        render();
        break;

      case "conv-random":
        var list = currentSet().conversations;
        var randomIndex = Math.floor(Math.random() * list.length);
        state.conv.selection = [list[randomIndex]];
        state.conv.index = randomIndex;
        state.conv.screen = "reading";
        render();
        break;
      case "conv-all":
        state.conv.selection = currentSet().conversations.slice();
        state.conv.index = 0;
        state.conv.screen = "reading";
        render();
        break;
      case "conv-pick":
        var pickList = currentSet().conversations;
        var pickIndex = pickList.map(function (c) { return c.id; }).indexOf(el.dataset.id);
        state.conv.selection = pickList.filter(function (c) { return c.id === el.dataset.id; });
        state.conv.index = pickIndex === -1 ? 0 : pickIndex;
        state.conv.screen = "reading";
        render();
        break;
      case "conv-back":
        state.conv.screen = "list";
        state.conv.selection = null;
        render();
        break;
      case "conv-mode":
        state.conv.mode = el.dataset.mode;
        render();
        break;
      case "conv-prev":
      case "conv-next":
        convMove(action === "conv-next" ? 1 : -1);
        break;
      case "conv-take-quiz":
        startConversationQuiz();
        break;
    }
  }

  function convMove(delta) {
    var all = currentSet().conversations;
    if (!state.conv.selection || all.length < 2) return;
    state.conv.index = (state.conv.index + delta + all.length) % all.length;
    render();
    viewEl.scrollTop = 0;
  }

  function handleKeydown(e) {
    if (state.filterSheet.open) {
      if (e.key === "Escape") { closeFilterSheet(); e.preventDefault(); }
      return;
    }
    if (state.mode !== "flashcards" || state.activeQuiz) return;
    var activeTag = (document.activeElement && document.activeElement.tagName) || "";
    if (["INPUT", "SELECT", "TEXTAREA"].indexOf(activeTag) !== -1) return;
    if (e.key === "ArrowLeft") { animateFlashMove(-1); e.preventDefault(); }
    else if (e.key === "ArrowRight") { animateFlashMove(1); e.preventDefault(); }
    else if ((e.key === " " || e.key === "Enter") && document.activeElement && document.activeElement.classList.contains("flashcard")) {
      toggleFlashFlip();
      e.preventDefault();
    }
  }

  var touchStartX = 0, touchStartY = 0, touchMoved = false;
  function handleTouchStart(e) {
    if (state.mode !== "flashcards" || state.filterSheet.open) return;
    var t = e.touches[0];
    touchStartX = t.clientX; touchStartY = t.clientY; touchMoved = false;
  }
  function handleTouchMove(e) {
    if (state.mode !== "flashcards" || state.filterSheet.open) return;
    var t = e.touches[0];
    if (Math.abs(t.clientX - touchStartX) > 10 || Math.abs(t.clientY - touchStartY) > 10) touchMoved = true;
  }
  function handleTouchEnd(e) {
    if (state.mode !== "flashcards" || state.filterSheet.open || !touchMoved) return;
    var t = e.changedTouches[0];
    var dx = t.clientX - touchStartX, dy = t.clientY - touchStartY;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) animateFlashMove(dx < 0 ? 1 : -1);
  }

  function handleInput(e) {
    if (e.target.id !== "table-search-input") return;
    state.table.query = e.target.value;
    var results = document.getElementById("glossary-results");
    if (results) results.innerHTML = renderGlossaryResultsHTML(state.table.query);
  }

  // ---------- Init ----------

  Promise.all([
    fetch("data/stp-malay.json").then(function (res) { return res.json(); }),
    fetch("data/topic-groups.json").then(function (res) { return res.json(); })
  ])
    .then(function (results) {
      var data = results[0];
      topicGroups = results[1].groups;

      allSets = data.sets.concat([{
        id: "all",
        label: "All weeks",
        cards: data.sets.reduce(function (acc, s) { return acc.concat(s.cards); }, []),
        conversations: data.sets.reduce(function (acc, s) { return acc.concat(s.conversations); }, [])
      }]);

      var validIds = allSets.map(function (s) { return s.id; });
      var savedSetId = localStorage.getItem(SET_KEY);
      var savedMode = localStorage.getItem(MODE_KEY);

      state.setId = validIds.indexOf(savedSetId) !== -1 ? savedSetId : "all";
      localStorage.setItem(SET_KEY, state.setId);
      resetFlashState();

      var initialMode = savedMode || (state.setId === "visit" ? "table" : "flashcards");
      if (initialMode === "quiz" && state.setId === "visit") initialMode = "flashcards";

      enterMode(initialMode);

      appEl.addEventListener("click", handleClick);
      appEl.addEventListener("input", handleInput);
      viewEl.addEventListener("touchstart", handleTouchStart, { passive: true });
      viewEl.addEventListener("touchmove", handleTouchMove, { passive: true });
      viewEl.addEventListener("touchend", handleTouchEnd, { passive: true });
      document.addEventListener("keydown", handleKeydown);
    })
    .catch(function (err) {
      viewEl.innerHTML = '<p class="empty-state">Could not load the word list. Try reloading the page.</p>';
      console.error(err);
    });
})();
