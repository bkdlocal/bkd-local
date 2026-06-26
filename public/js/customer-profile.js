(function () {
  const avatar = document.getElementById('avatar');
  const input = document.getElementById('avatarInput');
  if (avatar && input) {
    avatar.addEventListener('click', () => input.click());
    input.addEventListener('change', async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      const fd = new FormData();
      fd.append('photo', file);
      avatar.classList.add('uploading');
      try {
        const r = await fetch('/api/customer/profile/photo', { method: 'POST', body: fd });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || 'Upload failed.');
        let img = avatar.querySelector('img');
        if (!img) { img = document.createElement('img'); img.alt = 'Your photo'; avatar.insertBefore(img, avatar.firstChild); const ph = avatar.querySelector('.avatar-placeholder'); if (ph) ph.remove(); }
        img.src = j.url + (j.url.indexOf('?') >= 0 ? '&' : '?') + 't=' + Date.now();
      } catch (e) { alert(e.message); }
      finally { avatar.classList.remove('uploading'); input.value = ''; }
    });
  }

  document.querySelectorAll('.tag-chip input').forEach(cb => {
    cb.addEventListener('change', () => cb.closest('.tag-chip').classList.toggle('on', cb.checked));
  });

  const form = document.getElementById('profileForm');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('saveProfile');
      const state = document.getElementById('saveState');
      const occasionTags = Array.from(document.querySelectorAll('.tag-chip input:checked')).map(c => c.value);
      const body = {
        firstName: val('firstName'), lastName: val('lastName'), city: val('city'),
        state: val('state'), zipCode: val('zip'), occasionTags
      };
      btn.disabled = true; state.hidden = true;
      try {
        const r = await fetch('/api/customer/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || 'Could not save.');
        state.textContent = 'Saved'; state.hidden = false;
        setTimeout(() => { state.hidden = true; }, 2000);
      } catch (e) { alert(e.message); }
      finally { btn.disabled = false; }
    });
  }
  function val(id) { const el = document.getElementById(id); return el ? el.value.trim() : ''; }
})();
