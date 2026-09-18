(() => {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const gate = document.getElementById("gate");
  const main = document.getElementById("mainContent");
  const openButton = document.getElementById("openInvitation");
  const nav = document.getElementById("bottomNav");
  const musicButton = document.getElementById("musicToggle");
  const musicLabel = document.getElementById("musicLabel");
  const audio = document.getElementById("bgMusic");
  const welcomeTitle = document.getElementById("welcomeTitle");

  let musicIsPlaying = false;
  let lastGalleryTrigger = null;

  function personalizeGuest() {
    const params = new URLSearchParams(window.location.search);
    const guest = (params.get("to") || params.get("guest") || "").trim();
    const guestName = document.getElementById("guestName");

    if (guest && guestName) {
      guestName.textContent = guest.slice(0, 80);
    }
  }

  function updateMusicUI(isPlaying) {
    musicIsPlaying = isPlaying;
    if (!musicButton || !musicLabel) return;

    musicButton.setAttribute("aria-pressed", String(isPlaying));
    musicButton.setAttribute("aria-label", isPlaying ? "Matikan musik" : "Nyalakan musik");
    musicLabel.textContent = isPlaying ? "Musik aktif" : "Musik mati";
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
    main.removeAttribute("inert");
    main.setAttribute("aria-hidden", "false");
    document.body.classList.remove("locked");

    if (nav) {
      nav.hidden = false;
      window.requestAnimationFrame(() => nav.classList.add("is-visible"));
    }

    if (musicButton) musicButton.hidden = false;
    gate.classList.add("opened");
    playMusic();

    const finishDelay = reduceMotion.matches ? 0 : 780;
    window.setTimeout(() => {
      gate.hidden = true;
      gate.setAttribute("aria-hidden", "true");
      welcomeTitle?.focus({ preventScroll: true });
    }, finishDelay);
  }

  function initializeNavigation() {
    if (!nav) return;

    const links = [...nav.querySelectorAll("a[href^='#']")];
    const sections = links
      .map((link) => document.querySelector(link.getAttribute("href")))
      .filter(Boolean);

    function setActiveSection(sectionId) {
      links.forEach((link) => {
        const isActive = link.getAttribute("href") === `#${sectionId}`;
        if (isActive) link.setAttribute("aria-current", "page");
        else link.removeAttribute("aria-current");
      });
    }

    setActiveSection("beranda");

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
        rootMargin: "-28% 0px -58% 0px",
        threshold: [0, 0.15, 0.35, 0.6],
      },
    );

    sections.forEach((section) => observer.observe(section));
  }

  function initializeReveals() {
    const elements = [...document.querySelectorAll(".reveal")];
    if (!elements.length) return;

    if (reduceMotion.matches || !("IntersectionObserver" in window)) {
      elements.forEach((element) => element.classList.add("is-visible"));
      return;
    }

    elements.forEach((element) => element.classList.add("will-reveal"));
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -10%", threshold: 0.12 },
    );

    elements.forEach((element) => observer.observe(element));
  }

  function normalizeText(value) {
    return value.replace(/\s+/g, " ").trim();
  }

  function escapeCalendarText(value) {
    return value
      .replace(/\\/g, "\\\\")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,")
      .replace(/\n/g, "\\n");
  }

  function calendarTimestamp() {
    return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  }

  function downloadCalendar() {
    const location = normalizeText(document.getElementById("eventLocation")?.textContent || "");
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Adam & Nadhila//Wedding//ID",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      "UID:adam-nadhila-20261226",
      `DTSTAMP:${calendarTimestamp()}`,
      "DTSTART:20261226T020000Z",
      "SUMMARY:Pernikahan Adam & Nadhila",
      `LOCATION:${escapeCalendarText(location)}`,
      "DESCRIPTION:Pernikahan Adam Alfiansyah & Nadhila Rachmawati\\, S.Psi.",
      "END:VEVENT",
      "END:VCALENDAR",
    ];

    const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = "Adam-Nadhila-26-12-2026.ics";
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

    const fallback = document.createElement("textarea");
    fallback.value = value;
    fallback.setAttribute("readonly", "");
    fallback.style.position = "fixed";
    fallback.style.opacity = "0";
    document.body.appendChild(fallback);
    fallback.select();
    const succeeded = document.execCommand("copy");
    fallback.remove();
    if (!succeeded) throw new Error("Copy failed");
  }

  function initializeEventActions() {
    const calendarButton = document.getElementById("calendarBtn");
    const addressButton = document.getElementById("copyAddress");
    const eventStatus = document.getElementById("eventActionStatus");
    const location = normalizeText(document.getElementById("eventLocation")?.textContent || "");

    calendarButton?.addEventListener("click", () => {
      downloadCalendar();
      if (eventStatus) eventStatus.textContent = "File kalender berhasil dibuat.";
    });

    addressButton?.addEventListener("click", async () => {
      try {
        await copyText(location);
        if (eventStatus) eventStatus.textContent = "Alamat berhasil disalin.";
      } catch (error) {
        if (eventStatus) eventStatus.textContent = "Alamat belum dapat disalin. Silakan pilih teks alamat secara manual.";
      }
    });
  }

  function initializeGallery() {
    const dialog = document.getElementById("lightbox");
    const dialogImage = document.getElementById("lightboxImage");
    const closeButton = document.getElementById("closeLightbox");
    const galleryItems = [...document.querySelectorAll(".gallery-item")];

    if (!dialog || !dialogImage) return;

    galleryItems.forEach((button) => {
      button.addEventListener("click", () => {
        lastGalleryTrigger = button;
        dialogImage.src = button.dataset.src || "";
        dialogImage.alt = button.dataset.alt || "Foto Adam dan Nadhila";
        dialog.showModal();
      });
    });

    closeButton?.addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener("close", () => {
      dialogImage.removeAttribute("src");
      lastGalleryTrigger?.focus();
    });
  }

  function initializeRsvp() {
    const form = document.getElementById("rsvpForm");
    const attendance = document.getElementById("attendance");
    const guestCountField = document.getElementById("guestCountField");
    const guestCount = document.getElementById("guestCount");
    const status = document.getElementById("formStatus");
    const submitButton = form?.querySelector("button[type='submit']");

    if (!form || !attendance || !guestCountField || !guestCount || !status || !submitButton) return;

    function syncGuestCount() {
      const isAttending = attendance.value === "Insya Allah, saya hadir";
      guestCountField.hidden = !isAttending;
      guestCount.disabled = !isAttending;
      if (!isAttending) guestCount.value = "1";
    }

    attendance.addEventListener("change", syncGuestCount);
    syncGuestCount();

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;

      submitButton.disabled = true;
      form.setAttribute("aria-busy", "true");
      status.classList.remove("is-error");
      status.textContent = "Mengirim konfirmasi...";

      const formData = new FormData(form);
      try {
        const response = await fetch("/", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams(formData).toString(),
        });

        if (!response.ok) throw new Error("Submission failed");

        form.reset();
        syncGuestCount();
        status.textContent = "Terima kasih. Sampai bertemu di hari bahagia kami.";
      } catch (error) {
        status.classList.add("is-error");
        status.textContent = "Konfirmasi belum terkirim. Silakan periksa koneksi dan coba lagi.";
      } finally {
        submitButton.disabled = false;
        form.removeAttribute("aria-busy");
      }
    });
  }

  function initializeGiftCopy() {
    const copyButton = document.getElementById("copyAccount");
    const accountNumber = document.getElementById("accountNumber");
    const copyStatus = document.getElementById("copyStatus");

    copyButton?.addEventListener("click", async () => {
      try {
        await copyText(normalizeText(accountNumber?.textContent || ""));
        copyButton.textContent = "Nomor Rekening Disalin ✓";
        if (copyStatus) copyStatus.textContent = "Nomor rekening berhasil disalin.";
      } catch (error) {
        if (copyStatus) copyStatus.textContent = "Nomor belum dapat disalin. Silakan pilih nomor secara manual.";
      }

      window.setTimeout(() => {
        copyButton.textContent = "Salin Nomor Rekening";
      }, 2400);
    });
  }

  personalizeGuest();
  initializeNavigation();
  initializeReveals();
  initializeEventActions();
  initializeGallery();
  initializeRsvp();
  initializeGiftCopy();
  updateMusicUI(false);

  openButton?.addEventListener("click", openInvitation, { once: true });
  musicButton?.addEventListener("click", () => {
    if (musicIsPlaying) pauseMusic();
    else playMusic();
  });
})();
