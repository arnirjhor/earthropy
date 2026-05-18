# Screen Reader Testing Script — Earthropy

Manual testing guide for VoiceOver (macOS) and NVDA (Windows). Run after any significant UI change.

---

## Setup

### VoiceOver (macOS)
- Enable: `Cmd+F5` or System Settings → Accessibility → VoiceOver
- Key modifier: `VO` = `Ctrl+Option`
- Navigate landmarks: `VO+U` opens the rotor; use arrow keys to select "Landmarks" or "Headings"
- Next landmark: `VO+Shift+Right`
- Next heading: `VO+Cmd+H`
- Next interactive element: `Tab`
- Click/activate: `VO+Space`
- Read from here: `VO+A`

### NVDA (Windows)
- Download: https://www.nvaccess.org/
- Key modifier: `NVDA` key (usually `Insert`)
- Navigate landmarks: `D` key (next landmark), `Shift+D` (previous)
- Next heading: `H` key
- Next interactive: `Tab`
- Activate: `Enter` or `Space`
- Read from cursor: `NVDA+Down`

---

## Test Flow

### 1. Landing page (`/en`)

**VoiceOver steps:**
1. Open `http://localhost:3001/en` in Safari (VoiceOver works best with Safari).
2. Press `VO+U` and navigate to Landmarks. Confirm you see: `banner`, `navigation` (SDG color bar), `main`.
3. Press `Tab` — first focus should land on the **Skip to main content** link. Press `Return` — focus must jump to `#main-content`.
4. Press `VO+Cmd+H` repeatedly to walk headings. Confirm logical H1 → H2 → H3 hierarchy with no skipped levels.
5. Navigate to the SDG color bar navigation. Confirm each SDG chip announces as "Sustainable Development Goal N: [Name], link".
6. Confirm any CTA buttons have descriptive labels (not just "Learn more").

**Expected announcements:**
- Skip link: "Skip to main content, link"
- Nav: "SDG navigator, navigation"
- Each SDG chip: "Sustainable Development Goal 1: No Poverty, link"

**NVDA notes:** Same behavior; use `D` to move between landmarks. NVDA reads `aria-label` on `<nav>` as the landmark name.

---

### 2. Sign-up (`/en/signup`)

**VoiceOver steps:**
1. Navigate to `http://localhost:3000/en/signup`.
2. Press `Tab` to walk form fields. Each field must announce its label before the input type.
3. Submit the form with an empty email. Confirm the error announces via `role="alert"` without needing to navigate back to it.
4. Confirm password field announces "Password, secure text field".
5. After successful sign-up, confirm any success/redirect feedback is announced.

**Expected announcements:**
- "Email, text field" (or similar)
- On error: "Please enter a valid email address, alert"
- `aria-invalid="true"` fields: "[field name], invalid data, text field"
- `aria-describedby` on input causes VoiceOver to read hint text after the field label.

**NVDA notes:** Errors with `role="alert"` are announced immediately when inserted into the DOM. NVDA does not auto-read `aria-describedby` hint text in Browse mode — user must navigate to the hint element separately.

---

### 3. Sign-in (`/en/signin`)

**VoiceOver steps:**
1. Navigate to `http://localhost:3000/en/signin`.
2. `Tab` through email and password fields. Confirm labels.
3. Submit with wrong credentials. Error banner must be announced.
4. Successful sign-in redirects to dashboard.

**Expected announcements:**
- "Invalid credentials, alert" (or localized equivalent) on failure.

---

### 4. Dashboard (`/en/dashboard`)

**VoiceOver steps:**
1. After signing in, land on dashboard.
2. Press `VO+U` → Landmarks. Confirm: `main` ("main"), `complementary` ("Sidebar"), two `region`s ("Your groups", "Your feed" or labeled by `aria-labelledby`).
3. Press `Tab` — first focus: skip link. `Return` → jumps to `#main-content`.
4. In the SDG rail, navigate to each SDG toggle button. Confirm:
   - Unfollowed: "SDG 1: No Poverty, toggle button, off"
   - Followed: "SDG 1: No Poverty (following), toggle button, on"
5. Activate (toggle) an SDG. After page reload, confirm the button state reflects the new follow status.
6. In Your groups rail, confirm each AtlasCard link announces the group name.
7. In feed, confirm each article's link announces the post title.
8. If feed is empty, confirm the empty-state paragraph and the two CTA links are reachable.

**Expected announcements:**
- `aria-pressed="true"` button: "SDG 3: Good Health and Well-being (following), toggle button, on"
- Feed article link: "[Post title], link"
- Feed timestamp `<time>`: "3h ago" (relative time is fine; no special announcement needed)

**NVDA notes:** `aria-pressed` on a `<button>` announces as "pressed" / "not pressed" in NVDA. Behavior matches VoiceOver.

---

### 5. SDG Hub (`/en/sdg/sdg-1`)

**VoiceOver steps:**
1. Navigate to `http://localhost:3000/en/sdg/sdg-1`.
2. Confirm the H1 announces the SDG name ("No Poverty").
3. Confirm the goal number (`<span aria-label="Goal 1">`) announces as "Goal 1", not "1".
4. Confirm the color stripe has `aria-hidden="true"` and is not announced.
5. Tab to the UN Indicators external link. Confirm it announces as a link and that it opens in a new tab (VoiceOver does not auto-announce this — users should rely on the surrounding text context or an `(opens in new tab)` sr-only note if desired).
6. If authenticated, confirm Follow/Unfollow button has a clear label.
7. In the Groups section, confirm each AtlasCard link announces the group name.
8. In Recent Posts, confirm each post announces title and relative time.

**Expected announcements:**
- Goal number: "Goal 1"
- Color stripe: (silence — aria-hidden)
- Follow button: "Follow, button"
- Unfollow button: "Unfollow, button"

---

### 6. Group page (`/en/g/[slug]`)

**VoiceOver steps:**
1. Navigate to a group page.
2. Confirm H1 is the group name.
3. Tab to Join / Leave button. Confirm label includes the group name: "Join [Group Name], button" / "Leave [Group Name], button".
4. Navigate to the posts list. Confirm each post article announces the title.
5. Navigate to the New Post button/link. Confirm it announces clearly.

**Expected announcements:**
- Join button: "Join Climate Action Berlin, button"
- Leave button: "Leave Climate Action Berlin, button"

---

### 7. Create group (`/en/g/new`)

**VoiceOver steps:**
1. Navigate to `http://localhost:3000/en/g/new`.
2. `Tab` through all form fields: Name, Description, SDG selector, Visibility.
3. For the SDG multi-select fieldset, confirm the legend ("Sustainable Development Goals") is announced, then each SDG chip is a labeled checkbox.
4. Submit with invalid data. Confirm field-level errors announce without navigation.

**Expected announcements:**
- SDG fieldset: "Sustainable Development Goals, group"
- Each SDG checkbox: "SDG 1: No Poverty, checkbox, unchecked"
- SDG hint text: read after fieldset legend via `aria-describedby`

---

### 8. Create post (`/en/g/[slug]/post/new`)

**VoiceOver steps:**
1. Navigate to the new post form within a group.
2. Confirm the write/preview tab widget:
   - Tab to "Write" button. Confirm: "Write, tab, selected, 1 of 2"
   - Tab to "Preview" button. Confirm: "Preview, tab, not selected, 2 of 2"
3. Activate "Preview" tab. Confirm the tab panel switches and "Preview, tab, selected, 2 of 2" is announced.
4. Confirm the "Editor mode, tablist" grouping is announced when entering the tab widget.
5. Navigate to SDG section. Confirm `aria-labelledby` connects the label "Sustainable Development Goals" to the SDG checkboxes.
6. Submit without required fields. Confirm inline errors announce.

**Expected announcements:**
- Tab button: "Write, tab, selected, 1 of 2"
- After switching: "Preview, tab, selected, 2 of 2"
- SDG checkboxes: "SDG 7: Affordable and Clean Energy, checkbox, unchecked"

**NVDA notes:** NVDA reads `role="tab"` buttons as "tab" and `aria-selected="true"` as "selected". Tab order within `role="tablist"` should use arrow keys in ARIA spec — currently the form uses `Tab` key for both tabs, which is acceptable in a simple 2-tab widget but deviates from the ARIA authoring guide. Monitor if users report confusion.

---

### 9. Post detail (`/en/g/[slug]/p/[id]`)

**VoiceOver steps:**
1. Navigate to a published post.
2. Confirm H1 is the post title.
3. Confirm breadcrumb link (group slug) is before the H1.
4. Confirm SDG chips each announce "SDG N: [Name]".
5. If post is pending/rejected, confirm the status banner (`<output>`) is read.
6. Confirm comment thread is navigable: each comment, reply button reachable by `Tab`.
7. If author: confirm Withdraw button is labeled.

**Expected announcements:**
- Status banner (`<output>`): "This post is pending AI review" (VoiceOver reads `<output>` as a live region)
- SDG chip: "SDG 13: Climate Action"
- Withdraw button: "Withdraw, button"

**NVDA notes:** NVDA reads `<output>` as an `aria-live="polite"` region. When the page loads with an `<output>` already populated, NVDA may not announce it on page load — user should navigate to it manually if needed.

---

### 10. Notifications page (`/en/notifications`)

**VoiceOver steps:**
1. Navigate to `http://localhost:3000/en/notifications`.
2. Confirm H1 ("Notifications") is announced.
3. If unread items exist, confirm "Mark all as read, button" is reachable and labeled.
4. Navigate the notifications list. Each item should announce the kind label and timestamp.
5. Unread items have a visual dot indicator — confirm `aria-hidden="true"` is on the dot so it's not announced as a stray element.

**Expected announcements:**
- Mark all button: "Mark all as read, button"
- Unread dot: (silence — aria-hidden)
- Notification item: "Post published, [timestamp]"

---

### 11. Account settings (`/en/account`)

**VoiceOver steps:**
1. Navigate to `http://localhost:3000/en/account`.
2. Confirm the Account nav announces as "Account, navigation".
3. In Profile tab:
   - Display name and handle fields have labels.
   - After saving, confirm the success message announces via `<output>` or `role="status" aria-live="polite"`.
4. In Notifications tab:
   - Navigate the preferences table. Confirm: "Notification channel preferences, table" and column headers announce with `scope="col"`.
   - Each toggle/checkbox announces the row label.
5. In Sessions tab:
   - Confirm sessions list announces as "Active sessions, list".
   - Each session item announces device/session info.

**Expected announcements:**
- Display name save: "Saved" (via `<output>` live region)
- Table: "Notification channel preferences, table"
- Table header: "Notification, column header" then "In-app, column header" etc.

**NVDA notes:** NVDA reads table headers with `scope="col"` correctly. Without `scope`, NVDA may not associate headers with cells. `<output>` is treated as `aria-live="polite"` by NVDA, so success messages are announced after a short delay.

---

### 12. Moderation queue (`/en/moderation`)

**VoiceOver steps:**
1. Navigate to `http://localhost:3000/en/moderation` (moderator account required).
2. Confirm H1 ("Moderation queue").
3. Navigate to queue items. Each should announce post title and status.
4. Tab to Publish / Reject / Hold buttons. Confirm each has a descriptive `aria-label` including the post title.
5. Navigate to the transparency log link if present.

**Expected announcements:**
- Publish button: "Publish [Post Title], button"
- Reject button: "Reject [Post Title], button"

---

### 13. Appeals queue (`/en/moderation/appeals`)

**VoiceOver steps:**
1. Navigate to `http://localhost:3000/en/moderation/appeals`.
2. Each appeal item should announce the post title and appeal reason.
3. Approve / Reject buttons should have descriptive `aria-label` with the post/appeal context.

---

## RTL Languages (Arabic, Hebrew)

1. Switch locale to `ar` (e.g., `http://localhost:3000/ar/dashboard`).
2. Confirm `dir="rtl"` is on `<html>`.
3. Confirm `dir="auto"` on `<main>` elements allows per-content direction.
4. VoiceOver on macOS respects RTL — confirm reading order matches visual left-to-right layout mirroring.
5. The skip link uses `focus:start-2` (logical property) — confirm it appears at the correct edge in RTL.

---

## Regression Checklist

After any UI change, verify these do not regress:

- [ ] Skip to main content link appears on first Tab keypress
- [ ] `id="main-content"` present on every `<main>` element
- [ ] No orphan `<button>` without accessible name (check with `VO+U` → Buttons rotor)
- [ ] No heading level skipped (VO+U → Headings rotor)
- [ ] Live regions (`role="alert"`, `role="status"`, `<output>`) announce dynamic changes
- [ ] SDG toggle buttons announce `aria-pressed` state
- [ ] Tab widget: `role="tablist"`, `role="tab"`, `aria-selected`, `role="tabpanel"`, `aria-labelledby`
- [ ] Data tables have `<th scope="col|row">` headers
- [ ] All context-dependent buttons have `aria-label` (Join/Leave, Promote/Demote, etc.)

---

## Known Limitations

- **Relative timestamps** (`3h ago`, `2d ago`) are not announced with a machine-readable `<time>` equivalent. The `<time datetime="...">` element is present for semantic correctness, but screen readers read the visible text. This is acceptable for v0.1.
- **Tab widget arrow-key navigation**: The write/preview tabs use `Tab` to switch rather than arrow keys (ARIA authoring guide recommends arrow keys within a `role="tablist"`). This is a known deviation; it works but may confuse advanced AT users.
- **Toast/snackbar notifications**: Not implemented yet. When added, they must use `aria-live="assertive"` for errors and `aria-live="polite"` for confirmations.
- **Image alt text**: No user-uploaded images exist in v0.1. When added (group avatars, post images), ensure `alt` text or `aria-hidden="true"` for decorative images.
