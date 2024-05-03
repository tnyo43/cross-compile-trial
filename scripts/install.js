const fs = require("node:fs");
const path = require("node:path");
const https = require("follow-redirects/https");
const { exit } = require("node:process");

const DISTRIBUTION_VERSION = require("../package.json").version;
const { platform, arch } = process;

const BIN_NAME_OF_PLATFORM = {
  darwin: {
    x64: "main-x86_64-apple-darwin",
    arm64: "main-aarch64-apple-darwin",
  },
};

const binName = BIN_NAME_OF_PLATFORM[platform]?.[arch];

if (!binName) {
  console.warn(
    "This package doesn't ship with prebuilt binaries for your platform yet."
  );
  exit(1);
}

async function downloadAssetUrl() {
  const result = await fetch(
    `https://api.github.com/repos/tnyo43/cross-compile-trial/releases/tags/v${DISTRIBUTION_VERSION}`
  );

  const data = await result.json();
  const asset = data.assets.find((value) => value.name === binName);
  return asset.url;
}

async function downloadBinary() {
  const urlBase = await downloadAssetUrl();
  const url = new URL(urlBase);
  const hostname = url.hostname;
  const path = url.pathname;

  const filePath = "bin/main";

  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filePath);
    let fileInfo = null;

    const request = https.request(
      {
        hostname,
        path,
        headers: {
          Accept: "application/octet-stream",
          "User-Agent": "@tnyo43/cross-compile-trial",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      },
      (response) => {
        if (response.statusCode !== 200) {
          fs.unlink(filePath, () => {
            reject(
              new Error(`Failed to get '${url}' (${response.statusCode})`)
            );
          });
          return;
        }

        fileInfo = {
          mime: response.headers["content-type"],
          size: parseInt(response.headers["content-length"], 10),
        };
        response.pipe(file);
      }
    );

    file.on("finish", () => resolve(fileInfo));
    file.on("error", (err) => {
      console.log("file error", err);
      fs.unlink(filePath, () => reject(err));
    });

    request.end();
  });
}

downloadBinary();
