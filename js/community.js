/* =========================================================
   THE90 — Invite Friends and Support interactions
   ========================================================= */

(function () {
  'use strict';

  var inviteBack = document.querySelector('[data-invite-back]');
  var inviteLink = document.querySelector('[data-invite-link]');
  var copyInvite = document.querySelector('[data-copy-invite]');
  var shareInvite = document.querySelector('[data-share-invite]');
  var INVITE_RETURN_KEY = 'the90.inviteReturn';

  function savedInviteReturn() {
    try { return localStorage.getItem(INVITE_RETURN_KEY) || 'settings'; } catch (error) { return 'settings'; }
  }

  function setInviteReturn(name) {
    if (inviteBack) inviteBack.dataset.go = name;
    try { localStorage.setItem(INVITE_RETURN_KEY, name); } catch (error) { /* storage may be unavailable */ }
  }

  setInviteReturn(savedInviteReturn());

  document.addEventListener('click', function (event) {
    var trigger = event.target.closest('[data-invite-origin]');
    if (trigger) setInviteReturn(trigger.dataset.inviteOrigin);
  }, true);

  function fallbackCopy() {
    if (!inviteLink) return false;
    inviteLink.focus();
    inviteLink.select();
    try { return document.execCommand('copy'); } catch (error) { return false; }
  }

  function copyLink() {
    var value = inviteLink ? inviteLink.value : 'the90.app/invite/user123';
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(value).catch(function () { fallbackCopy(); });
    }
    fallbackCopy();
    return Promise.resolve();
  }

  function temporaryLabel(button, label) {
    if (!button) return;
    var text = button.querySelector('span') || button;
    var previous = text.textContent;
    text.textContent = label;
    setTimeout(function () { text.textContent = previous; }, 1400);
  }

  if (copyInvite) {
    copyInvite.addEventListener('click', function () {
      copyLink().then(function () { temporaryLabel(copyInvite, 'Copied'); });
    });
  }

  if (shareInvite) {
    shareInvite.addEventListener('click', function () {
      var profileUrl = 'https://the90.app/profile/yournickname';
      var shareData = {
        title: 'Your Name on THE90',
        text: 'Check out @yournickname on THE90.',
        url: profileUrl
      };
      if (navigator.share) {
        navigator.share(shareData).catch(function () { /* share sheet dismissed */ });
      } else if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(profileUrl).then(function () {
          temporaryLabel(shareInvite, 'Profile link copied');
        }).catch(function () { /* clipboard may be unavailable */ });
      } else {
        temporaryLabel(shareInvite, 'Share unavailable');
      }
    });
  }

  Array.prototype.slice.call(document.querySelectorAll('[data-faq]')).forEach(function (item) {
    item.addEventListener('click', function () {
      var opening = !item.classList.contains('is-open');
      Array.prototype.slice.call(document.querySelectorAll('[data-faq]')).forEach(function (other) {
        other.classList.toggle('is-open', other === item && opening);
        other.setAttribute('aria-expanded', String(other === item && opening));
      });
    });
    item.setAttribute('aria-expanded', 'false');
  });

  var supportForm = document.querySelector('[data-support-form]');
  var descriptionInput = document.querySelector('[data-support-description]');
  var supportFile = document.querySelector('[data-support-file]');
  var supportFileLabel = document.querySelector('[data-support-file-label]');
  var supportFormError = document.querySelector('[data-support-form-error]');
  var requestList = document.querySelector('[data-support-request-list]');
  var activeCount = document.querySelector('[data-support-active-count]');
  var viewRequestsButton = document.querySelector('[data-support-view-requests]');
  var topicTabs = Array.prototype.slice.call(document.querySelectorAll('[data-support-topic-tab]'));
  var requestFilters = Array.prototype.slice.call(document.querySelectorAll('[data-support-filter]'));
  var selectedTopic = '';
  var REQUESTS_STORAGE_KEY = 'the90.supportRequests.v1';
  var ACTIVE_REQUEST_KEY = 'the90.activeSupportRequest';

  var defaultRequests = [
    {
      id: 'technical-login', topic: 'Technical', title: 'Technical Issue',
      description: "Can't log into account...",
      fullDescription: "Hi Alex! I'm having trouble with my account login. It keeps saying my password is incorrect even though I know it's right.",
      date: 'Jul 6', meta: "We'll respond within 2 hours", status: 'open'
    },
    {
      id: 'pick-not-counted', topic: 'Pick Issue', title: 'Pick Issue',
      description: 'Pick not counted...', fullDescription: 'My pick was not counted after the match finished.',
      date: 'Jul 3', meta: 'Reply received', status: 'answered'
    },
    {
      id: 'coins-not-credited', topic: 'Coins', title: 'Coins and Balance',
      description: 'Coins not credited...', fullDescription: 'The coins from my latest correct pick were not credited.',
      date: 'Jun 28', meta: 'Closed', status: 'closed'
    }
  ];

  function cloneRequests(source) {
    return source.map(function (request) { return Object.assign({}, request); });
  }

  function loadRequests() {
    try {
      var saved = JSON.parse(localStorage.getItem(REQUESTS_STORAGE_KEY));
      if (Array.isArray(saved) && saved.length) return saved;
    } catch (error) { /* storage may be unavailable */ }
    return cloneRequests(defaultRequests);
  }

  var requests = loadRequests();
  var activeFilter = 'All';

  function saveRequests() {
    try { localStorage.setItem(REQUESTS_STORAGE_KEY, JSON.stringify(requests)); } catch (error) { /* storage may be unavailable */ }
  }

  function setActiveRequest(id) {
    try { localStorage.setItem(ACTIVE_REQUEST_KEY, id); } catch (error) { /* storage may be unavailable */ }
  }

  function savedActiveRequest() {
    try { return localStorage.getItem(ACTIVE_REQUEST_KEY); } catch (error) { return null; }
  }

  function getActiveRequest() {
    var savedId = savedActiveRequest();
    return requests.find(function (request) { return request.id === savedId; }) || requests[0];
  }

  function requestTitle(topic) {
    if (topic === 'Technical') return 'Technical Issue';
    if (topic === 'Coins') return 'Coins and Balance';
    if (topic === 'Other') return 'Other Request';
    return topic || 'Support Request';
  }

  function requestSummary(text) {
    var normalized = String(text || '').replace(/\s+/g, ' ').trim();
    return normalized.length > 34 ? normalized.slice(0, 34).trim() + '...' : normalized;
  }

  function requestDate() {
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date());
  }

  function statusLabel(status) {
    if (status === 'answered') return 'Answered';
    if (status === 'closed') return 'Closed';
    return 'Open';
  }

  function createRequestCard(request) {
    var card = document.createElement('button');
    card.className = 'support-request-card';
    card.type = 'button';
    card.dataset.go = 'support-chat';
    card.dataset.supportRequest = request.id;

    var copy = document.createElement('span');
    copy.className = 'support-request-card__copy';
    var title = document.createElement('strong');
    title.textContent = request.title;
    var summary = document.createElement('span');
    summary.textContent = request.description;
    copy.appendChild(title);
    copy.appendChild(summary);

    var status = document.createElement('span');
    status.className = 'support-request-status support-request-status--' + request.status;
    status.textContent = statusLabel(request.status);

    var meta = document.createElement('small');
    meta.textContent = request.date + ' · ' + request.meta;

    card.appendChild(copy);
    card.appendChild(status);
    card.appendChild(meta);
    return card;
  }

  function renderActiveCount() {
    if (!activeCount) return;
    var count = requests.filter(function (request) { return request.status !== 'closed'; }).length;
    activeCount.textContent = count + ' active';
  }

  function renderRequests() {
    renderActiveCount();
    if (!requestList) return;
    var visible = requests.filter(function (request) {
      return activeFilter === 'All' || request.topic === activeFilter;
    });
    var fragment = document.createDocumentFragment();
    visible.forEach(function (request) { fragment.appendChild(createRequestCard(request)); });
    if (!visible.length) {
      var empty = document.createElement('p');
      empty.className = 'support-request-empty';
      empty.textContent = 'No requests in this category yet.';
      fragment.appendChild(empty);
    }
    requestList.replaceChildren(fragment);
  }

  function selectTopic(value) {
    selectedTopic = value;
    topicTabs.forEach(function (tab) {
      var active = tab.dataset.supportTopicTab === value;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-pressed', String(active));
    });
    var topicField = document.querySelector('[data-support-topic-field]');
    if (topicField && value) topicField.classList.remove('is-invalid');
  }

  topicTabs.forEach(function (tab) {
    tab.setAttribute('aria-pressed', 'false');
    tab.addEventListener('click', function () { selectTopic(tab.dataset.supportTopicTab); });
  });

  if (descriptionInput) {
    descriptionInput.addEventListener('input', function () {
      if (!descriptionInput.value.trim()) return;
      var field = document.querySelector('[data-support-description-field]');
      if (field) field.classList.remove('is-invalid');
    });
  }

  if (supportFile) {
    supportFile.addEventListener('change', function () {
      var file = supportFile.files && supportFile.files[0];
      if (supportFileLabel) supportFileLabel.textContent = file ? file.name : '+ Add File';
    });
  }

  function selectRequestFilter(value) {
    activeFilter = value;
    requestFilters.forEach(function (item) {
      var active = item.dataset.supportFilter === value;
      item.classList.toggle('is-active', active);
      item.setAttribute('aria-selected', String(active));
    });
    renderRequests();
  }

  requestFilters.forEach(function (filter) {
    filter.addEventListener('click', function () { selectRequestFilter(filter.dataset.supportFilter); });
  });

  if (supportForm) {
    supportForm.addEventListener('submit', function (event) {
      event.preventDefault();
      var topic = selectedTopic;
      var description = descriptionInput ? descriptionInput.value.trim() : '';
      var topicField = document.querySelector('[data-support-topic-field]');
      var descriptionField = document.querySelector('[data-support-description-field]');
      if (topicField) topicField.classList.toggle('is-invalid', !topic);
      if (descriptionField) descriptionField.classList.toggle('is-invalid', !description);
      if (!topic || !description) {
        if (supportFormError) supportFormError.hidden = false;
        return;
      }

      var request = {
        id: 'request-' + Date.now(),
        topic: topic,
        title: requestTitle(topic),
        description: requestSummary(description),
        fullDescription: description,
        date: requestDate(),
        meta: "We'll respond within 2 hours",
        status: 'open',
        createdTime: currentTime()
      };
      requests.unshift(request);
      requests = requests.slice(0, 20);
      saveRequests();
      setActiveRequest(request.id);
      selectRequestFilter('All');

      supportForm.reset();
      selectTopic('');
      if (supportFileLabel) supportFileLabel.textContent = '+ Add File';
      if (supportFormError) supportFormError.hidden = true;
      if (viewRequestsButton) viewRequestsButton.click();
    });
  }

  renderRequests();

  var chatList = document.querySelector('[data-chat-list]');
  var chatScroll = document.querySelector('[data-chat-scroll]');
  var chatForm = document.querySelector('[data-chat-form]');
  var chatInput = document.querySelector('[data-chat-input]');
  var chatSend = document.querySelector('[data-chat-send]');
  var LEGACY_CHAT_STORAGE_KEY = 'the90.supportChat.v1';
  var CHAT_STORAGE_PREFIX = 'the90.supportChat.v2.';

  if (!chatList || !chatScroll || !chatForm || !chatInput || !chatSend) return;

  var initialMessages = [
    { role: 'agent', text: "Hi there! I'm Alex from the support team. How can I help you today?", time: '10:24 AM' },
    { role: 'user', text: "Hi Alex! I'm having trouble with my account login. It keeps saying my password is incorrect even though I know it's right.", time: '10:26 AM' },
    { role: 'agent', text: 'Sorry to hear that. Have you tried resetting your password recently? Sometimes our security system flags repeated attempts.', time: '10:28 AM' },
    { role: 'user', text: "Yes, I just tried that. I received the email and entered the code, but it still won't let me in.", time: '10:30 AM' },
    { role: 'agent', text: "Okay, let me check on our end. Can you please tell me what device and browser you're using?", time: '10:32 AM' }
  ];

  function currentTime() {
    return new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }

  function initialMessagesFor(request) {
    if (!request || request.id === 'technical-login') {
      return initialMessages.map(function (message) { return Object.assign({}, message); });
    }
    if (request.id === 'pick-not-counted') {
      return [
        { role: 'user', text: request.fullDescription, time: '2:12 PM' },
        { role: 'agent', text: 'I checked the match result and corrected the pick. Your points are now visible in My Zone.', time: '2:19 PM' }
      ];
    }
    if (request.id === 'coins-not-credited') {
      return [
        { role: 'user', text: request.fullDescription, time: '11:08 AM' },
        { role: 'agent', text: 'The missing coins have been credited. This request is now closed.', time: '11:24 AM' }
      ];
    }
    return [
      { role: 'user', text: request.fullDescription, time: request.createdTime || currentTime() },
      { role: 'agent', text: "Thanks, your request has been received. I'm reviewing it now and will help you here.", time: currentTime() }
    ];
  }

  function loadMessages() {
    var request = getActiveRequest();
    if (request) setActiveRequest(request.id);
    try {
      var saved = JSON.parse(localStorage.getItem(CHAT_STORAGE_PREFIX + request.id));
      if (Array.isArray(saved) && saved.length) return saved;
      if (request.id === 'technical-login') {
        var legacy = JSON.parse(localStorage.getItem(LEGACY_CHAT_STORAGE_KEY));
        if (Array.isArray(legacy) && legacy.length) return legacy;
      }
    } catch (error) { /* storage may be unavailable */ }
    return initialMessagesFor(request);
  }

  var messages = loadMessages();
  var replyPending = false;
  var CHAT_LINE_HEIGHT = 18;
  var CHAT_MAX_LINES = 5;

  function updateChatComposer() {
    var hasText = Boolean(chatInput.value.trim());
    var keepAtBottom = chatScroll.scrollHeight - chatScroll.scrollTop - chatScroll.clientHeight < 40;
    chatSend.disabled = !hasText;

    chatInput.style.height = CHAT_LINE_HEIGHT + 'px';
    var fullHeight = chatInput.scrollHeight;
    var maxHeight = CHAT_LINE_HEIGHT * CHAT_MAX_LINES;
    chatInput.style.height = Math.min(fullHeight, maxHeight) + 'px';
    chatInput.style.overflowY = fullHeight > maxHeight ? 'auto' : 'hidden';

    if (!chatForm.hidden) {
      requestAnimationFrame(function () {
        chatScroll.style.bottom = chatForm.offsetHeight + 'px';
        if (keepAtBottom) chatScroll.scrollTop = chatScroll.scrollHeight;
      });
    }
  }

  function syncChatAvailability() {
    var request = getActiveRequest();
    var writable = !request || request.status === 'open';
    chatForm.hidden = !writable;
    chatScroll.classList.toggle('support-chat-scroll--read-only', !writable);
    if (writable) updateChatComposer();
    else chatScroll.style.bottom = '';
  }

  function saveMessages() {
    var request = getActiveRequest();
    if (!request) return;
    try { localStorage.setItem(CHAT_STORAGE_PREFIX + request.id, JSON.stringify(messages)); } catch (error) { /* storage may be unavailable */ }
  }

  function createMessage(message) {
    var row = document.createElement('div');
    row.className = 'support-message' + (message.role === 'user' ? ' support-message--user' : '');
    var bubble = document.createElement('div');
    bubble.className = 'support-message__bubble';
    var text = document.createElement('p');
    text.textContent = message.text;
    var time = document.createElement('time');
    time.textContent = message.time;
    bubble.appendChild(text);
    bubble.appendChild(time);
    row.appendChild(bubble);
    return row;
  }

  function createTyping() {
    var row = document.createElement('div');
    row.className = 'support-message support-message--typing';
    row.setAttribute('aria-label', 'Support agent is typing');
    var bubble = document.createElement('div');
    bubble.className = 'support-message__bubble';
    bubble.appendChild(document.createElement('i'));
    bubble.appendChild(document.createElement('i'));
    bubble.appendChild(document.createElement('i'));
    row.appendChild(bubble);
    return row;
  }

  function scrollChatToBottom() {
    requestAnimationFrame(function () { chatScroll.scrollTop = chatScroll.scrollHeight; });
  }

  function renderChat(showTyping) {
    var fragment = document.createDocumentFragment();
    messages.forEach(function (message) { fragment.appendChild(createMessage(message)); });
    if (showTyping) fragment.appendChild(createTyping());
    chatList.replaceChildren(fragment);
    scrollChatToBottom();
  }

  function replyFor(text) {
    var normalized = text.toLowerCase();
    if (normalized.indexOf('password') !== -1 || normalized.indexOf('login') !== -1) {
      return "Thanks. I can see the reset request. Please wait two minutes, then try signing in once more — I've refreshed your login session.";
    }
    if (normalized.indexOf('coin') !== -1 || normalized.indexOf('point') !== -1) {
      return "I'll check your latest rewards now. Coins can take a few minutes to appear after a result is confirmed.";
    }
    if (normalized.indexOf('pick') !== -1 || normalized.indexOf('match') !== -1) {
      return 'I can help with that pick. Send me the match name and I will check its result status.';
    }
    return "Thanks for the details. I'm checking this for you now — please give me a moment.";
  }

  document.addEventListener('click', function (event) {
    var card = event.target.closest('[data-support-request]');
    if (!card) return;
    setActiveRequest(card.dataset.supportRequest);
    messages = loadMessages();
    replyPending = false;
    chatInput.value = '';
    syncChatAvailability();
    renderChat(false);
  }, true);

  chatList.setAttribute('aria-live', 'polite');
  syncChatAvailability();
  renderChat(false);

  chatInput.addEventListener('input', updateChatComposer);
  chatInput.addEventListener('keydown', function (event) {
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    if (!chatSend.disabled) chatForm.requestSubmit();
  });
  window.addEventListener('resize', updateChatComposer);

  chatForm.addEventListener('submit', function (event) {
    event.preventDefault();
    var value = chatInput.value.trim();
    if (!value) return;

    messages.push({ role: 'user', text: value, time: currentTime() });
    messages = messages.slice(-30);
    saveMessages();
    chatInput.value = '';
    updateChatComposer();
    renderChat(true);

    if (replyPending) return;
    replyPending = true;
    setTimeout(function () {
      messages.push({ role: 'agent', text: replyFor(value), time: currentTime() });
      messages = messages.slice(-30);
      replyPending = false;
      saveMessages();
      renderChat(false);
    }, 1100);
  });
})();
