/* =========================================================
   THE90 — in-app notifications
   ========================================================= */

(function () {
  'use strict';

  var list = document.querySelector('[data-notification-list]');
  if (!list) return;

  var badges = Array.prototype.slice.call(document.querySelectorAll('[data-notification-badge]'));
  var buttons = Array.prototype.slice.call(document.querySelectorAll('[data-notification-button]'));
  var STORAGE_KEY = 'the90.notifications.v1';
  var currentScreenNode = document.querySelector('[data-screen].is-active');
  var currentScreen = currentScreenNode ? currentScreenNode.dataset.screen : 'welcome';

  var initialNotifications = [
    { id: 'initial-1', type: 'achievement', title: 'Achievement unlocked', message: 'You earned the Gold Champion badge!', timeLabel: '2 min ago', unread: true },
    { id: 'initial-2', type: 'achievement', title: 'Match result', message: 'Your team won the Arena battle! +150 coins', timeLabel: '15 min ago', unread: true },
    { id: 'initial-3', type: 'info', title: 'System update', message: 'New season starts tomorrow. Get ready!', timeLabel: '5 hours ago', unread: true },
    { id: 'initial-4', type: 'ranking', title: 'Ranking change', message: 'You moved up to #42 in Global Rankings', timeLabel: 'Yesterday', unread: false },
    { id: 'initial-5', type: 'achievement', title: 'Match result', message: 'Your team won the Arena battle! +150 coins', timeLabel: '1 day ago', unread: false },
    { id: 'initial-6', type: 'info', title: 'System update', message: 'New season starts tomorrow. Get ready!', timeLabel: '5 hours ago', unread: false },
    { id: 'initial-7', type: 'achievement', title: 'Achievement unlocked', message: 'You earned the Gold Champion badge!', timeLabel: '2 days ago', unread: false },
    { id: 'initial-8', type: 'info', title: 'System update', message: 'A new prediction round is ready to play.', timeLabel: '3 days ago', unread: false }
  ];

  var incomingTemplates = [
    { type: 'achievement', title: 'Pick completed', message: 'Your Arsenal – Chelsea prediction was correct! +80 points' },
    { type: 'ranking', title: 'Ranking change', message: 'You moved up to #38 in Global Rankings' },
    { type: 'info', title: 'New challenge', message: 'The Weekend Prediction Challenge is now live.' },
    { type: 'achievement', title: 'Match result', message: 'Your team won the Arena battle! +150 coins' },
    { type: 'info', title: 'Daily picks ready', message: 'Fresh matches are waiting for your predictions.' }
  ];

  function cloneInitial() {
    return initialNotifications.map(function (item) { return Object.assign({}, item); });
  }

  function loadNotifications() {
    try {
      var saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (Array.isArray(saved) && saved.length) return saved;
    } catch (error) { /* storage may be unavailable */ }
    return cloneInitial();
  }

  var notifications = loadNotifications();

  function saveNotifications() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications)); } catch (error) { /* storage may be unavailable */ }
  }

  function formatTime(item) {
    if (!item.createdAt) return item.timeLabel || '';
    var elapsed = Math.max(0, Date.now() - item.createdAt);
    var minutes = Math.floor(elapsed / 60000);
    if (minutes < 1) return 'Now';
    if (minutes < 60) return minutes + ' min ago';
    var hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + (hours === 1 ? ' hour ago' : ' hours ago');
    var days = Math.floor(hours / 24);
    return days + (days === 1 ? ' day ago' : ' days ago');
  }

  function createVisual(type) {
    var visual = document.createElement('span');
    visual.className = 'notification-card__visual notification-card__visual--' + type;

    var image = document.createElement('img');
    image.alt = '';

    if (type === 'achievement') {
      image.src = 'assets/notifications/achievement.png';
      visual.appendChild(image);

      var crown = document.createElement('img');
      crown.className = 'notification-card__crown';
      crown.src = 'assets/notifications/crown.svg';
      crown.alt = '';
      visual.appendChild(crown);
    } else {
      image.src = type === 'ranking' ? 'assets/notifications/arrow-up.svg' : 'assets/notifications/info.svg';
      visual.appendChild(image);
    }

    return visual;
  }

  function createCard(item, animate) {
    var card = document.createElement('article');
    card.className = 'notification-card' + (animate ? ' is-new' : '');
    card.dataset.notificationId = item.id;
    card.appendChild(createVisual(item.type));

    var content = document.createElement('div');
    content.className = 'notification-card__content';
    var title = document.createElement('strong');
    title.textContent = item.title;
    var message = document.createElement('p');
    message.textContent = item.message;
    content.appendChild(title);
    content.appendChild(message);
    card.appendChild(content);

    var meta = document.createElement('span');
    meta.className = 'notification-card__meta';
    if (item.unread) {
      var unread = document.createElement('i');
      unread.className = 'notification-card__unread';
      unread.setAttribute('aria-label', 'Unread');
      meta.appendChild(unread);
    }
    var time = document.createElement('time');
    time.textContent = formatTime(item);
    meta.appendChild(time);
    card.appendChild(meta);

    return card;
  }

  function renderList(animatedId) {
    var fragment = document.createDocumentFragment();
    notifications.forEach(function (item) {
      fragment.appendChild(createCard(item, item.id === animatedId));
    });
    list.replaceChildren(fragment);
  }

  function unreadCount() {
    return notifications.filter(function (item) { return item.unread; }).length;
  }

  function renderBadges(animate) {
    var count = unreadCount();
    badges.forEach(function (badge) {
      badge.hidden = count === 0;
      badge.textContent = String(Math.min(count, 9));
      badge.classList.remove('is-updated');
      if (animate && count) {
        void badge.offsetWidth;
        badge.classList.add('is-updated');
      }
    });
    buttons.forEach(function (button) {
      button.setAttribute('aria-label', count ? 'Notifications, ' + count + ' unread' : 'Notifications');
    });
  }

  function markAllRead() {
    if (!unreadCount()) return;
    notifications.forEach(function (item) { item.unread = false; });
    saveNotifications();
    renderList();
    renderBadges(false);
  }

  var incomingIndex = 0;
  function addIncomingNotification() {
    var template = incomingTemplates[incomingIndex % incomingTemplates.length];
    incomingIndex += 1;
    var item = {
      id: 'incoming-' + Date.now(),
      type: template.type,
      title: template.title,
      message: template.message,
      createdAt: Date.now(),
      unread: true
    };

    notifications.unshift(item);
    notifications = notifications.slice(0, 20);
    saveNotifications();
    renderList(item.id);
    renderBadges(true);
  }

  function isAppScreen(name) {
    return name === 'main' || name === 'rankings' || name === 'arena' || name === 'my-zone' || name === 'notifications' ||
      name === 'invite-friends' || name === 'support' || name === 'support-contact' ||
      name === 'support-requests' || name === 'support-chat' ||
      name.indexOf('settings') === 0;
  }

  var notificationTimer;
  function scheduleIncoming() {
    clearTimeout(notificationTimer);
    var delay = 14000 + Math.floor(Math.random() * 9000);
    notificationTimer = setTimeout(function () {
      if (!document.hidden && isAppScreen(currentScreen)) addIncomingNotification();
      scheduleIncoming();
    }, delay);
  }

  window.addEventListener('the90:screen', function (event) {
    var nextScreen = event.detail;
    if (currentScreen === 'notifications' && nextScreen !== 'notifications') markAllRead();
    currentScreen = nextScreen;
  });

  renderList();
  renderBadges(false);
  scheduleIncoming();
})();
