# Notion Bridge Shareable Setup

This pack is **work in progress**.

It already works for:
- health
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

Use this guide if you want your own Custom GPT to work with Notion through a small Netlify bridge.

## What is in this pack
- `NOTION_BRIDGE_GPT_SCHEMA_SHAREABLE.json`
- `NOTION_BRIDGE_DEPLOYABLE_CONFIG_TEMPLATE.json`

## Before you start
You need:
- a Notion account
- a Netlify account
- the bridge project files
- a Custom GPT you can edit

## Step 1: Make the Notion integration
In Notion:
1. Click **Settings**.
2. Click **Connections**.
3. Click **Develop or manage integrations**.
4. Click **New integration**.
5. Turn on these permissions:
   - **Read content**
   - **Insert content**
   - **Update content**
6. Copy the integration token.

Paste that token into Netlify later as `NOTION_TOKEN`.

## Step 2: Share one Notion page with the integration
Pick the page you want this bridge to use as its main home.

In Notion:
1. Open that page.
2. Click **Share**.
3. Invite your integration.
4. Copy the page ID from the page URL.

Paste that page ID into Netlify later as `TECH_ROOM_PAGE_ID`.

Important:
`TECH_ROOM_PAGE_ID` is just the current env var name.
You can use any page you want as the bridge root.

## Step 3: Deploy the bridge to Netlify
Deploy the whole project folder.

Do not deploy only `notion-bridge.js`.

Your deploy needs these files:
- `netlify.toml`
- `netlify/functions/notion-bridge.js`

When the deploy is finished, copy your live function base URL.

It should look like this:

```text
https://YOUR-SITE.netlify.app/.netlify/functions/notion-bridge
```

## Step 4: Add the Netlify environment variables
In Netlify:
1. Open your site.
2. Click **Site configuration**.
3. Click **Environment variables**.
4. Add these three values:

```text
NOTION_TOKEN=your Notion integration token
TECH_ROOM_PAGE_ID=your chosen root page ID
BRIDGE_API_KEY=your own long random secret
```

Keep the `BRIDGE_API_KEY` value handy.
You will paste the same value into GPT Actions in a minute.

## Step 5: Add the Action in your Custom GPT
In ChatGPT:
1. Open your GPT.
2. Click **Configure**.
3. Click **Actions**.
4. Open `NOTION_BRIDGE_GPT_SCHEMA_SHAREABLE.json`.
5. Replace the placeholder Netlify URL with your real Netlify URL.
6. Copy the **entire file**.
7. Paste the **entire file** into the Actions schema box.
8. Set authentication to use header `x-bridge-key`.
9. Paste the same value you used for `BRIDGE_API_KEY`.
10. Click **Save**.

Important:
After any schema change, **save the Action and start a new chat**.

## Step 6: Test in this order
Use small tests first.

1. `health`
2. `search-pages`
3. `create-page`
4. `rename-page`
5. `append-text`
6. `create-database`
7. `create-comment-on-page`
8. `list-comments`

That order keeps the risk low and helps you spot where a problem starts.

## What to expect from renaming pages
`rename-page` updates the page title only.

It does not move the page, replace the page body, or change any other properties.

## What to expect from comments
`list-comments` now works with `page_id`.

Behind the scenes, the backend converts that into the `block_id` query parameter Notion expects.

If you already know the block ID, you can send `block_id` directly.

## Most common problems
`Unauthorized`
- The API key in GPT Actions does not match `BRIDGE_API_KEY` in Netlify.

`Server missing BRIDGE_API_KEY`
- The env var name is wrong or missing in Netlify.

`Server missing TECH_ROOM_PAGE_ID`
- The root page ID env var is wrong or missing in Netlify.

`Could not parse valid OpenAPI spec`
- The schema JSON was pasted with a broken quote, comma, or brace.
- Safest fix: paste the whole file again.

`ClientResponseError`
- GPT Actions is often holding on to stale auth or an older schema session.
- Save the Action again.
- Start a new chat.

## Safe way to work
Test changes in a duplicate GPT first.

When a change works there, copy it to your main GPT.

## Transparency note
This package is already usable, but it is still being refined.

That means the docs, schema wording, and packaging may keep getting cleaner as testing continues.
