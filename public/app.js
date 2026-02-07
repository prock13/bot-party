// Elements
const configPanel = document.getElementById("configPanel");
const gamePanel = document.getElementById("gamePanel");
const analyticsPanel = document.getElementById("analyticsPanel");
const logEl = document.getElementById("log");
const startBtn = document.getElementById("startBtn");
const backBtn = document.getElementById("backBtn");
const analyticsBtn = document.getElementById("analyticsBtn");
const statusEl = document.getElementById("status");
const roundsInput = document.getElementById("roundsInput");
const allowEarlyVoteInput = document.getElementById("allowEarlyVote");
const playerList = document.getElementById("playerList");
const addPlayerBtn = document.getElementById("addPlayerBtn");
const playerCountEl = document.getElementById("playerCount");
const locationSelect = document.getElementById("locationSelect");
const locationFileInput = document.getElementById("locationFileInput");
const importLocationBtn = document.getElementById("importLocationBtn");
const exportLocationBtn = document.getElementById("exportLocationBtn");
const locationCountEl = document.getElementById("locationCount");

// Provider capabilities (fetched from server)
let providerInfo = {
	openai: { displayName: "GPT", supportsStateful: true },
	anthropic: { displayName: "Claude", supportsStateful: false },
	google: { displayName: "Gemini", supportsStateful: true },
};

// Player types (built dynamically from provider info)
function getPlayerTypes() {
	return [
		{ value: "openai", label: `🤖 ${providerInfo.openai?.displayName || "GPT"} (OpenAI)` },
		{ value: "anthropic", label: `🤖 ${providerInfo.anthropic?.displayName || "Claude"} (Anthropic)` },
		{ value: "google", label: `🤖 ${providerInfo.google?.displayName || "Gemini"} (Google)` },
		{ value: "human", label: "👤 Human" },
	];
}

// Default players: one of each AI provider with memory mode
let players = [
	{ type: "openai", mode: "memory" },
	{ type: "anthropic", mode: "memory" },
	{ type: "google", mode: "memory" },
];

// Fetch provider capabilities from server
async function loadProviderInfo() {
	try {
		const res = await fetch("/api/providers");
		if (res.ok) {
			providerInfo = await res.json();
			renderPlayers(); // Re-render with updated info
		}
	} catch (e) {
		console.warn("Failed to load provider info, using defaults", e);
	}
}

// Check if a provider type supports stateful mode
function supportsStateful(type) {
	return providerInfo[type]?.supportsStateful ?? false;
}

function renderPlayers() {
	playerList.innerHTML = "";
	players.forEach((player, index) => {
		const slot = document.createElement("div");
		slot.className = "player-slot";

		const num = document.createElement("span");
		num.className = "player-num";
		num.textContent = (index + 1) + ".";

		// Type selector
		const typeSelect = document.createElement("select");
		typeSelect.className = "type-select";
		typeSelect.dataset.index = index;
		getPlayerTypes().forEach(pt => {
			const opt = document.createElement("option");
			opt.value = pt.value;
			opt.textContent = pt.label;
			if (pt.value === player.type) opt.selected = true;
			typeSelect.appendChild(opt);
		});
		typeSelect.addEventListener("change", (e) => {
			players[index].type = e.target.value;
			// Reset mode to memory if switching to a type that doesn't support stateful
			if (!supportsStateful(e.target.value)) {
				players[index].mode = "memory";
			}
			renderPlayers();
		});

		// Mode selector (only for AI players)
		const modeSelect = document.createElement("select");
		modeSelect.className = "mode-select";
		const isAI = player.type !== "human";
		const canStateful = supportsStateful(player.type);

		const memoryOpt = document.createElement("option");
		memoryOpt.value = "memory";
		memoryOpt.textContent = "Memory";
		if (player.mode === "memory") memoryOpt.selected = true;
		modeSelect.appendChild(memoryOpt);

		const statefulOpt = document.createElement("option");
		statefulOpt.value = "stateful";
		statefulOpt.textContent = "Stateful";
		if (player.mode === "stateful") statefulOpt.selected = true;
		statefulOpt.disabled = !canStateful;
		modeSelect.appendChild(statefulOpt);

		modeSelect.disabled = !isAI;
		modeSelect.title = !isAI ? "N/A for humans" : (!canStateful ? "Stateful mode not supported by this provider" : "Agent conversation mode");
		modeSelect.addEventListener("change", (e) => {
			players[index].mode = e.target.value;
		});

		const removeBtn = document.createElement("button");
		removeBtn.type = "button";
		removeBtn.className = "remove-btn";
		removeBtn.textContent = "×";
		removeBtn.title = "Remove player";
		removeBtn.addEventListener("click", () => {
			if (players.length > 2) {
				players.splice(index, 1);
				renderPlayers();
			} else {
				alert("Minimum 2 players required.");
			}
		});

		slot.appendChild(num);
		slot.appendChild(typeSelect);
		slot.appendChild(modeSelect);
		slot.appendChild(removeBtn);
		playerList.appendChild(slot);
	});

	playerCountEl.textContent = players.length + " player" + (players.length !== 1 ? "s" : "");
}

addPlayerBtn.addEventListener("click", () => {
	if (players.length >= 8) {
		alert("Maximum 8 players.");
		return;
	}
	// Cycle through AI providers for new players
	const aiTypes = ["openai", "anthropic", "google"];
	const aiCount = players.filter(p => p.type !== "human").length;
	const nextType = aiTypes[aiCount % aiTypes.length];
	players.push({ type: nextType, mode: "memory" });
	renderPlayers();
});

// Initialize player list
renderPlayers();
loadProviderInfo(); // Fetch actual provider capabilities from server
loadLocations(); // Load available locations

// Location management
async function loadLocations() {
	try {
		const res = await fetch("/api/locations");
		if (res.ok) {
			const locations = await res.json();
			populateLocationSelect(locations);
			updateLocationCount();
		}
	} catch (e) {
		console.warn("Failed to load locations", e);
	}
}

function populateLocationSelect(locations) {
	// Keep the "Random" option
	while (locationSelect.options.length > 1) {
		locationSelect.remove(1);
	}
	
	locations.forEach(loc => {
		const opt = document.createElement("option");
		opt.value = loc.location;
		opt.textContent = loc.location;
		locationSelect.appendChild(opt);
	});
}

async function updateLocationCount() {
	try {
		const res = await fetch("/api/locations/count");
		if (res.ok) {
			const count = await res.json();
			locationCountEl.textContent = `${count.total} location${count.total !== 1 ? 's' : ''}`;
			if (count.custom > 0) {
				locationCountEl.textContent += ` (${count.custom} custom)`;
			}
		}
	} catch (e) {
		console.warn("Failed to get location count", e);
	}
}

importLocationBtn.addEventListener("click", () => {
	locationFileInput.click();
});

locationFileInput.addEventListener("change", async (e) => {
	const file = e.target.files[0];
	if (!file) return;
	
	try {
		const text = await file.text();
		const res = await fetch("/api/locations/import", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: text
		});
		
		if (res.ok) {
			const result = await res.json();
			await loadLocations();
			alert(`Successfully imported locations! Total: ${result.count.total}`);
		} else {
			const error = await res.json();
			alert(`Import failed: ${error.error}`);
		}
	} catch (e) {
		alert(`Import failed: ${e.message}`);
	}
	
	// Reset file input
	locationFileInput.value = "";
});

exportLocationBtn.addEventListener("click", async () => {
	try {
		const res = await fetch("/api/locations/export");
		if (res.ok) {
			const blob = await res.blob();
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = "locations.json";
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		}
	} catch (e) {
		alert(`Export failed: ${e.message}`);
	}
});

// Analytics functions
async function loadAnalytics() {
	try {
		const res = await fetch("/api/analytics/summary");
		if (!res.ok) {
			console.error("Failed to load analytics");
			return;
		}
		
		const summary = await res.json();
		displayAnalyticsSummary(summary);
	} catch (e) {
		console.error("Error loading analytics:", e);
	}
}

function displayAnalyticsSummary(summary) {
	// Overview stats
	document.getElementById("totalGames").textContent = summary.totalGames || 0;
	
	if (summary.totalGames > 0) {
		const avgMinutes = Math.round(summary.avgGameDuration / 1000 / 60);
		document.getElementById("avgDuration").textContent = `${avgMinutes}m`;
		document.getElementById("avgTurns").textContent = summary.avgTurnsPerGame?.toFixed(1) || "-";
		
		// Win rates
		const spyWins = summary.spyWins || 0;
		const civilianWins = summary.civilianWins || 0;
		const total = spyWins + civilianWins;
		
		if (total > 0) {
			const spyPct = ((spyWins / total) * 100).toFixed(1);
			const civilianPct = ((civilianWins / total) * 100).toFixed(1);
			document.getElementById("spyWinRate").textContent = `${spyWins} (${spyPct}%)`;
			document.getElementById("civilianWinRate").textContent = `${civilianWins} (${civilianPct}%)`;
		} else {
			document.getElementById("spyWinRate").textContent = "0 (0%)";
			document.getElementById("civilianWinRate").textContent = "0 (0%)";
		}
		
		// Provider stats
		const providerStatsEl = document.getElementById("providerStats");
		providerStatsEl.innerHTML = "";
		
		const providers = Object.entries(summary.providerStats || {}).sort((a, b) => b[1].totalGames - a[1].totalGames);
		
		providers.forEach(([provider, stats]) => {
			const winRate = stats.gamesPlayed > 0 
				? ((stats.wins / stats.gamesPlayed) * 100).toFixed(1) 
				: 0;
			
			const row = document.createElement("div");
			row.className = "stat-row";
			row.innerHTML = `
				<span class="stat-label">${provider}</span>
				<span class="stat-value">${stats.wins}/${stats.gamesPlayed} (${winRate}%)</span>
			`;
			providerStatsEl.appendChild(row);
		});
		
		// Location stats (top 5)
		const locationStatsEl = document.getElementById("locationStats");
		locationStatsEl.innerHTML = "";
		
		const locations = (summary.locationStats || [])
			.slice(0, 5);
		
		locations.forEach((stats) => {
			const row = document.createElement("div");
			row.className = "stat-row";
			row.innerHTML = `
				<span class="stat-label">${stats.location}</span>
				<span class="stat-value">${stats.gamesPlayed} games</span>
			`;
			locationStatsEl.appendChild(row);
		});
		
		// Recent games
		loadRecentGames();
	} else {
		// No games yet
		document.getElementById("avgDuration").textContent = "-";
		document.getElementById("avgTurns").textContent = "-";
		document.getElementById("spyWinRate").textContent = "-";
		document.getElementById("civilianWinRate").textContent = "-";
		document.getElementById("providerStats").innerHTML = '<div class="stat-row"><span class="stat-label">No games yet</span></div>';
		document.getElementById("locationStats").innerHTML = '<div class="stat-row"><span class="stat-label">No games yet</span></div>';
		document.getElementById("recentGames").innerHTML = '<div style="text-align:center;padding:2rem;color:var(--muted);">No games recorded yet</div>';
	}
}

async function loadRecentGames() {
	try {
		const res = await fetch("/api/analytics/games");
		if (!res.ok) return;
		
		const games = await res.json();
		const recentGamesEl = document.getElementById("recentGames");
		recentGamesEl.innerHTML = "";
		
		if (games.length === 0) {
			recentGamesEl.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--muted);">No games recorded yet</div>';
			return;
		}
		
		// Show last 10 games
		games.slice(0, 10).forEach(game => {
			const date = new Date(game.timestamp);
			const dateStr = date.toLocaleDateString() + " " + date.toLocaleTimeString();
			
			const winner = game.winner === "spy" ? "🕵️ Spy" : game.winner === "civilians" ? "👥 Civilians" : "Draw";
			const duration = Math.round(game.duration / 1000 / 60);
			
			const item = document.createElement("div");
			item.className = "game-item";
			item.innerHTML = `
				<div class="game-item-header">
					<span class="game-item-id">${game.gameId.substring(0, 8)}</span>
					<span class="game-item-date">${dateStr}</span>
				</div>
				<div class="game-item-details">
					<span>📍 ${game.location}</span>
					<span>🏆 ${winner}</span>
					<span>⏱️ ${duration}m</span>
					<span>🔄 ${game.turns?.length || 0} turns</span>
				</div>
			`;
			
			recentGamesEl.appendChild(item);
		});
	} catch (e) {
		console.error("Error loading recent games:", e);
	}
}

analyticsBtn.addEventListener("click", () => {
	// Hide other panels
	configPanel.classList.add("hidden");
	gamePanel.classList.remove("active");
	analyticsPanel.style.display = "flex";
	backBtn.style.display = "block";
	backBtn.textContent = "← Back to game";
	backBtn.dataset.fromPanel = "analytics";

	// Load analytics data
	loadAnalytics();
});

// Show/hide panels
function showConfig() {
	configPanel.classList.remove("hidden");
	gamePanel.classList.remove("active");
	analyticsPanel.style.display = "none";
	backBtn.style.display = "none";
	backBtn.dataset.fromPanel = "";
	statusEl.textContent = "Ready";
	statusEl.classList.remove("live");
}

function showGame() {
	configPanel.classList.add("hidden");
	analyticsPanel.style.display = "none";
	gamePanel.classList.add("active");
	backBtn.style.display = "inline-block";
	backBtn.textContent = "← New Game";
	backBtn.dataset.fromPanel = "game";
}

backBtn.addEventListener("click", () => {
	if (backBtn.dataset.fromPanel === "analytics") {
		showGame();
	} else {
		showConfig();
	}
});

// Log section handling
let currentSection = null;
let currentBody = null;

function sectionTitleFor(line) {
	const roundMatch = line.match(/\[Round (\d+)\]/);
	if (roundMatch) return "Round " + roundMatch[1];
	if (line.includes("VOTING PHASE")) return "Voting";
	if (line.includes("VERDICT")) return "Verdict";
	if (line.includes("attempts a final guess")) return "Spy's guess";
	if (line.includes("ACTUAL LOCATION")) return "Final score";
	return null;
}

function startSection(title, firstLine) {
	const details = document.createElement("details");
	details.className = "log-section";
	details.open = true;
	const summary = document.createElement("summary");
	summary.textContent = title;
	const body = document.createElement("div");
	body.className = "section-body";
	if (firstLine) body.appendChild(document.createTextNode(firstLine + "\n"));
	details.appendChild(summary);
	details.appendChild(body);
	logEl.appendChild(details);
	currentSection = details;
	currentBody = body;
}

function isNearBottom(el) {
	return el.scrollHeight - el.scrollTop - el.clientHeight < 80;
}
function maybeScrollToBottom() {
	if (isNearBottom(logEl)) logEl.scrollTop = logEl.scrollHeight;
}

function appendLine(line) {
	if (!currentBody) startSection("Intro", line);
	else currentBody.appendChild(document.createTextNode(line + "\n"));
	maybeScrollToBottom();
}

function appendDebugEntry(entry) {
	if (!currentBody) startSection("Intro", null);
	const phase = entry.phase.charAt(0).toUpperCase() + entry.phase.slice(1);
	const providerLabel = entry.provider === "openai" ? "OpenAI" : entry.provider === "anthropic" ? "Anthropic" : entry.provider === "google" ? "Google" : entry.provider || "";

	if (entry.kind === "sent") {
		const details = document.createElement("details");
		details.className = "inspect-inline";
		details.setAttribute("data-prompt-id", entry.id);
		const summary = document.createElement("summary");
		summary.textContent = "📋 " + phase + " (" + entry.agentName + " via " + providerLabel + ") — prompt & response";
		details.appendChild(summary);

		const promptBlock = document.createElement("div");
		promptBlock.className = "debug-block";
		const promptLabel = document.createElement("div");
		promptLabel.className = "debug-label";
		promptLabel.textContent = "Prompt (messages sent)";
		promptBlock.appendChild(promptLabel);
		const promptPre = document.createElement("pre");
		promptPre.textContent = (entry.messages || []).map(m => "[" + m.role + "]\n" + m.content).join("\n\n");
		promptBlock.appendChild(promptPre);
		details.appendChild(promptBlock);

		const responseBlock = document.createElement("div");
		responseBlock.className = "debug-block";
		responseBlock.setAttribute("data-response-block", "true");
		const responseLabel = document.createElement("div");
		responseLabel.className = "debug-label";
		responseLabel.textContent = "Response";
		responseBlock.appendChild(responseLabel);
		const responsePre = document.createElement("pre");
		responsePre.className = "response-content";
		responsePre.innerHTML = '<span style="color:var(--muted);animation:pulse 1.5s ease-in-out infinite;">⏳ Waiting for response...</span>';
		responseBlock.appendChild(responsePre);
		details.appendChild(responseBlock);

		currentBody.appendChild(details);
	} else {
		const panel = document.querySelector('[data-prompt-id="' + entry.id + '"]');
		if (panel) {
			const responsePre = panel.querySelector('.response-content');
			if (responsePre) responsePre.textContent = entry.response || "(empty)";
		}
	}
	maybeScrollToBottom();
}

function handleLine(line) {
	const title = sectionTitleFor(line);
	if (title) startSection(title, line);
	else appendLine(line);
}

function appendAgentCreated(entry) {
	if (!currentBody) startSection("Intro", null);
	const providerLabel = entry.provider === "openai" ? "OpenAI" : entry.provider === "anthropic" ? "Anthropic" : entry.provider === "google" ? "Google" : entry.provider;
	const details = document.createElement("details");
	details.className = "inspect-inline";
	const summary = document.createElement("summary");
	summary.textContent = "🤖 Agent Created: " + entry.agentName + " (" + providerLabel + ", " + entry.mode + " mode)";
	details.appendChild(summary);

	const block = document.createElement("div");
	block.className = "debug-block";
	const label = document.createElement("div");
	label.className = "debug-label";
	label.textContent = "System Prompt";
	block.appendChild(label);
	const pre = document.createElement("pre");
	pre.textContent = entry.systemPrompt;
	block.appendChild(pre);
	details.appendChild(block);
	currentBody.appendChild(details);
	maybeScrollToBottom();
}

function appendGameInfo(info) {
	if (!currentBody) startSection("Intro", null);
	const details = document.createElement("details");
	details.className = "inspect-inline";
	const summary = document.createElement("summary");
	summary.textContent = "🎮 Game Setup — location, roles, spy (spoilers!)";
	details.appendChild(summary);

	const block = document.createElement("div");
	block.className = "debug-block";
	const pre = document.createElement("pre");

	let text = "📍 LOCATION: " + info.location + "\n\n";
	text += "👥 PLAYERS:\n";
	info.players.forEach(p => {
		const marker = p.isSpy ? "🕵️ SPY" : p.role;
		text += "  • " + p.name + ": " + marker + "\n";
	});
	text += "\n📋 ROLES AT THIS LOCATION:\n  " + info.roles.join(", ") + "\n";
	text += "\n🗺️ ALL POSSIBLE LOCATIONS:\n  " + info.allLocations.join(", ") + "\n";
	text += "\n⚙️ CONFIG:\n";
	text += "  • Players: " + info.players.length + "\n";
	text += "  • Rounds: " + info.config.rounds;
	if (info.config.playerSlots) {
		text += "\n  • Slots: " + info.config.playerSlots.map(s =>
			s.type === "human" ? "human" : s.type + ":" + s.mode
		).join(", ");
	}

	pre.textContent = text;
	block.appendChild(pre);
	details.appendChild(block);
	currentBody.appendChild(details);
	maybeScrollToBottom();
}

// SSE connection
const es = new EventSource("/api/stream");
es.onopen = () => {
	if (gamePanel.classList.contains("active")) {
		statusEl.textContent = "Connected";
	}
};
es.addEventListener("log", (e) => {
	try {
		const { line } = JSON.parse(e.data);
		if (line) handleLine(line);
	} catch (_) { }
});
es.addEventListener("prompt", (e) => {
	try {
		appendDebugEntry(JSON.parse(e.data));
	} catch (_) { }
});
es.addEventListener("gameinfo", (e) => {
	try {
		appendGameInfo(JSON.parse(e.data));
	} catch (_) { }
});
es.addEventListener("agentcreated", (e) => {
	try {
		appendAgentCreated(JSON.parse(e.data));
	} catch (_) { }
});
es.onerror = () => {
	if (gamePanel.classList.contains("active")) {
		statusEl.textContent = "Reconnecting…";
		statusEl.classList.remove("live");
	}
};

// Start game
startBtn.addEventListener("click", async () => {
	const aiPlayers = players.filter(p => p.type !== "human");
	const humanPlayers = players.filter(p => p.type === "human");

	if (players.length < 2) {
		alert("Need at least 2 players.");
		return;
	}
	if (humanPlayers.length > 1) {
		alert("Only one human player is supported.");
		return;
	}
	if (aiPlayers.length === 0) {
		alert("Need at least one AI player.");
		return;
	}

	startBtn.disabled = true;
	statusEl.textContent = "Starting…";
	statusEl.classList.add("live");
	currentSection = null;
	currentBody = null;
	logEl.innerHTML = "";
	showGame();

	try {
		const rounds = parseInt(roundsInput.value) || 9;
		const allowEarlyVote = allowEarlyVoteInput?.checked ?? true;
		const selectedLocation = locationSelect.value;
		
		// Encode players as "type:mode" pairs (human has no mode)
		const playersParam = players.map(p =>
			p.type === "human" ? "human" : `${p.type}:${p.mode}`
		).join(",");

		const params = {
			rounds: rounds.toString(),
			players: playersParam,
			allowEarlyVote: allowEarlyVote.toString(),
		};
		
		// Add location if not random
		if (selectedLocation) {
			params.location = selectedLocation;
		}

		const url = "/api/start?" + new URLSearchParams(params);

		const r = await fetch(url, { method: "POST" });
		if (!r.ok) throw new Error(await r.text());
		statusEl.textContent = "Game running — watch below";
	} catch (err) {
		statusEl.textContent = "Error: " + (err instanceof Error ? err.message : String(err));
		logEl.innerHTML = "";
		logEl.appendChild(document.createTextNode("[Request failed: " + (err instanceof Error ? err.message : String(err)) + "]"));
	} finally {
		startBtn.disabled = false;
	}
});
