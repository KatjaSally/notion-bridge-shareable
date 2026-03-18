const NOTION_VERSION = "2022-06-28";

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  };
}

function normalizeId(raw) {
  if (!raw || typeof raw !== "string") return "";
  const s = raw.trim();
  const noDashes = s.replace(/-/g, "");
  if (/^[0-9a-fA-F]{32}$/.test(noDashes)) return noDashes.toLowerCase();
  const m32 = s.match(/[0-9a-fA-F]{32}/);
  if (m32) return m32[0].toLowerCase();
  const md = s.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/);
  if (md) return md[0].replace(/-/g, "").toLowerCase();
  return "";
}

function notionId(raw) {
  const clean = normalizeId(raw);
  if (!clean || clean.length !== 32) return "";
  return `${clean.slice(0, 8)}-${clean.slice(8, 12)}-${clean.slice(12, 16)}-${clean.slice(16, 20)}-${clean.slice(20)}`;
}

function parseBody(event) {
  if (!event.body) return {};
  try {
    return JSON.parse(event.body);
  } catch {
    return null;
  }
}

function textToParagraphBlocks(text) {
  if (typeof text !== "string") return [];
  const trimmed = text.trim();
  if (!trimmed) return [];
  return trimmed
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => ({
      object: "block",
      type: "paragraph",
      paragraph: {
        rich_text: [{ type: "text", text: { content: p.slice(0, 1800) } }],
      },
    }))
    .slice(0, 90);
}

function itemsToTodoBlocks(items) {
  if (!Array.isArray(items)) return [];

  return items
    .map((item) => {
      if (typeof item === "string") {
        const text = item.trim();
        if (!text) return null;
        return {
          object: "block",
          type: "to_do",
          to_do: {
            rich_text: [{ type: "text", text: { content: text.slice(0, 1800) } }],
            checked: false,
          },
        };
      }

      if (!item || typeof item !== "object") return null;

      const rawText = typeof item.text === "string"
        ? item.text
        : typeof item.label === "string"
          ? item.label
          : typeof item.content === "string"
            ? item.content
            : "";
      const text = rawText.trim();
      if (!text) return null;

      return {
        object: "block",
        type: "to_do",
        to_do: {
          rich_text: [{ type: "text", text: { content: text.slice(0, 1800) } }],
          checked: Boolean(item.checked),
        },
      };
    })
    .filter(Boolean)
    .slice(0, 90);
}

async function notionFetch(path, method, token, body) {
  const response = await fetch(`https://api.notion.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) return { ok: false, status: response.status, data };
  return { ok: true, status: response.status, data };
}

function extractTitle(page) {
  const properties = page?.properties || {};
  for (const v of Object.values(properties)) {
    if (v?.type === "title" && Array.isArray(v.title)) {
      const t = v.title.map((x) => x?.plain_text || "").join("").trim();
      if (t) return t;
    }
  }
  return "(untitled)";
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204 };

  const bridgeKey = process.env.BRIDGE_API_KEY;
  const notionToken = process.env.NOTION_TOKEN;
  const techRoomId = notionId(process.env.TECH_ROOM_PAGE_ID || "");
  const incomingKey = event.headers["x-bridge-key"] || event.headers["X-Bridge-Key"];

  if (!bridgeKey) return json(500, { error: "Server missing BRIDGE_API_KEY" });
  if (!notionToken) return json(500, { error: "Server missing NOTION_TOKEN" });
  if (!techRoomId) return json(500, { error: "Server missing TECH_ROOM_PAGE_ID" });
  if (!incomingKey || incomingKey !== bridgeKey) return json(401, { error: "Unauthorized" });

  if (event.path.endsWith("/health") && event.httpMethod === "GET") {
    return json(200, { ok: true, message: "Bridge is running" });
  }

  if (event.path.endsWith("/search-pages") && event.httpMethod === "POST") {
    const body = parseBody(event);
    if (!body) return json(400, { error: "Invalid JSON body" });

    const query = typeof body.query === "string" ? body.query.trim() : "";
    const limitRaw = Number(body.limit);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(50, Math.floor(limitRaw))) : 20;

    const reqBody = { filter: { property: "object", value: "page" }, page_size: 100 };
    if (query) reqBody.query = query;

    const result = await notionFetch("/search", "POST", notionToken, reqBody);
    if (!result.ok) return json(result.status, result.data);

    const pages = (result.data.results || [])
      .filter((item) => item?.object === "page")
      .map((item) => ({
        id: item.id,
        url: item.url,
        title: extractTitle(item),
        last_edited_time: item.last_edited_time,
      }))
      .slice(0, limit);

    return json(200, { count: pages.length, pages });
  }

  if (event.path.endsWith("/get-page") && event.httpMethod === "POST") {
    const body = parseBody(event);
    if (!body) return json(400, { error: "Invalid JSON body" });

    const pageId = notionId(body.page_id || "");
    if (!pageId) return json(400, { error: "page_id is required" });

    const result = await notionFetch(`/pages/${pageId}`, "GET", notionToken);
    if (!result.ok) return json(result.status, result.data);

    return json(200, {
      id: result.data.id,
      url: result.data.url,
      title: extractTitle(result.data),
      last_edited_time: result.data.last_edited_time,
    });
  }

  if (event.path.endsWith("/create-page") && event.httpMethod === "POST") {
    const body = parseBody(event);
    if (!body) return json(400, { error: "Invalid JSON body" });

    const title = typeof body.title === "string" ? body.title.trim() : "";
    const content = typeof body.content === "string" ? body.content : "";
    const parentId = notionId(body.parent_page_id || "") || techRoomId;

    if (!title) return json(400, { error: "title is required" });

    const result = await notionFetch("/pages", "POST", notionToken, {
      parent: { page_id: parentId },
      properties: {
        title: { title: [{ type: "text", text: { content: title.slice(0, 200) } }] },
      },
      children: textToParagraphBlocks(content),
    });

    if (!result.ok) return json(result.status, result.data);
    return json(200, { id: result.data.id, url: result.data.url, title, parent_page_id: parentId });
  }

  if (event.path.endsWith("/rename-page") && event.httpMethod === "POST") {
    const body = parseBody(event);
    if (!body) return json(400, { error: "Invalid JSON body" });

    const pageId = notionId(body.page_id || "");
    const title = typeof body.title === "string" ? body.title.trim() : "";

    if (!pageId) return json(400, { error: "page_id is required" });
    if (!title) return json(400, { error: "title is required" });

    const getResult = await notionFetch(`/pages/${pageId}`, "GET", notionToken);
    if (!getResult.ok) return json(getResult.status, getResult.data);

    const properties = getResult.data?.properties || {};
    const titleKey = Object.keys(properties).find((key) => properties[key]?.type === "title");
    if (!titleKey) return json(400, { error: "Page has no title property" });

    const patchResult = await notionFetch(`/pages/${pageId}`, "PATCH", notionToken, {
      properties: {
        [titleKey]: {
          title: [
            {
              type: "text",
              text: { content: title.slice(0, 200) }
            }
          ]
        }
      }
    });
    if (!patchResult.ok) return json(patchResult.status, patchResult.data);

    return json(200, {
      ok: true,
      id: patchResult.data.id,
      url: patchResult.data.url,
      title
    });
  }

  if (event.path.endsWith("/append-text") && event.httpMethod === "POST") {
    const body = parseBody(event);
    if (!body) return json(400, { error: "Invalid JSON body" });

    const pageId = notionId(body.page_id || "");
    const text = typeof body.text === "string" ? body.text : "";
    if (!pageId) return json(400, { error: "page_id is required" });
    if (!text.trim()) return json(400, { error: "text is required" });

    const result = await notionFetch(`/blocks/${pageId}/children`, "PATCH", notionToken, {
      children: textToParagraphBlocks(text),
    });

    if (!result.ok) return json(result.status, result.data);
    return json(200, { ok: true });
  }

  if (event.path.endsWith("/append-checkboxes") && event.httpMethod === "POST") {
    const body = parseBody(event);
    if (!body) return json(400, { error: "Invalid JSON body" });

    const pageId = notionId(body.page_id || "");
    const items = Array.isArray(body.items) ? body.items : [];

    if (!pageId) return json(400, { error: "page_id is required" });
    if (!items.length) return json(400, { error: "items array is required" });

    const children = itemsToTodoBlocks(items);
    if (!children.length) {
      return json(400, { error: "items must contain at least one non-empty checkbox label" });
    }

    const result = await notionFetch(`/blocks/${pageId}/children`, "PATCH", notionToken, {
      children,
    });

    if (!result.ok) return json(result.status, result.data);
    return json(200, { ok: true, appended_blocks: result.data.results?.length || children.length });
  }
if (event.path.endsWith("/append-toggle") && event.httpMethod === "POST") {
  const body = parseBody(event);
  if (!body) return json(400, { error: "Invalid JSON body" });

  const pageId = notionId(body.page_id || "");
  const text = typeof body.text === "string" ? body.text.trim() : "";

  if (!pageId) return json(400, { error: "page_id is required" });
  if (!text) return json(400, { error: "text is required" });

  const result = await notionFetch(`/blocks/${pageId}/children`, "PATCH", notionToken, {
    children: [
      {
        object: "block",
        type: "toggle",
        toggle: {
          rich_text: [
            { type: "text", text: { content: text.slice(0, 1800) } }
          ]
        }
      }
    ]
  });

  if (!result.ok) return json(result.status, result.data);
  return json(200, { ok: true, type: "toggle", text });
}

if (event.path.endsWith("/set-checkbox-state") && event.httpMethod === "POST") {
  const body = parseBody(event);
  if (!body) return json(400, { error: "Invalid JSON body" });

  const blockId = notionId(body.block_id || "");
  const checked = Boolean(body.checked);

  if (!blockId) return json(400, { error: "block_id is required" });

  const result = await notionFetch(`/blocks/${blockId}`, "PATCH", notionToken, {
    to_do: { checked }
  });

  if (!result.ok) return json(result.status, result.data);
  return json(200, {
    ok: true,
    block_id: blockId,
    checked
  });
}

  if (event.path.endsWith("/append-blocks") && event.httpMethod === "POST") {
  const body = parseBody(event);
  if (!body) return json(400, { error: "Invalid JSON body" });

  const pageId = notionId(body.page_id || body.parent_id || "");
  if (!pageId) return json(400, { error: "page_id (or parent_id) is required" });

  // Accept both keys so wording differences don't break calls
  let children = [];
  if (Array.isArray(body.children)) children = body.children;
  else if (Array.isArray(body.blocks)) children = body.blocks;

  if (!children.length) return json(400, { error: "children (or blocks) array is required" });

  const afterId = notionId(body.after || "");
  const payload = afterId ? { children, after: afterId } : { children };

  const result = await notionFetch(`/blocks/${pageId}/children`, "PATCH", notionToken, payload);
  if (!result.ok) return json(result.status, result.data);

  return json(200, {
    ok: true,
    appended_blocks: result.data.results?.length || children.length,
    inserted_after: afterId || null
  });
}



  if (event.path.endsWith("/get-block-children") && event.httpMethod === "POST") {
    const body = parseBody(event);
    if (!body) return json(400, { error: "Invalid JSON body" });

    const blockId = notionId(body.block_id || body.page_id || "");
    if (!blockId) return json(400, { error: "block_id or page_id is required" });

    const pageSizeRaw = Number(body.page_size);
    const pageSize = Number.isFinite(pageSizeRaw) ? Math.max(1, Math.min(100, Math.floor(pageSizeRaw))) : 100;
    const startCursor = typeof body.start_cursor === "string" ? body.start_cursor.trim() : "";

    const q = new URLSearchParams({ page_size: String(pageSize) });
    if (startCursor) q.set("start_cursor", startCursor);

    const result = await notionFetch(`/blocks/${blockId}/children?${q.toString()}`, "GET", notionToken);
    if (!result.ok) return json(result.status, result.data);

    return json(200, {
      results: result.data.results || [],
      has_more: Boolean(result.data.has_more),
      next_cursor: result.data.next_cursor || null,
    });
  }

  if (event.path.endsWith("/create-database") && event.httpMethod === "POST") {
    const body = parseBody(event);
    if (!body) return json(400, { error: "Invalid JSON body" });

    const parentPageId = notionId(body.parent_page_id || "");
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!parentPageId) return json(400, { error: "parent_page_id is required" });
    if (!title) return json(400, { error: "title is required" });

    const defaultProps = {
      Name: { title: {} },
      Status: { select: { options: [{ name: "Todo" }, { name: "Doing" }, { name: "Done" }] } },
      Priority: { select: { options: [{ name: "Low" }, { name: "Medium" }, { name: "High" }] } },
    };
    const properties = body.properties && typeof body.properties === "object" ? body.properties : defaultProps;

    const result = await notionFetch("/databases", "POST", notionToken, {
      parent: { page_id: parentPageId },
      title: [{ type: "text", text: { content: title.slice(0, 200) } }],
      properties,
    });

    if (!result.ok) return json(result.status, result.data);
    return json(200, { id: result.data.id, url: result.data.url, title });
  }

  if (event.path.endsWith("/create-database-page") && event.httpMethod === "POST") {
    const body = parseBody(event);
    if (!body) return json(400, { error: "Invalid JSON body" });

    const databaseId = notionId(body.database_id || "");
    const properties = body.properties && typeof body.properties === "object" ? body.properties : null;
    if (!databaseId) return json(400, { error: "database_id is required" });
    if (!properties) return json(400, { error: "properties object is required" });

    const children = Array.isArray(body.children)
      ? body.children
      : textToParagraphBlocks(typeof body.content === "string" ? body.content : "");

    const result = await notionFetch("/pages", "POST", notionToken, {
      parent: { database_id: databaseId },
      properties,
      children,
    });

    if (!result.ok) return json(result.status, result.data);
    return json(200, { id: result.data.id, url: result.data.url });
  }

  if (event.path.endsWith("/update-page-properties") && event.httpMethod === "POST") {
    const body = parseBody(event);
    if (!body) return json(400, { error: "Invalid JSON body" });

    const pageId = notionId(body.page_id || "");
    const properties = body.properties && typeof body.properties === "object" ? body.properties : null;
    if (!pageId) return json(400, { error: "page_id is required" });
    if (!properties) return json(400, { error: "properties object is required" });

    const result = await notionFetch(`/pages/${pageId}`, "PATCH", notionToken, { properties });
    if (!result.ok) return json(result.status, result.data);

    return json(200, { ok: true, id: result.data.id, url: result.data.url });
  }
  if (event.path.endsWith("/create-database-row-simple") && event.httpMethod === "POST") {
    const body = parseBody(event);
    if (!body) return json(400, { error: "Invalid JSON body" });

    const databaseId = notionId(body.database_id || "");
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const status = typeof body.status === "string" ? body.status.trim() : "";
    const priority = typeof body.priority === "string" ? body.priority.trim() : "";

    if (!databaseId) return json(400, { error: "database_id is required" });
    if (!name) return json(400, { error: "name is required" });

    const properties = {
      Name: {
        title: [
          {
            text: { content: name }
          }
        ]
      }
    };

    if (status) properties.Status = { select: { name: status } };
    if (priority) properties.Priority = { select: { name: priority } };

    const result = await notionFetch("/pages", "POST", notionToken, {
      parent: { database_id: databaseId },
      properties
    });

    if (!result.ok) return json(result.status, result.data);
    return json(200, { id: result.data.id, url: result.data.url });
  }
  if (event.path.endsWith("/search-databases") && event.httpMethod === "POST") {
    const body = parseBody(event);
    if (!body) return json(400, { error: "Invalid JSON body" });

    const query = typeof body.query === "string" ? body.query.trim() : "";
    const limitRaw = Number(body.limit);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(50, Math.floor(limitRaw))) : 20;

    const reqBody = {
      filter: { property: "object", value: "database" },
      page_size: 100
    };
    if (query) reqBody.query = query;

    const result = await notionFetch("/search", "POST", notionToken, reqBody);
    if (!result.ok) return json(result.status, result.data);

    const databases = (result.data.results || [])
      .filter((item) => item?.object === "database")
      .map((item) => ({
        id: item.id,
        url: item.url,
        title: Array.isArray(item.title)
          ? item.title.map((t) => t?.plain_text || "").join("").trim() || "(untitled)"
          : "(untitled)"
      }))
      .slice(0, limit);

    return json(200, { count: databases.length, databases });
  }
  if (event.path.endsWith("/search-databases") && event.httpMethod === "POST") {
    const body = parseBody(event);
    if (!body) return json(400, { error: "Invalid JSON body" });

    const query = typeof body.query === "string" ? body.query.trim() : "";
    const limitRaw = Number(body.limit);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(50, Math.floor(limitRaw))) : 20;

    const reqBody = {
      filter: { property: "object", value: "database" },
      page_size: 100
    };
    if (query) reqBody.query = query;

    const result = await notionFetch("/search", "POST", notionToken, reqBody);
    if (!result.ok) return json(result.status, result.data);

    const databases = (result.data.results || [])
      .filter((item) => item?.object === "database")
      .map((item) => ({
        id: item.id,
        url: item.url,
        title: Array.isArray(item.title)
          ? item.title.map((t) => t?.plain_text || "").join("").trim() || "(untitled)"
          : "(untitled)"
      }))
      .slice(0, limit);

    return json(200, { count: databases.length, databases });
  }
  if (event.path.endsWith("/update-database-row-simple") && event.httpMethod === "POST") {
    const body = parseBody(event);
    if (!body) return json(400, { error: "Invalid JSON body" });

    const pageId = notionId(body.page_id || "");
    const status = typeof body.status === "string" ? body.status.trim() : "";
    const priority = typeof body.priority === "string" ? body.priority.trim() : "";

    if (!pageId) return json(400, { error: "page_id is required" });
    if (!status && !priority) return json(400, { error: "status or priority is required" });

    const properties = {};
    if (status) properties.Status = { select: { name: status } };
    if (priority) properties.Priority = { select: { name: priority } };

    const result = await notionFetch(`/pages/${pageId}`, "PATCH", notionToken, { properties });
    if (!result.ok) return json(result.status, result.data);

    return json(200, { ok: true, id: result.data.id, url: result.data.url });
  }
  if (event.path.endsWith("/query-database-rows") && event.httpMethod === "POST") {
    const body = parseBody(event);
    if (!body) return json(400, { error: "Invalid JSON body" });

    const databaseId = notionId(body.database_id || "");
    const nameEquals = typeof body.name_equals === "string" ? body.name_equals.trim() : "";
    const limitRaw = Number(body.limit);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(100, Math.floor(limitRaw))) : 20;

    if (!databaseId) return json(400, { error: "database_id is required" });

    const queryBody = { page_size: limit };
    if (nameEquals) {
      queryBody.filter = {
        property: "Name",
        title: { equals: nameEquals }
      };
    }

    const result = await notionFetch(`/databases/${databaseId}/query`, "POST", notionToken, queryBody);
    if (!result.ok) return json(result.status, result.data);

    const rows = (result.data.results || []).map((item) => {
      const titleArr = item?.properties?.Name?.title || [];
      const name = titleArr.map((t) => t?.plain_text || "").join("").trim() || "(untitled)";
      const status = item?.properties?.Status?.select?.name || "";
      const priority = item?.properties?.Priority?.select?.name || "";
      return {
        id: item.id,
        url: item.url,
        name,
        status,
        priority,
        last_edited_time: item.last_edited_time
      };
    });

    return json(200, { count: rows.length, rows });
  }
  if (event.path.endsWith("/create-comment-on-page") && event.httpMethod === "POST") {
    const body = parseBody(event);
    if (!body) return json(400, { error: "Invalid JSON body" });

    const pageId = notionId(body.page_id || "");
    const commentText = typeof body.comment_text === "string" ? body.comment_text.trim() : "";

    if (!pageId) return json(400, { error: "page_id is required" });
    if (!commentText) return json(400, { error: "comment_text is required" });

    const result = await notionFetch("/comments", "POST", notionToken, {
      parent: { page_id: pageId },
      rich_text: [
        {
          type: "text",
          text: { content: commentText.slice(0, 1800) }
        }
      ]
    });

    if (!result.ok) return json(result.status, result.data);

    return json(200, {
      id: result.data.id,
      discussion_id: result.data.discussion_id || "",
      created_time: result.data.created_time || ""
    });
  }
  if (event.path.endsWith("/list-comments") && event.httpMethod === "POST") {
    const body = parseBody(event);
    if (!body) return json(400, { error: "Invalid JSON body" });

    const pageId = notionId(body.page_id || "");
    const blockId = notionId(body.block_id || "");
    const targetId = blockId || pageId;
    const startCursor = typeof body.start_cursor === "string" ? body.start_cursor.trim() : "";
    const limitRaw = Number(body.limit);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(100, Math.floor(limitRaw))) : 50;

    if (!targetId) {
      return json(400, { error: "page_id or block_id is required" });
    }

    const qs = new URLSearchParams();
    qs.set("block_id", targetId);
    qs.set("page_size", String(limit));
    if (startCursor) qs.set("start_cursor", startCursor);

    const result = await notionFetch(`/comments?${qs.toString()}`, "GET", notionToken);
    if (!result.ok) return json(result.status, result.data);

    const comments = (result.data.results || []).map((c) => ({
      id: c.id,
      discussion_id: c.discussion_id || "",
      created_time: c.created_time || "",
      created_by: c.created_by?.id || "",
      text: Array.isArray(c.rich_text)
        ? c.rich_text.map((r) => r?.plain_text || "").join("").trim()
        : ""
    }));

    return json(200, {
      count: comments.length,
      comments,
      has_more: Boolean(result.data.has_more),
      next_cursor: result.data.next_cursor || null
    });
  }

  return json(404, { error: "Not found" });
};
