# Adam & Nadhila Wedding Invitation — UI/UX Redesign Specification

## Status

Ready for implementation.

This specification reflects the confirmed direction:

- Experience priority: balanced storytelling and guest utility
- Visual direction: soft romantic
- Language: Indonesian-first, with English allowed only as a decorative accent

## 1. Objective

Redesign the existing one-page wedding invitation into a soft, romantic experience that still feels personal and cinematic, while making the information guests need—date, time, location, calendar, and RSVP—immediately discoverable and easy to act on.

The result should feel intimate, graceful, and photo-led rather than ornate or template-like. It must remain fast and comfortable on mobile, where most guests are expected to open it from a shared link.

## 2. Current Product and Baseline

The repository is a framework-free static site deployed from the repository root through Netlify:

- `index.html` contains the complete invitation and Netlify RSVP form.
- `styles.css` contains the responsive layout, visual system, gate, gallery, fixed navigation, and cinematic-scene styling.
- `script.js` contains the opening gate, personalized guest query parameters, music, a scroll-driven film engine, navigation state, calendar download, account-number copy action, RSVP submission, reveal animations, and gallery lightbox.
- `assets/` contains the supplied WebP photography and background music.

The current site already supports:

- Guest personalization through `?to=` or `?guest=`.
- An opening gate that unlocks the invitation and starts music after a user gesture.
- Couple, date, story, event, gallery, RSVP, gift, and closing sections.
- Google Maps, downloadable calendar, Netlify form submission, account-number copy, gallery lightbox, fixed navigation, and reduced-motion detection.

Current issues the redesign must address:

- Event details and RSVP are visually buried behind a long, scroll-controlled introduction.
- The opening film intercepts wheel, touch, and keyboard scrolling, which can make navigation feel unpredictable.
- Functional and narrative copy inconsistently mixes Indonesian and English.
- Some controls and active navigation states are too subtle, especially on small screens.
- The CloudFront-hosted Ogg font fails to load because of cross-origin restrictions.
- The 4.2 MB audio file is preloaded before the guest chooses to open the invitation.
- The main content is only marked `aria-hidden` while the gate is open; it should also be removed from the focus order.

## 3. Goals

1. Preserve a memorable, emotional opening and photo story without blocking native page navigation.
2. Put event facts and the two primary guest actions—view the location and RSVP—within the first content viewport after opening.
3. Establish a cohesive soft-romantic visual system built around the supplied photographs.
4. Make all essential copy and controls Indonesian-first.
5. Preserve and improve every existing invitation function.
6. Deliver a responsive, accessible, dependency-light static experience.

## 4. Non-goals

- Do not change the wedding date, time, address, map URL, couple or parent names, bank details, or other factual content unless the user separately supplies corrections.
- Do not add a CMS, database, JavaScript framework, bundler, authentication system, or custom RSVP backend.
- Do not replace the supplied couple photography or generate new couple imagery.
- Do not add public guestbook/wishes rendering, attendance administration, payment processing, or analytics as part of this redesign.
- Do not autoplay audio before the guest explicitly opens the invitation.

## 5. Audience and Core Journeys

### Primary audience

Invited family, friends, and colleagues opening a personalized link, primarily on a mobile phone and often while multitasking.

### Core journey A: quick information

1. Guest sees the personalized opening.
2. Guest opens the invitation.
3. Guest immediately sees the date, time, Bekasi location context, and clear `Lihat Detail Acara` and `Konfirmasi Kehadiran` actions.
4. Guest opens Maps or downloads the calendar without needing to traverse the story.

### Core journey B: emotional story

1. Guest opens the invitation.
2. Guest moves through the welcome, couple introduction, relationship story, and gallery using native scrolling.
3. Motion and photography create atmosphere without delaying access to practical content.
4. Guest reaches the event, RSVP, gift, and closing sections in a coherent narrative order.

### Core journey C: RSVP

1. Guest reaches RSVP from the hero action or persistent navigation.
2. Guest completes the existing Netlify form with clear labels, validation, and attendance-dependent fields.
3. Guest receives a visible and screen-reader-announced sending, success, or failure state.

## 6. Information Architecture

Use this page order:

1. **Opening gate** — personalized guest name, couple names, date, and `Buka Undangan`.
2. **Welcome/hero** — emotional introduction plus immediately visible event summary and primary actions.
3. **Couple** — both partners and their parents.
4. **Our story** — a concise two-part story using the existing urban and horizon photo sets.
5. **Event** — date, time, full address, Maps, calendar, and optional address-copy action.
6. **Gallery** — responsive photo composition with accessible lightbox.
7. **RSVP** — attendance form and submission feedback.
8. **Wedding gift** — respectful optional gift information and copy action.
9. **Closing** — full-bleed portrait, couple names, date, and thank-you message.

Persistent navigation appears only after the gate opens. It must provide direct access to `Beranda`, `Cerita`, `Acara`, and `RSVP`; gallery and gift remain part of the natural document flow. On mobile it may use a safe-area-aware bottom dock, while desktop may use a compact top or side treatment. The active state must be visibly distinct and programmatically indicated with `aria-current="page"`.

## 7. Functional Requirements

### 7.1 Opening gate

- `FUN-01` Preserve personalization from `?to=` and `?guest=` and insert the value using text-safe DOM APIs.
- `FUN-02` Keep the page locked and the main invitation both `aria-hidden` and inert until `Buka Undangan` is activated.
- `FUN-03` Open with one restrained transition of 600–900 ms; after it finishes, hide the gate and move focus to the welcome content without causing an unexpected scroll jump.
- `FUN-04` Treat opening as the explicit user gesture that may start music. A failed or blocked audio start must never block the invitation.

### 7.2 Welcome and navigation

- `FUN-05` Show date, time, and Bekasi context in the first viewport after opening.
- `FUN-06` Provide prominent links to the event section and RSVP section in that same viewport.
- `FUN-07` Use normal anchor navigation and native scrolling. Do not prevent default wheel, touch, Page Up/Down, arrow, or Space behavior to drive a custom timeline.
- `FUN-08` Update navigation state from section visibility without continuous layout-heavy calculations.

### 7.3 Event actions

- `FUN-09` Preserve the existing Google Maps destination and open it in a new tab with safe link attributes.
- `FUN-10` Preserve downloadable `.ics` calendar generation using 26 December 2026 at 09:00 WIB and the current venue details.
- `FUN-11` If an address-copy control is added, provide success and failure feedback without replacing the Maps action.

### 7.4 Gallery

- `FUN-12` Preserve all six gallery images and their full-size lightbox behavior.
- `FUN-13` Give every gallery trigger a unique, descriptive accessible name instead of repeating a generic photo label.
- `FUN-14` Support close button, Escape, and backdrop close; focus must return to the photo trigger that opened the dialog.

### 7.5 RSVP

- `FUN-15` Preserve `name="rsvp"`, `method="POST"`, `data-netlify="true"`, the hidden `form-name`, and honeypot fields required by Netlify.
- `FUN-16` Preserve the submitted field names unless a coordinated Netlify migration is explicitly made.
- `FUN-17` Keep name and attendance required; provide clear required indicators and inline validation language in Indonesian.
- `FUN-18` Show `Jumlah Tamu` only when attending, or disable and reset it when not attending. The submitted values remain 1–4.
- `FUN-19` Disable the submit button while sending to prevent duplicate submission, then restore it after success or failure.
- `FUN-20` Keep visible `Mengirim`, success, and retry states in an `aria-live` status region.
- `FUN-21` Preserve form values on a failed request and reset them only after a successful submission.

### 7.6 Gift and music

- `FUN-22` Preserve the BCA number and account holder exactly as currently supplied.
- `FUN-23` Preserve one-tap account-number copy with visible and screen-reader feedback plus a fallback when the Clipboard API is unavailable.
- `FUN-24` Keep the music control persistent but visually secondary. It must expose its state through `aria-pressed` and an Indonesian label such as `Nyalakan musik` / `Matikan musik`.
- `FUN-25` Music must pause and resume without restarting from the beginning.

## 8. Content and Language Requirements

- `COPY-01` All essential navigation, buttons, field labels, validation, event information, system status, and instructional copy must be Indonesian.
- `COPY-02` English may appear only in small decorative eyebrows or chapter marks, never as the sole wording for a required action or fact.
- `COPY-03` Replace essential English phrases such as `Open event notes` and `Will you be there?` with natural Indonesian.
- `COPY-04` Retain the intimate, calm tone of the existing Indonesian copy and avoid generic wedding-template language where a more personal phrase already exists.
- `COPY-05` Keep factual names, honorifics, academic suffixes, date, time, address, and account details unchanged.
- `COPY-06` Avoid duplicating the same date/time block as a standalone full-height section when the information can be integrated into the welcome and event sections.

Suggested functional labels:

- `Lihat Detail Acara`
- `Buka di Google Maps`
- `Simpan ke Kalender`
- `Konfirmasi Kehadiran`
- `Kirim Konfirmasi`
- `Salin Nomor Rekening`
- `Lihat Foto`

## 9. Visual Design System

### 9.1 Art direction

The design should feel soft romantic through warm light, gentle layering, refined type, organic framing, and generous breathing room—not through excessive floral graphics, saturated pink, or decorative clutter.

Use the existing photography as the main visual material. Favor full-bleed crops for emotional anchors and smaller arched or softly rounded frames for intimate moments. Decorative details should be subtle: fine rules, translucent paper layers, small petal/leaf line motifs, and occasional script accents.

### 9.2 Color tokens

Start from this palette and adjust only as needed to meet contrast requirements:

- `--color-canvas: #FBF7F2` — warm ivory page background
- `--color-surface: #FFFDFC` — elevated cards and form fields
- `--color-blush: #E9D4D2` — soft section tint
- `--color-rose: #AD777C` — accent and selected states
- `--color-sage: #89927D` — secondary accent and success context
- `--color-ink: #3D3334` — primary text
- `--color-muted: #74696A` — secondary text when contrast permits
- `--color-deep: #493A3D` — dark romantic surfaces and overlays
- `--color-line: rgba(61, 51, 52, 0.16)` — borders and separators

Do not place light rose, sage, or muted text on ivory unless the resulting contrast meets WCAG requirements. Primary body copy should use `--color-ink`.

### 9.3 Typography

- Use one elegant, high-contrast serif for names and major headings, one highly readable sans serif for body copy and controls, and at most one restrained script accent.
- Remove the failing CloudFront Ogg font dependency.
- Fonts must use `font-display: swap` and have metrics-compatible local/system fallbacks. If a display font is self-hosted, include only licensed WOFF2 files and the weights actually used.
- Minimum body size is 16 px on mobile with a 1.5–1.7 line height. Functional labels must not rely on extreme letter spacing or sizes below 12 px.

### 9.4 Shape, spacing, and layout

- Use a consistent 4/8 px spacing scale and fluid section padding through `clamp()`.
- Standard content width: approximately 1120–1200 px; readable text width: 42–65 characters.
- Use soft arches or 20–32 px radii for selected photo/card moments. Do not round every surface.
- Buttons use pill or softly rounded shapes, a minimum 44 px target, clear filled/secondary hierarchy, visible hover/focus/pressed states, and no color-only state distinction.
- Cards may use translucent ivory surfaces and fine borders; avoid heavy drop shadows. If used, shadows must be diffuse and low contrast.

## 10. Motion and Interaction Design

- `MOTION-01` Replace the current 2700 px cinematic timeline and detent-based scroll interception with native document flow.
- `MOTION-02` Keep atmosphere through lightweight entrance reveals, slow image scale, and optional desktop-only parallax capped at a subtle travel distance.
- `MOTION-03` Animate only `transform` and `opacity` for recurring effects.
- `MOTION-04` Each reveal should run once and take no longer than roughly 700 ms.
- `MOTION-05` Under `prefers-reduced-motion: reduce`, disable parallax, scale effects, smooth scrolling, and nonessential reveals; content must render immediately in its final position.
- `MOTION-06` No animation may delay or obscure event details, RSVP controls, or navigation.

## 11. Responsive Requirements

- `RESP-01` Treat 320–430 px portrait screens as the primary layout target.
- `RESP-02` Support at minimum 320, 375/390, 768, 1024, and 1440 px widths without horizontal overflow.
- `RESP-03` Keep important text and faces within safe image crops. Use explicit mobile and desktop `object-position` values when one crop cannot serve both.
- `RESP-04` Stack story and RSVP layouts on small screens; alternate editorial layouts only when the viewport has room.
- `RESP-05` Keep persistent mobile navigation above `env(safe-area-inset-bottom)` and ensure it does not cover the last form control or closing content.
- `RESP-06` Use viewport-relative heights only with sensible min/max constraints; content must remain usable in short landscape viewports and browser UI changes.
- `RESP-07` Touch targets must be at least 44 × 44 CSS pixels with adequate separation.

## 12. Accessibility Requirements

Target WCAG 2.2 AA for the redesigned page.

- `A11Y-01` Maintain one logical page `h1` after the gate and a sequential heading hierarchy.
- `A11Y-02` All controls must be keyboard-operable with a clearly visible `:focus-visible` treatment.
- `A11Y-03` Decorative images use empty alt text; meaningful images use concise, distinct Indonesian descriptions.
- `A11Y-04` Do not use `aria-label` to replace visible control text where visible text is practical.
- `A11Y-05` Main text and functional UI must meet 4.5:1 contrast; large text and non-text UI must meet applicable 3:1 requirements.
- `A11Y-06` Gate, dialog, navigation, music state, copy feedback, and form status must expose correct semantics and focus behavior.
- `A11Y-07` Form errors must be associated with their fields and identified by more than color.
- `A11Y-08` The experience remains complete with audio muted, animations disabled, images still loading, or JavaScript audio playback rejected.

## 13. Performance and Reliability Constraints

- Keep the framework-free, build-free deployment unless implementation uncovers a blocking browser requirement.
- Reuse the supplied WebP assets; do not convert them to heavier formats.
- Add explicit `width` and `height` or `aspect-ratio` for images to prevent layout shifts.
- Eagerly load only the opening/hero image required for the first paint; lazy-load below-the-fold gallery and story images.
- Change audio from eager `preload="auto"` to `metadata` or `none` and load/play it only after the opening gesture.
- Avoid continuous requestAnimationFrame loops and per-scroll layout measurement.
- Do not introduce first-party console errors, missing assets, or failed font requests.
- Target on a representative mobile connection: LCP ≤ 2.5 s, CLS ≤ 0.1, and INP ≤ 200 ms. These are acceptance targets, not a reason to remove essential invitation content.

## 14. Technical Architecture

Retain the existing three-file architecture and progressively enhance semantic HTML:

### `index.html`

- Reorder and simplify the sections according to the information architecture.
- Preserve Netlify form attributes, stable action IDs, query-personalization target, map URL, facts, and supplied asset references.
- Add semantic landmarks, descriptive labels, image dimensions/aspect ratios, inert gate behavior, and status regions.
- Keep content meaningful in source order so the invitation is understandable without animations.

### `styles.css`

Organize styles in this order:

1. Font declarations and design tokens
2. Reset and document defaults
3. Reusable layout primitives
4. Components: gate, buttons, navigation, cards, gallery, form, dialog, music control
5. Section-specific compositions
6. Motion/reveal utilities
7. Responsive queries
8. Reduced-motion and other user preference queries

Remove the large set of cinematic-engine CSS variables and the styles used only for split frames, detents, and the scroll film. Use CSS Grid/Flexbox and `clamp()` for responsive composition.

### `script.js`

Keep the script dependency-free and organize it into small feature initializers:

- Guest personalization
- Gate and focus management
- Music controller
- Navigation and active-section observer
- Reveal observer
- Event calendar/address actions
- Gallery dialog
- RSVP state, validation, and submission
- Gift copy feedback

Remove the film interpolation math, wheel/touch/keyboard interception, detent snapping, pointer-driven scene transforms, and always-on animation work. Prefer `IntersectionObserver`, event delegation where appropriate, and CSS classes/state attributes.

### State and content ownership

- Keep visible invitation copy in HTML.
- Keep only behavior-specific state in JavaScript.
- Avoid duplicating event/account values across multiple JavaScript blocks. When behavior needs the same value as the page, derive it from a stable `data-*` attribute or a single clearly named constant.
- Preserve URL personalization entirely client-side; it must not be sent to third parties.

## 15. Implementation Plan

1. **Restructure the semantic document.** Reorder the invitation, create the welcome utility block, consolidate duplicated date content, translate functional copy, and preserve all factual and Netlify fields.
2. **Build the soft-romantic design foundation.** Replace legacy tokens and failing font usage, define color/type/spacing/focus systems, and establish shared buttons, cards, surfaces, and photo treatments.
3. **Implement responsive section compositions.** Build the gate, welcome, couple, story, event, gallery, RSVP, gift, closing, and persistent navigation for mobile first, then enhance tablet and desktop layouts.
4. **Simplify interaction code.** Remove scroll hijacking and the cinematic math; implement gate focus management, navigation observation, restrained reveals, reduced motion, audio state, and reliable dialog behavior.
5. **Improve practical actions.** Harden Maps/calendar, clipboard fallback, attendance-dependent RSVP fields, duplicate-submit prevention, and accessible feedback while retaining Netlify compatibility.
6. **Harden accessibility.** Verify headings, landmarks, labels, alt text, inert/focus behavior, keyboard paths, contrast, target sizes, and screen-reader statuses.
7. **Optimize loading and rendering.** Correct image sizing/loading, defer audio, eliminate failed font resources, and remove unnecessary animation/layout work.
8. **Validate end to end.** Test the acceptance matrix below, inspect desktop/mobile screenshots, run accessibility and performance checks, and correct regressions before handoff.

## 16. Validation Matrix

### Viewports

- 320 × 568
- 390 × 844
- 768 × 1024
- 1024 × 768
- 1440 × 900 or larger

### Required manual flows

- Open default invitation and personalized URLs using both supported query keys.
- Open invitation with audio allowed and with playback rejected.
- Navigate directly to story, event, and RSVP using keyboard and touch.
- Open Maps and download/inspect the calendar file.
- Open every gallery item; close with button, Escape, and backdrop; verify returned focus.
- Submit RSVP successfully in a Netlify-compatible preview and simulate a failed request.
- Switch attendance between attending and not attending; verify guest-count behavior and submission payload.
- Copy the account number with Clipboard API available and unavailable.
- Test reduced-motion mode and keyboard-only operation.
- Confirm there are no first-party console errors or failed local resources.

### Automated/assisted checks

- HTML validity and duplicate-ID check
- Accessibility audit with no critical or serious violations
- Responsive overflow check at each target viewport
- Lighthouse or equivalent performance check on mobile and desktop
- Contrast verification for all token combinations used by text and controls

## 17. Success Criteria

The redesign is complete when all of the following are true:

1. The experience clearly reads as soft romantic and uses the supplied photography cohesively.
2. Date, time, event-detail action, and RSVP action are visible in the first content viewport after opening at 390 × 844 and at desktop width.
3. A guest can jump to event details or RSVP without moving through the story first.
4. Native scrolling works normally with mouse, trackpad, keyboard, and touch; there are no detents or intercepted gestures.
5. All current features—personalization, gate, music, Maps, calendar, gallery, RSVP, copy action, and closing—still work.
6. All essential interface and status copy is Indonesian; any remaining English is purely decorative.
7. The page has no horizontal overflow at the validation widths and no persistent control obscures content.
8. Keyboard focus, reduced motion, dialog behavior, form feedback, contrast, and target sizes meet the accessibility requirements.
9. The RSVP form remains compatible with Netlify and prevents accidental duplicate submissions.
10. No first-party console errors, failed font requests, broken image/audio requests, or layout-shifting unsized images remain.
11. Performance targets are met or any documented exception is demonstrably caused by an essential supplied media asset and has been minimized.

## 18. Assumptions

- The existing factual wedding content is authoritative.
- The supplied photographs and soundtrack are approved for reuse.
- The current Google Maps URL and BCA details should remain public within the invitation.
- Netlify remains the deployment and form-processing platform.
- No additional photography, logo, monogram file, or custom floral illustration is required; decorative accents can be implemented with typography and lightweight CSS/SVG line work if needed.
