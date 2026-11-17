# RFactory

A web app where an AI bot joins team calls (Google Meet, Zoom, Teams, Slack huddles) to run standups and make changes through the Factory services (PFactory, AIFactory, TFactory via CFactory).

Work follows intent → spec → plan: see `intent/`, `spec/`, `plan/`.

## Roles

`deploy/pod.sh up` passes three comma-separated email lists to the web app:

- `RFACTORY_ALLOWED_EMAILS` (required): members, who may use the app.
- `RFACTORY_APPROVERS`: members who may approve or reject changes. Required when writes are on.
- `RFACTORY_ADMINS`: members with the admin role.

Approvers and admins must also be members; otherwise the web app refuses to start (`roles-not-members`).
