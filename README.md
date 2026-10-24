# Yuki RO · Boss Timers

An independent GitHub Pages copy of the Yuki pixel boss timer. It retains the approved eighteen boss portraits, four-pose character actions, twelve header residents, Hong Kong morning/afternoon/night scenery, compact layout and countdown rules.

The original hosted app is a separate application. This repository contains no original Site identity, runtime credentials, live database, notification subscriptions or dispatcher configuration.

The saved custom bosses 暗·逐影, 亡靈巫師 and 殭屍龍 use three articulated pixel characters with four distinct action poses each in `ro-pixel-motion-f.png`, selected through the art-only `portraitMotion` resolver and the same animation renderer as the eighteen catalog bosses. This is posed character animation, not movement of a still icon. The unchanged native reference portraits remain available through `portraitIcon` for reference/fallback. No default boss records, stored IDs, timers or metadata change. Asset sources are recorded in `public/art/boss-icons/README.md`.

## Architecture

- GitHub Pages serves the static React interface at `https://yukikiie.github.io/yuki-ro-boss-timers/`.
- A separate Cloudflare Worker and D1 database store one shared roster and send Web Push notifications.
- This deployment explicitly enables `PUBLIC_TIMERS="true"`: open the GitHub address without a connection code. Anyone who can reach the site or API can read, add, change or remove the shared timers. There are no separate private timers per visitor.
- A Cloudflare cron invokes the durable reminder dispatcher every minute. The browser, ChatGPT and the Windows PC do not need to remain open. Delivery can still be delayed by the network, device settings and push gateways; exact-second delivery is not guaranteed.
- The two websites have independent timers and notification registrations. Updating this repository does not deploy or overwrite the original website.

## Public access and privacy

Public access is intentional and applies only to this GitHub copy. Treat the roster, boss names and recent notification history as public; do not enter private information. A link is not a password. Another visitor's timer changes affect the same roster and reminders on every subscribed device, including the owner's phone. The browser origin allowlist limits browser access but does not prevent direct API clients from using this public service.

Push subscription endpoints and device encryption keys remain in Cloudflare storage and are never listed by the API. Device status, test and removal require the particular subscription endpoint; they do not accept a public list index or device identifier. The Web Push public key is intentionally available to browsers, while the VAPID private key and other runtime secrets remain server-side. No HTTP route invokes the reminder dispatcher.

This is a small shared tool, not an abuse-resistant public service: anyone may consume the shared eight-device subscription limit or repeatedly change timers. Disabling notifications on one device does not prevent other visitors from using the shared roster. The existing Windows-encrypted setup backup remains private and ignored by Git; it is not published or needed to open the public site.

The backend enables public access only for the exact string `PUBLIC_TIMERS="true"`. Missing, false or malformed values retain the private bearer-key checks and fail closed without a valid private configuration. The current public frontend has no code-entry screen; returning to private access also requires restoring a compatible authenticated frontend. The original hosted website remains unchanged.

## First deployment

1. Install Node 22.13 or later and run `npm ci`.
2. Sign into the intended Cloudflare account with `npx wrangler login`.
3. Create a new database: `npx wrangler d1 create yuki-ro-boss-timers --config worker/wrangler.jsonc`.
4. Replace the database placeholder in `worker/wrangler.jsonc` with that exact returned database ID. Do not use an existing app's database.
5. Run `npm run worker:migrate`.
6. Generate an independent Web Push VAPID key pair. Set `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` with Wrangler's secret commands; never put the private key in source files, GitHub Pages settings or frontend environment variables. Deliberately set the Worker variable `PUBLIC_TIMERS` to the exact string `"true"` only if everyone may read and edit this shared roster. Public mode does not require an owner connection code. Keep any existing private setup backup ignored and unpublished.
7. Run `npm run worker:deploy`. Set `public/config.json`'s `apiOrigin` to the exact HTTPS Worker origin returned by deployment.
8. Run `npm test`, `npm run typecheck` and `npm run build`.
9. Push the source to `main`. In repository Settings → Pages, select GitHub Actions. The included workflow tests and publishes only the static `dist/` directory.

The configured origin allowlist is exactly `https://yukikiie.github.io`; the application URL includes its project path. Public mode does not require a bearer header. The backend's default private mode still requires authentication even when the origin is allowed. There is no HTTP dispatch endpoint or public route listing subscriptions or private keys.

## Connect a device and test notifications

Open the GitHub Pages address directly; there is no sign-in or connection code. Publish only trusted applications under this GitHub account: GitHub Pages projects on the same account share a browser origin and therefore the origin's browser-storage trust boundary.

On iPhone, open the GitHub address in Safari, choose Share → Add to Home Screen, then open that new icon. Enable notifications from the app's notification screen. Permission and subscriptions from the original website cannot transfer to this different origin. Each visitor must grant notification permission on their own device; opening the link alone does not subscribe it. All subscribed devices receive reminders for the same public roster.

Send a test notification and verify that it actually appears on the phone, including while locked. Gateway acceptance alone is not proof of display. Focus modes, notification settings, battery/network conditions and operating-system policies can delay or suppress delivery. Wait for the backend status to report its first successful scheduled dispatch before relying on closed-app reminders; Cron Trigger changes can take several minutes to propagate.

## Timer behavior

Each MVP uses three hours after a confirmed kill; each Mini uses two hours. Manual countdowns are independent. Active countdowns appear first, ordered globally by earliest respawn time; untimed and invalid countdowns follow. Equal times and untimed bosses retain MVP-before-Mini ordering, then favorites, then original order. These are user-supplied game rules, not verified game-server observations.

Every boss card exposes a pink `剛被擊殺` button alongside the separate manual `設定倒數` control. Confirming an actual kill restarts that boss from the server's current time using its configured duration: MVP three hours or Mini two hours. Repeated kills need no time entry. Cancelling the confirmation leaves timers unchanged; countdown expiry never implies a new kill. Both controls remain disabled during the daily rest period.

At 03:00–05:00 Hong Kong time, countdowns are cleared and alerts are suppressed. At 05:00, yesterday's countdowns are invalidated. Enter fresh observations for the new rotation; the application does not invent spawn times, read the game or control an emulator.

Reminders cover ten minutes, five minutes, one minute and the two-minute spawn window, with durable per-device deduplication and bounded retry attempts. Late entry never backfills missed reminder stages. A scheduler outage can miss a window; stale notifications are not replayed later as if current.

After the one-time phone notification connection, saving a valid countdown automatically schedules its remaining reminder stages. No assistant request, daily enable step or open computer is required. The production Worker enables both MVP and Mini reminders and runs its minute cron continuously. `MVP_ALERTS_ENABLED` and `MINI_ALERTS_ENABLED` are optional service mute controls; both default enabled and are explicitly `true` in the current deployment. The notification center displays the server's actual policy alongside scheduler health. Phone delivery still requires a valid subscription, network access and OS notification permission.

The compact route strip selects the earliest two confirmed future countdowns across the whole roster, independently of MVP/Mini and favorite filters. It shows the first destination, the next preparation target and their due-time gap; five minutes or less is highlighted. Expired countdowns leave this navigation queue without implying a kill, clearing the timer or starting a new countdown. Reminder messages identify the next confirmed target to prepare for.

## Development

At viewport widths of 1100px or more, the interface becomes a desktop dashboard up to 1440px wide. A complete 2172×724, 3:1 panoramic header spans its width, with morning, afternoon and night artwork and the same twelve animated residents. Navigation, clocks and compact filters sit below the artwork, followed by the upcoming route and a full-width three-column boss grid. Each desktop card has its own inline-size container, keeping portraits, badges and countdowns at card scale rather than scaling them with the whole dashboard. One complete 739:2129 garden sits behind the cards in natural flow; neither its proportions nor its landmarks depend on roster length. Smaller screens keep the unchanged 4:3 mobile header, single-column layout and mobile controls.

- `npm run dev`: frontend at local port 5174, including the `/yuki-ro-boss-timers/` base path.
- `npm run worker:dev`: local Worker at port 8787. Production's exact origin allowlist is intentionally not relaxed for localhost.
- `npm test`: timer, metadata, Web Push encryption, worker/storage, public/private access boundaries, CORS and project-path tests.
- `npm run typecheck`: frontend and backend TypeScript checks.
- `npm run build`: static frontend; private Worker secrets are never bundled.

`APP_BASE_PATH` can change the frontend directory at build time. A deployment at another owner or project path also requires deliberately updating the Worker's allowlist, app URL and VAPID subject. The service worker uses its own project scope for notification icons and destinations, so it does not take over another GitHub Pages app.

## Artwork and licenses

Backgrounds retain their complete paintings at their natural aspect ratios: 4:3 for the original mobile header, 3:1 for the new desktop panorama and 739:2129 for the width-fitted garden and its matching animation overlay. Empty or filtered lists still preserve the whole garden. Adding, sorting or filtering bosses never crops or resizes the painting to fit the roster. The desktop garden and overlaid cards share a natural-flow grid cell; there is no sidebar, separate garden tile or repeated image strip. Notification and guide pages show the complete earlier 3:2 map with `contain`. A genuinely longer illustrated scene requires newly drawn terrain in a new versioned asset.

The three versioned desktop panoramas in `public/art/ro-header-desktop-*-v1.png` are new artwork generated with the built-in image tool, not crops or stretches of the mobile painting. All 51 pre-existing artwork assets remain unchanged. The desktop renderer reuses the existing twelve residents and their actual pose animations through one translated standard-world scene; it does not bake them into the panorama or create duplicate animation providers. Prompt provenance is recorded in `public/pixel/README.md`. The locally bundled Noto Sans TC font retains its OFL license in `public/fonts/`. Retained vendor CSS licenses remain in `vendor/`.
