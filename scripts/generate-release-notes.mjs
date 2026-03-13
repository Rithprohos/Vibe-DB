#!/usr/bin/env bun

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const DEFAULT_BASE_URL = "https://gen.pollinations.ai";
const DEFAULT_MODEL = "openai";
const MAX_PROMPT_CHARS = Number.parseInt(
  process.env.RELEASE_NOTES_PROMPT_MAX_CHARS ?? "12000",
  10,
);

const RELEASE_NOTES_SYSTEM_PROMPT = [
  "You are a solo indie developer writing GitHub release notes in Markdown.",
  "Use only the provided commit messages.",
  "Summarize changes from feat, fix, refactor, perf, and improvement-style commits only.",
  "Talk about improvements as well as features and fixes.",
  "Treat refactor, perf, and improvement-style commits as product or developer-facing improvements when they result in clearer UX, better behavior, better performance, cleaner flows, or other meaningful upgrades.",
  "Ignore chore, docs, style, test, ci, build, and merge commits unless a provided commit is explicitly typed as feat, fix, refactor, perf, or improvement.",
  "Do not invent features, fixes, or breaking changes.",
  "Do not call something an improvement unless it is supported by the provided commits.",
  "Write like one person shipping fast, slightly unserious, but still clear.",
  "Sound human, casual, and a little scrappy, not corporate.",
  "Keep the wording concise and factual enough that users can still understand what changed.",
  "Style requirements:",
  "- Use clear section headings with emojis.",
  "- Use short bullet points with concrete outcomes.",
  "- A little personality is good; fluff is not.",
  "- No code fences, no tables, no corporate marketing tone.",
].join("\n");

const RELEASE_NOTES_USER_PROMPT_PREFIX = [
  "Summarize these commit messages into polished GitHub release notes.",
  "Return Markdown only.",
  "Use these sections in order and omit empty ones:",
  "## ✨ Features",
  "## 🐛 Fixes",
  "## ♻️ Improvements",
  "## 💥 Breaking Changes (only if explicitly present with ! or BREAKING CHANGE)",
  "Use only feat, fix, refactor, perf, and improvement-style commits from the provided list.",
  "Map refactor, perf, and improvement-style commits into Improvements when they describe meaningful user-facing or workflow-facing polish.",
  "Keep it under 220 words.",
  "Prefer 3-10 bullets total.",
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

async function runGit(args) {
  const { stdout } = await execFileAsync("git", args, {
    cwd: process.cwd(),
    maxBuffer: 1024 * 1024 * 4,
  });
  return stdout.trim();
}

async function tagExists(tag) {
  try {
    await runGit(["rev-parse", "--verify", `refs/tags/${tag}`]);
    return true;
  } catch {
    return false;
  }
}

async function getPreviousTag(tag) {
  try {
    const output = await runGit(["describe", "--tags", "--abbrev=0", `${tag}^`]);
    return output || "";
  } catch {
    return "";
  }
}

function parseCommitSubject(subject) {
  const trimmed = subject.trim();
  if (!trimmed) {
    return null;
  }

  const conventionalMatch = trimmed.match(
    /^(feat|fix|refactor|perf|improve|improvement)(\([^)]+\))?(!)?:\s+(.+)$/i,
  );

  if (conventionalMatch) {
    const [, rawType, scope = "", bang = "", description] = conventionalMatch;
    const normalizedDescription = description.trim().replace(/\s+/g, " ");
    if (!normalizedDescription) {
      return null;
    }

    const type = rawType.toLowerCase() === "feat"
      ? "feat"
      : rawType.toLowerCase() === "fix"
        ? "fix"
        : "improvement";

    return {
      type,
      scope,
      description: normalizedDescription,
      breaking: bang === "" ? /breaking change/i.test(trimmed) : true,
    };
  }

  const improvementMatch = trimmed.match(
    /^(improve|improves|improved|improvement|improvements)\s+(.+)$/i,
  );

  if (!improvementMatch) {
    return null;
  }

  const [, , description] = improvementMatch;
  const normalizedDescription = description.trim().replace(/\s+/g, " ");
  if (!normalizedDescription) {
    return null;
  }

  return {
    type: "improvement",
    scope: "",
    description: normalizedDescription,
    breaking: /breaking change/i.test(trimmed),
  };
}

async function getReleaseCommits(tag) {
  const hasTag = await tagExists(tag);
  if (!hasTag) {
    throw new Error(`Tag ${tag} does not exist locally.`);
  }

  const previousTag = await getPreviousTag(tag);
  const revisionRange = previousTag ? `${previousTag}..${tag}` : tag;
  const logOutput = await runGit([
    "log",
    revisionRange,
    "--no-merges",
    "--pretty=format:%H%x09%s",
  ]);

  const seen = new Set();
  const commits = logOutput
    .split("\n")
    .map((line) => {
      const [hash = "", subject = ""] = line.split("\t");
      const parsed = parseCommitSubject(subject);
      if (!parsed) {
        return null;
      }

      const dedupeKey = `${parsed.type}:${parsed.description.toLowerCase()}`;
      if (seen.has(dedupeKey)) {
        return null;
      }
      seen.add(dedupeKey);

      return {
        hash,
        subject,
        ...parsed,
      };
    })
    .filter(Boolean);

  return {
    previousTag,
    revisionRange,
    commits,
  };
}

function stringifyCommitsForPrompt(commits) {
  return commits
    .map((commit) => {
      const scope = commit.scope || "";
      const breaking = commit.breaking ? " [breaking]" : "";
      return `- ${commit.type}${scope}: ${commit.description}${breaking}`;
    })
    .join("\n")
    .slice(0, Math.max(400, MAX_PROMPT_CHARS));
}

function toBulletText(commit) {
  const scopeLabel = commit.scope
    ? `${commit.scope.slice(1, -1)}: `
    : "";
  const text = `${scopeLabel}${commit.description}`;
  return commit.breaking ? `${text} (breaking)` : text;
}

function buildLocalSummaryMarkdown(commits) {
  const sections = [
    { key: "feat", title: "## ✨ Features" },
    { key: "fix", title: "## 🐛 Fixes" },
    { key: "improvement", title: "## ♻️ Improvements" },
  ];

  const lines = [];
  let totalBullets = 0;

  for (const section of sections) {
    const items = commits.filter((commit) => commit.type === section.key).slice(0, 4);
    if (items.length === 0) {
      continue;
    }

    lines.push(section.title);
    for (const item of items) {
      lines.push(`- ${toBulletText(item)}`);
      totalBullets += 1;
    }
    lines.push("");
  }

  const breakingCommits = commits.filter((commit) => commit.breaking).slice(0, 3);
  if (breakingCommits.length > 0) {
    lines.push("## 💥 Breaking Changes");
    for (const item of breakingCommits) {
      lines.push(`- ${toBulletText(item)}`);
      totalBullets += 1;
    }
    lines.push("");
  }

  if (totalBullets === 0) {
    return [
      "## ✨ Features",
      "- No user-facing feature, fix, or improvement commits were found in this release range.",
      "",
    ].join("\n");
  }

  return lines.join("\n").trim();
}

function buildFallbackBody(tag, previousTag, commits) {
  const rangeLabel = previousTag ? `${previousTag}..${tag}` : tag;
  return [
    `# VibeDB ${tag}`,
    "",
    `_Source: git log ${rangeLabel}_`,
    "",
    buildLocalSummaryMarkdown(commits),
    "",
  ].join("\n");
}

async function summarizeWithPollinations({ tag, previousTag, commits }) {
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
          `Previous tag: ${previousTag || "none"}`,
          RELEASE_NOTES_USER_PROMPT_PREFIX,
          "",
          "Commit messages:",
          stringifyCommitsForPrompt(commits),
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

  const retryPayload = {
    ...payload,
    messages: [
      payload.messages[0],
      {
        role: "user",
        content: [
          `Version tag: ${tag}`,
          "Write short GitHub release notes in Markdown from these commit messages.",
          "Use only feat, fix, refactor, perf, and improvement-style entries.",
          "Use: ## ✨ Features, ## 🐛 Fixes, ## ♻️ Improvements.",
          "If a section is empty, omit it.",
          "Keep under 180 words.",
          "",
          "Commit messages:",
          stringifyCommitsForPrompt(commits),
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

  if (typeof choice?.text === "string") {
    return choice.text.trim();
  }

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

  const { previousTag, commits } = await getReleaseCommits(tag);

  if (commits.length === 0) {
    process.stdout.write(buildFallbackBody(tag, previousTag, commits));
    return;
  }

  let body;
  try {
    const summary = await summarizeWithPollinations({
      tag,
      previousTag,
      commits,
    });
    body = [
      `# VibeDB ${tag}`,
      "",
      `_Source: git log ${previousTag ? `${previousTag}..${tag}` : tag}_`,
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
    body = buildFallbackBody(tag, previousTag, commits);
  }

  process.stdout.write(body);
}

await main();
