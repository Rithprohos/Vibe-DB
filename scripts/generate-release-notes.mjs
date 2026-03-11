#!/usr/bin/env bun

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const DEFAULT_BASE_URL = "https://gen.pollinations.ai";
const DEFAULT_MODEL = "openai";
const MAX_CHANGELOG_BYTES = Number.parseInt(
  process.env.RELEASE_NOTES_CHANGELOG_MAX_BYTES ?? "24000",
  10,
);
const MAX_PROMPT_CHARS = Number.parseInt(
  process.env.RELEASE_NOTES_PROMPT_MAX_CHARS ?? "12000",
  10,
);
const RELEASE_NOTES_SYSTEM_PROMPT = [
  "You are a senior release engineer writing GitHub release notes in Markdown.",
  "Write concise, factual notes for developers and power users.",
  "Use only information from the provided changelog; do not invent features, fixes, or breaking changes.",
  "Style requirements:",
  "- Use clear section headings with emojis.",
  "- Use short bullet points with concrete outcomes.",
  "- No code fences, no tables, no marketing fluff.",
].join("\n");
const RELEASE_NOTES_USER_PROMPT_PREFIX = [
  "Summarize this changelog into polished release notes.",
  "Return Markdown only.",
  "Use these sections in order and omit empty ones:",
  "## ✨ Highlights",
  "## 🔧 Improvements",
  "## 🐛 Fixes",
  "## 💥 Breaking Changes (only if explicitly present)",
  "Keep it under 240 words.",
  "Prefer 4-12 bullets total.",
  "Include tasteful emojis in section titles and, when natural, in 1-2 bullets.",
].join("\n");

function trimTrailingSlashes(value) {
  return value.replace(/\/+$/, "");
}

function buildChatCompletionsUrl(baseUrl) {
  const trimmed = trimTrailingSlashes(baseUrl.trim() || DEFAULT_BASE_URL);
  if (trimmed.endsWith("/chat/completions")) {
    return trimmed;
  }
  if (trimmed.endsWith("/v1")) {
    return `${trimmed}/chat/completions`;
  }
  return `${trimmed}/v1/chat/completions`;
}

function prepareChangelogForPrompt(changelogContent) {
  const lines = changelogContent.split("\n");
  const selected = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    if (
      trimmed.startsWith("#") ||
      /^(\*\*Release Date:\*\*|Release Date:)/i.test(trimmed) ||
      /^-\s+\[[xX ]\]\s+/.test(trimmed) ||
      /^-\s+/.test(trimmed)
    ) {
      selected.push(trimmed);
    }
  }

  const compact = selected.join("\n").trim();
  const promptSource =
    compact.length >= 200
      ? compact
      : changelogContent.trim();

  return promptSource.slice(0, Math.max(400, MAX_PROMPT_CHARS));
}

function dedupePush(target, seen, value) {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return;
  }
  const key = normalized.toLowerCase();
  if (seen.has(key)) {
    return;
  }
  seen.add(key);
  target.push(normalized);
}

function classifyBullet(context, bullet) {
  const text = `${context} ${bullet}`.toLowerCase();
  if (/(breaking|deprecat|remove|removed|migration|incompatible)/.test(text)) {
    return "breaking";
  }
  if (/(fix|bug|error|issue|null|crash|rollback|syntax|correct)/.test(text)) {
    return "fixes";
  }
  if (
    /(improv|optimi|performance|support|add|new|enhance|refactor|ui|ux|editor|workflow|coverage|type)/.test(
      text,
    )
  ) {
    return "improvements";
  }
  return "highlights";
}

function buildLocalSummaryMarkdown(changelogContent) {
  const lines = changelogContent.split("\n");
  let headingContext = "";
  const seen = new Set();
  const categories = {
    highlights: [],
    improvements: [],
    fixes: [],
    breaking: [],
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    const headingMatch = line.match(/^#{1,6}\s+(.+)$/);
    if (headingMatch) {
      headingContext = headingMatch[1].trim();
      continue;
    }

    const taskMatch = line.match(/^-\s+\[[xX ]\]\s+(.+)$/);
    const bulletMatch = line.match(/^-\s+(.+)$/);
    const bullet = (taskMatch?.[1] ?? bulletMatch?.[1] ?? "").trim();
    if (!bullet) {
      continue;
    }

    const bucket = classifyBullet(headingContext, bullet);
    dedupePush(categories[bucket], seen, bullet);
  }

  const sectionDefs = [
    { key: "highlights", title: "## ✨ Highlights" },
    { key: "improvements", title: "## 🔧 Improvements" },
    { key: "fixes", title: "## 🐛 Fixes" },
    { key: "breaking", title: "## 💥 Breaking Changes" },
  ];

  const output = [];
  let totalBullets = 0;

  for (const section of sectionDefs) {
    const items = categories[section.key].slice(0, 4);
    if (items.length === 0) {
      continue;
    }
    output.push(section.title);
    for (const item of items) {
      output.push(`- ${item}`);
      totalBullets += 1;
      if (totalBullets >= 12) {
        break;
      }
    }
    if (totalBullets >= 12) {
      break;
    }
    output.push("");
  }

  if (totalBullets === 0) {
    return [
      "## ✨ Highlights",
      "- Internal updates were prepared for this release.",
      "",
    ].join("\n");
  }

  return output.join("\n").trim();
}

function buildFallbackBody(tag, changelogPath, changelogContent) {
  return [
    `# VibeDB ${tag}`,
    "",
    `_Source: \`${changelogPath}\`_`,
    "",
    buildLocalSummaryMarkdown(changelogContent),
    "",
  ].join("\n");
}

function buildNoChangelogBody(tag, changelogPath) {
  return [
    `# VibeDB ${tag}`,
    "",
    `No changelog file found at \`${changelogPath}\`.`,
    "See the assets to download and install this version.",
    "",
  ].join("\n");
}

async function summarizeWithPollinations({ tag, changelogContent }) {
  const baseUrl = process.env.POLLINATIONS_BASE_URL ?? DEFAULT_BASE_URL;
  const model = process.env.POLLINATIONS_MODEL ?? DEFAULT_MODEL;
  const apiKey = (process.env.POLLINATIONS_API_KEY ?? "").trim();
  const url = buildChatCompletionsUrl(baseUrl);

  const payload = {
    model,
    messages: [
      {
        role: "system",
        content: RELEASE_NOTES_SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: [
          `Version tag: ${tag}`,
          RELEASE_NOTES_USER_PROMPT_PREFIX,
          "",
          "Changelog content:",
          changelogContent,
        ].join("\n"),
      },
    ],
    temperature: 0.2,
    max_tokens: 700,
    stream: false,
  };

  const headers = {
    "Content-Type": "application/json",
  };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  async function callAndExtract(requestPayload) {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(requestPayload),
    });

    if (!response.ok) {
      const details = (await response.text()).slice(0, 300);
      throw new Error(`Pollinations call failed ${response.status}: ${details}`);
    }

    const data = await response.json();
    const summary = extractSummaryFromCompletion(data);
    if (isLikelyNonReleaseSummary(summary)) {
      return "";
    }
    return summary;
  }

  const firstAttempt = await callAndExtract(payload);
  if (firstAttempt) {
    return firstAttempt;
  }

  // Retry once with simpler constraints if provider returns a structurally valid but empty answer.
  const retryPayload = {
    ...payload,
    messages: [
      payload.messages[0],
      {
        role: "user",
        content: [
          `Version tag: ${tag}`,
          "Write short GitHub release notes in Markdown for this changelog.",
          "Use: ## ✨ Highlights, ## 🔧 Improvements, ## 🐛 Fixes.",
          "If a section is empty, omit it.",
          "Keep under 180 words.",
          "",
          "Changelog content:",
          changelogContent,
        ].join("\n"),
      },
    ],
    temperature: 0.1,
  };

  const retryAttempt = await callAndExtract(retryPayload);
  if (retryAttempt) {
    return retryAttempt;
  }

  throw new Error("Pollinations returned an empty summary.");
}

function extractSummaryFromCompletion(data) {
  const choice = data?.choices?.[0];
  if (!choice) {
    return "";
  }

  // OpenAI-compatible: choices[0].message.content is a string.
  if (typeof choice?.message?.content === "string") {
    const text = choice.message.content.trim();
    if (text) {
      return text;
    }
  }

  if (Array.isArray(choice?.message?.content_blocks)) {
    const text = choice.message.content_blocks
      .map((block) => {
        if (typeof block?.text === "string") {
          return block.text;
        }
        return "";
      })
      .join("\n")
      .trim();
    if (text) {
      return text;
    }
  }

  // Some providers return content parts.
  if (Array.isArray(choice?.message?.content)) {
    const text = choice.message.content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }
        if (part && typeof part.text === "string") {
          return part.text;
        }
        if (part && typeof part.content === "string") {
          return part.content;
        }
        return "";
      })
      .join("\n")
      .trim();
    if (text) {
      return text;
    }
  }

  // Legacy completion-style response.
  if (typeof choice?.text === "string") {
    return choice.text.trim();
  }

  // Rare providers may emit top-level output text arrays.
  if (Array.isArray(data?.output_text)) {
    const text = data.output_text.join("\n").trim();
    if (text) {
      return text;
    }
  }

  if (Array.isArray(data?.output)) {
    const text = data.output
      .flatMap((item) => {
        if (typeof item?.content === "string") {
          return [item.content];
        }
        if (!Array.isArray(item?.content)) {
          return [];
        }
        return item.content
          .map((part) => {
            if (typeof part?.text === "string") {
              return part.text;
            }
            if (typeof part?.content === "string") {
              return part.content;
            }
            return "";
          })
          .filter(Boolean);
      })
      .join("\n")
      .trim();
    if (text) {
      return text;
    }
  }

  return "";
}

function isLikelyNonReleaseSummary(text) {
  const normalized = text.toLowerCase().trim();
  if (!normalized) {
    return true;
  }

  const greetingPatterns = [
    /^#?\s*hello\b/,
    /\bhow can i help\b/,
    /\bi[' ]?m .*ai assistant\b/,
    /\bmade by anthropic\b/,
  ];
  if (greetingPatterns.some((pattern) => pattern.test(normalized))) {
    return true;
  }

  const hasStructure = normalized.includes("## ") || normalized.includes("- ");
  return !hasStructure;
}

async function main() {
  const tag = process.argv[2];
  if (!tag) {
    console.error("Usage: bun scripts/generate-release-notes.mjs <tag>");
    process.exit(1);
  }

  const changelogPath = `changelog/${tag}.md`;
  const absolutePath = resolve(process.cwd(), changelogPath);

  let changelogBuffer;
  try {
    changelogBuffer = await readFile(absolutePath);
  } catch {
    process.stdout.write(buildNoChangelogBody(tag, changelogPath));
    return;
  }

  const truncated = changelogBuffer.subarray(0, Math.max(1, MAX_CHANGELOG_BYTES));
  const changelogContent = truncated.toString("utf8");
  const aiPromptChangelog = prepareChangelogForPrompt(changelogContent);

  let body;
  try {
    const summary = await summarizeWithPollinations({
      tag,
      changelogContent: aiPromptChangelog,
    });
    body = [
      `# VibeDB ${tag}`,
      "",
      `_Source: \`${changelogPath}\`_`,
      "",
      summary,
      "",
    ].join("\n");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `::warning::Pollinations summary failed for ${tag}. Falling back to local summary.`,
    );
    console.error(message);
    body = buildFallbackBody(tag, changelogPath, changelogContent);
  }

  process.stdout.write(body);
}

await main();
