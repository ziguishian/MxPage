// Exercise the packaged Electron binary as Node with an isolated database/storage.
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");
const { spawn } = require("node:child_process");

async function main() {
  const unpacked = path.resolve(process.argv[2] || "dist-desktop/win-unpacked");
  const executable = path.join(unpacked, "MxPage.exe");
  const root = path.join(unpacked, "resources/app/.next-desktop/standalone");
  const runtime = await fs.mkdtemp(path.join(os.tmpdir(), "mxpage-desktop-smoke-"));
  const port = await new Promise((resolve, reject) => {
    const listener = net.createServer(); listener.on("error", reject);
    listener.listen(0, "127.0.0.1", () => { const value = listener.address().port; listener.close(() => resolve(value)); });
  });
  const env = { ...process.env, ELECTRON_RUN_AS_NODE: "1", NODE_ENV: "production", APP_RUNTIME: "desktop", DATABASE_URL: `file:${path.join(runtime, "test.db").replaceAll("\\", "/")}`, STORAGE_ROOT: path.join(runtime, "storage"), APP_SECRET: "isolated-packaging-smoke-test", PORT: String(port), HOSTNAME: "127.0.0.1" };
  delete env.LOCK_BASE_URL; delete env.FORCED_API_BASE; delete env.FORCED_API_BASE_URL;
  function start(file) {
    const child = spawn(executable, [path.join(root, file)], { cwd: root, env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let output = ""; child.stdout.on("data", data => output += data); child.stderr.on("data", data => output += data);
    const exited = new Promise((resolve, reject) => { child.on("error", reject); child.on("exit", code => resolve(code)); });
    return { child, exited, output: () => output };
  }
  const migration = start("scripts/apply-prisma-migrations.cjs");
  assert.equal(await migration.exited, 0, migration.output());
  const server = start("server.js");
  try {
    const base = `http://127.0.0.1:${port}`;
    let ready = false;
    for (let i = 0; i < 60; i++) {
      if (server.child.exitCode !== null) throw new Error(server.output());
      try { ready = (await fetch(base, { signal: AbortSignal.timeout(2000) })).ok; } catch {}
      if (ready) break;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    assert.ok(ready, server.output());
    const page = await (await fetch(base)).text();
    assert.match(page, /MxPage/);
    const list = await (await fetch(`${base}/api/projects`)).json();
    assert.ok(list.success); assert.deepEqual(list.data, [], "The package must start without developer projects");
    const created = await (await fetch(`${base}/api/projects`, { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({name:"Packaging smoke test", platform:"general_ecommerce", style:"generic_clean"}) })).json();
    assert.ok(created.success, JSON.stringify(created));
    const updated = await (await fetch(`${base}/api/projects/${created.data.id}`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({modelSnapshot:{previewConfig:{heroImageCount:10,detailSectionCount:20}}}) })).json();
    assert.ok(updated.success, JSON.stringify(updated));
    assert.equal(updated.data.modelSnapshot.previewConfig.heroImageCount, 10);
    assert.equal(updated.data.modelSnapshot.previewConfig.detailSectionCount, 20);
    assert.equal((await fetch(`${base}/projects/${created.data.id}/configure`)).status, 200);
    assert.equal((await fetch(`${base}/ecommerce-references/vivid-lime.jpg`)).status, 200);
    const files = await fs.readdir(path.join(unpacked, "resources/app"), {recursive:true});
    const forbidden = files.filter(file => /(^|[\\/])\.env(?:\.|$)|\.db(?:-|$)/i.test(file));
    assert.deepEqual(forbidden, [], "Private environment/database files must not ship");
    console.log(JSON.stringify({passed:true, version:JSON.parse(await fs.readFile(path.join(unpacked,"resources/app/package.json"),"utf8")).version, checks:["packaged Electron runtime", "fresh database migrations", "home and configuration HTTP 200", "project create/update with 10 + 20", "built-in reference assets", "no bundled environment/database"]}));
  } finally {
    server.child.kill(); await server.exited;
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
