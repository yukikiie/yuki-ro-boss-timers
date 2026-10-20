# Yuki RO · Boss Timers

An independent GitHub Pages copy of the Yuki pixel boss timer. It retains the approved eighteen boss portraits, four-pose character actions, twelve header residents, Hong Kong morning/afternoon/night scenery, compact layout and countdown rules.

The original hosted app is a separate application. This repository contains no original Site identity, runtime credentials, live database, notification subscriptions or dispatcher configuration.

## Architecture

- GitHub Pages serves the static React interface at `https://yukikiie.github.io/yuki-ro-boss-timers/`.
- A separate Cloudflare Worker and D1 database store the private roster and send Web Push notifications.
- An unguessable 256-bit private connection code protects the single owner's API. Only its SHA-256 hash is stored in Worker secrets. The private code is never part of this repository or a website URL.
- A Cloudflare cron invokes the durable reminder dispatcher every minute. The browser, ChatGPT and the Windows PC do not need to remain open. Delivery can still be delayed by the network, device settings and push gateways; exact-second delivery is not guaranteed.
- The two websites have independent timers and notification registrations. Updating this repository does not deploy or overwrite the original website.

## First deployment

1. Install Node 22.13 or later and run `npm ci`.
2. Sign into the intended Cloudflare account with `npx wrangler login`.
3. Create a new database: `npx wrangler d1 create yuki-ro-boss-timers --config worker/wrangler.jsonc`.
4. Replace the database placeholder in `worker/wrangler.jsonc` with that exact returned database ID. Do not use an existing app's database.
5. Run `npm run worker:migrate`.
6. Generate a random 32-byte base64url owner connection code and an independent Web Push VAPID key pair. Keep the connection code and private key private. Set `OWNER_KEY_SHA256`, `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` with Wrangler's secret commands; never put them in source files, GitHub Pages settings or frontend environment variables.
7. Run `npm run worker:deploy`. Set `public/config.json`'s `apiOrigin` to the exact HTTPS Worker origin returned by deployment.
8. Run `npm test`, `npm run typecheck` and `npm run build`.
9. Push the source to `main`. In repository Settings → Pages, select GitHub Actions. The included workflow tests and publishes only the static `dist/` directory.

The configured origin allowlist is exactly `https://yukikiie.github.io`; the application URL includes its project path. Authentication is required even when the request origin is allowed. There is no unauthenticated dispatch endpoint and no public route that lists subscriptions or private keys.

## Connect a device and test notifications

Open the GitHub Pages address and enter the private connection code. It is saved only after the backend validates it. Use Settings → Disconnect to forget it on that browser. Publish only trusted applications under this GitHub account: GitHub Pages projects on the same account share a browser origin and therefore the origin's storage trust boundary.

On the original setup PC, the owner can run `powershell -NoProfile -File scripts/show-connection-code.ps1` to read the Windows-encrypted local setup backup. That private backup is ignored by Git and is not part of a clone or the website. Never share it or paste its contents into a public issue.

On iPhone, open the GitHub address in Safari, choose Share → Add to Home Screen, then open that new icon. Enter the connection code and enable notifications from the app's notification screen. Permission and subscriptions from the original website cannot transfer to this different origin.

Send a test notification and verify that it actually appears on the phone, including while locked. Gateway acceptance alone is not proof of display. Focus modes, notification settings, battery/network conditions and operating-system policies can delay or suppress delivery. Wait for the backend status to report its first successful scheduled dispatch before relying on closed-app reminders; Cron Trigger changes can take several minutes to propagate.

## Timer behavior

Each MVP uses three hours after a confirmed kill; each Mini uses two hours. Manual countdowns are independent. Active countdowns appear first, ordered globally by earliest respawn time; untimed and invalid countdowns follow. Equal times and untimed bosses retain MVP-before-Mini ordering, then favorites, then original order. These are user-supplied game rules, not verified game-server observations.

Every boss card exposes a pink `剛被擊殺` button alongside the separate manual `設定倒數` control. Confirming an actual kill restarts that boss from the server's current time using its configured duration: MVP three hours or Mini two hours. Repeated kills need no time entry. Cancelling the confirmation leaves timers unchanged; countdown expiry never implies a new kill. Both controls remain disabled during the daily rest period.

At 03:00–05:00 Hong Kong time, countdowns are cleared and alerts are suppressed. At 05:00, yesterday's countdowns are invalidated. Enter fresh observations for the new rotation; the application does not invent spawn times, read the game or control an emulator.

Reminders cover ten minutes, five minutes, one minute and the two-minute spawn window, with durable per-device deduplication and bounded retry attempts. Late entry never backfills missed reminder stages. A scheduler outage can miss a window; stale notifications are not replayed later as if current.

The compact route strip selects the earliest two confirmed future countdowns across the whole roster, independently of MVP/Mini and favorite filters. It shows the first destination, the next preparation target and their due-time gap; five minutes or less is highlighted. Expired countdowns leave this navigation queue without implying a kill, clearing the timer or starting a new countdown. Reminder messages identify the next confirmed target to prepare for.

## Development

- `npm run dev`: frontend at local port 5174, including the `/yuki-ro-boss-timers/` base path.
- `npm run worker:dev`: local Worker at port 8787. Production's exact origin allowlist is intentionally not relaxed for localhost.
- `npm test`: timer, metadata, Web Push encryption, worker/storage, authentication, CORS and project-path tests.
- `npm run typecheck`: frontend and backend TypeScript checks.
- `npm run build`: static frontend; private Worker secrets are never bundled.

`APP_BASE_PATH` can change the frontend directory at build time. A deployment at another owner or project path also requires deliberately updating the Worker's allowlist, app URL and VAPID subject. The service worker uses its own project scope for notification icons and destinations, so it does not take over another GitHub Pages app.

## Artwork and licenses

Existing artwork files are copied unchanged from the approved application; no new raster artwork is generated for this migration. The locally bundled Noto Sans TC font retains its OFL license in `public/fonts/`. Retained vendor CSS licenses remain in `vendor/`.
