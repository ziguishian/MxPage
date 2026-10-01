const crypto = require("crypto");
const fs = require("fs");
const fsp = require("fs/promises");
const http = require("http");
const net = require("net");
const path = require("path");
const { spawn } = require("child_process");

const { app, BrowserWindow, dialog } = require("electron");

const { toSqliteFileUrl } = require("../scripts/runtime-paths.cjs");

let mainWindow = null;
let splashWindow = null;
let serverProcess = null;
let serverUrl = null;
let isQuitting = false;

function getWindowIcon() {
  return app.isPackaged
    ? path.join(process.resourcesPath, "icon.ico")
    : path.join(__dirname, "../public/brand-icon.ico");
}

function getStandaloneRoot() {
  return path.resolve(__dirname, "..", ".next-desktop", "standalone");
}

function getServerEntry() {
  return path.join(getStandaloneRoot(), "server.js");
}

function getMigrationScript() {
  return path.join(getStandaloneRoot(), "scripts", "apply-prisma-migrations.cjs");
}

async function ensureDir(dirPath) {
  await fsp.mkdir(dirPath, { recursive: true });
}

async function readJson(filePath) {
  try {
    return JSON.parse(await fsp.readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

async function writeJson(filePath, value) {
  await ensureDir(path.dirname(filePath));
  await fsp.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function ensureDesktopRuntimeConfig() {
  const userDataDir = app.getPath("userData");
  const prismaDir = path.join(userDataDir, "prisma");
  const storageDir = path.join(userDataDir, "storage");
  const configPath = path.join(userDataDir, "config", "runtime.json");

  await Promise.all([ensureDir(userDataDir), ensureDir(prismaDir), ensureDir(storageDir)]);

  const currentConfig = (await readJson(configPath)) ?? {};
  const appSecret =
    typeof currentConfig.appSecret === "string" && currentConfig.appSecret.length >= 12
      ? currentConfig.appSecret
      : crypto.randomBytes(32).toString("hex");

  const nextConfig = {
    appSecret,
    updatedAt: new Date().toISOString(),
  };

  await writeJson(configPath, nextConfig);

  return {
    userDataDir,
    prismaDir,
    storageDir,
    databasePath: path.join(prismaDir, "dev.db"),
    appSecret,
  };
}

function getRuntimeEnv(runtime, port) {
  return {
    ...process.env,
    NODE_ENV: "production",
    PORT: String(port),
    HOSTNAME: "127.0.0.1",
    APP_RUNTIME: "desktop",
    APP_USER_DATA_DIR: runtime.userDataDir,
    DATABASE_URL: toSqliteFileUrl(runtime.databasePath),
    STORAGE_ROOT: runtime.storageDir,
    APP_SECRET: runtime.appSecret,
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME || "MxPage",
  };
}

function spawnNodeScript(scriptPath, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath], {
      cwd: getStandaloneRoot(),
      env: {
        ...env,
        ELECTRON_RUN_AS_NODE: "1",
      },
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderr = "";
    let stdout = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(stderr || stdout || `Script failed with exit code ${code}`));
      }
    });
  });
}

function findAvailablePort(preferredPort = 3000, maxAttempts = 20) {
  const tryPort = (port, remaining) =>
    new Promise((resolve, reject) => {
      const tester = net.createServer();

      tester.once("error", (error) => {
        tester.close();
        if (remaining <= 0) {
          reject(error);
          return;
        }
        resolve(tryPort(port + 1, remaining - 1));
      });

      tester.once("listening", () => {
        const address = tester.address();
        tester.close(() => {
          if (typeof address === "object" && address && typeof address.port === "number") {
            resolve(address.port);
            return;
          }
          resolve(port);
        });
      });

      tester.listen(port, "127.0.0.1");
    });

  return tryPort(preferredPort, maxAttempts);
}

function waitForServer(url, timeoutMs = 30000) {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const attempt = () => {
      const request = http.get(url, (response) => {
        response.resume();

        if ((response.statusCode ?? 500) < 500) {
          resolve(true);
          return;
        }

        if (Date.now() - startedAt > timeoutMs) {
          reject(new Error(`Server health check failed with status ${response.statusCode}`));
          return;
        }

        setTimeout(attempt, 500);
      });

      request.on("error", () => {
        if (Date.now() - startedAt > timeoutMs) {
          reject(new Error("Timed out waiting for local desktop server to start."));
          return;
        }

        setTimeout(attempt, 500);
      });
    };

    attempt();
  });
}

async function startNextServer(runtime) {
  const serverEntry = getServerEntry();
  if (!fs.existsSync(serverEntry)) {
    throw new Error(`Missing Next standalone server entry: ${serverEntry}`);
  }

  const port = await findAvailablePort(3000);
  const env = getRuntimeEnv(runtime, port);

  serverProcess = spawn(process.execPath, [serverEntry], {
    cwd: getStandaloneRoot(),
    env: {
      ...env,
      ELECTRON_RUN_AS_NODE: "1",
    },
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  let serverErrors = "";

  serverProcess.stderr.on("data", (chunk) => {
    serverErrors += chunk.toString();
  });

  serverProcess.on("exit", (code) => {
    if (!isQuitting && code !== 0) {
      dialog.showErrorBox(
        "MxPage 启动失败",
        serverErrors || `内置服务异常退出，退出码：${code}`
      );
      app.quit();
    }
  });

  serverUrl = `http://127.0.0.1:${port}`;
  await waitForServer(serverUrl);
  return serverUrl;
}

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 460,
    height: 280,
    resizable: false,
    minimizable: false,
    maximizable: false,
    closable: true,
    frame: false,
    show: false,
    center: true,
    backgroundColor: "#111827",
    title: "MxPage",
    icon: getWindowIcon(),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  const splashHtml = `
    <!DOCTYPE html>
    <html lang="zh-CN">
      <head>
        <meta charset="UTF-8" />
        <meta
          http-equiv="Content-Security-Policy"
          content="default-src 'self' 'unsafe-inline' data:;"
        />
        <title>MxPage</title>
        <style>
          * { box-sizing: border-box; }
          html, body {
            margin: 0;
            width: 100%;
            height: 100%;
            font-family: "Segoe UI", Arial, sans-serif;
            background: linear-gradient(135deg, #111827 0%, #1f2937 100%);
            color: #ffffff;
          }
          .wrap {
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
          }
          .card {
            width: 100%;
            border-radius: 18px;
            background: rgba(255, 255, 255, 0.06);
            border: 1px solid rgba(255, 255, 255, 0.08);
            padding: 28px 24px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.32);
          }
          .title {
            font-size: 22px;
            font-weight: 700;
            letter-spacing: 0.2px;
            margin-bottom: 8px;
          }
          .desc {
            font-size: 13px;
            color: rgba(255, 255, 255, 0.72);
            line-height: 1.7;
            margin-bottom: 18px;
          }
          .status {
            font-size: 13px;
            color: #93c5fd;
            margin-bottom: 14px;
            min-height: 20px;
          }
          .bar {
            width: 100%;
            height: 8px;
            border-radius: 999px;
            overflow: hidden;
            background: rgba(255, 255, 255, 0.08);
          }
          .bar > div {
            width: 42%;
            height: 100%;
            border-radius: 999px;
            background: linear-gradient(90deg, #60a5fa, #34d399);
            animation: loading 1.2s ease-in-out infinite;
          }
          .foot {
            margin-top: 14px;
            font-size: 12px;
            color: rgba(255, 255, 255, 0.48);
          }
          @keyframes loading {
            0% { transform: translateX(-110%); }
            100% { transform: translateX(260%); }
          }
        </style>
      </head>
      <body>
        <div class="wrap">
          <div class="card">
            <div class="title">MxPage</div>
            <div class="desc">AI e-commerce detail page generation and editing workspace</div>
            <div class="status" id="status">正在启动应用...</div>
            <div class="bar"><div></div></div>
            <div class="foot">请稍候，正在初始化本地服务与数据环境</div>
          </div>
        </div>
      </body>
    </html>
  `;

  splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashHtml)}`);

  splashWindow.once("ready-to-show", () => {
    splashWindow?.show();
  });

  splashWindow.on("closed", () => {
    splashWindow = null;
  });
}

function updateSplashStatus(text) {
  if (!splashWindow || splashWindow.isDestroyed()) {
    return;
  }

  const safeText = JSON.stringify(text);
  splashWindow.webContents
    .executeJavaScript(
      `(() => {
        const el = document.getElementById("status");
        if (el) el.textContent = ${safeText};
      })();`,
      true
    )
    .catch(() => {});
}

function createMainWindow(url) {
  mainWindow = new BrowserWindow({
    width: 1520,
    height: 980,
    minWidth: 1280,
    minHeight: 820,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#f5f5f5",
    title: "MxPage",
    icon: getWindowIcon(),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.once("ready-to-show", () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
    }
    mainWindow?.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  return mainWindow.loadURL(url);
}

async function shutdownServerProcess() {
  if (!serverProcess || serverProcess.killed) {
    return;
  }

  await new Promise((resolve) => {
    const currentProcess = serverProcess;
    currentProcess.once("exit", () => resolve(null));
    currentProcess.kill();

    setTimeout(() => {
      if (!currentProcess.killed) {
        currentProcess.kill("SIGKILL");
      }
      resolve(null);
    }, 3000);
  });
}

async function bootstrapDesktopApp() {
  console.time("desktop:total");

  createSplashWindow();
  updateSplashStatus("正在准备本地运行环境...");
  console.time("desktop:runtime");
  const runtime = await ensureDesktopRuntimeConfig();
  console.timeEnd("desktop:runtime");

  updateSplashStatus("正在初始化数据库...");
  console.time("desktop:migration");
  await spawnNodeScript(getMigrationScript(), getRuntimeEnv(runtime, 3000));
  console.timeEnd("desktop:migration");

  updateSplashStatus("正在启动本地服务...");
  console.time("desktop:server");
  const url = await startNextServer(runtime);
  console.timeEnd("desktop:server");

  updateSplashStatus("正在加载界面...");
  console.time("desktop:window");
  await createMainWindow(url);
  console.timeEnd("desktop:window");

  console.timeEnd("desktop:total");
}

app.on("before-quit", async () => {
  isQuitting = true;
  await shutdownServerProcess();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", async () => {
  if (!mainWindow && serverUrl) {
    await createMainWindow(serverUrl);
  }
});

app.whenReady().then(() => {
  bootstrapDesktopApp().catch((error) => {
    dialog.showErrorBox(
      "MxPage 启动失败",
      error instanceof Error ? error.message : "未知错误"
    );
    app.quit();
  });
});
