#!/usr/bin/env node
/**
 * Creates, updates and tears down the per-PR preview stack in Komodo.
 *
 * Plain .mjs without dependencies, like scripts/migrate.mjs: the workflow can
 * run it without `npm ci`.
 *
 * Usage: node scripts/preview-stack.mjs <deploy|destroy> [--dry-run]
 */

const REQUIRED = {
  deploy: [
    "KOMODO_URL",
    "KOMODO_API_KEY",
    "KOMODO_API_SECRET",
    "KOMODO_SERVER_ID",
    "PR_NUMBER",
    "PREVIEW_DOMAIN",
    "PREVIEW_CADDY_NETWORK",
    "PREVIEW_IMAGE",
    "PREVIEW_BASIC_AUTH_HASH",
    "PREVIEW_BETTER_AUTH_SECRET",
  ],
  destroy: [
    "KOMODO_URL",
    "KOMODO_API_KEY",
    "KOMODO_API_SECRET",
    "PR_NUMBER",
  ],
};

function requireEnv(names) {
  const missing = names.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    console.error(`Missing configuration: ${missing.join(", ")}`);
    process.exit(1);
  }
}

/**
 * Actions masks the registered secrets, but escapeEnvValue() doubles every `$`,
 * so an echoed `environment` would no longer match and would print in clear.
 */
function redact(text) {
  const masked = String(text ?? "").replace(
    /((?:BASIC_AUTH_HASH|BETTER_AUTH_SECRET)=)[^\s"',\\]*/g,
    "$1<redacted>"
  );
  return masked.length > 2000 ? `${masked.slice(0, 2000)}… [truncated]` : masked;
}

async function komodo(path, body) {
  const res = await fetch(`${process.env.KOMODO_URL.replace(/\/$/, "")}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.KOMODO_API_KEY,
      "x-api-secret": process.env.KOMODO_API_SECRET,
    },
    body: JSON.stringify(body ?? {}),
  });
  const text = await res.text();
  if (!res.ok) {
    const error = new Error(`${path} -> ${res.status}: ${redact(text)}`);
    error.status = res.status;
    error.bodyText = text;
    throw error;
  }
  return text ? JSON.parse(text) : null;
}

/**
 * Komodo answers 200 even when the compose run failed; the outcome sits in the
 * returned Update. Returns a message on a real failure, else null.
 * A response without a `success` field is not a failure, and `success` is also
 * false while an update is still Queued or InProgress — so a `status` that is
 * present but not terminal is not a failure either.
 */
function updateFailure(label, result) {
  const update = result && typeof result === "object" ? (result.update ?? result) : null;
  if (!update || typeof update !== "object" || update.success !== false) return null;
  if (typeof update.status === "string" && !/^complete/i.test(update.status)) return null;

  const logs = Array.isArray(update.logs) ? update.logs : [];
  const failed = logs.filter((log) => log && log.success === false);
  const detail = (failed.length > 0 ? failed : logs)
    .map((log) => [log?.stage, log?.command, log?.stderr, log?.stdout].filter(Boolean).join("\n"))
    .filter(Boolean)
    .join("\n---\n");

  return `${label} failed.${detail ? `\n${redact(detail)}` : " Komodo reported no details."}`;
}

function assertUpdateOk(label, result) {
  const message = updateFailure(label, result);
  if (message) throw new Error(message);
}

/**
 * Only BASIC_AUTH_HASH and BETTER_AUTH_SECRET go through the .env file Komodo
 * writes: a bcrypt hash contains `$`, which compose would read as a variable
 * if it sat in the compose file itself.
 */
function composeFile({ image, host, network, tz, locale }) {
  return [
    "services:",
    "  app:",
    `    image: ${image}`,
    "    pull_policy: always",
    "    restart: unless-stopped",
    "    networks: [caddy]",
    "    environment:",
    '      AUTH_ENABLED: "true"',
    '      ALLOW_USER_REGISTRATION: "true"',
    `      BETTER_AUTH_URL: "https://${host}"`,
    '      BETTER_AUTH_SECRET: "${BETTER_AUTH_SECRET}"',
    `      TZ: "${tz}"`,
    `      DEFAULT_LOCALE: "${locale}"`,
    // Cloudflare sits in front of Caddy, so the last X-Forwarded-For entry is
    // Cloudflare's address, not the visitor's.
    '      TRUSTED_PROXY_HEADER: "CF-Connecting-IP"',
    // Rocket Loader strips the nonce off the hydration scripts; drop this once
    // it is confirmed off for the preview domain.
    '      CSP_STRICT_DYNAMIC_BYPASS: "true"',
    "    labels:",
    `      caddy: ${host}`,
    '      caddy.reverse_proxy: "{{upstreams 3000}}"',
    '      caddy.basic_auth.preview: "${BASIC_AUTH_HASH}"',
    "",
    "networks:",
    "  caddy:",
    "    external: true",
    `    name: ${network}`,
    "",
  ].join("\n");
}

// Compose expands variables inside .env values, so escape literal $ as $$.
function escapeEnvValue(value) {
  return value.replace(/\$/g, "$$$$");
}

function stackConfig() {
  const pr = process.env.PR_NUMBER;
  const host = `pr-${pr}.${process.env.PREVIEW_DOMAIN}`;
  return {
    server_id: process.env.KOMODO_SERVER_ID,
    project_name: `bettershift-pr-${pr}`,
    file_contents: composeFile({
      image: process.env.PREVIEW_IMAGE,
      host,
      network: process.env.PREVIEW_CADDY_NETWORK,
      tz: process.env.PREVIEW_TZ || "Europe/Berlin",
      locale: process.env.PREVIEW_LOCALE || "de",
    }),
    environment: [
      `BETTER_AUTH_SECRET=${escapeEnvValue(process.env.PREVIEW_BETTER_AUTH_SECRET)}`,
      `BASIC_AUTH_HASH=${escapeEnvValue(process.env.PREVIEW_BASIC_AUTH_HASH)}`,
    ].join("\n"),
    env_file_path: ".env",
    // Each push must start from an empty database, and there are no volumes
    // to carry state over anyway.
    destroy_before_deploy: true,
    auto_update: false,
    poll_for_updates: false,
    webhook_enabled: false,
  };
}

async function findStack(name) {
  try {
    return await komodo("/read/GetStack", { stack: name });
  } catch (error) {
    if (error.status === 404 || /not found|does not exist/i.test(error.bodyText || "")) {
      return null;
    }
    throw error;
  }
}

function stackId(stack, fallbackName) {
  return stack?._id?.$oid || stack?.id || fallbackName;
}

async function deploy({ dryRun }) {
  const name = `bettershift-pr-${process.env.PR_NUMBER}`;
  const config = stackConfig();

  if (dryRun) {
    console.log(`Stack: ${name}`);
    console.log("--- compose ---");
    console.log(config.file_contents);
    console.log("--- config ---");
    console.log(JSON.stringify({ ...config, environment: "<redacted>", file_contents: "<shown above>" }, null, 2));
    return;
  }

  const existing = await findStack(name);
  if (existing) {
    assertUpdateOk(
      "UpdateStack",
      await komodo("/write/UpdateStack", { id: stackId(existing, name), config })
    );
    console.log(`Stack ${name} updated.`);
  } else {
    assertUpdateOk("CreateStack", await komodo("/write/CreateStack", { name, config }));
    console.log(`Stack ${name} created.`);
  }

  assertUpdateOk("DeployStack", await komodo("/execute/DeployStack", { stack: name }));
  console.log(`Stack ${name} deployed.`);
}

async function destroy({ dryRun }) {
  const name = `bettershift-pr-${process.env.PR_NUMBER}`;

  if (dryRun) {
    console.log(`Would destroy and delete stack ${name}.`);
    return;
  }

  const existing = await findStack(name);
  if (!existing) {
    console.log(`Stack ${name} does not exist — nothing to do.`);
    return;
  }

  // Best effort on purpose: a stack whose containers never came up reports a
  // failed destroy, and the row must still go, or nothing ever cleans it up.
  const failure = updateFailure(
    "DestroyStack",
    await komodo("/execute/DestroyStack", { stack: name, services: [], remove_orphans: true })
  );
  if (failure) {
    console.error(`${failure}\nDeleting the stack entry anyway.`);
  }
  await komodo("/write/DeleteStack", { id: stackId(existing, name) });
  console.log(`Stack ${name} destroyed and deleted.`);
}

const command = process.argv[2];
const dryRun = process.argv.includes("--dry-run");

if (command !== "deploy" && command !== "destroy") {
  console.error("Usage: node scripts/preview-stack.mjs <deploy|destroy> [--dry-run]");
  process.exit(1);
}

requireEnv(REQUIRED[command]);

try {
  await (command === "deploy" ? deploy({ dryRun }) : destroy({ dryRun }));
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
