# MCDI endpoints mcdi-cli depends on

Each subfolder documents one area of MCDI's API that an mcdi-cli command
surface is built on, sourced directly from MCDI's controller code
(`github.com/MicroClub-USTHB/MCDI`), not just from the product PRD's
description of it.

- [`login/`](login/) — the admin Discord OAuth flow behind
  `mcdi-cli login` / `logout` / `whoami`
- [`webhook/`](webhook/) — the `/admin/inbound-webhooks` CRUD surface behind
  `mcdi-cli webhook ...`

See [`../mcdi-cli-PRD.md`](../mcdi-cli-PRD.md) for the full product
requirements these map to. Each doc ends with a "Gaps for mcdi-cli" section
listing what's missing or unconfirmed on the MCDI side — those gaps are
tracked as issues in this repo.
