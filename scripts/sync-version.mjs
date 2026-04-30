/**
 * Đồng bộ version vào package.json, src-tauri/tauri.conf.json, src-tauri/Cargo.toml.
 * Gọi với env VERSION=1.2.3 (không có tiền tố v).
 */
import fs from "fs";

const v = process.env.VERSION?.trim();
if (!v) {
  console.error("sync-version: thiếu biến môi trường VERSION");
  process.exit(1);
}

const pkgPath = "package.json";
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
pkg.version = v;
fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

const tauriPath = "src-tauri/tauri.conf.json";
const tauri = JSON.parse(fs.readFileSync(tauriPath, "utf8"));
tauri.version = v;
fs.writeFileSync(tauriPath, `${JSON.stringify(tauri, null, 2)}\n`);

const cargoPath = "src-tauri/Cargo.toml";
let cargo = fs.readFileSync(cargoPath, "utf8");
cargo = cargo.replace(/^version = "[^"]+"/m, `version = "${v}"`);
fs.writeFileSync(cargoPath, cargo);

console.log(`sync-version: đã đặt version = ${v}`);
