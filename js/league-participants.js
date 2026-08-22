/* =========================================================
   THE90 — the league roster

   Opened from the Participants figure on the league page.
   Everyone in the league, with the address the invite went to
   and a way to take them back out again.
   ========================================================= */

(function () {
  'use strict';

  var T = window.THE90;
  var list = document.querySelector('[data-participants-list]');
  if (!list) return;

  var PEOPLE = [
    ['Zara Volkov', 'zara.volkov@gmail.com', 'assets/invite/avatar-zara.png'],
    ['Kai Tanaka', 'kai.tanaka@gmail.com', 'assets/invite/avatar-kai.png'],
    ['Nina Okafor', 'n.okafor@outlook.com', 'assets/support/banner-person.png'],
    ['Sam Moreau', 'sam.moreau@gmail.com', 'assets/invite/profile-person.png'],
    ['Juno Park', 'juno.park@icloud.com', 'assets/invite/screen-person.png'],
    ['Ravi Patel', 'ravi.patel@gmail.com', 'assets/invite/avatar-zara.png'],
    ['Liam Becker', 'l.becker@outlook.com', 'assets/invite/avatar-kai.png'],
    ['Mia Bennett', 'mia.bennett@gmail.com', 'assets/support/banner-person.png'],
    ['Ethan Bennett', 'ethan.b@icloud.com', 'assets/invite/profile-person.png'],
    ['Sofia Bennett', 'sofia.bennett@gmail.com', 'assets/invite/screen-person.png']
  ];

  function row(person) {
    var item = document.createElement('article');
    item.className = 'participant';

    var avatar = document.createElement('img');
    avatar.className = 'participant__avatar';
    avatar.src = person[2];
    avatar.alt = '';

    var copy = document.createElement('span');
    copy.className = 'participant__copy';
    var name = document.createElement('strong');
    name.textContent = person[0];
    var mail = document.createElement('small');
    mail.textContent = person[1];
    copy.appendChild(name);
    copy.appendChild(mail);

    var remove = document.createElement('button');
    remove.className = 'participant__delete';
    remove.type = 'button';
    remove.textContent = 'Delete';
    remove.setAttribute('aria-label', 'Remove ' + person[0] + ' from the league');
    remove.addEventListener('click', function () {
      // taking someone out of a league is not a thing to do by accident
      var drop = function () { item.remove(); };
      if (T && T.confirm) {
        T.confirm('Remove ' + person[0] + '?',
          'They lose their place on the board and access to the chat. You can invite them back.',
          'Remove', drop);
      } else {
        drop();
      }
    });

    item.appendChild(avatar);
    item.appendChild(copy);
    item.appendChild(remove);
    return item;
  }

  var fragment = document.createDocumentFragment();
  PEOPLE.forEach(function (person) { fragment.appendChild(row(person)); });
  list.replaceChildren(fragment);
})();
