# RFactory

A web app where an AI bot joins team calls (Google Meet, Zoom, Teams, Slack huddles) to run standups and make changes through the Factory services (PFactory, AIFactory, TFactory via CFactory).

Work follows intent → spec → plan: see `intent/`, `spec/`, `plan/`.

## Roles

`deploy/pod.sh up` passes three comma-separated email lists to the web app:

- `RFACTORY_ALLOWED_EMAILS` (required): members, who may use the app.
- `RFACTORY_APPROVERS`: members who may approve or reject changes. Required when writes are on.
- `RFACTORY_ADMINS`: members with the admin role.

Approvers and admins must also be members; otherwise the web app refuses to start (`roles-not-members`).

## How the bot hears

During a call, the bot hears either through the meeting platform's live captions (`platform`) or through RFactory's own speech-to-text service (`audio`), selected by `listen` (`auto`, `platform`, or `audio`) and `language`. See [`docs/hearing.md`](docs/hearing.md) for the `auto` rule, fallback when own transcription is not configured, privacy guarantees, environment and scope settings, and rollback.

## Licence

RFactory is free software under the GNU Affero General Public License v3.0 only (`LICENSE`). Third-party parts and their licences are listed in `NOTICE.md`; upstream licence texts are in `LICENSES/`. This is not a legal review.
