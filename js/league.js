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

  var STORAGE_KEY = 'the90.leagueChat.v1';
  var LINE_HEIGHT = 20;
  var MAX_LINES = 5;
  var replyPending = false;
  var initialMessages = [
    { role: 'agent', author: 'Alex Rivera', avatar: 'assets/league/chat-alex.png', text: "Hey everyone! Who's coming to the meetup on Saturday? We've got a great topic lined up 🎉", time: '3:10 PM' },
    { role: 'user', text: "I'll be there! Is it still at the usual café? I can bring some snacks if needed.", time: '3:12 PM' },
    { role: 'agent', author: 'Alex Rivera', avatar: 'assets/league/chat-alex.png', text: "Yep, same place! Doors open at 2 PM. We're doing a book swap this time.", time: '3:15 PM' },
    { role: 'agent', author: 'Alex Rivera', avatar: 'assets/league/chat-alex.png', text: "Bring any books you've finished — fiction, non-fiction, anything goes!", time: '3:15 PM' },
    { role: 'agent', author: 'Leo Hart', avatar: 'assets/league/chat-leo.png', text: "Oh nice, I love book swaps! I've got a couple of novels I've been meaning to pass along.", time: '3:18 PM' },
    { role: 'user', text: "Count me in! I'll bring that sci-fi collection I mentioned last week. Should be a fun afternoon.", time: '3:22 PM' },
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

  function createMessage(message) {
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
    var time = document.createElement('time');
    time.textContent = message.time;
    bubble.appendChild(text);
    bubble.appendChild(time);
    content.appendChild(bubble);
    row.appendChild(content);
    return row;
  }

  function renderMessages() {
    var fragment = document.createDocumentFragment();
    messages.forEach(function (message) { fragment.appendChild(createMessage(message)); });
    list.replaceChildren(fragment);
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
      scroll.style.bottom = footer.offsetHeight + 'px';
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

  var allButton = document.querySelector('[data-league-all]');
  var allLabel = document.querySelector('[data-league-all-label]');
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
    row.className = 'league-member' + (person.isYou ? ' league-member--you' : '');

    var position = document.createElement('span');
    position.className = 'league-member__rank';
    position.textContent = rank;

    var avatar = document.createElement('img');
    avatar.src = person.avatar;
    avatar.alt = person.name;

    var copy = document.createElement('span');
    copy.className = 'league-member__copy';
    var name = document.createElement('strong');
    name.textContent = person.name;
    var handle = document.createElement('small');
    handle.textContent = person.handle;
    copy.appendChild(name);
    copy.appendChild(handle);

    var score = document.createElement('span');
    score.className = 'league-member__score';
    score.textContent = formatScore(person.score) + ' ';
    var coin = document.createElement('img');
    coin.src = 'assets/league/coin.svg';
    coin.alt = 'Coins';
    score.appendChild(coin);

    row.appendChild(position);
    row.appendChild(avatar);
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
    // Same shape as the global board: the leading 20, then wherever you are.
    var shape = BOARD.plan(PARTICIPANT_COUNT, joined ? YOUR_RANK : null);
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

  if (allButton && topBlock && fullBlock) {
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

    var expanded = false;
    function setExpanded(value) {
      expanded = value;
      topBlock.hidden = expanded;
      fullBlock.hidden = !expanded;
      allButton.setAttribute('aria-expanded', String(expanded));
      if (allLabel) allLabel.textContent = expanded ? 'Hide participants' : 'All participants';
      if (sectionTitle) sectionTitle.textContent = expanded ? 'All Participants' : 'Top Participants';
    }

    allButton.addEventListener('click', function () {
      setExpanded(!expanded);
      if (!expanded && leagueScroll) {
        allButton.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    });

    // The league always opens on the short list, however it was left last time.
    window.addEventListener('the90:screen', function (event) {
      if (event.detail !== 'league' || !expanded) return;
      setExpanded(false);
      if (leagueScroll) leagueScroll.scrollTop = 0;
    });
  }

  window.addEventListener('resize', updateComposer);
  window.addEventListener('the90:screen', function (event) {
    if (event.detail !== 'league-chat') return;
    updateComposer();
    scrollToBottom();
  });
})();
