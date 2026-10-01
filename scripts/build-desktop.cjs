const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const { spawn } = require("child_process");

const { ensureSafeWorkdir } = require("./safe-workdir.cjs");

const projectRoot = path.resolve(__dirname, "..");
const desktopDistDirName = ".next-desktop";
const desktopDistDir = path.join(projectRoot, desktopDistDirName);
const safeCwd = ensureSafeWorkdir(projectRoot);

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? projectRoot,
      env: options.env ?? process.env,
      stdio: "inherit",
      windowsHide: true,
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${path.basename(command)} exited with code ${code}`));
    });
  });
}

async function removePath(targetPath) {
  const resolved = path.resolve(targetPath);
  const relative = path.relative(desktopDistDir, resolved);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Refusing to remove a path outside the desktop build: ${resolved}`);
  }
  await fsp.rm(resolved, { recursive: true, force: true });
}

async function copyFileWithParents(sourcePath, targetPath) {
  await fsp.mkdir(path.dirname(targetPath), { recursive: true });
  await fsp.copyFile(sourcePath, targetPath);
}

async function copyDirectory(sourceDir, targetDir) {
  await fsp.mkdir(targetDir, { recursive: true });
  const entries = await fsp.readdir(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, targetPath);
    } else {
      await copyFileWithParents(sourcePath, targetPath);
    }
  }
}

async function pathExists(targetPath) {
  try {
    await fsp.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function runNextBuild() {
  await runCommand(process.execPath, [path.join(projectRoot, "scripts", "run-next-safe.cjs"), "build"], {
    cwd: projectRoot,
    env: { ...process.env, NEXT_DIST_DIR: desktopDistDirName },
  });
}

async function prepareStandaloneBundle() {
  const standaloneRoot = path.join(desktopDistDir, "standalone");
  const serverEntry = path.join(standaloneRoot, "server.js");

  if (!(await pathExists(serverEntry))) {
    throw new Error("Next standalone server.js was not generated. Please verify next.config.mjs output settings.");
  }

  await removePath(path.join(standaloneRoot, ".next", "static"));
  await removePath(path.join(standaloneRoot, desktopDistDirName, "static"));
  await removePath(path.join(standaloneRoot, "public"));
  await removePath(path.join(standaloneRoot, "prisma"));
  await removePath(path.join(standaloneRoot, "scripts"));
  await removePath(path.join(standaloneRoot, "desktop"));

  await copyDirectory(path.join(desktopDistDir, "static"), path.join(standaloneRoot, desktopDistDirName, "static"));

  if (await pathExists(path.join(projectRoot, "public"))) {
    await copyDirectory(path.join(projectRoot, "public"), path.join(standaloneRoot, "public"));
  }

  await copyDirectory(path.join(projectRoot, "prisma", "migrations"), path.join(standaloneRoot, "prisma", "migrations"));
  await copyFileWithParents(path.join(projectRoot, "prisma", "schema.prisma"), path.join(standaloneRoot, "prisma", "schema.prisma"));
  await copyFileWithParents(
    path.join(projectRoot, "scripts", "apply-prisma-migrations.cjs"),
    path.join(standaloneRoot, "scripts", "apply-prisma-migrations.cjs"),
  );
  await copyFileWithParents(
    path.join(projectRoot, "scripts", "runtime-paths.cjs"),
    path.join(standaloneRoot, "scripts", "runtime-paths.cjs"),
  );
  await copyFileWithParents(path.join(projectRoot, "desktop", "preload.cjs"), path.join(standaloneRoot, "desktop", "preload.cjs"));

  const prismaRuntimeSource = path.join(projectRoot, "node_modules", ".prisma");
  if (await pathExists(prismaRuntimeSource)) {
    await removePath(path.join(standaloneRoot, "node_modules", ".prisma"));
    await copyDirectory(prismaRuntimeSource, path.join(standaloneRoot, "node_modules", ".prisma"));
  }
}

async function prepareDesktopBuild() {
  await runNextBuild();
  await prepareStandaloneBundle();
  console.log("Desktop bundle prepared successfully.");
}

async function startDesktopApp() {
  await prepareDesktopBuild();
  const electronBinary = require("electron");
  const desktopEnv = { ...process.env };
  delete desktopEnv.ELECTRON_RUN_AS_NODE;
  await runCommand(electronBinary, [projectRoot], {
    cwd: safeCwd,
    env: {
      ...desktopEnv,
      APP_RUNTIME: "desktop",
    },
  });
}

async function buildWindowsInstaller() {
  await prepareDesktopBuild();
  const builderCli = require.resolve("electron-builder/out/cli/cli.js");
  await runCommand(process.execPath, [builderCli, "--win", "nsis"], {
    cwd: safeCwd,
    env: {
      ...process.env,
      CSC_IDENTITY_AUTO_DISCOVERY: "false",
    },
  });
}

async function main() {
  const command = process.argv[2] ?? "prepare";

  if (command === "prepare") {
    await prepareDesktopBuild();
    return;
  }

  if (command === "start") {
    await startDesktopApp();
    return;
  }

  if (command === "dist:win") {
    await buildWindowsInstaller();
    return;
  }

  throw new Error(`Unknown desktop build command: ${command}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
