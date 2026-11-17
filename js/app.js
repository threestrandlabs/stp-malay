(function () {
  "use strict";

  var SET_KEY = "stpMalay.setId";
  var MODE_KEY = "stpMalay.mode";
  var WEEK_IDS = ["1", "2", "3", "4", "5", "6"];

  var viewEl = document.getElementById("view");
  var setSelectEl = document.getElementById("set-select");
  var termCountEl = document.getElementById("term-count");
  var modeButtons = Array.prototype.slice.call(document.querySelectorAll(".mode-btn"));

  var allSets = [];
  var topicGroups = [];
  var state = {
    setId: null,
    mode: null,
    activeQuiz: null,
    flash: { topics: new Set(), deck: [], pos: 0, flipped: false, direction: "ms-en", panelOpen: false, expanded: new Set() },
    quizSetup: { screen: "setup", expanded: new Set() },
    conv: { screen: "list", selection: null, showEnglish: true },
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
    check: tplHtml("tpl-icon-check"),
    x: tplHtml("tpl-icon-x"),
    search: tplHtml("tpl-icon-search")
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

  function currentSet() {
    var set = allSets.filter(function (s) { return s.id === state.setId; })[0];
    return set || allSets[0];
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

  // ---------- Flashcards ----------

  function resetFlashState() {
    var set = currentSet();
    state.flash.topics = new Set(getTopics(set));
    state.flash.direction = "ms-en";
    state.flash.panelOpen = false;
    state.flash.expanded = new Set();
    recomputeFlashDeck();
  }

  function recomputeFlashDeck() {
    var set = currentSet();
    var filtered = set.cards.filter(function (c) { return state.flash.topics.has(c.topic); });
    state.flash.deck = shuffle(filtered);
    state.flash.pos = 0;
    state.flash.flipped = false;
  }

  function openTopicsPanel() {
    state.flash.panelOpen = true;
    render();
    var panel = document.getElementById("topics-panel");
    if (panel) panel.focus();
  }

  function closeTopicsPanel() {
    state.flash.panelOpen = false;
    render();
    var trigger = document.querySelector(".topics-trigger");
    if (trigger) trigger.focus();
  }

  function flashTopicsSummaryLabel(set) {
    var allTopics = getTopics(set);
    var selected = state.flash.topics;
    if (selected.size === allTopics.length) return "Topics: All";
    if (selected.size === 0) return "Topics: None";
    var groups = getPresentGroups(set);
    var fullGroups = groups.filter(function (g) { return g.topics.every(function (t) { return selected.has(t); }); });
    var anyPartial = groups.some(function (g) {
      var n = g.topics.filter(function (t) { return selected.has(t); }).length;
      return n > 0 && n < g.topics.length;
    });
    if (!anyPartial && fullGroups.length) return "Topics: " + fullGroups.length + " of " + groups.length + " groups";
    return "Topics: " + selected.size + " subtopics";
  }

  function renderTopicsPanel(set) {
    var groups = getPresentGroups(set);
    var selected = state.flash.topics;
    var expanded = state.flash.expanded;

    var rows = groups.map(function (g) {
      var selectedCount = g.topics.filter(function (t) { return selected.has(t); }).length;
      var checked = selectedCount === 0 ? "false" : selectedCount === g.topics.length ? "true" : "mixed";
      var count = set.cards.filter(function (c) { return g.topics.indexOf(c.topic) !== -1; }).length;
      var isExpanded = expanded.has(g.id);
      var subRows = !isExpanded ? "" : '<div class="topic-subtopic-list">' + g.topics.map(function (t) {
        var n = set.cards.filter(function (c) { return c.topic === t; }).length;
        return '<button type="button" class="topic-row-sub" role="checkbox" aria-checked="' + selected.has(t) + '" data-action="flash-subtopic-toggle" data-topic="' + esc(t) + '">' +
          '<span class="topic-check" aria-hidden="true"></span>' +
          '<span class="topic-row-label">' + esc(t) + "</span>" +
          '<span class="topic-row-count">' + n + "</span>" +
          "</button>";
      }).join("") + "</div>";

      return '<div class="topic-group">' +
        '<div class="topic-row-group">' +
        '<button type="button" class="topic-row-main" role="checkbox" aria-checked="' + checked + '" data-action="flash-group-toggle" data-group="' + esc(g.id) + '">' +
        '<span class="topic-check" aria-hidden="true"></span>' +
        '<span class="topic-row-label">' + esc(g.label) + "</span>" +
        '<span class="topic-row-count">' + count + "</span>" +
        "</button>" +
        '<button type="button" class="topic-expand-btn" data-action="flash-group-expand" data-group="' + esc(g.id) + '" aria-expanded="' + isExpanded + '" aria-label="' + (isExpanded ? "Collapse " : "Expand ") + esc(g.label) + ' topics">' + ICONS.chevronRight + "</button>" +
        "</div>" +
        subRows +
        "</div>";
    }).join("");

    var doneLabel = state.flash.deck.length ? "Show " + state.flash.deck.length + " cards" : "Done";

    return '<div class="topics-overlay" data-action="flash-topics-backdrop"></div>' +
      '<div class="topics-panel" id="topics-panel" role="dialog" aria-modal="true" aria-labelledby="topics-panel-title" tabindex="-1">' +
      '<div class="topics-panel-header"><h2 class="topics-panel-title" id="topics-panel-title">Topics</h2>' +
      '<button type="button" class="icon-btn btn-ghost" data-action="flash-topics-close" aria-label="Close">' + ICONS.x + "</button></div>" +
      '<div class="topics-panel-quick">' +
      '<button type="button" class="btn btn-ghost" data-action="flash-topics-all">All</button>' +
      '<button type="button" class="btn btn-ghost" data-action="flash-topics-none">None</button>' +
      "</div>" +
      '<div class="topics-panel-list">' + rows + "</div>" +
      '<div class="topics-panel-footer"><button type="button" class="btn btn-primary" data-action="flash-topics-done">' + doneLabel + "</button></div>" +
      "</div>";
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
    cardEl.setAttribute("data-anim", "out-" + dir);
    cardEl.classList.add("anim-out-" + dir);
    setTimeout(function () {
      flashMove(delta);
      var newCardEl = viewEl.querySelector(".flashcard");
      if (newCardEl) {
        newCardEl.setAttribute("data-anim", "in-" + dir);
        newCardEl.classList.add("anim-in-" + dir);
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            newCardEl.classList.remove("anim-in-" + dir);
            newCardEl.removeAttribute("data-anim");
          });
        });
      }
      flashAnimating = false;
    }, outDuration);
  }

  function renderFlashcards() {
    var set = currentSet();
    var topics = getTopics(set);
    var panelHtml = state.flash.panelOpen ? renderTopicsPanel(set) : "";
    var topicsButton = '<button type="button" class="btn topics-trigger" data-action="flash-topics-open" aria-haspopup="dialog">' + esc(flashTopicsSummaryLabel(set)) + "</button>";

    if (!topics.length) {
      return topicsButton + '<p class="empty-state">No topics in this set.</p>' + panelHtml;
    }

    var deck = state.flash.deck;
    if (!deck.length) {
      return '<div class="flash-toolbar">' + topicsButton + "</div>" +
        '<p class="empty-state">No topics selected. Choose a topic to study.</p>' + panelHtml;
    }

    var card = deck[state.flash.pos];
    var msFirst = state.flash.direction === "ms-en";
    var frontLangCode = msFirst ? "ms" : "en";
    var backLangCode = msFirst ? "en" : "ms";
    var frontText = msFirst ? card.ms : card.en;
    var frontLang = msFirst ? ' lang="ms"' : "";
    var backText = msFirst ? card.en : card.ms;
    var backLang = msFirst ? "" : ' lang="ms"';
    var visibleSide = state.flash.flipped ? backLangCode : frontLangCode;

    var examplesHtml = "";
    if (card.examples && card.examples.length) {
      examplesHtml = '<div class="card-examples"><p class="card-examples-title">Examples</p>' +
        card.examples.map(function (ex) {
          return '<div class="example-row"><span class="example-ms lang-ms" lang="ms">' + esc(ex.ms) + '</span> — <span class="example-en lang-en">' + esc(ex.en) + "</span></div>";
        }).join("") + "</div>";
    }

    return '<div class="flash-toolbar">' +
      topicsButton +
      '<div class="direction-toggle" role="group" aria-label="Direction">' +
      '<button type="button" data-action="flash-direction" data-direction="ms-en" aria-pressed="' + msFirst + '">BM &rarr; EN</button>' +
      '<button type="button" data-action="flash-direction" data-direction="en-ms" aria-pressed="' + !msFirst + '">EN &rarr; BM</button>' +
      "</div>" +
      '<span class="flash-counter">' + (state.flash.pos + 1) + " / " + deck.length + "</span>" +
      "</div>" +
      '<div class="card-stage">' +
      '<div class="flashcard' + (state.flash.flipped ? " is-flipped" : "") + '" tabindex="0" role="button" aria-pressed="' + state.flash.flipped + '" aria-label="Flashcard, tap to flip" data-action="flash-flip-card" data-side="' + visibleSide + '">' +
      '<div class="flashcard-inner">' +
      '<div class="card-face card-face-front card-face-' + frontLangCode + '">' +
      '<p class="card-lang-label">' + (frontLangCode === "ms" ? "MELAYU" : "ENGLISH") + "</p>" +
      '<p class="card-topic">' + esc(card.topic) + "</p>" +
      '<p class="card-term"' + frontLang + ">" + esc(frontText) + "</p>" +
      '<p class="card-hint">Tap to reveal</p>' +
      "</div>" +
      '<div class="card-face card-face-back card-face-' + backLangCode + '">' +
      '<p class="card-lang-label">' + (backLangCode === "ms" ? "MELAYU" : "ENGLISH") + "</p>" +
      '<p class="card-topic">' + esc(card.topic) + "</p>" +
      '<p class="card-term"' + backLang + ">" + esc(backText) + "</p>" +
      (card.note ? '<p class="card-note">' + esc(card.note) + "</p>" : "") +
      "</div>" +
      "</div>" +
      "</div>" +
      "</div>" +
      examplesHtml +
      '<div class="flash-controls">' +
      '<button type="button" class="btn" data-action="flash-prev">' + ICONS.chevronLeft + '<span class="visually-hidden">Previous card</span></button>' +
      '<button type="button" class="btn btn-primary flip-btn" data-action="flash-flip">' + ICONS.rotate + " Flip</button>" +
      '<button type="button" class="btn" data-action="flash-next"><span class="visually-hidden">Next card</span>' + ICONS.chevronRight + "</button>" +
      "</div>" +
      '<div class="flash-shuffle-row"><button type="button" class="btn btn-ghost" data-action="flash-shuffle">' + ICONS.shuffle + " Shuffle</button></div>" +
      panelHtml;
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
    return { kind: "term", prompt: card.ms, topic: card.topic, options: options, correctIndex: correctIndex };
  }

  function buildConvQuestion(q) {
    var tagged = q.options.map(function (text, i) { return { text: text, isCorrect: i === q.correct }; });
    var shuffled = shuffle(tagged);
    var correctIndex = -1;
    shuffled.forEach(function (o, i) { if (o.isCorrect) correctIndex = i; });
    return { kind: "question", prompt: q.q, options: shuffled.map(function (o) { return o.text; }), correctIndex: correctIndex };
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
      return '<div class="back-row"><button type="button" class="btn btn-ghost" data-action="quiz-setup-back">' + ICONS.chevronLeft + " Back</button></div>" +
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
      var subItems = !isExpanded ? "" : '<div class="quiz-group-subitems">' + g.topics.map(function (t) {
        var tn = set.cards.filter(function (c) { return c.topic === t; }).length;
        return '<button type="button" class="setup-item" data-action="quiz-topic" data-topic="' + esc(t) + '"><span class="setup-item-title">' + esc(t) + "</span><span class=\"setup-item-meta\">" + tn + " terms</span></button>";
      }).join("") + "</div>";

      return '<div class="quiz-group">' +
        '<div class="quiz-group-row">' +
        '<button type="button" class="setup-item quiz-group-start" data-action="quiz-group" data-group="' + esc(g.id) + '"><span class="setup-item-title">' + esc(g.label) + "</span><span class=\"setup-item-meta\">" + n + " terms</span></button>" +
        '<button type="button" class="quiz-group-expand" data-action="quiz-group-expand" data-group="' + esc(g.id) + '" aria-expanded="' + isExpanded + '" aria-label="' + (isExpanded ? "Collapse " : "Expand ") + esc(g.label) + ' topics">' + ICONS.chevronRight + "</button>" +
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

  // ---------- Quiz run / results (shared by quiz mode and conversation quiz) ----------

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

    var optionsMarkup = q.options.map(function (opt, i) {
      var cls = "quiz-option";
      var pressed = aq.selected === i;
      var icon = "";
      if (aq.checked) {
        if (i === q.correctIndex) { cls += " is-correct"; icon = '<span class="quiz-option-icon">' + ICONS.check + "</span>"; }
        else if (i === aq.selected) { cls += " is-wrong"; icon = '<span class="quiz-option-icon">' + ICONS.x + "</span>"; }
      }
      return '<button type="button" class="' + cls + '" data-action="quiz-select" data-index="' + i + '" aria-pressed="' + pressed + '"' + (aq.checked ? " disabled" : "") + "><span>" + esc(opt) + "</span>" + icon + "</button>";
    }).join("");

    var feedback = '<p class="quiz-feedback" aria-live="polite"></p>';
    if (aq.checked) {
      var correct = aq.selected === q.correctIndex;
      feedback = '<p class="quiz-feedback ' + (correct ? "is-correct" : "is-wrong") + '" aria-live="polite">' +
        (correct ? ICONS.check + " Correct." : ICONS.x + " Not quite.") + "</p>";
    }

    var actionButton = !aq.checked ?
      '<button type="button" class="btn btn-primary" data-action="quiz-check"' + (aq.selected === null ? " disabled" : "") + ">Check</button>" :
      '<button type="button" class="btn btn-primary" data-action="quiz-next">' + (aq.index + 1 >= total ? "See results" : "Next") + "</button>";

    return '<div class="quiz-header">' +
      '<p class="quiz-title">' + esc(aq.title) + " &middot; " + total + " question" + (total === 1 ? "" : "s") + "</p>" +
      '<div class="quiz-progress"><span>Question ' + (aq.index + 1) + " / " + total + '</span><span>Score ' + aq.score + "</span></div>" +
      '<div class="progress-bar"><div class="progress-bar-fill" style="width:' + Math.round((aq.index / total) * 100) + '%"></div></div>' +
      "</div>" +
      termMarkup +
      '<div class="quiz-options">' + optionsMarkup + "</div>" +
      feedback +
      '<div class="quiz-actions">' + actionButton + "</div>";
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
      '<p class="quiz-score">' + aq.score + " / " + total + "</p>" +
      '<p class="quiz-message">' + esc(message) + "</p>" +
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
      var selection = state.conv.selection;
      var showEnglish = state.conv.showEnglish;
      var body = selection.map(function (conv) {
        var heading = selection.length > 1 ?
          '<h2 class="conv-section-title">' + esc(conv.title) + " — " + esc(conv.subtitle) + "</h2>" : "";
        var lines = conv.lines.map(function (line) {
          return '<div class="conv-line"><p class="conv-speaker">' + esc(line.speaker) + "</p>" +
            '<p class="conv-ms lang-ms" lang="ms">' + esc(line.ms) + "</p>" +
            (showEnglish ? '<p class="conv-en lang-en">' + esc(line.en) + "</p>" : "") +
            "</div>";
        }).join("");
        return heading + lines;
      }).join("");

      return '<div class="back-row"><button type="button" class="btn btn-ghost" data-action="conv-back">' + ICONS.chevronLeft + " Back</button></div>" +
        '<div class="conv-toolbar"><span class="section-label" style="margin:0">' + selection.length + " conversation" + (selection.length > 1 ? "s" : "") + "</span>" +
        '<button type="button" class="btn btn-ghost" data-action="conv-toggle-en" aria-pressed="' + showEnglish + '">' + (showEnglish ? "Hide English" : "Show English") + "</button></div>" +
        body +
        '<div class="conv-actions"><button type="button" class="btn btn-primary" data-action="conv-take-quiz">Take quiz</button></div>';
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

  // ---------- Table ----------

  function buildGlossaryGroups() {
    var set = currentSet();
    if (set.id === "visit") {
      return groupCardsByTopic(set.cards).map(function (g) { return { heading: g.topic, cards: g.cards }; });
    }
    var groups = [];
    allSets.filter(function (s) { return WEEK_IDS.indexOf(s.id) !== -1 || s.id === "visit"; }).forEach(function (s) {
      groupCardsByTopic(s.cards).forEach(function (g) {
        groups.push({ heading: s.label + " · " + g.topic, cards: g.cards });
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
      return '<h2 class="glossary-group-title">' + esc(g.heading) + "</h2>" +
        g.cards.map(function (c) {
          return '<div class="glossary-row"><p class="glossary-ms lang-ms" lang="ms">' + esc(c.ms) + '</p><p class="glossary-en lang-en">' + esc(c.en) + "</p>" +
            (c.note ? '<p class="glossary-note">' + esc(c.note) + "</p>" : "") +
            "</div>";
        }).join("");
    }).join("");
  }

  function renderTableView() {
    return '<div class="table-toolbar"><span class="table-search-icon">' + ICONS.search + '</span>' +
      '<input type="search" class="table-search" id="table-search-input" placeholder="Search Malay or English" value="' + esc(state.table.query) + '" aria-label="Search glossary"></div>' +
      '<div id="glossary-results">' + renderGlossaryResultsHTML(state.table.query) + "</div>";
  }

  // ---------- Top-level render / navigation ----------

  function render() {
    setSelectEl.value = state.setId;
    termCountEl.textContent = currentSet().cards.length + " terms";
    modeButtons.forEach(function (btn) {
      var m = btn.dataset.mode;
      btn.hidden = m === "quiz" && state.setId === "visit";
      btn.setAttribute("aria-pressed", String(m === state.mode));
    });

    if (state.activeQuiz) {
      viewEl.innerHTML = renderQuizFlow();
      return;
    }

    if (state.mode === "flashcards") viewEl.innerHTML = renderFlashcards();
    else if (state.mode === "quiz") viewEl.innerHTML = renderQuizSetup();
    else if (state.mode === "conversation") viewEl.innerHTML = renderConversation();
    else viewEl.innerHTML = renderTableView();
  }

  function enterMode(mode) {
    if (mode === "quiz" && state.setId === "visit") mode = "flashcards";
    state.mode = mode;
    localStorage.setItem(MODE_KEY, mode);
    state.activeQuiz = null;
    resetFlashState();
    state.quizSetup = { screen: "setup", expanded: new Set() };
    state.conv = { screen: "list", selection: null, showEnglish: true };
    state.table = { query: "" };
    render();
  }

  function enterSet(id, userChange) {
    state.setId = id;
    localStorage.setItem(SET_KEY, id);
    if (userChange) {
      enterMode(id === "visit" ? "table" : "flashcards");
    }
  }

  function handleModeClick(mode) {
    if (mode === "quiz" && state.setId === "visit") return;
    enterMode(mode);
  }

  // ---------- Events ----------

  function handleViewClick(e) {
    var el = e.target.closest ? e.target.closest("[data-action]") : null;
    if (!el) return;
    var action = el.dataset.action;
    var aq = state.activeQuiz;

    switch (action) {
      case "flash-topics-all":
        state.flash.topics = new Set(getTopics(currentSet()));
        recomputeFlashDeck();
        render();
        break;
      case "flash-topics-none":
        state.flash.topics = new Set();
        recomputeFlashDeck();
        render();
        break;
      case "flash-topics-open":
        openTopicsPanel();
        break;
      case "flash-topics-close":
      case "flash-topics-backdrop":
      case "flash-topics-done":
        closeTopicsPanel();
        break;
      case "flash-group-toggle":
        var toggleGroup = getPresentGroups(currentSet()).filter(function (g) { return g.id === el.dataset.group; })[0];
        if (toggleGroup) {
          var allSelected = toggleGroup.topics.every(function (t) { return state.flash.topics.has(t); });
          toggleGroup.topics.forEach(function (t) {
            if (allSelected) state.flash.topics.delete(t); else state.flash.topics.add(t);
          });
          recomputeFlashDeck();
          render();
        }
        break;
      case "flash-subtopic-toggle":
        var subtopic = el.dataset.topic;
        if (state.flash.topics.has(subtopic)) state.flash.topics.delete(subtopic); else state.flash.topics.add(subtopic);
        recomputeFlashDeck();
        render();
        break;
      case "flash-group-expand":
        var expandId = el.dataset.group;
        if (state.flash.expanded.has(expandId)) state.flash.expanded.delete(expandId); else state.flash.expanded.add(expandId);
        render();
        break;
      case "flash-direction":
        state.flash.direction = el.dataset.direction;
        state.flash.flipped = false;
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
        state.conv.selection = [list[Math.floor(Math.random() * list.length)]];
        state.conv.screen = "reading";
        render();
        break;
      case "conv-all":
        state.conv.selection = currentSet().conversations.slice();
        state.conv.screen = "reading";
        render();
        break;
      case "conv-pick":
        state.conv.selection = currentSet().conversations.filter(function (c) { return c.id === el.dataset.id; });
        state.conv.screen = "reading";
        render();
        break;
      case "conv-back":
        state.conv.screen = "list";
        state.conv.selection = null;
        render();
        break;
      case "conv-toggle-en":
        state.conv.showEnglish = !state.conv.showEnglish;
        render();
        break;
      case "conv-take-quiz":
        startConversationQuiz();
        break;
    }
  }

  function handleKeydown(e) {
    if (state.mode === "flashcards" && state.flash.panelOpen) {
      if (e.key === "Escape") { closeTopicsPanel(); e.preventDefault(); }
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
    if (state.mode !== "flashcards" || state.flash.panelOpen) return;
    var t = e.touches[0];
    touchStartX = t.clientX; touchStartY = t.clientY; touchMoved = false;
  }
  function handleTouchMove(e) {
    if (state.mode !== "flashcards" || state.flash.panelOpen) return;
    var t = e.touches[0];
    if (Math.abs(t.clientX - touchStartX) > 10 || Math.abs(t.clientY - touchStartY) > 10) touchMoved = true;
  }
  function handleTouchEnd(e) {
    if (state.mode !== "flashcards" || state.flash.panelOpen || !touchMoved) return;
    var t = e.changedTouches[0];
    var dx = t.clientX - touchStartX, dy = t.clientY - touchStartY;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) animateFlashMove(dx < 0 ? 1 : -1);
  }

  function handleTableInput(e) {
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

      setSelectEl.innerHTML = allSets.map(function (s) {
        return '<option value="' + esc(s.id) + '">' + esc(s.label) + "</option>";
      }).join("");

      var validIds = allSets.map(function (s) { return s.id; });
      var savedSetId = localStorage.getItem(SET_KEY);
      var savedMode = localStorage.getItem(MODE_KEY);

      state.setId = validIds.indexOf(savedSetId) !== -1 ? savedSetId : "all";
      localStorage.setItem(SET_KEY, state.setId);

      var initialMode = savedMode || (state.setId === "visit" ? "table" : "flashcards");
      if (initialMode === "quiz" && state.setId === "visit") initialMode = "flashcards";

      enterMode(initialMode);

      setSelectEl.addEventListener("change", function (e) { enterSet(e.target.value, true); });
      modeButtons.forEach(function (btn) {
        btn.addEventListener("click", function () { handleModeClick(btn.dataset.mode); });
      });
      viewEl.addEventListener("click", handleViewClick);
      viewEl.addEventListener("input", handleTableInput);
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
