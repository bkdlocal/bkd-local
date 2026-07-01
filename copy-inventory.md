# Customer-Facing Copy Inventory

Every user-visible string in the customer-facing screens, grouped by screen in the
requested order. Strings are **verbatim** — no paraphrasing or fixes. Where copy is
templated, the literal text is shown with its `${...}` placeholders intact.

**Notation:** `→` after a verbatim template shows the rendered/plain-text result for clarity.

**Scope notes (verified in code):**
- The directory route is `/bakers` (not `/directory`); the baker-profile route is `/bakers/:id` (not `/baker/:id`).
- **`/customer/home` does not exist** — there is no such route. The customer landing screens are Profile, Orders, Messages.
- **No customer verify-email screen exists.** `GET /api/customer/verify` returns JSON only (hit via an emailed link); email delivery is stubbed (`server/email.js`) with no body/subject copy.
- **No customer forgot/reset-password screen exists.** The only set-password/forgot flow is the baker one (`renderBakerSetPassword`, `/api/auth/forgot-password`), which is out of scope.

---

## Shared site chrome (header + footer)

Rendered by `layout()` on **every** public and customer page below. `server/public-site.js`.

| # | Location | File:line | Verbatim text |
|---|---|---|---|
| 1 | Header / brand wordmark | server/public-site.js:100 | `bkd<span>.local</span>` → `bkd.local` |
| 2 | Header nav (logged-out) / link | server/public-site.js:95 | `How it works` |
| 3 | Header nav (logged-out) / link | server/public-site.js:96 | `For bakers` |
| 4 | Header nav (logged-out) / CTA | server/public-site.js:97 | `Are you a baker?` |
| 5 | Header nav (customer) / link | server/public-site.js:90 | `Messages` |
| 6 | Header nav (customer) / link | server/public-site.js:91 | `Orders` |
| 7 | Header nav (customer) / CTA | server/public-site.js:92 | `Profile` |
| 8 | Footer / copyright line | server/public-site.js:107 | `© Bkd Local · local bakers, baked to order` |
| 9 | Footer / link | server/public-site.js:108 | `Browse bakers` |
| 10 | Footer / link | server/public-site.js:108 | `For bakers` |

### Shared baker-card component (`bakerCard`, used on Homepage + Directory)

| # | Location | File:line | Verbatim text |
|---|---|---|---|
| 11 | Baker card / "taking orders" pill | server/public-site.js:66 | `Taking orders` |
| 12 | Baker card / paused pill | server/public-site.js:67 | `Currently paused` |
| 13 | Baker card / view button | server/public-site.js:77 | `View baker` |
| 14 | Baker card + profile / verified badge | server/public-site.js:37 | `✓ Verified` |
| 15 | Baker card photo / verified badge | server/public-site.js:43 | `✓ Verified` |
| 16 | Baker card + profile / founding badge | server/public-site.js:38 | `Founding Baker` |
| 17 | Baker card + profile / rating line | server/public-site.js:61 | `★ ${rating} <span class="rating-count">(${n} review${n === 1 ? '' : 's'})</span>` → e.g. `★ 4.8 (12 reviews)` |

---

## 1. Homepage — `/`

`server/public-site.js` `renderHome` + `hero` + `searchBlock`.

| # | Location | File:line | Verbatim text |
|---|---|---|---|
| 18 | Homepage / page (meta) title | server/public-site.js:202 | `Find an artisan baker near you · Bkd Local` |
| 19 | Homepage / meta description | server/public-site.js:203 | `Discover verified local bakers in ${REGION} available on your date. Cakes, cookies, macarons and more, made to order.` → REGION = `Tennessee` (line 1) |
| 20 | Homepage / hero eyebrow | server/public-site.js:146 | `${REGION.toUpperCase()}` → `WEST TENNESSEE` |
| 21 | Homepage / hero headline | server/public-site.js:147 | `Find an artisan baker <span>near you</span>` → `Find an artisan baker near you` |
| 22 | Homepage / hero subhead | server/public-site.js:148 | `Every baker is verified. Prices are upfront. Payment is protected.` |
| 23 | Homepage / search prompt | server/public-site.js:118 | `When do you need your bakes?` |
| 24 | Homepage / search mode tab | server/public-site.js:122 | `Single date` |
| 25 | Homepage / search mode tab | server/public-site.js:123 | `Date range` |
| 26 | Homepage / date single aria-label | server/public-site.js:127 | `Date you need your bakes` |
| 27 | Homepage / date range from aria-label | server/public-site.js:130 | `From date` |
| 28 | Homepage / date range separator | server/public-site.js:131 | `to` |
| 29 | Homepage / date range to aria-label | server/public-site.js:132 | `To date` |
| 30 | Homepage / search input placeholder | server/public-site.js:137 | `Filter by treat, baker name, or occasion (optional)` |
| 31 | Homepage / search input aria-label | server/public-site.js:137 | `Filter by treat, baker, or occasion` |
| 32 | Homepage / search submit button | server/public-site.js:138 | `Find bakers` |
| 33 | Homepage / featured section heading | server/public-site.js:186 | `Featured bakers` |
| 34 | Homepage / see-all link | server/public-site.js:187 | `See all →` |
| 35 | Homepage / empty state | server/public-site.js:191 | `No bakers are live just yet. Check back soon.` |
| 36 | Homepage / how-it-works heading | server/public-site.js:194 | `How it works` |
| 37 | Homepage / step 1 heading | server/public-site.js:196 | `Pick your date` |
| 38 | Homepage / step 1 body | server/public-site.js:196 | `Tell us when you need your bakes.` |
| 39 | Homepage / step 2 heading | server/public-site.js:197 | `Browse who is free` |
| 40 | Homepage / step 2 body | server/public-site.js:197 | `See verified bakers available then.` |
| 41 | Homepage / step 3 heading | server/public-site.js:198 | `Request and pick up` |
| 42 | Homepage / step 3 body | server/public-site.js:198 | `Reserve your order and grab it fresh.` |

---

## 2. Directory — `/bakers`

`server/public-site.js` `renderDirectory` (reuses `hero` compact + `bakerCard`).

| # | Location | File:line | Verbatim text |
|---|---|---|---|
| 43 | Directory / page (meta) title | server/public-site.js:257 | `Find a baker · Bkd Local` |
| 44 | Directory / meta description | server/public-site.js:258 | `Browse verified local bakers in ${REGION} by date, treat and city.` |
| 45 | Directory / "all treats" filter pill | server/public-site.js:230 | `All treats` |
| 46 | Directory / result count noun | server/public-site.js:249 | `${bakers.length} artisan baker${bakers.length === 1 ? '' : 's'}` → e.g. `7 artisan bakers` |
| 47 | Directory / result count suffix (with date) | server/public-site.js:236 | `available ${esc(dl)}` → e.g. `available June 25, 2026` |
| 48 | Directory / result count suffix (no date) | server/public-site.js:236 | `in ${esc(REGION)}` → `in Tennessee` |
| 49 | Directory / empty state (date selected) | server/public-site.js:240 | `No bakers are available ${esc(dl)}. Try another date or <a href="/bakers">clear your search</a>.` |
| 50 | Directory / empty-state link (date) | server/public-site.js:240 | `clear your search` |
| 51 | Directory / empty state (no date) | server/public-site.js:242 | `No bakers match your search. <a href="/bakers">Clear filters</a>.` |
| 52 | Directory / empty-state link (no date) | server/public-site.js:242 | `Clear filters` |

*(Hero strings #20–#32 and baker-card strings #11–#17 also render here.)*

---

## 3. Baker profile — `/bakers/:id`

`server/public-site.js` `renderProfile` + `menuSection` + `portfolioSection` + `reviewsSection`.

| # | Location | File:line | Verbatim text |
|---|---|---|---|
| 53 | Baker profile / page (meta) title | server/public-site.js:336 | `${baker.businessName} · Bkd Local` |
| 54 | Baker profile / meta description fallback | server/public-site.js:335 | `${baker.businessName}, a verified local baker${baker.city ? ` in ${shortCity(baker.city)}` : ''} on Bkd Local.` |
| 55 | Baker profile / breadcrumb | server/public-site.js:314 | `← All bakers` |
| 56 | Baker profile / location line | server/public-site.js:322,307 | `📍 ${esc(loc)}` where loc appends `Pickup available` |
| 57 | Baker profile / menu section label | server/public-site.js:276 | `Menu` |
| 58 | Baker profile / menu-item request link | server/public-site.js:273 | `Request` |
| 59 | Baker profile / portfolio section label | server/public-site.js:287 | `Portfolio` |
| 60 | Baker profile / reviews section label | server/public-site.js:301 | `Reviews` |
| 61 | Baker profile / primary action button | server/public-site.js:329 | `Request an order` |
| 62 | Baker profile / secondary action button | server/public-site.js:330 | `Message` |
| 63 | Baker profile / custom-quote prompt | server/public-site.js:332 | `Want something more intricate? <a ...>Message this baker for a custom quote.</a>` |
| 64 | Baker profile / custom-quote link text | server/public-site.js:332 | `Message this baker for a custom quote.` |

*(Badges #14/#16 and rating line #17 also render here.)*

---

## 4. `/customer/home`

**No such route exists.** No copy to inventory. (The customer entry points are Profile, Orders, Messages — see below.)

---

## 5. Customer Messages — `/customer/messages`

`server/customer-site.js` `renderCustomerMessages` + `threadListItem` + `bubble` + `custTabs`; client `public/js/customer-messages.js`.

| # | Location | File:line | Verbatim text |
|---|---|---|---|
| 65 | Customer tabs / Profile | server/customer-site.js:20 | `Profile` |
| 66 | Customer tabs / Orders | server/customer-site.js:20 | `Orders` |
| 67 | Customer tabs / Messages | server/customer-site.js:20 | `Messages` |
| 68 | Messages / page (meta) title | server/customer-site.js:321 | `Messages · Bkd Local` |
| 69 | Messages / page H1 | server/customer-site.js:312 | `Messages` |
| 70 | Messages / thread-list empty | server/customer-site.js:284 | `No conversations yet.` |
| 71 | Messages / thread preview "you" prefix | server/customer-site.js:270 | `You: ` |
| 72 | Messages / custom-quote thread tag | server/customer-site.js:274 | `Quote` |
| 73 | Messages / custom-quote banner | server/customer-site.js:299 | `This is a custom quote conversation.` |
| 74 | Messages / conversation empty (active thread) | server/customer-site.js:291 | `Say hello to start the conversation.` |
| 75 | Messages / composer placeholder | server/customer-site.js:302 | `Write a message` |
| 76 | Messages / send button | server/customer-site.js:303 | `Send` |
| 77 | Messages / no-active-thread empty | server/customer-site.js:306 | `No messages yet. <a href="/bakers">Find a baker</a> to start a conversation.` |
| 78 | Messages / no-active-thread link | server/customer-site.js:306 | `Find a baker` |
| 79 | Messages / unread-dot tooltip | server/customer-site.js:277 | `New message` |
| 80 | Messages (client) / conversation empty | public/js/customer-messages.js:28 | `Say hello to start the conversation.` |
| 81 | Messages (client) / send error fallback (alert) | public/js/customer-messages.js:54 | `Could not send.` |

---

## 6. Customer Orders (list) — `/customer/orders`

`server/customer-site.js` `renderPastOrders` + `orderRow` + `statusBadge`.

| # | Location | File:line | Verbatim text |
|---|---|---|---|
| 82 | Orders / page (meta) title | server/customer-site.js:169 | `Your orders · Bkd Local` |
| 83 | Orders / page H1 | server/customer-site.js:164 | `Your orders` |
| 84 | Orders / empty state | server/customer-site.js:167 | `No orders yet. <a href="/bakers">Find a baker</a> to place your first request.` |
| 85 | Orders / empty-state link | server/customer-site.js:167 | `Find a baker` |
| 86 | Orders / row details link | server/customer-site.js:155 | `View order details` |

### Shared status badge labels (`statusInfo`, used on Orders, Order Status, Profile mini-cards)

| # | Location | File:line | Verbatim text |
|---|---|---|---|
| 87 | Status badge / confirmed | server/customer-site.js:38 | `Confirmed` |
| 88 | Status badge / fulfilled | server/customer-site.js:39 | `Fulfilled` |
| 89 | Status badge / disputed | server/customer-site.js:40 | `Disputed` |
| 90 | Status badge / cancelled | server/customer-site.js:41 | `Cancelled` |
| 91 | Status badge / pending (default) | server/customer-site.js:42 | `Pending` |

---

## 7. Order Status — `/customer/orders/:id`

`server/customer-site.js` `renderOrderStatus` + `statusInfo` + `timeline` + `receiptBlock` + `ratingPrompt`; client `public/js/order-status.js`.

| # | Location | File:line | Verbatim text |
|---|---|---|---|
| 92 | Order status / page (meta) title | server/customer-site.js:254 | `${order.menuItem} · Bkd Local` |
| 93 | Order status / breadcrumb | server/customer-site.js:234 | `← Your orders` |
| 94 | Order status / "from baker" line | server/customer-site.js:236 | `from ${esc(order.bakerName)}` |
| 95 | Order status / status banner — confirmed | server/customer-site.js:38 | `Baker confirmed your order. Pickup details below.` |
| 96 | Order status / status banner — fulfilled | server/customer-site.js:39 | `Order complete. Rate your baker below.` |
| 97 | Order status / status banner — disputed | server/customer-site.js:40 | `You have an open dispute. We will review within 48 hours.` |
| 98 | Order status / status banner — cancelled | server/customer-site.js:41 | `This order was cancelled.` |
| 99 | Order status / status banner — pending (default) | server/customer-site.js:42 | `Your request was sent. Waiting for baker to confirm.` |
| 100 | Order status / timeline step | server/customer-site.js:178 | `Request sent` |
| 101 | Order status / timeline step | server/customer-site.js:178 | `Confirmed` |
| 102 | Order status / timeline step | server/customer-site.js:178 | `Complete` |
| 103 | Order status / pickup section heading | server/customer-site.js:226,229 | `Pickup details` |
| 104 | Order status / pickup date label | server/customer-site.js:227 | `Date:` |
| 105 | Order status / pickup address label | server/customer-site.js:228 | `Address:` |
| 106 | Order status / pickup address fallback | server/customer-site.js:228 | `Ask your baker for the exact spot.` |
| 107 | Order status / pickup not-yet-confirmed | server/customer-site.js:230 | `The pickup address will appear here once ${esc((baker && baker.businessName) || 'your baker')} confirms your order.` |
| 108 | Order status / pickup baker fallback name | server/customer-site.js:230 | `your baker` |
| 109 | Order status / order summary heading | server/customer-site.js:243 | `Order summary` |
| 110 | Order status / receipt — subtotal | server/customer-site.js:194 | `Subtotal` |
| 111 | Order status / receipt — service fee | server/customer-site.js:195 | `Service fee` |
| 112 | Order status / receipt — total | server/customer-site.js:196 | `Total` |
| 113 | Order status / rating (already rated) heading | server/customer-site.js:202 | `Your rating` |
| 114 | Order status / rating (already rated) note | server/customer-site.js:205 | `Thanks for rating. Ratings cannot be changed once submitted.` |
| 115 | Order status / rating (window closed) heading | server/customer-site.js:208 | `Rate your baker` |
| 116 | Order status / rating (window closed) note | server/customer-site.js:209 | `The rating window for this order has closed.` |
| 117 | Order status / rating (active) heading | server/customer-site.js:211 | `Rate your baker` |
| 118 | Order status / rating (active) prompt | server/customer-site.js:212 | `How was your order? You can only rate once, so make it count.` |
| 119 | Order status / star button aria-label | server/customer-site.js:214 | `${n} stars` → e.g. `3 stars` |
| 120 | Order status / review textarea placeholder | server/customer-site.js:216 | `Add a few words about your order (optional)` |
| 121 | Order status / submit rating button | server/customer-site.js:217 | `Submit rating` |
| 122 | Order status / back-to-orders button | server/customer-site.js:248 | `Back to orders` |
| 123 | Order status / order-again button | server/customer-site.js:249 | `Order again` |
| 124 | Order status (client) / submit in-progress | public/js/order-status.js:20 | `Submitting...` |
| 125 | Order status (client) / post-submit heading | public/js/order-status.js:30 | `Your rating` |
| 126 | Order status (client) / post-submit note | public/js/order-status.js:32 | `Thanks for rating. Ratings cannot be changed once submitted.` |
| 127 | Order status (client) / submit error fallback | public/js/order-status.js:28 | `Could not submit rating.` |
| 128 | Order status (client) / submit button reset | public/js/order-status.js:33 | `Submit rating` |

---

## 8. Customer Profile — `/customer/profile`

`server/customer-site.js` `renderCustomerProfile` + `avatarBlock` + `occasionChips` + `compactOrderCard` + `custTabs`; client `public/js/customer-profile.js`.

| # | Location | File:line | Verbatim text |
|---|---|---|---|
| 129 | Profile / page (meta) title | server/customer-site.js:133 | `Your profile · Bkd Local` |
| 130 | Profile / avatar edit affordance | server/customer-site.js:65 | `Edit` |
| 131 | Profile / avatar image alt | server/customer-site.js:61 | `Your photo` |
| 132 | Profile / first-name label | server/customer-site.js:102 | `First name` |
| 133 | Profile / first-name placeholder | server/customer-site.js:102 | `First name` |
| 134 | Profile / last-name label | server/customer-site.js:103 | `Last name` |
| 135 | Profile / last-name placeholder | server/customer-site.js:103 | `Last name` |
| 136 | Profile / city label | server/customer-site.js:105 | `City` |
| 137 | Profile / city placeholder | server/customer-site.js:105 | `City` |
| 138 | Profile / state label | server/customer-site.js:107 | `State` |
| 139 | Profile / state placeholder | server/customer-site.js:107 | `State` |
| 140 | Profile / zip label | server/customer-site.js:108 | `Zip code` |
| 141 | Profile / zip placeholder | server/customer-site.js:108 | `Zip code` |
| 142 | Profile / email label | server/customer-site.js:110 | `Email` |
| 143 | Profile / occasion-tags label | server/customer-site.js:112 | `What I usually order for` |
| 144 | Profile / occasion choice | server/customer-site.js:4 | `Birthday` |
| 145 | Profile / occasion choice | server/customer-site.js:4 | `Wedding` |
| 146 | Profile / occasion choice | server/customer-site.js:4 | `Baby Shower` |
| 147 | Profile / occasion choice | server/customer-site.js:4 | `Holiday` |
| 148 | Profile / occasion choice | server/customer-site.js:4 | `Corporate` |
| 149 | Profile / occasion choice | server/customer-site.js:4 | `Graduation` |
| 150 | Profile / occasion choice | server/customer-site.js:4 | `Just Because` |
| 151 | Profile / occasion choice | server/customer-site.js:4 | `Other` |
| 152 | Profile / save button | server/customer-site.js:115 | `Save changes` |
| 153 | Profile / save-state indicator | server/customer-site.js:116 | `Saved` |
| 154 | Profile / baker-rating heading | server/customer-site.js:121 | `Your baker rating` |
| 155 | Profile / rating empty state | server/customer-site.js:92 | `No ratings yet. After your first order, bakers can rate you.` |
| 156 | Profile / rating privacy note | server/customer-site.js:123 | `Bakers can see this when they review your order requests. It is private and never shown on your public profile or the directory.` |
| 157 | Profile / recent-orders heading | server/customer-site.js:127 | `Recent orders` |
| 158 | Profile / recent-orders see-all link | server/customer-site.js:127 | `See all →` |
| 159 | Profile / recent-orders empty state | server/customer-site.js:128 | `No orders yet. <a href="/bakers">Find a baker</a> to get started.` |
| 160 | Profile / recent-orders empty link | server/customer-site.js:128 | `Find a baker` |
| 161 | Profile (client) / photo upload error fallback | public/js/customer-profile.js:15 | `Upload failed.` |
| 162 | Profile (client) / image alt on upload | public/js/customer-profile.js:17 | `Your photo` |
| 163 | Profile (client) / save error fallback | public/js/customer-profile.js:43 | `Could not save.` |
| 164 | Profile (client) / save-state text | public/js/customer-profile.js:44 | `Saved` |

---

## 9. Order Request Flow — `/order/new`

`server/order-flow.js` `renderOrderFlow` + `addonRow`; client `public/js/order.js`.

| # | Location | File:line | Verbatim text |
|---|---|---|---|
| 165 | Order flow / page (meta) title | server/order-flow.js:105 | `Request from ${baker.businessName} · Bkd Local` |
| 166 | Order flow / meta description | server/order-flow.js:106 | `Send an order request to ${baker.businessName} on Bkd Local.` |
| 167 | Order flow / breadcrumb | server/order-flow.js:39 | `← Back to ${esc(baker.businessName)}` |
| 168 | Order flow / step 1 H1 | server/order-flow.js:47 | `${esc(item.name)}` (menu item name) |
| 169 | Order flow / step 1 price line | server/order-flow.js:48 | `$${Number(item.price).toFixed(2)} ${soldPerLabel}` where soldPerLabel = `per ${esc(item.soldPer)}` (line 27) |
| 170 | Order flow / quantity label | server/order-flow.js:50 | `How many ${esc(qtyUnit)}${item.soldPer ? 's' : '(s)'}?` → e.g. `How many cookies?` / `How many order(s)?` |
| 171 | Order flow / quantity stepper "fewer" aria-label | server/order-flow.js:52 | `Fewer` |
| 172 | Order flow / quantity stepper "more" aria-label | server/order-flow.js:54 | `More` |
| 173 | Order flow / pickup-date label | server/order-flow.js:58 | `When would you like to pick up?` |
| 174 | Order flow / no-dates message | server/order-flow.js:31 | `This baker has no open pickup dates right now. Please check back soon.` |
| 175 | Order flow / step 1 continue button | server/order-flow.js:62 | `Continue` |
| 176 | Order flow / step 2 heading | server/order-flow.js:67 | `Add a little extra` |
| 177 | Order flow / step 2 subhead | server/order-flow.js:68 | `Customize ${esc(item.name)} with optional add-ons.` |
| 178 | Order flow / no-add-ons message | server/order-flow.js:35 | `No add-ons available for this item.` |
| 179 | Order flow / add-on price meta (per cookie) | server/order-flow.js:12 | `$${a.price.toFixed(2)} per cookie` |
| 180 | Order flow / add-on stepper "fewer" aria-label | server/order-flow.js:15 | `Fewer` |
| 181 | Order flow / add-on stepper "more" aria-label | server/order-flow.js:16 | `More` |
| 182 | Order flow / add-on price meta (per set) | server/order-flow.js:21 | `$${a.price.toFixed(2)} per set` |
| 183 | Order flow / running total label | server/order-flow.js:70 | `Total so far` |
| 184 | Order flow / step 2 back button | server/order-flow.js:72 | `Back` |
| 185 | Order flow / step 2 review button | server/order-flow.js:73 | `Review` |
| 186 | Order flow / step 3 heading | server/order-flow.js:78 | `Review your request` |
| 187 | Order flow / notes label | server/order-flow.js:81 | `Any details for your baker? (optional)` |
| 188 | Order flow / notes placeholder | server/order-flow.js:82 | `Colors, theme, flavors, allergies, pickup time...` |
| 189 | Order flow / payment note | server/order-flow.js:84 | `No payment is collected now. This sends your request; ${esc(baker.businessName)} will confirm and arrange payment with you.` |
| 190 | Order flow / step 3 back button | server/order-flow.js:86 | `Back` |
| 191 | Order flow / step 3 submit button | server/order-flow.js:87 | `Send request` |
| 192 | Order flow / done emoji | server/order-flow.js:94 | `🎉` |
| 193 | Order flow / done heading | server/order-flow.js:95 | `Request sent!` |
| 194 | Order flow / done body | server/order-flow.js:96 | `Your request has gone to ${esc(baker.businessName)}. They will confirm and reach out with pickup and payment details.` |
| 195 | Order flow / done CTA | server/order-flow.js:97 | `Browse more bakers` |
| 196 | Order flow (client) / summary pickup row label | public/js/order.js:47 | `Pickup` |
| 197 | Order flow (client) / summary pickup empty value | public/js/order.js:47 | `—` |
| 198 | Order flow (client) / summary subtotal label | public/js/order.js:49 | `Subtotal` |
| 199 | Order flow (client) / summary service-fee label | public/js/order.js:50 | `Service fee` |
| 200 | Order flow (client) / summary total label | public/js/order.js:51 | `Total` |
| 201 | Order flow (client) / submit in-progress | public/js/order.js:79 | `Sending...` |
| 202 | Order flow (client) / submit error fallback | public/js/order.js:84 | `Could not send request.` |
| 203 | Order flow (client) / submit button reset | public/js/order.js:85 | `Send request` |

### Order-request server-side error messages (surfaced in `#orderError` / toast)

| # | Location | File:line | Verbatim text |
|---|---|---|---|
| 204 | Order request / account not found | server.js:1246 | `Account not found.` |
| 205 | Order request / baker not found | server.js:1250 | `Baker not found.` |
| 206 | Order request / item not found | server.js:1252 | `Item not found.` |
| 207 | Order request / invalid pickup date | server.js:1258 | `Please choose an available pickup date.` |

---

## 10. Customer Auth

### 10a. Sign up — `/signup` & Log in — `/login`

`server/order-flow.js` `renderAuth`; client `public/js/auth.js`.

| # | Location | File:line | Verbatim text |
|---|---|---|---|
| 208 | Auth / page (meta) title | server/order-flow.js:139 | `${isSignup ? 'Sign up' : 'Log in'} · Bkd Local` |
| 209 | Auth / heading (signup) | server/order-flow.js:120 | `Create your account` |
| 210 | Auth / heading (login) | server/order-flow.js:120 | `Welcome back` |
| 211 | Auth / subhead (signup) | server/order-flow.js:121 | `Sign up to send order requests to local bakers.` |
| 212 | Auth / subhead (login) | server/order-flow.js:121 | `Log in to continue your order request.` |
| 213 | Auth / first-name label (signup) | server/order-flow.js:115 | `First name` |
| 214 | Auth / last-name label (signup) | server/order-flow.js:116 | `Last name` |
| 215 | Auth / email label | server/order-flow.js:124 | `Email` |
| 216 | Auth / password label | server/order-flow.js:125 | `Password` |
| 217 | Auth / submit button (signup) | server/order-flow.js:126 | `Create account` |
| 218 | Auth / submit button (login) | server/order-flow.js:126 | `Log in` |
| 219 | Auth / switch line (signup) | server/order-flow.js:132 | `Already have an account? <a ...>Log in</a>` |
| 220 | Auth / switch link (signup) | server/order-flow.js:132 | `Log in` |
| 221 | Auth / switch line (login) | server/order-flow.js:133 | `New here? <a ...>Create an account</a>` |
| 222 | Auth / switch link (login) | server/order-flow.js:133 | `Create an account` |
| 223 | Auth (client) / login error fallback | public/js/auth.js:22 | `Could not log in.` |
| 224 | Auth (client) / signup success note | public/js/auth.js:26 | `Account created. Check your email for a verification link, then <a href="...">log in</a>.` |
| 225 | Auth (client) / signup success note link | public/js/auth.js:26 | `log in` |
| 226 | Auth (client) / signup error fallback | public/js/auth.js:29 | `Could not create account.` |

### Auth server-side messages (surfaced in `#authError` / `#authNote`)

| # | Location | File:line | Verbatim text |
|---|---|---|---|
| 227 | Signup / invalid email | server.js:733 | `A valid email is required.` |
| 228 | Signup / password too short | server.js:734 | `Password must be at least 8 characters.` |
| 229 | Signup / first name required | server.js:735 | `First name is required.` |
| 230 | Signup / email already exists | server.js:738 | `An account with that email already exists.` |
| 231 | Login / missing fields | server.js:761 | `Email and password are required.` |
| 232 | Login / bad credentials | server.js:764 | `Incorrect email or password.` |
| 233 | Login / email not verified | server.js:767 | `Please verify your email before logging in. Check your inbox for the verification link.` |
| 234 | Customer API / not authenticated | server.js:130 | `Not logged in.` |
| 235 | Customer API / account not found | server.js:782 | `Account not found.` |
| 236 | Resend verification / email required | server.js:809 | `Email is required.` |

### 10b. Verify email

**No rendered screen.** `GET /api/customer/verify` returns JSON only (reached via emailed link). The strings below are the JSON `error` messages it returns; they are only surfaced if a client renders them (no in-app page currently does).

| # | Location | File:line | Verbatim text |
|---|---|---|---|
| 237 | Verify / missing token | server.js:790 | `Missing verification token.` |
| 238 | Verify / invalid or used link | server.js:792 | `Invalid or already-used verification link.` |
| 239 | Verify / expired link | server.js:795 | `Verification link has expired. Please request a new one.` |

*Verification email body/subject: none — delivery is stubbed in `server/email.js` (console log only, no customer-facing copy).*

### 10c. Forgot / reset password (customer)

**No customer-facing screen or copy exists.** The only set-password/forgot flow is the baker one (`renderBakerSetPassword` in `server/order-flow.js:145`, `/api/auth/forgot-password` in `server.js:318`), which is out of scope (baker app).

---

## Shared — other customer-facing server error/validation messages

These belong to customer screens above (Profile, Messages, Order Status) and surface as `alert()` / inline errors.

| # | Location | File:line | Verbatim text |
|---|---|---|---|
| 240 | Profile photo / not configured | server.js:1417 | `Photo uploads are not configured.` |
| 241 | Profile photo / no file | server.js:1418 | `No photo uploaded.` |
| 242 | Profile photo / account not found | server.js:1420 | `Account not found.` |
| 243 | Profile patch / account not found | server.js:1398 | `Account not found.` |
| 244 | Rate order / order not found | server.js:1502 | `Order not found.` |
| 245 | Rate order / not yet complete | server.js:1503 | `You can rate once the order is complete.` |
| 246 | Rate order / window closed | server.js:1505 | `The rating window for this order has closed.` |
| 247 | Rate order / already rated | server.js:1507 | `You already rated this order.` |
| 248 | Rate order / invalid stars | server.js:1509 | `Please choose 1 to 5 stars.` |
| 249 | Messages send / empty | server.js:1723 | `Message cannot be empty.` |
| 250 | Messages send / no baker resolved | server.js:1735 | `Could not determine the baker for this message.` |

---

## Shared — "Not found" page

`server/public-site.js` `renderNotFound` — served for missing baker profile, missing menu item in `/order/new`, and missing/owned-by-other order detail.

| # | Location | File:line | Verbatim text |
|---|---|---|---|
| 251 | Not found / page (meta) title | server/public-site.js:341 | `Not found · Bkd Local` |
| 252 | Not found / heading | server/public-site.js:344 | `Baker not found` |
| 253 | Not found / body | server/public-site.js:345 | `This baker isn't available right now.` |
| 254 | Not found / CTA button | server/public-site.js:346 | `Browse all bakers` |

---

**Total strings inventoried: 254.**
