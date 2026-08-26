/* THE90 — League overview and league chat */
(function () {
  'use strict';

  var screen = document.querySelector('[data-screen="league-chat"]');
  var list = document.querySelector('[data-league-chat-list]');
  var scroll = document.querySelector('[data-league-chat-scroll]');
  var form = document.querySelector('[data-league-chat-form]');
  var input = document.querySelector('[data-league-chat-input]');
  var send = document.querySelector('[data-league-chat-send]');
  var footer = document.querySelector('[data-shell-footer]');
  var join = document.querySelector('[data-league-join]');
  if (!screen || !list || !scroll || !form || !input || !send || !footer) return;

  /* Bump when the seeded conversation changes — the chat is kept in
     localStorage, so an old transcript would otherwise stick around. */
  var STORAGE_KEY = 'the90.leagueChat.v2';
  var LINE_HEIGHT = 18;
  var MAX_LINES = 5;
  var replyPending = false;
  var initialMessages = [
    { role: 'agent', author: 'Alex Rivera', avatar: 'assets/league/chat-alex.png', text: "Hey everyone! Who's coming to the meetup on Saturday? We've got a great topic lined up 🎉", time: '3:10 PM' },
    { role: 'user', text: "I'll be there! Is it still at the usual café? I can bring some snacks if needed.", time: '3:12 PM' },
    { role: 'system', text: 'Zara Volkov made her picks for Round 3' },
    { role: 'agent', author: 'Alex Rivera', avatar: 'assets/league/chat-alex.png', text: "Yep, same place! Doors open at 2 PM. We're doing a book swap this time.", time: '3:15 PM' },
    { role: 'agent', author: 'Alex Rivera', avatar: 'assets/league/chat-alex.png', text: "Bring any books you've finished — fiction, non-fiction, anything goes!", time: '3:15 PM' },
    { role: 'system', text: 'Kai Tanaka called the exact score and took 30 points' },
    { role: 'agent', author: 'Leo Hart', avatar: 'assets/league/chat-leo.png', text: "Oh nice, I love book swaps! I've got a couple of novels I've been meaning to pass along.", time: '3:18 PM' },
    { role: 'user', text: "Count me in! I'll bring that sci-fi collection I mentioned last week. Should be a fun afternoon.", time: '3:22 PM' },
    { role: 'system', text: 'Nina Okafor earned a 500 Coins streak bonus' },
    { role: 'agent', author: 'Marcus', text: "Awesome, sounds like a full house! I'll set up the discussion corner too — last time the debates got pretty lively 😄", time: '3:25 PM' }
  ];

  function cloneMessages(source) {
    return source.map(function (message) { return Object.assign({}, message); });
  }

  function loadMessages() {
    try {
      var saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (Array.isArray(saved) && saved.length) return saved;
    } catch (error) { /* storage may be unavailable */ }
    return cloneMessages(initialMessages);
  }

  function saveMessages() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages)); } catch (error) { /* storage may be unavailable */ }
  }

  function currentTime() {
    return new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }

  function createMessage(message, showTime) {
    /* Not everything in a league chat is somebody talking — picks landing and
       bonuses paying out get announced too. Those sit centred and bare, with
       no avatar and no bubble, so they read as the room rather than a person. */
    if (message.role === 'system') {
      var note = document.createElement('p');
      note.className = 'league-chat-system';
      note.setAttribute('role', 'status');
      note.textContent = message.text;
      return note;
    }

    var row = document.createElement('article');
    var isUser = message.role === 'user';
    row.className = 'league-chat-message' + (isUser ? ' league-chat-message--user' : '');

    if (!isUser) {
      if (message.avatar) {
        var avatar = document.createElement('img');
        avatar.className = 'league-chat-message__avatar';
        avatar.src = message.avatar;
        avatar.alt = message.author;
        row.appendChild(avatar);
      } else {
        var initial = document.createElement('span');
        initial.className = 'league-chat-message__avatar';
        initial.textContent = message.author.charAt(0);
        initial.setAttribute('aria-label', message.author);
        row.appendChild(initial);
      }
    }

    var content = document.createElement('div');
    content.className = 'league-chat-message__content';
    if (!isUser) {
      var author = document.createElement('span');
      author.className = 'league-chat-message__name';
      author.textContent = message.author;
      content.appendChild(author);
    }

    var bubble = document.createElement('div');
    bubble.className = 'league-chat-message__bubble';
    var text = document.createElement('p');
    text.textContent = message.text;
    bubble.appendChild(text);
    content.appendChild(bubble);

    /* The time sits under the bubble rather than inside it, and only under the
       last of a run from the same person at the same minute — the way a
       messenger stamps a group rather than a line. */
    if (showTime) {
      var time = document.createElement('time');
      time.className = 'league-chat-message__time';
      time.textContent = message.time;
      content.appendChild(time);
    }
    row.appendChild(content);
    return row;
  }

  /* The header counts the room rather than the roll: how much has been said
     in here, kept in step as it is said. */
  var counter = document.querySelector('[data-league-chat-count]');

  function paintCount() {
    if (!counter) return;
    var said = messages.filter(function (message) { return message.role !== 'system'; }).length;
    counter.textContent = said + (said === 1 ? ' message' : ' messages');
  }

  function renderMessages() {
    var fragment = document.createDocumentFragment();
    messages.forEach(function (message, index) {
      var next = messages[index + 1];
      var grouped = next && next.role === message.role &&
        next.author === message.author && next.time === message.time;
      fragment.appendChild(createMessage(message, !grouped));
    });
    list.replaceChildren(fragment);
    paintCount();
  }

  function scrollToBottom() {
    requestAnimationFrame(function () { scroll.scrollTop = scroll.scrollHeight; });
  }

  function updateComposer() {
    var hasText = Boolean(input.value.trim());
    var keepAtBottom = scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 40;
    send.disabled = !hasText;
    input.style.height = LINE_HEIGHT + 'px';
    var fullHeight = input.scrollHeight;
    var maxHeight = LINE_HEIGHT * MAX_LINES;
    input.style.height = Math.min(fullHeight, maxHeight) + 'px';
    input.style.overflowY = fullHeight > maxHeight ? 'auto' : 'hidden';

    requestAnimationFrame(function () {
      if (!footer.classList.contains('is-league-chat')) return;
      /* The room runs the whole height of the screen — messages pass under the
         field and are blurred by it — so it is the list that keeps clear of a
         growing composer, not the scroller. */
      list.style.paddingBottom = (footer.offsetHeight + 18) + 'px';
      if (keepAtBottom) scrollToBottom();
    });
  }

  function replyFor(text) {
    if (/meetup|saturday|book/i.test(text)) return "Sounds great — the meetup is still at the usual café. See you there!";
    if (/match|pick|points/i.test(text)) return 'Good luck in the next round! The leaderboard updates as soon as results are confirmed.';
    return 'Thanks for sharing! The league is stronger when everyone joins the conversation.';
  }

  var messages = loadMessages();
  renderMessages();
  updateComposer();

  input.addEventListener('input', updateComposer);
  input.addEventListener('keydown', function (event) {
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    if (!send.disabled) form.requestSubmit();
  });

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var value = input.value.trim();
    if (!value) return;

    messages.push({ role: 'user', text: value, time: currentTime() });
    messages = messages.slice(-30);
    saveMessages();
    input.value = '';
    renderMessages();
    updateComposer();
    scrollToBottom();

    if (replyPending) return;
    replyPending = true;
    window.setTimeout(function () {
      messages.push({ role: 'agent', author: 'Alex Rivera', avatar: 'assets/league/chat-alex.png', text: replyFor(value), time: currentTime() });
      messages = messages.slice(-30);
      replyPending = false;
      saveMessages();
      renderMessages();
      scrollToBottom();
    }, 1000);
  });


  /* -------------------------------------------------------
     Full participant list — collapsed shows the top three plus
     your pinned card, expanded drops your card into place at #15.
     ------------------------------------------------------- */

  var topBlock = document.querySelector('[data-league-top]');
  var fullBlock = document.querySelector('[data-league-full]');
  var sectionTitle = document.querySelector('[data-league-participants-title]');
  var yourScoreCell = document.querySelector('[data-league-your-score]');
  var leagueScroll = document.querySelector('[data-league-scroll]');

  var BOARD = window.THE90.board;
  var PARTICIPANT_COUNT = 40;
  var YOUR_RANK = 15;

  // You are not on a league's board until you have actually joined it.
  var joined = true;
  var leagueTop = [
    { name: 'Zara Volkov', handle: '@zarav', avatar: 'assets/league/zara.png', score: 6671 },
    { name: 'Kai Tanaka', handle: '@kait', avatar: 'assets/league/kai.png', score: 6231 },
    { name: 'Nina Okafor', handle: '@ninao', avatar: 'assets/league/nina.png', score: 5125 }
  ];
  var leagueNames = [
    'Sam Moreau', 'Juno Park', 'Ravi Patel', 'Liam Becker', 'Elif Yilmaz', 'Marc Dubois',
    'Ana Costa', 'Theo Novak', 'Maya Silva', 'Omar Haddad', 'Lena Fischer', 'Hugo Santos',
    'Iris Kowalski', 'Dan Petrov', 'Nora Mensah', 'Felix Muller', 'Amara Okoye', 'Jonas Nielsen',
    'Clara Rossi', 'Viktor Popescu', 'Mila Johansson', 'Adam Ibrahim', 'Rosa Martinez',
    'Ilya Sokolov', 'Tara Bennett', 'Noel Garcia', 'Sara Kim', 'Bruno Alves', 'Lea Dumont',
    'Kofi Mensah', 'Ines Ferreira', 'Milan Horvat', 'Ada Nowak', 'Yuki Sato', 'Pablo Nunez',
    'Freya Larsen', 'Nadia Rahman'
  ];
  var leagueAvatars = [
    'assets/league/chat-alex.png',
    'assets/league/chat-leo.png',
    'assets/league/nina.png',
    'assets/league/kai.png',
    'assets/league/zara.png'
  ];

  function formatScore(value) {
    return BOARD.format(value);
  }

  function participantAt(rank) {
    if (rank <= leagueTop.length) return leagueTop[rank - 1];
    if (rank === YOUR_RANK) {
      return {
        name: 'Your Name',
        handle: '@yournickname',
        avatar: 'assets/league/your-avatar.png',
        score: 5125 - (rank - leagueTop.length) * 118,
        isYou: true
      };
    }
    var index = rank - leagueTop.length - 1;
    var name = leagueNames[index % leagueNames.length];
    return {
      name: name,
      handle: '@' + name.toLowerCase().replace(/[^a-z]/g, '').slice(0, 8),
      avatar: leagueAvatars[index % leagueAvatars.length],
      score: 5125 - (rank - leagueTop.length) * 118
    };
  }

  function createMember(rank) {
    var person = participantAt(rank);
    var row = document.createElement('article');
    /* The same row the global ranking draws — one board, one shape, so a
       place in a league reads the way a place anywhere else does. */
    row.className = 'rankings-row league-member' + (person.isYou ? ' rankings-row--you league-member--you' : '');
    row.dataset.rank = String(rank);
    if (person.isYou) row.dataset.currentRank = 'true';

    var position = document.createElement('span');
    position.className = 'rankings-row__rank';
    position.textContent = rank;

    var avatarHost = document.createElement('span');
    avatarHost.className = 'rankings-row__avatar';
    var avatar = document.createElement('img');
    avatar.src = person.avatar;
    avatar.alt = person.name;
    avatarHost.appendChild(avatar);

    var copy = document.createElement('span');
    copy.className = 'rankings-row__copy';
    var name = document.createElement('strong');
    name.textContent = person.name;
    var handle = document.createElement('small');
    handle.textContent = person.handle;
    copy.appendChild(name);
    copy.appendChild(handle);

    var score = document.createElement('span');
    score.className = 'rankings-score';
    score.textContent = formatScore(person.score) + ' ';
    var coin = document.createElement('img');
    coin.src = 'assets/league/coin.svg';
    coin.alt = 'Coins';
    coin.width = 14;
    coin.height = 12;
    score.appendChild(coin);

    row.appendChild(position);
    row.appendChild(avatarHost);
    row.appendChild(copy);
    row.appendChild(score);
    return row;
  }

  function createNeighbours(ranks) {
    var block = document.createElement('div');
    block.className = 'league-neighbours';

    var title = document.createElement('p');
    title.className = 'league-neighbours__title';
    title.textContent = 'Your position';
    block.appendChild(title);

    ranks.forEach(function (rank) { block.appendChild(createMember(rank)); });

    var index = ranks.indexOf(YOUR_RANK);
    var above = index > 0 ? ranks[index - 1] : null;
    var hint = document.createElement('p');
    hint.className = 'league-neighbours__hint';
    hint.textContent = BOARD.chaseHint(
      { rank: YOUR_RANK, score: participantAt(YOUR_RANK).score },
      above ? {
        rank: above,
        score: participantAt(above).score,
        name: participantAt(above).name
      } : null,
      'coins'
    );
    block.appendChild(hint);
    return block;
  }

  function renderFull() {
    /* Everyone, in order. A league is small enough that there is nothing to
       gain by folding the middle of it away — that trick belongs to the
       global board and to a tournament, where the middle is thousands long. */
    var shape = BOARD.plan(PARTICIPANT_COUNT, joined ? YOUR_RANK : null, PARTICIPANT_COUNT);
    var fragment = document.createDocumentFragment();

    shape.lead.forEach(function (rank) {
      // without membership your seat belongs to whoever is next in line
      if (!joined && rank === YOUR_RANK) return;
      fragment.appendChild(createMember(rank));
    });
    if (shape.neighbours.length) {
      fragment.appendChild(createNeighbours(shape.neighbours));
    }
    fullBlock.replaceChildren(fragment);
  }

  if (topBlock && fullBlock) {
    renderFull();
    document.addEventListener('the90:league-membership', function (event) {
      joined = event.detail.joined;
      renderFull();
    });

    // Keep the pinned card in sync with the score it has inside the full list.
    if (yourScoreCell) {
      yourScoreCell.textContent = formatScore(participantAt(YOUR_RANK).score) + ' ';
      var pinnedCoin = document.createElement('img');
      pinnedCoin.src = 'assets/league/coin.svg';
      pinnedCoin.alt = 'Coins';
      yourScoreCell.appendChild(pinnedCoin);
    }

    /* The board opens open: a league is small enough that the whole thing is
       the interesting part, and hiding it behind a control only asks a
       question everybody answers the same way. */
    topBlock.hidden = true;
    fullBlock.hidden = false;
    if (sectionTitle) sectionTitle.textContent = 'Leaderboard';


    /* ---------------------------------------------------------
       Your own seat, the way the global board does it: held at
       the foot of the screen while the real row is further down,
       and given up the moment the board scrolls far enough to
       show it in its own place.
       --------------------------------------------------------- */

    var pin = document.querySelector('[data-league-pin]');
    var pinRank = document.querySelector('[data-league-pin-rank]');
    var pinScore = document.querySelector('[data-league-pin-score]');
    var queued = false;

    function yourRow() {
      return fullBlock.querySelector('.league-member--you') ||
        document.querySelector('[data-league-panel="participants"] .league-member--you');
    }

    function fillPin() {
      var row = yourRow();
      if (!row || !pin) return;
      var rank = row.querySelector('.league-member__rank');
      var score = row.querySelector('.league-member__score');
      if (rank && pinRank) pinRank.textContent = rank.textContent;
      if (score && pinScore) pinScore.innerHTML = score.innerHTML;
    }

    function updatePin() {
      queued = false;
      if (!pin || !leagueScroll) return;
      var screen = document.querySelector('[data-screen="league"]');
      var row = yourRow();
      var onPicks = document.querySelector('[data-league-panel="participants"]');
      var showing = screen && screen.classList.contains('is-active') && row &&
        onPicks && onPicks.getAttribute('aria-hidden') !== 'true';
      if (!showing) { pin.hidden = true; return; }

      var frame = leagueScroll.getBoundingClientRect();
      var rect = row.getBoundingClientRect();
      // hidden once the real row has come up past where the plate sits
      pin.hidden = rect.top < frame.bottom - 132;
    }

    function schedulePin() {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(updatePin);
    }

    if (leagueScroll) leagueScroll.addEventListener('scroll', schedulePin, { passive: true });
    document.addEventListener('click', function (event) {
      if (event.target.closest('[data-league-tab]')) window.setTimeout(schedulePin, 60);
    });

    window.addEventListener('the90:screen', function (event) {
      if (event.detail !== 'league') { if (pin) pin.hidden = true; return; }
      fillPin();
      window.setTimeout(schedulePin, 80);
    });

    fillPin();
    schedulePin();
  }


  window.addEventListener('resize', updateComposer);
  window.addEventListener('the90:screen', function (event) {
    if (event.detail !== 'league-chat') return;
    updateComposer();
    scrollToBottom();
    seen();
  });


  /* =======================================================
     What the league page says about the chat

     The Chat button carries whatever has arrived since you
     last looked in. Looking in is what clears it.
     ======================================================= */

  var UNREAD_KEY = 'the90.leagueUnread.v1';
  var unreadDot = document.querySelector('[data-chat-unread]');

  function unreadCount() {
    try {
      var saved = localStorage.getItem(UNREAD_KEY);
      if (saved !== null) return Math.max(0, Number(saved) || 0);
    } catch (error) { /* storage may be unavailable */ }
    // the room has been busy while you were away
    return 3;
  }

  function paintUnread() {
    if (!unreadDot) return;
    var count = unreadCount();
    unreadDot.textContent = count > 9 ? '9+' : String(count);
    unreadDot.hidden = count < 1;
  }

  function seen() {
    try { localStorage.setItem(UNREAD_KEY, '0'); } catch (error) { /* storage may be unavailable */ }
    paintUnread();
  }

  paintUnread();


  /* =======================================================
     The long version of what this league is
     ======================================================= */

  var moreButton = document.querySelector('[data-league-showmore]');
  var moreCopy = document.querySelector('[data-league-more]');

  if (moreButton && moreCopy) {
    moreButton.addEventListener('click', function () {
      var open = moreCopy.hidden;
      moreCopy.hidden = !open;
      moreButton.textContent = open ? 'Show less' : 'Show more';
      moreButton.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }
})();
