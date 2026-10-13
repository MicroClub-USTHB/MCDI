# Changelog

All notable changes to mcdi-cli are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/2.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-10-13

First release. The CLI covers MCDI Inbound Webhooks: logging in as an admin, writing and pre-checking FormSchema files, and managing webhooks.

### Added

- `mcdi-cli login` and `logout`: browser-based Discord login with PKCE, one session per named profile (`--profile`).
- `mcdi-cli whoami`, `profile` and `config` commands to inspect and manage profiles.
- `mcdi-cli schema init` to scaffold a FormSchema file from the admin panel's templates, and `schema validate` to check it offline with the same validator the MCDI API runs (`@mcdi/form-schema`).
- Custom validation rules ("house rules") that extend the built-in pre-check, per project or global.
- `mcdi-cli webhook create`, `list`, `get`, `update` and `delete`; `update` accepts `--name`, `--schema`, `--active` and `--inactive`.
- `mcdi-cli webhook roles set` to choose which Discord roles can read submissions, and `webhook rotate-secret` to issue a new signing secret.
- `mcdi-cli webhook secret get [id|slug]` to read back a signing secret, with `--reveal`. The CLI keeps an encrypted copy because MCDI shows a secret only once.
- Local pre-check on `webhook create` and `webhook update --schema`: an invalid schema never reaches the server.
- Exit codes for scripting: `0` success, `1` local pre-check failed, `2` MCDI rejected the request, `3` not logged in or not allowed, `4` not found, `5` unexpected or network error, `64` invalid command line.
- The `mcdi` command as a shorter alias for `mcdi-cli`.
- A guide to writing backend schemas (`docs/form-schema.md`) and one for custom rules (`docs/custom-rules.md`).

### Security

- Session tokens and webhook signing secrets are encrypted at rest with AES-256-GCM. The key lives in the OS keychain, or in a `0600` key file next to the config when no keychain is reachable.
- Each stored secret is decrypted only with the key that encrypted it and is bound to its config slot.
- The CLI fetches the encryption key before MCDI issues a signing secret it never shows again, so a key failure cannot lose a secret.
- A locked keychain does not drop stored sessions.
- The session is sent only to `https` base URLs (`http` is allowed on localhost), never follows redirects, and the login link must be on `discord.com`.
- The login callback is checked against the OAuth state, and control characters are stripped from printed errors.
- Config writes are locked so parallel commands cannot lose secrets, and a profile that holds signing secrets cannot be pointed at another MCDI.

[Unreleased]: https://github.com/MicroClub-USTHB/MCDI/compare/mcdi-cli-v0.1.0...HEAD
[0.1.0]: https://github.com/MicroClub-USTHB/MCDI/releases/tag/mcdi-cli-v0.1.0
