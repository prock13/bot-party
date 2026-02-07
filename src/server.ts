import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import type { PromptEntry, AgentCreatedEntry } from "./agent";
import { SpyfallGame, type GameInfoEntry } from "./game";
import type { GameConfig, PlayerSlotConfig } from "./types";
import { PROVIDER_TYPES, type ProviderType, getProviderCapabilities } from "./providers";
import { AnalyticsService } from "./analytics";
import { LocationManager } from "./locations";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;

/** SSE clients: each can receive broadcast payloads (full SSE message). */
const sseClients: Set<(payload: string) => void> = new Set();

/** Shared analytics service instance */
const analytics = new AnalyticsService();

/** Shared location manager instance */
const locationManager = new LocationManager();

function broadcast(line: string): void {
    const payload = `event: log\ndata: ${JSON.stringify({ line })}\n\n`;
    for (const send of sseClients) {
        try {
            send(payload);
        } catch {
            // client may have disconnected
        }
    }
}

function broadcastPrompt(entry: PromptEntry): void {
    const payload = `event: prompt\ndata: ${JSON.stringify(entry)}\n\n`;
    for (const send of sseClients) {
        try {
            send(payload);
        } catch {
            // client may have disconnected
        }
    }
}

function broadcastGameInfo(info: GameInfoEntry): void {
    const payload = `event: gameinfo\ndata: ${JSON.stringify(info)}\n\n`;
    for (const send of sseClients) {
        try {
            send(payload);
        } catch {
            // client may have disconnected
        }
    }
}

function broadcastAgentCreated(entry: AgentCreatedEntry): void {
    const payload = `event: agentcreated\ndata: ${JSON.stringify(entry)}\n\n`;
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

/**
 * Helper to read request body
 */
function readRequestBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
        let body = "";
        req.on("data", chunk => {
            body += chunk.toString();
        });
        req.on("end", () => resolve(body));
        req.on("error", reject);
    });
}

async function handleStart(res: ServerResponse, queryString: string): Promise<void> {
    const params = new URLSearchParams(queryString);
    
    const rounds = Math.min(30, Math.max(1, parseInt(params.get("rounds") || "9") || 9));
    
    // Parse players param: "openai:memory,anthropic:memory,human,google:stateful"
    const playersParam = params.get("players");
    let playerSlots: PlayerSlotConfig[] | undefined;
    
    if (playersParam) {
        playerSlots = [];
        const slots = playersParam.split(",").map(s => s.trim());
        for (const slot of slots) {
            if (slot === "human") {
                playerSlots.push({ type: "human" });
            } else {
                const [provider, mode] = slot.split(":");
                if (PROVIDER_TYPES.includes(provider as ProviderType)) {
                    // Map "thread" (legacy) to "stateful"
                    const agentMode = (mode === "stateful" || mode === "thread") ? "stateful" : "memory";
                    playerSlots.push({
                        type: provider as ProviderType,
                        mode: agentMode,
                    });
                }
            }
        }
        // Ensure at least 2 players
        if (playerSlots.length < 2) {
            playerSlots = undefined;
        }
    }

    // Parse allowEarlyVote option (default: true)
    const allowEarlyVote = params.get("allowEarlyVote") !== "false";
    
    // Parse locationName option (if provided)
    const locationName = params.get("location") || undefined;

    const config: GameConfig = {
        rounds,
        allowEarlyVote,
        locationName,
        playerSlots,
    };

    const game = new SpyfallGame();
    game.onOutput = broadcast;
    game.onPrompt = broadcastPrompt;
    game.onGameInfo = broadcastGameInfo;
    game.onAgentCreated = broadcastAgentCreated;

    const numPlayers = playerSlots?.length ?? 3;
    res.writeHead(202, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, message: `Game started with ${numPlayers} players. Watch the stream.` }));

    try {
        await game.run(config);
        broadcast("\n[Game over.]");
    } catch (err) {
        broadcast(`\n[Error: ${err instanceof Error ? err.message : String(err)}]`);
    } finally {
        game.onOutput = undefined;
        game.onPrompt = undefined;
        game.onGameInfo = undefined;
        game.onAgentCreated = undefined;
    }
}

const MIME_TYPES: Record<string, string> = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "application/javascript",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".svg": "image/svg+xml",
};

function serveStatic(res: ServerResponse, filePath: string): boolean {
    const fullPath = join(__dirname, "..", "public", filePath);
    
    // Security: prevent path traversal
    if (!fullPath.startsWith(join(__dirname, "..", "public"))) {
        return false;
    }
    
    if (!existsSync(fullPath)) {
        return false;
    }
    
    const ext = extname(fullPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    
    try {
        const content = readFileSync(fullPath);
        res.writeHead(200, { "Content-Type": contentType });
        res.end(content);
        return true;
    } catch {
        return false;
    }
}

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = req.url ?? "/";
    const [path, queryString] = url.split("?");

    if (path === "/api/stream" && req.method === "GET") {
        handleStream(res);
        return;
    }
    if (path === "/api/providers" && req.method === "GET") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(getProviderCapabilities()));
        return;
    }
    if (path === "/api/start" && req.method === "POST") {
        void handleStart(res, queryString ?? "");
        return;
    }
    // Analytics endpoints
    if (path === "/api/analytics/summary" && req.method === "GET") {
        res.writeHead(200, { "Content-Type": "application/json" });
        const summary = analytics.generateSummary();
        res.end(JSON.stringify(summary));
        return;
    }
    if (path === "/api/analytics/games" && req.method === "GET") {
        res.writeHead(200, { "Content-Type": "application/json" });
        const games = analytics.loadAllGames();
        res.end(JSON.stringify(games));
        return;
    }
    if (path.startsWith("/api/analytics/games/") && req.method === "GET") {
        const gameId = path.substring("/api/analytics/games/".length);
        const game = analytics.loadGame(gameId);
        if (game) {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(game));
        } else {
            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Game not found" }));
        }
        return;
    }
    // Location endpoints
    if (path === "/api/locations" && req.method === "GET") {
        res.writeHead(200, { "Content-Type": "application/json" });
        const locations = locationManager.getAll();
        res.end(JSON.stringify(locations));
        return;
    }
    if (path === "/api/locations/import" && req.method === "POST") {
        try {
            const body = await readRequestBody(req);
            const imported = JSON.parse(body);
            
            if (Array.isArray(imported)) {
                locationManager.addCustomBatch(imported);
            } else {
                locationManager.addCustom(imported);
            }
            
            const count = locationManager.getCount();
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: true, count }));
        } catch (err) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: err instanceof Error ? err.message : "Invalid location data" }));
        }
        return;
    }
    if (path === "/api/locations/export" && req.method === "GET") {
        res.writeHead(200, { 
            "Content-Type": "application/json",
            "Content-Disposition": "attachment; filename=locations.json"
        });
        res.end(locationManager.exportAll());
        return;
    }
    if (path === "/api/locations/count" && req.method === "GET") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(locationManager.getCount()));
        return;
    }
    // Serve static files from public/
    if (req.method === "GET") {
        const filePath = path === "/" ? "index.html" : path.slice(1); // Remove leading /
        if (serveStatic(res, filePath)) {
            return;
        }
    }

    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
});

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log("Open in a browser, then click Start game to stream a run.");
});
