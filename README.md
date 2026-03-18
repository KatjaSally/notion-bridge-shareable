# Notion Bridge Shareable

A public starter pack to connect a Custom GPT to Notion through Netlify Functions.

This package is a **work in progress** and currently usable.

## Quickstart (first-time users)
1. Deploy this repo to Netlify.
2. Set Netlify env vars: `NOTION_TOKEN`, `TECH_ROOM_PAGE_ID`, `BRIDGE_API_KEY`.
3. Open `NOTION_BRIDGE_GPT_SCHEMA_SHAREABLE.json` and replace `YOUR-NETLIFY-SITE`.
4. Paste schema into GPT Actions.
5. In GPT Action auth, set header `x-bridge-key` with the same value as `BRIDGE_API_KEY`.
6. Save Action and start a new chat.
7. Run tests: `health` -> `search-pages` -> `create-page`.

## Files in this repo
- `netlify.toml`
- `netlify/functions/notion-bridge.js`
- `NOTION_BRIDGE_GPT_SCHEMA_SHAREABLE.json`
- `NOTION_BRIDGE_DEPLOYABLE_CONFIG_TEMPLATE.json`
- `NOTION_BRIDGE_SHAREABLE_SETUP.md`
- `NOTION_BRIDGE_SHAREABLE_SETUP.docx`

## Implemented endpoints (source of truth)
- `GET /health`
- `POST /search-pages`
- `POST /get-page`
- `POST /create-page`
- `POST /rename-page`
- `POST /append-text`
- `POST /append-checkboxes`
- `POST /append-toggle`
- `POST /set-checkbox-state`
- `POST /append-blocks`
- `POST /get-block-children`
- `POST /create-database`
- `POST /create-database-page`
- `POST /update-page-properties`
- `POST /create-database-row-simple`
- `POST /search-databases`
- `POST /query-database-rows`
- `POST /update-database-row-simple`
- `POST /create-comment-on-page`
- `POST /list-comments`

## Current limitations
> - This bridge does not auto-disambiguate similar page names. Search may return multiple matches.
> - Checkbox state updates require a checkbox `block_id` (get it first via `get-block-children`).
> - Advanced block transforms (full in-place rewriting logic) are limited.
> - `TECH_ROOM_PAGE_ID` is a legacy env var name; it means your default root page ID.

## About `TECH_ROOM_PAGE_ID`
The variable name is historical.

Use it as: **default root page ID** for page creation when no `parent_page_id` is passed.

If you want to rename this to `ROOT_PAGE_ID`, update both the code and docs together before publishing a new version.

## Safety
Never commit real secrets.

Do not publish:
- real `NOTION_TOKEN`
- real `BRIDGE_API_KEY`
- personal page IDs you do not want public

## Note
After any Action schema edit, always save and start a new chat.
