/**
 * @mosaix/shell — Server Bootstrapper & Main HTTP Host
 * Delegates application lifecycle, configuration, and request handling to bootstrap subsystem.
 */

import { createApp } from "../bootstrap/index.js";

const app = createApp();
await app.boot();
await app.listen();
