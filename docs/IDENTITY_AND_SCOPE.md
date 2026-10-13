# Identity and Scope

## Purpose

Fixel Recall uses opaque local identifiers for project, session and context block scope. These IDs
must be safe to show in logs, metrics, dashboard rows and retrieval references without revealing a
repository path or letting a caller smuggle a filesystem path into the vault.

## Identifier Types

| Type             | Format                              | Stability                                                    | Purpose                                        |
| ---------------- | ----------------------------------- | ------------------------------------------------------------ | ---------------------------------------------- |
| Project ID       | `prj_` plus 32 base64url characters | Stable for the same canonical path and local identity secret | Public project scope                           |
| Session ID       | `ses_` plus 32 base64url characters | Unique per session                                           | Public session scope                           |
| Context block ID | `blk_` plus 43 base64url characters | Unique per stored block                                      | Retrieval handle scoped by project and session |

Public IDs are validated with strict allowlists. Slashes, backslashes, `..`, short IDs and arbitrary
strings are rejected. IDs are never accepted as direct filesystem paths.

## Project Identity

The project ID is derived from:

- the canonical local project path
- a local identity secret
- HMAC-SHA-256

Only the derived `prj_...` value is public. The raw repository path and repository name are not part
of the public ID. The same project path with the same local secret produces the same project ID, so
a developer can resume local state. A different path or a different local secret produces a
different project ID.

The local identity secret is an input to the identity function. Storage for that secret is a later
vault concern and must not be committed to Git.

## Session Lifecycle

Create:

- validate the project ID
- generate a random `ses_...` ID
- record `createdAt`, `expiresAt` and `active` status

Resume:

- validate the session identity
- reject deleted sessions
- return the active session when it has not expired
- return an expired session when the expiry time has passed

Expire:

- mark active sessions as `expired`
- leave deleted sessions deleted

Delete:

- mark the session as `deleted`
- later vault storage must remove associated blocks for that session

## Context Block Scope

Context block IDs are random `blk_...` identifiers and are always carried with both `projectId` and
`sessionId`. A block is valid only inside its exact project and session namespace.

Retrieval and storage layers must check:

- project match
- session match
- block ID format
- session state
- authorization for the project/session namespace

On authorization failure, retrieval returns nothing. It must not fall back to a broad filesystem
read.

## Cross-Project Separation

Project IDs are compared using exact opaque IDs. A block created under one project ID must fail
scope checks under another project ID, even if the session ID string happens to match. This prevents
cross-project vault access and keeps repository identity out of logs and public handles.

## Non-Goals

This document does not define the final vault file layout, secret persistence, disk expiry worker or
retrieval API. It defines the identity contract those components must obey.
