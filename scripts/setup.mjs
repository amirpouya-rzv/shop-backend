import { existsSync, copyFileSync } from "node:fs";
import { execSync } from "node:child_process";

const run = (cmd) => {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
};

if (!existsSync(".env")) {
  copyFileSync(".env.example", ".env");
  console.log("Created .env from .env.example");
}

try {
  run("npx prisma generate");
  run("npx prisma migrate deploy");
  run("npm run db:seed");
  console.log("\nSetup complete. Start the API with: npm run dev");
} catch {
  console.error(
    "\nSetup failed. Most likely the database is not reachable.\n" +
      "1. Make sure PostgreSQL is running (or run: docker compose up -d)\n" +
      "2. Check DATABASE_URL in the .env file (username, password, database name)\n" +
      "3. Run: npm run setup"
  );
  process.exit(1);
}
