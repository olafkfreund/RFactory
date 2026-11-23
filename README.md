# RFactory

A web app where an AI bot joins team calls (Google Meet, Zoom, Teams, Slack huddles) to run standups and make changes through the Factory services (PFactory, AIFactory, TFactory via CFactory).

Work follows intent → spec → plan: see `intent/`, `spec/`, `plan/`.

## Roles

`deploy/pod.sh up` passes three comma-separated email lists to the web app:

- `RFACTORY_ALLOWED_EMAILS` (required): members, who may use the app.
- `RFACTORY_APPROVERS`: members who may approve or reject changes. Required when writes are on.
- `RFACTORY_ADMINS`: members with the admin role.

Approvers and admins must also be members; otherwise the web app refuses to start (`roles-not-members`).

## Standup and review

RFactory reads the configured project's cards from CFactory, read-only. A card counts only when its repository is the configured one and its issue belongs to that repository's project; other cards are left out, and cards whose issue points elsewhere are only counted ("conflicting").

**Standup** (`POST /api/standup`, and "stand up" in a call). The server builds it from the board, with no AI call:

- **done**, newest first;
- **now**: in progress, with the latest stage run;
- **missing**: no acceptance criteria recorded (neither in the field nor under an "Acceptance criteria" heading in the description), or a stage recorded as failed;
- **next**: ready, in CFactory's order;
- **issues**: blocked, failed stages, issue sync errors, board-versus-issue mismatches;
- **unknown**: any other status, shown as it is.

In a call the bot speaks a two- or three-sentence headline built from the counts; the page shows the full lists.

**Freshness.** Issue data is `current`, `stale` or `unavailable`, from CFactory's sync state for the configured repository. A stale or failed read is reported as such, never as a gap.

**Review** (members only, on the page):

- `GET /api/review`: plan, code and test stage counts, failed and active stages.
- `GET /api/review/<card_key>`: the full card, its stages and its issue discussion. Cards outside the project return 404.

Card descriptions, criteria, stage detail and comments appear only in the review. They never reach the AI, the call or the shared board. Stage results can come from another card with the same correlation key until olafkfreund/CFactory#583 is fixed; test cases, branches, pull requests, plan findings and pending approvals aren't in the card data yet.

## How the bot hears

During a call, the bot hears either through the meeting platform's live captions (`platform`) or through RFactory's own speech-to-text service (`audio`), selected by `listen` (`auto`, `platform`, or `audio`) and `language`. See [`docs/hearing.md`](docs/hearing.md) for the `auto` rule, fallback when own transcription is not configured, privacy guarantees, environment and scope settings, and rollback.

## Licence

RFactory is free software under the GNU Affero General Public License v3.0 only (`LICENSE`). Third-party parts and their licences are listed in `NOTICE.md`; upstream licence texts are in `LICENSES/`. This is not a legal review.
