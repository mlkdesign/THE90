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
  var invite = document.querySelector('[data-league-invite]');
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

  if (join) {
    join.addEventListener('click', function () {
      join.textContent = join.dataset.joined ? 'Participace league' : 'You are participating';
      join.dataset.joined = join.dataset.joined ? '' : 'true';
    });
  }

  if (invite) {
    invite.addEventListener('click', function () {
      var shareData = { title: 'DIAMOND CUP', text: 'Join my DIAMOND CUP league on THE90.' };
      if (navigator.share) navigator.share(shareData).catch(function () { /* share sheet dismissed */ });
      else invite.textContent = 'Invite link copied';
    });
  }

  window.addEventListener('resize', updateComposer);
  window.addEventListener('the90:screen', function (event) {
    if (event.detail !== 'league-chat') return;
    updateComposer();
    scrollToBottom();
  });
})();
