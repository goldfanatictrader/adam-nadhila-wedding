(() => {
  'use strict';

  const slug = document.body.dataset.slug;
  const preview = document.body.dataset.preview === 'true';
  const apiRoot = `/api/invitations/${encodeURIComponent(slug)}`;
  let responseVersion = 0;
  let wishPage = 1;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const gate = document.getElementById('gate');
  const main = document.getElementById('mainContent');
  const openButton = document.getElementById('openInvitation');
  const nav = document.getElementById('bottomNav');
  const musicButton = document.getElementById('musicToggle');
  const musicLabel = document.getElementById('musicLabel');
  const audio = document.getElementById('bgMusic');
  const welcomeTitle = document.getElementById('welcomeTitle');

  let musicIsPlaying = false;
  let lastGalleryTrigger = null;

  function personalizeGuest() {
    const params = new URLSearchParams(window.location.search);
    const guest = (params.get('to') || params.get('guest') || '').trim();
    const guestName = document.getElementById('guestName');

    if (guest && guestName) {
      guestName.textContent = guest.slice(0, 80);
    }
  }

  function updateMusicUI(isPlaying) {
    musicIsPlaying = isPlaying;
    if (!musicButton || !musicLabel) return;

    musicButton.setAttribute('aria-pressed', String(isPlaying));
    musicButton.setAttribute('aria-label', isPlaying ? 'Matikan musik' : 'Nyalakan musik');
    musicLabel.textContent = isPlaying ? 'Musik aktif' : 'Musik mati';
  }

  async function playMusic() {
    if (!audio) return;

    audio.volume = 0.55;
    try {
      await audio.play();
      updateMusicUI(true);
    } catch (error) {
      updateMusicUI(false);
    }
  }

  function pauseMusic() {
    if (audio) audio.pause();
    updateMusicUI(false);
  }

  function openInvitation() {
    if (!gate || !main || !openButton) return;

    openButton.disabled = true;
    main.inert = false;
    main.removeAttribute('inert');
    main.setAttribute('aria-hidden', 'false');
    document.body.classList.remove('locked');

    if (nav) {
      nav.hidden = false;
      window.requestAnimationFrame(() => nav.classList.add('is-visible'));
    }

    if (musicButton) musicButton.hidden = false;
    gate.classList.add('opened');
    playMusic();
    initializeGuestSession();
    loadWishes(true);

    const finishDelay = reduceMotion.matches ? 0 : 780;
    window.setTimeout(() => {
      gate.hidden = true;
      gate.setAttribute('aria-hidden', 'true');
      welcomeTitle?.focus({ preventScroll: true });
    }, finishDelay);
  }

  function initializeNavigation() {
    if (!nav) return;

    const links = [...nav.querySelectorAll("a[href^='#']")];
    const sections = links
      .map((link) => document.querySelector(link.getAttribute('href')))
      .filter(Boolean);

    function setActiveSection(sectionId) {
      links.forEach((link) => {
        const isActive = link.getAttribute('href') === `#${sectionId}`;
        if (isActive) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
      });
    }

    setActiveSection('beranda');

    const visibleSections = new Map();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) visibleSections.set(entry.target.id, entry.intersectionRatio);
          else visibleSections.delete(entry.target.id);
        });

        if (!visibleSections.size) return;
        const [mostVisible] = [...visibleSections.entries()].sort((a, b) => b[1] - a[1]);
        setActiveSection(mostVisible[0]);
      },
      {
        rootMargin: '-28% 0px -58% 0px',
        threshold: [0, 0.15, 0.35, 0.6],
      },
    );

    sections.forEach((section) => observer.observe(section));
  }

  function initializeReveals() {
    const elements = [...document.querySelectorAll('.reveal')];
    if (!elements.length) return;

    if (reduceMotion.matches || !('IntersectionObserver' in window)) {
      elements.forEach((element) => element.classList.add('is-visible'));
      return;
    }

    elements.forEach((element) => element.classList.add('will-reveal'));
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: '0px 0px -10%', threshold: 0.12 },
    );

    elements.forEach((element) => observer.observe(element));
  }

  function normalizeText(value) {
    return value.replace(/\s+/g, ' ').trim();
  }

  function getEventLocation() {
    const location = document.getElementById('eventLocation');
    return normalizeText(location?.innerText || location?.textContent || '');
  }

  function escapeCalendarText(value) {
    return value
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n');
  }

  function calendarTimestamp() {
    return new Date()
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}Z$/, 'Z');
  }

  function downloadCalendar() {
    const location = getEventLocation();
    const start = new Date(Number(document.body.dataset.start));
    if (!Number.isFinite(start.getTime())) return;
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//CELEYO//Invitation//ID',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${slug}@celeyo.com`,
      `DTSTAMP:${calendarTimestamp()}`,
      `DTSTART:${start
        .toISOString()
        .replace(/[-:]/g, '')
        .replace(/\.\d{3}Z$/, 'Z')}`,
      `SUMMARY:${escapeCalendarText('Pernikahan ' + document.body.dataset.names)}`,
      `LOCATION:${escapeCalendarText(location)}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ];

    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = `${slug}.ics`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);
  }

  async function copyText(value) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return;
    }

    const fallback = document.createElement('textarea');
    fallback.value = value;
    fallback.setAttribute('readonly', '');
    fallback.style.position = 'fixed';
    fallback.style.opacity = '0';
    document.body.appendChild(fallback);
    fallback.select();
    const succeeded = document.execCommand('copy');
    fallback.remove();
    if (!succeeded) throw new Error('Copy failed');
  }

  function initializeEventActions() {
    const calendarButton = document.getElementById('calendarBtn');
    const addressButton = document.getElementById('copyAddress');
    const eventStatus = document.getElementById('eventActionStatus');
    const location = getEventLocation();

    calendarButton?.addEventListener('click', () => {
      downloadCalendar();
      if (eventStatus) eventStatus.textContent = 'File kalender berhasil dibuat.';
    });

    addressButton?.addEventListener('click', async () => {
      try {
        await copyText(location);
        if (eventStatus) eventStatus.textContent = 'Alamat berhasil disalin.';
      } catch (error) {
        if (eventStatus)
          eventStatus.textContent =
            'Alamat belum dapat disalin. Silakan pilih teks alamat secara manual.';
      }
    });
  }

  function initializeGallery() {
    const dialog = document.getElementById('lightbox');
    const dialogImage = document.getElementById('lightboxImage');
    const closeButton = document.getElementById('closeLightbox');
    const galleryItems = [...document.querySelectorAll('.gallery-item')];

    if (!dialog || !dialogImage) return;

    galleryItems.forEach((button) => {
      button.addEventListener('click', () => {
        lastGalleryTrigger = button;
        dialogImage.src = button.dataset.src || '';
        dialogImage.alt = button.dataset.alt || 'Foto undangan';
        dialog.showModal();
      });
    });

    closeButton?.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener('close', () => {
      dialogImage.removeAttribute('src');
      lastGalleryTrigger?.focus();
    });
  }

  async function request(path, method = 'GET', data) {
    const response = await fetch(apiRoot + path, {
      method,
      headers: data ? { 'Content-Type': 'application/json' } : undefined,
      body: data ? JSON.stringify(data) : undefined,
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Permintaan belum berhasil.');
    return result;
  }
  async function initializeGuestSession() {
    if (preview) return;
    const note = document.getElementById('responseNote');
    try {
      const url = new URL(location.href);
      const code = url.searchParams.get('code');
      if (code) {
        await request('/open', 'POST', { code });
        url.searchParams.delete('code');
        history.replaceState(null, '', url.pathname + url.search + url.hash);
      }
      const result = await request('/response');
      document.getElementById('guestName').textContent = result.name;
      document.getElementById('guestFullName').value = result.name;
      const count = document.getElementById('guestCount');
      count.replaceChildren(
        ...Array.from(
          { length: result.maxParty },
          (_, i) => new Option(String(i + 1), String(i + 1)),
        ),
      );
      const form = document.getElementById('rsvpForm');
      form.setAttribute('aria-disabled', 'false');
      form
        .querySelectorAll('select,textarea,button[type=submit]')
        .forEach((el) => (el.disabled = false));
      if (result.response) {
        responseVersion = result.response.version;
        document.getElementById('attendance').value = result.response.attending ? 'yes' : 'no';
        count.value = String(result.response.party || 1);
        document.getElementById('guestMessage').value = result.response.message;
      }
      document.getElementById('attendance').dispatchEvent(new Event('change'));
      note.textContent =
        'Tautan personal terverifikasi. Ucapan langsung tampil; Anda dapat mengeditnya di sini.';
    } catch (error) {
      note.textContent = error.message;
    }
  }
  async function loadWishes(reset = false) {
    if (preview) return;
    const feed = document.getElementById('wishFeed');
    try {
      if (reset) {
        wishPage = 1;
        feed.replaceChildren();
      }
      const wishes = await request(`/wishes?page=${wishPage}`);
      for (const wish of wishes) {
        const article = document.createElement('article');
        article.className = 'wish-card';
        const name = document.createElement('strong');
        name.textContent = wish.name;
        const message = document.createElement('p');
        message.textContent = wish.message;
        const date = document.createElement('small');
        date.textContent = new Date(wish.updated_at).toLocaleDateString('id-ID');
        article.append(name, message, date);
        feed.append(article);
      }
      document.getElementById('moreWishes').hidden = wishes.length < 20;
    } catch {
      if (!feed.children.length) feed.textContent = 'Ucapan belum dapat dimuat.';
    }
  }
  function initializeRsvp() {
    const form = document.getElementById('rsvpForm');
    const attendance = document.getElementById('attendance');
    const count = document.getElementById('guestCount');
    const status = document.getElementById('formStatus');
    attendance.addEventListener('change', () => {
      count.disabled = attendance.value !== 'yes';
    });
    document.getElementById('moreWishes').addEventListener('click', () => {
      wishPage++;
      loadWishes();
    });
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (preview || form.getAttribute('aria-disabled') === 'true' || !form.reportValidity())
        return;
      const button = form.querySelector('button[type=submit]');
      button.disabled = true;
      status.textContent = 'Menyimpan konfirmasi…';
      try {
        const attending = attendance.value === 'yes';
        const result = await request('/response', 'POST', {
          attending,
          party: attending ? Number(count.value) : 0,
          message: document.getElementById('guestMessage').value,
          version: responseVersion,
          website: new FormData(form).get('website') || '',
        });
        responseVersion = result.version;
        status.textContent = 'Terima kasih. Konfirmasi dan ucapan Anda telah tersimpan.';
        await loadWishes(true);
      } catch (error) {
        status.textContent = error.message;
      } finally {
        button.disabled = false;
      }
    });
  }
  function initializeYoutube() {
    const panel = document.getElementById('youtubePanel');
    if (!panel) return;
    panel.addEventListener('toggle', () => {
      const container = document.getElementById('youtubePlayer');
      if (!panel.open) {
        container.replaceChildren();
        return;
      }
      pauseMusic();
      const iframe = document.createElement('iframe');
      iframe.src = `https://www.youtube-nocookie.com/embed/${panel.dataset.video}?autoplay=0&playsinline=1`;
      iframe.title = 'Video musik pilihan';
      iframe.allow = 'encrypted-media; picture-in-picture';
      iframe.allowFullscreen = true;
      container.replaceChildren(iframe);
    });
  }

  function initializeGiftCopy() {
    document.querySelectorAll('.bank-card').forEach((card) => {
      const copyButton = card.querySelector('.copy-account');
      const accountNumber = card.querySelector('.account-number');
      const copyStatus = card.querySelector('.copy-status');
      const bankName = card.querySelector('.bank-name')?.textContent.trim();
      if (!copyButton || !accountNumber || !copyStatus) return;

      const defaultLabel = copyButton.textContent;
      let resetTimer;

      copyButton.addEventListener('click', async () => {
        window.clearTimeout(resetTimer);
        copyButton.disabled = true;
        copyButton.textContent = defaultLabel;
        copyStatus.textContent = '';

        try {
          await copyText(normalizeText(accountNumber.textContent));
          copyButton.textContent = 'Nomor Rekening Disalin ✓';
          copyStatus.textContent = `Nomor rekening ${bankName} berhasil disalin.`;
        } catch (error) {
          copyStatus.textContent = `Nomor rekening ${bankName} belum dapat disalin. Silakan pilih nomor secara manual.`;
        } finally {
          copyButton.disabled = false;
          resetTimer = window.setTimeout(() => {
            copyButton.textContent = defaultLabel;
          }, 2400);
        }
      });
    });
  }

  personalizeGuest();
  initializeNavigation();
  initializeReveals();
  initializeEventActions();
  initializeGallery();
  initializeRsvp();
  initializeGiftCopy();
  initializeYoutube();
  updateMusicUI(false);

  openButton?.addEventListener('click', openInvitation, { once: true });
  musicButton?.addEventListener('click', () => {
    if (musicIsPlaying) pauseMusic();
    else playMusic();
  });
})();
