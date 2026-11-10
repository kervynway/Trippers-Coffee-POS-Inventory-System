"use strict";

const { initDb, closeDb, databaseName } = require("./db");

if (require.main === module) {
  (async () => {
    try {
      await initDb();
      console.log(`Schema ready in "${databaseName}".`);
    } catch (error) {
      console.error("Database initialization failed:", error);
      process.exitCode = 1;
    } finally {
      await closeDb();
    }
  })();
}

module.exports = { initDb };
