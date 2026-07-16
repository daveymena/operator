import("./bin/mcp-body.mjs")
  .then(m => console.log("loaded"))
  .catch(e => console.error("ERROR:", e.message));