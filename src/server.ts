import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { SpyfallGame } from "./game";
import type { GameConfig } from "./types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;

/** SSE clients: each can receive broadcast lines. */
const sseClients: Set<(line: string) => void> = new Set();

function broadcast(line: string): void {
    const payload = `data: ${JSON.stringify({ line })}\n\n`;
    for (const send of sseClients) {
        try {
            send(payload);
        } catch {
            // client may have disconnected
        }
    }
}

function handleStream(res: ServerResponse): void {
    res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
    });
    res.flushHeaders?.();

    const send = (payload: string) => {
        res.write(payload);
        (res as ServerResponse & { flush?: () => void }).flush?.();
    };
    sseClients.add(send);

    res.on("close", () => {
        sseClients.delete(send);
    });
}

async function handleStart(res: ServerResponse): Promise<void> {
    const defaultConfig: GameConfig = {
        numPlayers: 4,
        includeHuman: false,
        rounds: 12,
    };

    const game = new SpyfallGame();
    game.onOutput = broadcast;

    res.writeHead(202, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, message: "Game started. Watch the stream." }));

    try {
        await game.run(defaultConfig);
        broadcast("\n[Game over.]");
    } catch (err) {
        broadcast(`\n[Error: ${err instanceof Error ? err.message : String(err)}]`);
    } finally {
        game.onOutput = undefined;
    }
}

function serveHtml(res: ServerResponse): void {
    const path = join(__dirname, "..", "public", "index.html");
    const html = readFileSync(path, "utf-8");
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(html);
}

const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const url = req.url ?? "/";
    const path = url.split("?")[0];

    if (path === "/api/stream" && req.method === "GET") {
        handleStream(res);
        return;
    }
    if (path === "/api/start" && req.method === "POST") {
        void handleStart(res);
        return;
    }
    if (path === "/" && req.method === "GET") {
        serveHtml(res);
        return;
    }

    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
});

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log("Open in a browser, then click Start game to stream a run.");
});
