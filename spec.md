# Wedding E-Invite — Full Spec

**Couple:** Ashrith Jacob & Veena
**Date:** Monday, 28 December 2026
**Venue:** Resort 82, Bhavikere, Nelamangala, Bengaluru
**Audience:** Family and friends, opened mostly on phones from a WhatsApp link
**Reference sites:** https://digiwed161-sys.github.io/Ashika_weds_Steve/?v=8 , https://clintandnamitha.elysianties.in/

A single mobile-first page. It is a static site (GitHub Pages / Netlify) with a Google Sheet as the backend, using Google Apps Script. Guests need no login.

---

## 1. Goals

1. Photos of the couple (main photo, individual portraits, gallery)
2. A song of the couple's choice playing in the background
3. A live countdown to the ceremony
4. A wishes wall: guests post messages, everyone sees them, and the couple can moderate
5. An RSVP with an **exact headcount**: adults and children counted separately, plus each family member's name

Non-goals: guest accounts, payments, admin dashboard (the Google Sheet is the dashboard).

---

## 2. File structure

```
/
├── index.html          # whole site: markup, CSS, JS, CONFIG block
├── song.mp3            # background music (couple supplies)
├── photos/
│   ├── hero.jpg
│   ├── groom.jpg
│   ├── bride.jpg
│   └── g1.jpg … g6.jpg
├── og-thumb.jpg        # 1200×630 link-preview image for WhatsApp (optional, recommended)
└── apps-script.gs      # backend, pasted into the Google Sheet's Apps Script (not served)
```

No build step and no framework, just vanilla HTML/CSS/JS. Everything editable lives in one `CONFIG` object.

---

## 3. CONFIG schema

```js
const CONFIG = {
  groom: "Ashrith",          groomFull: "Ashrith Jacob", groomLine: "Son of [Father] & [Mother]",
  bride: "Veena",            brideFull: "Veena",         brideLine: "Daughter of [Father] & [Mother]",
  weddingAt: "2026-12-28T10:30:00+05:30",   // ISO with IST offset; countdown target (TIME TBD)
  dateShort: "28 · 12 · 2026",
  placeShort: "Nelamangala · Bengaluru",
  rsvpBy: "10 December 2026",
  events: [{
    name: "Wedding Ceremony",
    date: "Monday, 28 December 2026",
    time: "10:30 AM",                          // TBD
    venue: "Resort 82",
    address: "Bhavikere, Nelamangala, Bengaluru",
    map: "https://www.google.com/maps/search/?api=1&query=Resort+82+Bhavikere+Nelamangala"
  }],                                          // more events (reception etc.) render as more cards
  photos: { hero: "", groom: "", bride: "", gallery: ["", "", "", "", "", ""] },  // "" → placeholder frame
  song: "",                                    // e.g. "song.mp3"; "" hides the music button
  endpoint: "",                                // Apps Script /exec URL; "" → preview mode (localStorage)
  contact: "Questions? Call or WhatsApp [name] on [number]"
};
```

The monogram is derived from the first letters of `groom` and `bride` ("A & V").

---

## 4. Page structure (top to bottom)

| # | Section | Content / behaviour |
|---|---------|---------------------|
| 0 | **Opening screen** (fixed overlay) | Bordered card: eyebrow "Wedding Invitation", monogram, "Lovingly invited / {guest}", button **Open invitation**. Tapping fades the overlay out (0.9s) and starts the song. `{guest}` comes from `?to=` in the URL (max 60 chars, escaped) and defaults to "Family & Friends". |
| — | Preview banner | Shown only when `endpoint` is empty: "Preview mode: RSVPs and wishes are only saved in this browser…" |
| 1 | **Hero** | Arch-topped portrait photo (4:5, top radius 170px), eyebrow "Together with their families", names stacked ("Ashrith / & / Veena"), date line, place line. |
| 2 | **Invitation + Countdown** | "Join us as we begin forever" plus invite text, then a 4-column countdown: Days / Hours / Minutes / Seconds. Updates every 1s, clamps at 0. |
| 3 | **The couple** | Two portraits side by side (3:4), full names, parents line under each. |
| 4 | **When & where** | One card per event: Date, Time, Venue + address, **Get directions** button (opens Google Maps in a new tab). |
| 5 | **Gallery** | 2-column grid. Every 3rd photo (index 0, 3, …) spans both columns at 16:10; others are square. |
| 6 | **RSVP** | See §5. |
| 7 | **Wishes wall** | See §6. |
| 8 | **Footer** | Monogram, "With love and gratitude", contact line. |
| — | **Music button** | Fixed bottom-right (16px + safe-area inset), 48px circle with a note icon that spins while playing. Toggles play/pause. Hidden when `song` is empty. |

A decorative **zari border** (a saree-border band) sits between every section. See §7.

---

## 5. RSVP

### Fields
| Field | Type | Rules |
|-------|------|-------|
| Name | text | required, max 80 |
| Phone (WhatsApp) | tel | optional, max 20 |
| Will you attend? | 2-option toggle | "Joyfully, yes" (default) / "Sadly, no" |
| Adults | stepper | min 1, max 15, label "Including you" (shown only if yes) |
| Children | stepper | min 0, max 10, label "Under 12" (shown only if yes) |
| Total line | computed | "N guests in total" |
| Family member names | text inputs | one input per extra guest (total − 1), placeholder "Guest 2 name"…; optional; typed values survive count changes |
| Note | textarea | optional, max 500 ("Dietary needs, travel plans…") |

### Behaviour
- Stepper −/+ buttons disable at their min/max.
- Choosing "no" hides the count block and sends 0 / 0 / 0.
- Each guest gets a stable `id` (`crypto.randomUUID()`) kept in localStorage, so re-submitting **updates** their sheet row instead of adding a duplicate.
- The submit button reads "Sending…" and is disabled in flight. On error it shows: "Your RSVP didn't go through. Check your connection and try again."
- On success the form is replaced by a summary card (Name, Attending, Adults, Children, Total, With: names) and a **Change my response** button that reopens the form prefilled.
- On revisit, the saved RSVP is read from localStorage and the summary card is shown directly.

### Payload (POST body, `Content-Type: text/plain` to avoid a CORS preflight)
```json
{ "type": "rsvp", "id": "uuid", "name": "…", "phone": "…", "attending": "yes|no",
  "adults": 2, "children": 1, "total": 3, "guests": ["Name 2", "Name 3"], "message": "…" }
```

---

## 6. Wishes wall

- Form: Name (required, max 60) and Wish (required, max 400). Button "Post wish" ("Posting…" in flight).
- List: newest first; each card shows the message (pre-wrap, wraps long words), the name in uppercase gold, and the date (`en-IN`, e.g. "13 Oct").
- Empty state: "Wishes from family and friends will appear here. Be the first to write one."
- Load error: "Wishes couldn't load right now. Refresh to try again."
- After posting, clear the message field and reload the list.
- Moderation: the couple types `x` in the sheet's **Hide** column and that wish disappears from the wall.
- Payload: `{ "type": "wish", "name": "…", "message": "…", "at": "ISO date" }`
- Fetch: `GET {endpoint}?action=wishes` → `{ ok: true, wishes: [{ at, name, message }] }` (max 200, newest first, hidden rows excluded).

All user text is HTML-escaped before rendering.

---

## 7. Visual design

**Direction:** a deep peacock-silk ground with gold zari detailing, like a silk saree and its border. It deliberately commits to a single dark look: no light theme, `color-scheme: dark`.

### Tokens
```css
--silk:     #0e3532;  /* page background */
--silk-2:   #134742;  /* panels, inputs */
--silk-3:   #1b5a53;  /* focus/hover, photo placeholder gradient */
--zari:     #d8a845;  /* gold: borders, eyebrows, buttons */
--zari-soft:#efd590;  /* hover gold, highlighted text */
--jasmine:  #f6f1e4;  /* primary text */
--mist:     #a8c6bf;  /* secondary text */
--kumkum:   #d65b6e;  /* errors */
```
Body background: `--silk` with a soft radial glow of `--silk-2` at the top.

### Type (Google Fonts)
- **Display:** Bodoni Moda (400/600, italic 400/500), fallback Didot, Georgia. Used for names, h2 (italic), countdown numbers, and big values.
- **Body:** Jost 300/400/500, fallback Avenir Next, system-ui.
- **Eyebrow labels:** 0.72rem, uppercase, letter-spacing 0.32em, gold.
- **Names:** `clamp(3rem, 15vw, 4.6rem)`, italic; the "&" is upright, gold, at 0.45em.
- **h2:** `clamp(1.9rem, 7vw, 2.5rem)` italic, `text-wrap: balance`.
- Countdown numbers use `tabular-nums lining-nums`.

### Layout
- Single column, max-width 560px, 20px side gutter (16px under 420px), 56px section padding, centred text (forms left-aligned).
- **Zari border:** a 14px band made of a fine vertical-stripe gold row, top and bottom 1px gold rules, and a faint 45° diagonal weave. It bleeds to the column edges (negative side margin equal to the gutter).
- Opening card: 1px gold border plus an outer outline offset 6px (a double frame).
- Buttons: solid gold with dark text, uppercase, 0.18em tracking, 2px radius. The ghost variant is a gold outline.
- Event and RSVP-summary cards: `--silk-2` fill with a gold-tinted border. Wish cards use a 2px gold left border.
- Photo placeholders: a silk gradient with a gold-tinted border and an uppercase label ("Your photo", "Photo 3").

### Graphics (exact code)

There are no image assets apart from the couple's photos. Every decorative element below is drawn in code. Copy these verbatim.

**Zari border band** (between every section):
```css
.zari{height:14px;margin-inline:-20px;           /* = side gutter, so it bleeds edge to edge */
  background:
   repeating-linear-gradient(90deg,var(--zari) 0 2px,transparent 2px 10px) center/100% 4px no-repeat, /* stitch row */
   linear-gradient(var(--zari),var(--zari)) top/100% 1px no-repeat,                                   /* top rule */
   linear-gradient(var(--zari),var(--zari)) bottom/100% 1px no-repeat,                                /* bottom rule */
   repeating-linear-gradient(45deg,transparent 0 6px,color-mix(in srgb,var(--zari) 35%,transparent) 6px 7px); /* weave */
}
@media (max-width:420px){.zari{margin-inline:-16px}}
```
```html
<div class="zari"></div>
```

**Background glow:**
```css
body{background:var(--silk);background-image:radial-gradient(120% 60% at 50% 0%,var(--silk-2) 0%,transparent 60%)}
```

**Opening card double frame:**
```css
.gate-card{width:min(360px,100%);border:1px solid var(--zari);padding:44px 28px;
  outline:1px solid color-mix(in srgb,var(--zari) 45%,transparent);outline-offset:6px}
```

**Monogram** ("A & V"; first letters come from CONFIG):
```css
.mono{font-family:var(--display);font-size:3.2rem;font-style:italic;color:var(--zari-soft);line-height:1}
.mono span{font-style:normal;font-size:1.6rem;color:var(--zari);margin-inline:.35em;vertical-align:middle}
```
```html
<div class="mono">A<span>&amp;</span>V</div>
```

**Photo frames and placeholders:**
```css
.photo{position:relative;overflow:hidden;max-width:100%;
  background:linear-gradient(160deg,var(--silk-3),var(--silk-2));
  border:1px solid color-mix(in srgb,var(--zari) 55%,transparent)}
.photo img{width:100%;height:100%;object-fit:cover;display:block}
.photo .ph{position:absolute;inset:0;display:grid;place-items:center;color:var(--mist);
  font-size:.72rem;letter-spacing:.24em;text-transform:uppercase}
.hero .photo{aspect-ratio:4/5;width:min(340px,100%);margin:0 auto 36px;border-radius:170px 170px 4px 4px} /* arch */
.couple .photo{aspect-ratio:3/4;border-radius:2px}
.gallery .photo{aspect-ratio:1;border-radius:2px}
.gallery .photo:nth-child(3n+1){grid-column:span 2;aspect-ratio:16/10}
```

**Countdown dividers:** each unit has `border-top:1px solid var(--zari);padding-top:14px`.

**Wish cards:** `background:var(--silk-2);border-left:2px solid var(--zari);padding:18px`.

**Music icon** (SVG, stroke `currentColor`, spins while playing):
```html
<button id="music" aria-label="Play music">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    <path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>
  </svg>
</button>
```
```css
#music{position:fixed;right:16px;bottom:calc(16px + env(safe-area-inset-bottom,0px));width:48px;height:48px;border-radius:50%;
  background:var(--silk-2);border:1px solid var(--zari);color:var(--zari-soft);display:grid;place-items:center}
#music svg{width:20px;height:20px}
#music.on svg{animation:spin 6s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
```

**Still to create:** `og-thumb.jpg` (1200×630) for the WhatsApp link preview. Suggested design: the hero photo on the left, and on the right the monogram, "Ashrith & Veena" and "28 · 12 · 2026" in Bodoni Moda on `--silk`, with a zari band across the bottom.

### Motion and accessibility
- The overlay fade and the music-icon spin are the only animations. Both are disabled under `prefers-reduced-motion`.
- Visible `:focus-visible` outline (2px `--zari-soft`).
- Radio toggles are real radio inputs (visually hidden) with labels; steppers have aria-labels.
- Images use `loading="lazy"`.

---

## 8. Backend — Google Apps Script

The script is container-bound to a Google Sheet and deployed as a **Web app**: *Execute as: Me*, *Access: Anyone*.

### Sheets (auto-created with bold, frozen headers)
**RSVPs:** `Updated | Name | Phone | Attending | Adults | Children | Total | Family members | Note | ID`
**Wishes:** `Posted | Name | Wish | Hide`

### `doPost(e)`
- Uses `LockService` script lock (10s) to serialise writes.
- `type: "rsvp"`: sanitise (clip strings; ints clamped to adults ≤ 15 and children ≤ 10; guests ≤ 25 names × 60 chars). Find the row by `ID` in column 10. If found, overwrite it; otherwise append. Total is recomputed server-side.
- `type: "wish"`: require name and message, then append `[now, name, msg, ""]`.
- Returns `{ ok: true }` or `{ ok: false, error }` as JSON.

### `doGet(e)`
- `?action=wishes` returns non-hidden wishes, newest first, max 200.

### Client call
```js
fetch(endpoint, { method: "POST", body: JSON.stringify(payload) })  // no headers → text/plain, no preflight
  .then(r => r.json())
```
**Preview mode:** when `endpoint` is empty, RSVPs and wishes are saved only to localStorage (prefix `av_`) and the preview banner shows.

Redeploy note: after editing the script, use *Manage deployments → Edit → New version* so the `/exec` URL stays the same.

---

## 9. Hosting and sharing

- GitHub Pages (public repo → Settings → Pages → `main`) or Netlify Drop.
- Add Open Graph tags (`og:title`, `og:description`, `og:image` = absolute URL to `og-thumb.jpg`, 1200×630) so the WhatsApp preview shows a photo.
- Personalised links: `https://…/?to=The+Mathew+Family`.
- Compress photos to ~1600px wide and under 500KB. Keep the song under about 5MB with `preload="none"` (it loads on tap).

---

## 10. Open items (need from couple)

- [ ] Ceremony time (countdown currently 10:30 AM placeholder)
- [ ] Both sets of parents' names
- [ ] Reception or other events? (date, time, venue, map link)
- [ ] RSVP deadline (placeholder: 10 Dec 2026) and contact name/number
- [ ] Photos: 1 hero, 2 portraits, up to 6 gallery
- [ ] Song (.mp3)
- [ ] Optional: couple's story/timeline section, dress-code/colour palette section, veg/non-veg counts in RSVP

---

## 11. Acceptance checklist

- [ ] Renders well at 360–430px width with no horizontal scroll; still looks good on desktop
- [ ] Music starts on "Open invitation" and the button toggles it; no autoplay before a tap
- [ ] Countdown is correct in IST and reads 0 after the event
- [ ] RSVP: yes with 2 adults and 1 child plus names creates one sheet row with Total 3; re-submitting edits the same row
- [ ] RSVP "no" stores 0/0/0
- [ ] Wishes post, appear newest first, and hide when `x` is put in Hide
- [ ] HTML in names/messages is shown as text, not rendered
- [ ] `?to=` greeting works and is escaped
- [ ] WhatsApp link preview shows title, date and image
- [ ] Reduced-motion users get no animation