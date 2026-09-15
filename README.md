# OxidDB Starter Kit

A small kit for trying out a provisioned OxidDB instance: a health check, and an
interactive session that tells you whether OxidDB is a good fit for your idea.

## Setup

```bash
cp .env.example .env
# fill in OXID_URL and OXID_API_KEY
```

Drop the documentation bundle into `./docs`, one folder per engine version:

```
docs/
  0.9.8/
  0.9.9/
```

## Commands

```bash
make test      # check that your instance is online and your key works
make version   # print the engine version your instance reports
make start     # open a feasibility session for your idea
make docs      # list the documentation versions you have locally
```

## make test

Calls the health endpoint on your instance using the values in `.env`. It
distinguishes between an unreachable host, a rejected API key, and a healthy
instance, so you know which thing to fix.

## make start

Opens a Claude Code session primed with `FEASIBILITY.md`. It will ask which
version you are running, read the matching folder under `./docs`, then interview
you about your idea before giving a verdict across three pillars: ontological
reasoning, vector search, and the neurosymbolic link between them.

It is built to give you an honest answer. If your problem is better served by
Postgres, pgvector, or a plain graph database, it will say so and tell you why.

## Requirements

- `make`, `curl`, `bash`
- [Claude Code](https://claude.com/product/claude-code) on your PATH for `make start`
