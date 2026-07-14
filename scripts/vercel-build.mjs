import { spawnSync } from "node:child_process";

function run(command, args) {
  const executable = process.platform === "win32" ? `${command}.cmd` : command;
  const result = spawnSync(executable, args, { stdio: "inherit", env: process.env });

  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (process.env.VERCEL_ENV === "production") {
  console.info("deploy.migrations.start");
  run("npm", ["run", "db:migrate:deploy"]);
  console.info("deploy.migrations.complete");
} else {
  console.info("deploy.migrations.skipped", { environment: process.env.VERCEL_ENV ?? "local" });
}

run("npm", ["run", "build"]);
