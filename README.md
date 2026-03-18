# Notion Bridge Shareable

Public shareable files for a Custom GPT + Netlify bridge that connects to Notion.

This package is a **work in progress**, but it is already usable.

## Start here
If you are new to this setup, open `NOTION_BRIDGE_SHAREABLE_SETUP.md` first.

That guide walks you through:
- creating the Notion integration
- setting the Netlify environment variables
- pasting the schema into GPT Actions
- testing the bridge in a safe order

If you only need the schema, use `NOTION_BRIDGE_GPT_SCHEMA_SHAREABLE.json`.

Important:
After any schema change in GPT Actions, save the Action and start a new chat.

## What works right now
- health check
- search pages
- create page
- rename page
- append text
- create database
- search databases
- create/query/update simple rows
- create comments
- list comments
- get block children

## Files in this repo
- `NOTION_BRIDGE_GPT_SCHEMA_SHAREABLE.json`
- `NOTION_BRIDGE_DEPLOYABLE_CONFIG_TEMPLATE.json`
- `NOTION_BRIDGE_SHAREABLE_SETUP.md`
- `NOTION_BRIDGE_SHAREABLE_SETUP.docx`

## What this repo is for
Use this repo as the public download home for the shareable setup files.

It is meant for:
- the latest public schema
- the latest public setup guide
- placeholder/template config files

It is **not** meant for:
- real Notion tokens
- real API keys
- personal Netlify values
- private experiments

## Important safety rule
Never upload real secrets.

Do not commit:
- `NOTION_TOKEN`
- `BRIDGE_API_KEY`
- private page IDs you do not want public
- personal environment files

Only upload templates and placeholder values.

## Quick use
1. Deploy the bridge project to Netlify.
2. Add your env vars in Netlify.
3. Open `NOTION_BRIDGE_GPT_SCHEMA_SHAREABLE.json`.
4. Replace the placeholder Netlify URL with your own URL.
5. Paste the full schema into GPT Actions.
6. Save the Action.
7. Start a new chat.

## Notes
- `list-comments` accepts `page_id` for convenience.
- The backend maps that to the `block_id` query parameter that Notion expects.
- The setup docs are intentionally beginner-friendly and may keep improving.
