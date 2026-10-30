import fs from "node:fs";
import path from "node:path";

/** Reads .env.local (and .env) into process.env without overriding what is already set. Values are never printed. */
export function loadEnv(root = process.cwd()) {
  for (const name of [".env.local", ".env"]) {
    const file = path.join(root, name);
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (!match || line.trim().startsWith("#")) continue;
      const value = match[2].replace(/^(['"])(.*)\1$/, "$2");
      if (value && !(match[1] in process.env)) process.env[match[1]] = value;
    }
  }
}
