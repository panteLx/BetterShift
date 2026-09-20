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
    console.error(`Fehlende Konfiguration: ${missing.join(", ")}`);
    process.exit(1);
  }
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
    const error = new Error(`${path} -> ${res.status}: ${text}`);
    error.status = res.status;
    error.bodyText = text;
    throw error;
  }
  return text ? JSON.parse(text) : null;
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
    console.log(JSON.stringify({ ...config, environment: "<maskiert>", file_contents: "<oben>" }, null, 2));
    return;
  }

  const existing = await findStack(name);
  if (existing) {
    await komodo("/write/UpdateStack", { id: stackId(existing, name), config });
    console.log(`Stack ${name} aktualisiert.`);
  } else {
    await komodo("/write/CreateStack", { name, config });
    console.log(`Stack ${name} angelegt.`);
  }

  await komodo("/execute/DeployStack", { stack: name });
  console.log(`Stack ${name} deployed.`);
}

async function destroy({ dryRun }) {
  const name = `bettershift-pr-${process.env.PR_NUMBER}`;

  if (dryRun) {
    console.log(`Würde Stack ${name} zerstören und löschen.`);
    return;
  }

  const existing = await findStack(name);
  if (!existing) {
    console.log(`Stack ${name} existiert nicht — nichts zu tun.`);
    return;
  }

  await komodo("/execute/DestroyStack", { stack: name, services: [], remove_orphans: true });
  await komodo("/write/DeleteStack", { id: stackId(existing, name) });
  console.log(`Stack ${name} zerstört und gelöscht.`);
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
