<p align="center">
  <img src="assets/OxidDB-HeaderLogo.jpg" alt="OxidDB" width="480">
</p>

# OxidDB Starter Kit

A small kit for trying out a provisioned OxidDB instance: a health check, and an
interactive session that tells you whether OxidDB is a good fit for your idea.

## Who this is for

This kit is for teams who are new to OxidDB and want to find out, before writing
any application code, whether it fits the problem they have. OxidDB combines three
things that usually live in separate systems: an ontology layer for modelling the
concepts in your domain and reasoning over how they relate, vector search for
finding things by meaning rather than exact match, and a neurosymbolic link that
lets those two work together, so a similarity search can be constrained or
explained by the structure of your ontology. That combination is powerful for
knowledge graphs, semantic search over structured domains, recommendation with
explainable rules, and any product where "what is this similar to" and "what is
this connected to" are both first-class questions. It is not the right tool for
everything, and the kit is designed to tell you that honestly when it applies.

## Setup

Run the interactive setup and enter your instance URL and API key when prompted:

```bash
make init
```

This writes a `.env` file (gitignored) with `OXID_URL` and `OXID_API_KEY`. If
you would rather do it by hand, copy `.env.example` to `.env` and fill in the
values yourself.

Drop the documentation bundle into `./docs`, one folder per engine version:

```
docs/
  0.9.8/
  0.9.9/
```

## Commands

```bash
make init      # create .env by entering your instance URL and API key
make test      # check that your instance is online and your key works
make start     # open a feasibility session for your idea
make docs      # list the documentation versions you have locally
make help      # print this list
```

## make init

Asks two questions, the base URL of your OxidDB instance and its API key, and
writes them to `.env`. A trailing slash on the URL is stripped. The API key can be
left empty if authentication is disabled on your instance. If a `.env` already
exists you are asked before it is overwritten.

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

## make docs

Lists the documentation versions you have locally under `./docs`.

## Requirements

- `make`, `curl`, `bash`
- [Claude Code](https://claude.com/product/claude-code) on your PATH for `make start`
