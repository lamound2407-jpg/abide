import "dotenv/config";
import {
  createInterface
} from "node:readline/promises";
import {
  stdin as input,
  stdout as output
} from "node:process";
import {
  copyFile,
  mkdir,
  readFile,
  writeFile,
  chmod
} from "node:fs/promises";
import path from "node:path";
import {
  fileURLToPath
} from "node:url";

const rl =
  createInterface({
    input,
    output
  });

const here =
  path.dirname(
    fileURLToPath(
      import.meta.url
    )
  );

const bridge =
  path.resolve(
    here,
    ".."
  );

function stripQuotes(value) {
  return String(value || "")
    .trim()
    .replace(/^['"]|['"]$/g, "");
}

async function upsertEnv(values) {
  const envPath =
    path.join(
      bridge,
      ".env"
    );

  let text = "";

  try {
    text =
      await readFile(
        envPath,
        "utf8"
      );
  } catch {}

  const lines =
    text
      .split(/\r?\n/)
      .filter(
        (line) =>
          line.length > 0
      );

  for (
    const [
      key,
      value
    ] of Object.entries(values)
  ) {
    const index =
      lines.findIndex(
        (line) =>
          line.startsWith(
            `${key}=`
          )
      );

    const next =
      `${key}=${value}`;

    if (index >= 0) {
      lines[index] =
        next;
    } else {
      lines.push(
        next
      );
    }
  }

  await writeFile(
    envPath,
    `${lines.join("\n")}\n`,
    "utf8"
  );
}

console.log("");
console.log(
  "ABIDE BRIDGE FIREBASE SETUP"
);
console.log(
  "Nothing entered here is sent to ChatGPT."
);
console.log("");

const rawKeyPath =
  stripQuotes(
    await rl.question(
      "Drag the Firebase Admin JSON key into Terminal, then press Enter: "
    )
  );

if (!rawKeyPath) {
  console.error(
    "No key path supplied."
  );
  rl.close();
  process.exit(1);
}

const sourceKey =
  path.resolve(
    rawKeyPath.replace(/^~/, process.env.HOME || "")
  );

let parsed;

try {
  parsed =
    JSON.parse(
      await readFile(
        sourceKey,
        "utf8"
      )
    );
} catch {
  console.error(
    "That file could not be read as a Firebase service-account JSON key."
  );
  rl.close();
  process.exit(1);
}

if (
  parsed.project_id !==
  "abide-809d9"
) {
  console.error(
    `That key belongs to project "${parsed.project_id || "unknown"}", not abide-809d9.`
  );
  rl.close();
  process.exit(1);
}

const email =
  String(
    await rl.question(
      "Email address used for the Abide account that should receive bridge items: "
    )
  ).trim();

if (!email) {
  console.error(
    "An Abide account email is required."
  );
  rl.close();
  process.exit(1);
}

const secretsDir =
  path.join(
    bridge,
    ".secrets"
  );

await mkdir(
  secretsDir,
  {
    recursive: true
  }
);

const storedKey =
  path.join(
    secretsDir,
    "firebase-admin.json"
  );

await copyFile(
  sourceKey,
  storedKey
);

await chmod(
  storedKey,
  0o600
);

await upsertEnv({
  FIREBASE_PROJECT_ID:
    "abide-809d9",
  ABIDE_TARGET_EMAIL:
    email,
  GOOGLE_APPLICATION_CREDENTIALS:
    storedKey,
  ABIDE_BRIDGE_DRY_RUN:
    "false"
});

console.log("");
console.log(
  "✓ Firebase Admin key copied into abide-bridge/.secrets/"
);
console.log(
  "✓ .env configured locally"
);
console.log(
  "✓ Real create_task writes enabled"
);
console.log("");
console.log(
  "Checking access..."
);

process.env.FIREBASE_PROJECT_ID =
  "abide-809d9";
process.env.ABIDE_TARGET_EMAIL =
  email;
process.env.GOOGLE_APPLICATION_CREDENTIALS =
  storedKey;
process.env.ABIDE_BRIDGE_DRY_RUN =
  "false";

const {
  resolveTargetUser
} =
  await import(
    "./firebaseAdmin.js"
  );

try {
  const user =
    await resolveTargetUser();

  console.log(
    `✓ Firebase connected. Target Abide UID resolved for ${user.email}.`
  );
} catch (error) {
  console.error("");
  console.error(
    `Firebase check failed: ${error.message}`
  );
  console.error(
    "The configuration was saved, but do not run a real simulator test until this is resolved."
  );
  rl.close();
  process.exit(1);
}

console.log("");
console.log(
  "Setup complete."
);
console.log(
  "You may delete the original JSON key from Downloads after confirming the .secrets copy exists."
);
console.log("");

rl.close();
