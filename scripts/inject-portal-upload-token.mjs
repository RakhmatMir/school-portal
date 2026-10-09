/** Подставляет PAT из PORTAL_UPLOAD_TOKEN в portal.json перед GitHub Pages deploy (не храним в git). */
import fs from "fs";

const path = "data/portal.json";
const token = String(process.env.PORTAL_UPLOAD_TOKEN || "").trim();
const portal = JSON.parse(fs.readFileSync(path, "utf8"));

if (!portal.submissions_upload || typeof portal.submissions_upload !== "object") {
  portal.submissions_upload = { enabled: false, github_token: "" };
}

portal.submissions_upload.enabled = Boolean(token);
portal.submissions_upload.github_token = token;

fs.writeFileSync(path, `${JSON.stringify(portal, null, 2)}\n`);
console.log(
  token
    ? "inject-portal-upload-token: enabled (token length " + token.length + ")"
    : "inject-portal-upload-token: disabled (no PORTAL_UPLOAD_TOKEN secret)"
);
