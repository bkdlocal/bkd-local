(function () {
  // Heart toggle for favorite bakers. Optimistic UI, then persist to the server;
  // revert on failure. Works on baker cards (inside an anchor) and standalone.
  async function toggle(btn) {
    if (btn.dataset.busy === '1') return;
    const bakerId = btn.dataset.bakerId;
    if (!bakerId) return;
    const wasFav = btn.getAttribute('aria-pressed') === 'true';
    const nowFav = !wasFav;

    // Optimistic update.
    btn.dataset.busy = '1';
    setState(btn, nowFav);

    try {
      let res;
      if (nowFav) {
        res = await fetch('/api/customer/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bakerId: bakerId })
        });
      } else {
        res = await fetch('/api/customer/favorites/' + encodeURIComponent(bakerId), { method: 'DELETE' });
      }
      if (!res.ok) throw new Error('request failed');

      // On the Favorites list, removing a baker drops its card.
      if (!nowFav) {
        var list = btn.closest('[data-fav-list]');
        if (list) {
          var card = btn.closest('.baker-card');
          if (card) card.remove();
          showEmptyIfNeeded(list);
        }
      }
    } catch (e) {
      setState(btn, wasFav); // revert
      alert('Could not update your favorites. Please try again.');
    } finally {
      btn.dataset.busy = '';
    }
  }

  function setState(btn, fav) {
    btn.setAttribute('aria-pressed', fav ? 'true' : 'false');
    var label = fav ? 'Remove from favorites' : 'Save to favorites';
    btn.setAttribute('aria-label', label);
    btn.setAttribute('title', label);
  }

  function showEmptyIfNeeded(list) {
    if (list.querySelector('.baker-card')) return;
    var grid = list.querySelector('.baker-grid');
    if (grid) grid.remove();
    if (!list.querySelector('[data-fav-empty]')) {
      var p = document.createElement('p');
      p.className = 'muted';
      p.setAttribute('data-fav-empty', '');
      p.innerHTML = 'You have not favorited any bakers yet. Tap the heart on any baker to save them here. <a href="/bakers">Browse bakers</a>.';
      list.appendChild(p);
    }
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-fav-toggle]');
    if (!btn) return;
    // Do not follow the card's link or bubble to it.
    e.preventDefault();
    e.stopPropagation();
    toggle(btn);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
    var btn = e.target.closest('[data-fav-toggle]');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    toggle(btn);
  });
})();
