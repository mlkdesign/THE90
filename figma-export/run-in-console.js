/* Paste this into the prototype's DevTools console (http://localhost:4173)
   to re-capture every screen and state after the prototype changes.
   Keep the tab in the foreground while it runs. */
(async () => {
  for (const f of ['extract.js', 'drive.js']) {
    (0, eval)(await (await fetch('/figma-export/' + f + '?t=' + Date.now())).text());
  }
  const D = window.THE90_DRIVE;
  D.lock();
  D.reset();
  await D.tokens();

  const screens = D.screens();
  for (let i = 0; i < screens.length; i++) {
    const r = await D.capture(screens[i]);
    console.log(`${i + 1}/${screens.length}`, r.ok ? r.label : r);
  }
  for (const st of D.states) {
    const r = await D.capture(st.screen, st);
    console.log('state', r.ok ? r.label : r);
  }

  console.log('done', await D.finish());
  console.log('now run:  node figma-export/build.mjs');
})();
