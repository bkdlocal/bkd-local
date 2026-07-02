(function () {
  var params = new URLSearchParams(window.location.search);

  // ---- Logged-in customers: toggle the favorite directly (optimistic) --------
  async function toggle(btn) {
    if (btn.dataset.busy === '1') return;
    var bakerId = btn.dataset.bakerId;
    if (!bakerId) return;
    var wasFav = btn.getAttribute('aria-pressed') === 'true';
    var nowFav = !wasFav;

    btn.dataset.busy = '1';
    setState(btn, nowFav); // optimistic

    try {
      var res;
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

  // ---- Guests: route into signup/login framed around saving this baker -------
  function guestIntent(btn) {
    var bakerId = btn.dataset.bakerId;
    if (!bakerId) return;
    var bakerName = btn.dataset.bakerName || 'this baker';
    // On this baker's own profile the signup modal is present: open it reframed.
    var modal = document.getElementById('bakerSignupModal');
    if (modal && modal.getAttribute('data-baker-id') === bakerId) {
      document.dispatchEvent(new CustomEvent('bkd:fav-signup', { detail: { bakerId: bakerId, bakerName: bakerName } }));
      return;
    }
    // From a card elsewhere: carry the intent to that baker's profile.
    window.location = '/bakers/' + encodeURIComponent(bakerId) + '?fav=1';
  }

  // ---- Single completion path after auth: /bakers/<id>?fav=1 -----------------
  async function completePending() {
    if (params.get('fav') !== '1') return;
    var loggedInHeart = document.querySelector('[data-fav-toggle][data-baker-id]');
    if (loggedInHeart) {
      // Authenticated now: save the baker they intended, then reflect it.
      try {
        var res = await fetch('/api/customer/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bakerId: loggedInHeart.dataset.bakerId })
        });
        if (res.ok) setState(loggedInHeart, true);
      } catch (e) {}
      stripFavParam();
      return;
    }
    // Still a guest (arrived from a card link): open the reframed signup modal.
    var guestHeart = document.querySelector('[data-fav-guest][data-baker-id]');
    var modal = document.getElementById('bakerSignupModal');
    if (guestHeart && modal && modal.getAttribute('data-baker-id') === guestHeart.dataset.bakerId) {
      document.dispatchEvent(new CustomEvent('bkd:fav-signup', {
        detail: { bakerId: guestHeart.dataset.bakerId, bakerName: guestHeart.dataset.bakerName || 'this baker' }
      }));
    }
  }

  function stripFavParam() {
    params.delete('fav');
    var qs = params.toString();
    window.history.replaceState({}, '', window.location.pathname + (qs ? '?' + qs : '') + window.location.hash);
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

  function handle(target) {
    var toggleBtn = target.closest('[data-fav-toggle]');
    if (toggleBtn) { toggle(toggleBtn); return true; }
    var guestBtn = target.closest('[data-fav-guest]');
    if (guestBtn) { guestIntent(guestBtn); return true; }
    return false;
  }

  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-fav-toggle], [data-fav-guest]');
    if (!el) return;
    e.preventDefault();
    e.stopPropagation();
    handle(e.target);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
    var el = e.target.closest('[data-fav-toggle], [data-fav-guest]');
    if (!el) return;
    e.preventDefault();
    e.stopPropagation();
    handle(e.target);
  });

  completePending();
})();
