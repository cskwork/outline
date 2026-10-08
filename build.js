/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable no-undef */
const { execFile } = require("child_process");
const { readdirSync, existsSync } = require("fs");
const { rm, mkdir, copyFile } = require("fs/promises");

const getDirectories = (source) =>
  readdirSync(source, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);

/**
 * Executes a program with arguments and return it as a Promise.
 * @param file {string}
 * @param args {string[]}
 * @return {Promise<string>}
 */
function execAsync(file, args) {
  return new Promise((resolve, reject) => {
    execFile(file, args, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve(stdout ? stdout : stderr);
      }
    });
  });
}

async function build() {
  // Clean previous build
  console.log("Clean previous build…");

  await Promise.all([
    rm("./build/server", { recursive: true, force: true }),
    rm("./build/plugins", { recursive: true, force: true }),
  ]);

  const d = getDirectories("./plugins");

  // Compile server and shared
  console.log("Compiling…");
  await Promise.all([
    execAsync(process.execPath, [require.resolve("@babel/cli/bin/babel.js"), "--extensions", ".ts,.tsx", "--quiet", "-d", "./build/server", "./server"]),
    execAsync(process.execPath, [require.resolve("@babel/cli/bin/babel.js"), "--extensions", ".ts,.tsx", "--quiet", "-d", "./build/shared", "./shared"]),
    ...d.map(async (plugin) => {
      const hasServer = existsSync(`./plugins/${plugin}/server`);

      if (hasServer) {
        await execAsync(process.execPath, [require.resolve("@babel/cli/bin/babel.js"), "--extensions", ".ts,.tsx", "--quiet", "-d", `./build/plugins/${plugin}/server`, `./plugins/${plugin}/server`]);
      }

      const hasShared = existsSync(`./plugins/${plugin}/shared`);

      if (hasShared) {
        await execAsync(process.execPath, [require.resolve("@babel/cli/bin/babel.js"), "--extensions", ".ts,.tsx", "--quiet", "-d", `./build/plugins/${plugin}/shared`, `./plugins/${plugin}/shared`]);
      }
    }),
  ]);

  // Copy static files
  console.log("Copying static files…");
  await Promise.all([
    copyFile("./server/collaboration/Procfile", "./build/server/collaboration/Procfile"),
    copyFile("./server/static/error.dev.html", "./build/server/error.dev.html"),
    copyFile("./server/static/error.prod.html", "./build/server/error.prod.html"),
    copyFile("package.json", "./build/package.json"),
    ...d.map(async (plugin) => {
      try {
        await mkdir(`./build/plugins/${plugin}`, { recursive: true });
        await copyFile(`./plugins/${plugin}/plugin.json`, `./build/plugins/${plugin}/plugin.json`);
      } catch {
        // Preserve optional plugin-manifest copy behavior.
      }
    }),
  ]);

  console.log("Done!");
}

void build();
