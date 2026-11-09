// server.ts
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var app = express();
var PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3e3;
var HOST = "0.0.0.0";
var distPath = path.resolve(__dirname, "dist");
var publicPath = path.resolve(__dirname, "public");
if (fs.existsSync(publicPath)) {
  app.use(express.static(publicPath));
}
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}
app.get("*", (_req, res) => {
  const indexHtml = path.resolve(distPath, "index.html");
  if (fs.existsSync(indexHtml)) {
    res.sendFile(indexHtml);
  } else {
    res.status(200).send(`
      <!DOCTYPE html>
      <html>
        <head><title>JARVIS Studio</title></head>
        <body style="background:#050b14;color:#22d3ee;font-family:monospace;padding:2rem;">
          <h2>JARVIS Studio server is running.</h2>
          <p>Please run <code>npm run build</code> to compile the frontend assets.</p>
        </body>
      </html>
    `);
  }
});
app.listen(PORT, HOST, () => {
  console.log(`JARVIS Web Server listening on http://${HOST}:${PORT}`);
});
