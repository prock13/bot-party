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
const reactionFrequencySelect = document.getElementById("reactionFrequency");
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

// Default players: one of each AI provider with memory mode and neutral personality
let players = [
	{ type: "openai", mode: "memory", personality: "neutral" },
	{ type: "anthropic", mode: "memory", personality: "neutral" },
	{ type: "google", mode: "memory", personality: "neutral" },
];

// Available personalities
const personalities = [
	{ id: "neutral", name: "Balanced", desc: "Standard, no special traits" },
	{ id: "aggressive", name: "Aggressive", desc: "Direct and confrontational" },
	{ id: "quiet", name: "Quiet", desc: "Reserved and observant" },
	{ id: "paranoid", name: "Paranoid", desc: "Suspects everyone" },
	{ id: "comedic", name: "Comedic", desc: "Playful and humorous" },
	{ id: "analytical", name: "Analytical", desc: "Logical and methodical" },
	{ id: "social", name: "Social", desc: "Friendly and trusting" },
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

// Update the provider status banner
function updateProviderStatusBanner() {
	const banner = document.getElementById('providerStatusBanner');
	if (!banner) return;

	const configured = [];
	const missing = [];
	
	for (const [type, info] of Object.entries(providerInfo)) {
		if (type === 'human') continue;
		if (info.configured) {
			configured.push(info.displayName);
		} else {
			missing.push(info.displayName);
		}
	}

	if (missing.length > 0) {
		banner.style.display = 'block';
		banner.className = 'provider-status-banner warning';
		banner.innerHTML = `
			<span class="banner-icon">⚠️</span>
			<span class="banner-text">
				<strong>Missing API Keys:</strong> ${missing.join(', ')}
				${configured.length > 0 ? `<span class="banner-subtext">Available: ${configured.join(', ')}</span>` : ''}
			</span>
		`;
	} else if (configured.length > 0) {
		banner.style.display = 'block';
		banner.className = 'provider-status-banner success';
		banner.innerHTML = `
			<span class="banner-icon">✓</span>
			<span class="banner-text">All providers configured: ${configured.join(', ')}</span>
		`;
	} else {
		banner.style.display = 'none';
	}
}

// Check if a provider type supports stateful mode
function supportsStateful(type) {
	return providerInfo[type]?.supportsStateful ?? false;
}

// Check if a provider has an API key configured
function isProviderConfigured(type) {
	return providerInfo[type]?.configured ?? false;
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
			// Mark unconfigured providers
			if (pt.value !== 'human' && !isProviderConfigured(pt.value)) {
				opt.textContent = pt.label + ' (No API Key)';
				opt.disabled = true;
				opt.style.color = '#666';
			} else {
				opt.textContent = pt.label;
			}
			if (pt.value === player.type) opt.selected = true;
			typeSelect.appendChild(opt);
		});
		typeSelect.addEventListener("change", (e) => {
			const newType = e.target.value;
			// Prevent selection of unconfigured providers
			if (newType !== 'human' && !isProviderConfigured(newType)) {
				alert(`Cannot select ${providerInfo[newType]?.displayName || newType}: API key not configured. Please add the API key to your .env file.`);
				e.target.value = player.type; // Revert to previous selection
				return;
			}
			players[index].type = newType;
			// Reset mode to memory if switching to a type that doesn't support stateful
			if (!supportsStateful(newType)) {
				players[index].mode = "memory";
			}
			// Reset personality to neutral when switching to human
			if (newType === "human") {
				players[index].personality = undefined;
			} else if (!players[index].personality) {
				players[index].personality = "neutral";
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

		// Personality selector (only for AI players)
		const personalitySelect = document.createElement("select");
		personalitySelect.className = "personality-select";
		personalities.forEach(p => {
			const opt = document.createElement("option");
			opt.value = p.id;
			opt.textContent = p.name;
			opt.title = p.desc;
			if (player.personality === p.id) opt.selected = true;
			personalitySelect.appendChild(opt);
		});
		personalitySelect.disabled = !isAI;
		personalitySelect.title = !isAI ? "N/A for humans" : "Agent personality";
		personalitySelect.addEventListener("change", (e) => {
			players[index].personality = e.target.value;
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
		slot.appendChild(personalitySelect);
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
	// Cycle through AI providers for new players, skip unconfigured ones
	const aiTypes = ["openai", "anthropic", "google"].filter(type => isProviderConfigured(type));
	if (aiTypes.length === 0) {
		alert("No AI providers configured. Please add API keys to your .env file.");
		return;
	}
	const aiCount = players.filter(p => p.type !== "human").length;
	const nextType = aiTypes[aiCount % aiTypes.length];
	players.push({ type: nextType, mode: "memory", personality: "neutral" });
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
	
	// Load analytics data
	loadAnalytics();
});

// Show/hide panels
function showConfig() {
	configPanel.classList.remove("hidden");
	gamePanel.classList.remove("active");
	analyticsPanel.style.display = "none";
	backBtn.style.display = "none";
	statusEl.textContent = "Ready";
	statusEl.classList.remove("live");
}

function showGame() {
	configPanel.classList.add("hidden");
	analyticsPanel.style.display = "none";
	gamePanel.classList.add("active");
	backBtn.style.display = "inline-block";
}

backBtn.addEventListener("click", showConfig);

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
	
	// Queue event for visual board (with delay)
	if (typeof gameState !== 'undefined' && typeof visualBoardRenderer !== 'undefined') {
		const event = gameState.handleLogLine(line);
		if (event) {
			gameState.queueEvent(event);
		}
	}
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
	
	// Update visual board
	if (typeof gameState !== 'undefined' && typeof visualBoardRenderer !== 'undefined') {
		gameState.handleGameInfo(info);
		visualBoardRenderer.initialize();
	}
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

// ==================== Visual Game Board ====================

// Audio Manager for Text-to-Speech
class AudioManager {
	constructor() {
		this.synth = window.speechSynthesis;
		this.audioQueue = [];
		this.speaking = false;
		this.enabled = false;
		this.volume = 0.8;
		this.voiceMap = new Map(); // player name -> voice
		this.availableVoices = [];
		this.rate = 1.0;
		
		// Wait for voices to load
		if (this.synth) {
			this.synth.onvoiceschanged = () => {
				this.availableVoices = this.synth.getVoices();
				this.assignDefaultVoices();
			};
			
			// Try to get voices immediately (some browsers load synchronously)
			this.availableVoices = this.synth.getVoices();
			if (this.availableVoices.length > 0) {
				this.assignDefaultVoices();
			}
		}
	}
	
	assignDefaultVoices() {
		// Clear existing assignments
		this.voiceMap.clear();
		
		// Filter for English voices
		const englishVoices = this.availableVoices.filter(v => 
			v.lang.startsWith('en-')
		);
		
		if (englishVoices.length === 0) {
			console.warn('No English voices available');
			return;
		}
		
		// Assign voices to players as they're added
		// This will be called when players are set up
	}
	
	assignVoiceToPlayer(playerName, voiceIndex = null) {
		if (this.availableVoices.length === 0) return;
		
		const englishVoices = this.availableVoices.filter(v => 
			v.lang.startsWith('en-')
		);
		
		if (englishVoices.length === 0) return;
		
		let voice;
		if (voiceIndex !== null && englishVoices[voiceIndex]) {
			voice = englishVoices[voiceIndex];
		} else {
			// Assign different voice based on player index
			const playerCount = this.voiceMap.size;
			voice = englishVoices[playerCount % englishVoices.length];
		}
		
		this.voiceMap.set(playerName, voice);
	}
	
	setEnabled(enabled) {
		this.enabled = enabled;
		if (!enabled) {
			this.stop();
		}
	}
	
	setVolume(volume) {
		this.volume = Math.max(0, Math.min(1, volume));
	}
	
	setRate(rate) {
		this.rate = rate;
	}
	
	speak(text, playerName) {
		if (!this.enabled || !this.synth || !text) {
			return Promise.resolve(); // Return resolved promise if disabled
		}
		
		return new Promise((resolve) => {
			// Add to queue with resolve callback
			this.audioQueue.push({ text, playerName, resolve });
			
			// Process queue if not already speaking
			if (!this.speaking) {
				this.processQueue();
			}
		});
	}
	
	async processQueue() {
		if (this.speaking || this.audioQueue.length === 0) return;
		
		this.speaking = true;
		const { text, playerName, resolve } = this.audioQueue.shift();
		
		const utterance = new SpeechSynthesisUtterance(text);
		utterance.volume = this.volume;
		utterance.rate = this.rate;
		
		// Assign voice if available
		const voice = this.voiceMap.get(playerName);
		if (voice) {
			utterance.voice = voice;
		}
		
		utterance.onend = () => {
			this.speaking = false;
			resolve(); // Resolve the promise when done
			// Process next in queue with a small delay
			if (this.audioQueue.length > 0) {
				setTimeout(() => this.processQueue(), 100);
			}
		};
		
		utterance.onerror = () => {
			this.speaking = false;
			resolve(); // Resolve even on error to prevent hanging
			// Continue with queue on error
			if (this.audioQueue.length > 0) {
				setTimeout(() => this.processQueue(), 100);
			}
		};
		
		this.synth.speak(utterance);
	}
	
	stop() {
		if (this.synth) {
			this.synth.cancel();
			// Resolve all pending promises in the queue
			this.audioQueue.forEach(item => {
				if (item.resolve) item.resolve();
			});
			this.audioQueue = [];
			this.speaking = false;
		}
	}
	
	getAvailableVoices() {
		return this.availableVoices.filter(v => v.lang.startsWith('en-'));
	}
}

// Game State Manager
class GameStateManager {
	constructor() {
		this.reset();
		this.eventQueue = [];
		this.processing = false;
		this.paused = false;
		this.speed = 1; // 1x speed
		this.baseDelay = 1500; // Base delay in ms between events
	}

	reset() {
		this.players = [];
		this.currentRound = 0;
		this.totalRounds = 0;
		this.currentAsker = null;
		this.currentTarget = null;
		this.phase = 'setup';
		this.location = '???';
		this.currentQuestion = null;
		this.currentAnswer = null;
		this.isHumanPlayer = false;
		this.eventQueue = [];
		this.processing = false;
	}

	setSpeed(speed) {
		this.speed = speed;
	}

	setPaused(paused) {
		this.paused = paused;
		if (!paused && !this.processing) {
			this.processQueue();
		}
	}

	queueEvent(event) {
		if (event) {
			this.eventQueue.push(event);
			if (!this.processing && !this.paused) {
				this.processQueue();
			}
		}
	}

	async processQueue() {
		if (this.processing || this.paused || this.eventQueue.length === 0) {
			return;
		}

		this.processing = true;
		
		while (this.eventQueue.length > 0 && !this.paused) {
			const event = this.eventQueue.shift();
			await visualBoardRenderer.handleEvent(event);
			
			// Delay between events based on speed
			const delay = this.baseDelay / this.speed;
			await new Promise(resolve => setTimeout(resolve, delay));
		}
		
		this.processing = false;
	}

	handleGameInfo(data) {
		this.players = data.players.map((p, idx) => ({
			id: idx,
			name: p.name,
			role: p.role,
			isSpy: p.isSpy,
			isHuman: p.name === 'You',
			eliminated: false,
			suspected: false,
			votes: 0,
			avatar: this.getPlayerAvatar(p.name),
			color: this.getPlayerColor(idx)
		}));
		this.totalRounds = data.config.rounds || 9;
		this.location = data.players.find(p => p.name === 'You')?.role || '???';
		this.isHumanPlayer = data.players.some(p => p.name === 'You');
		this.phase = 'questions';
		this.actualLocation = null;
		this.accusedPlayer = null;
		this.spyPlayer = null;
		this.winner = null;
	}

	handleLogLine(line) {
		// Trim the line to remove leading/trailing whitespace (including newlines)
		const trimmedLine = line.trim();
		
		// Parse different line patterns
		const turnMatch = trimmedLine.match(/^([\w-]+) ➔ ([\w-]+)$/);
		if (turnMatch) {
			this.currentAsker = this.findPlayerByName(turnMatch[1]);
			this.currentTarget = this.findPlayerByName(turnMatch[2]);
			return { type: 'turn', asker: this.currentAsker, target: this.currentTarget };
		}

		const questionMatch = trimmedLine.match(/^Q: (.+)$/);
		if (questionMatch) {
			this.currentQuestion = questionMatch[1];
			return { type: 'question', text: this.currentQuestion, asker: this.currentAsker, target: this.currentTarget };
		}

		const answerMatch = trimmedLine.match(/^A: (.+)$/);
		if (answerMatch) {
			this.currentAnswer = answerMatch[1];
			return { type: 'answer', text: this.currentAnswer, target: this.currentTarget };
		}

		const roundMatch = trimmedLine.match(/^\[Round (\d+)\]$/);
		if (roundMatch) {
			this.currentRound = parseInt(roundMatch[1]);
			this.currentQuestion = null;
			this.currentAnswer = null;
			return { type: 'round', round: this.currentRound };
		}

		if (trimmedLine.includes('VOTING PHASE')) {
			this.phase = 'voting';
			// Reset vote counts
			this.players.forEach(p => p.votes = 0);
			return { type: 'phase', phase: 'voting' };
		}

		// Parse votes: "PlayerName voted for: TargetName (reason)"
		const voteMatch = trimmedLine.match(/^([\w-]+) voted for: ([\w-]+)/);
		if (voteMatch) {
			const voter = this.findPlayerByName(voteMatch[1]);
			const target = this.findPlayerByName(voteMatch[2]);
			if (target) {
				target.votes = (target.votes || 0) + 1;
			}
			return { type: 'vote', voter, target };
		}

		// Parse verdict: "⚖️ VERDICT: The group accuses PlayerName!"
		const verdictMatch = trimmedLine.match(/VERDICT: (?:A tie|The group accuses ([\w-]+)!)/);
		if (verdictMatch) {
			this.phase = 'verdict';
			this.accusedPlayer = verdictMatch[1] ? this.findPlayerByName(verdictMatch[1]) : null;
			return { type: 'verdict', accused: this.accusedPlayer };
		}

		// Parse spy reveal: "🕵️ REVEAL: The Spy was indeed PlayerName!"
		const revealMatch = trimmedLine.match(/REVEAL: The Spy was (?:indeed )?([\w-]+)!/);
		if (revealMatch) {
			this.spyPlayer = this.findPlayerByName(revealMatch[1]);
			return { type: 'reveal', spy: this.spyPlayer };
		}

		// Parse actual location: "📍 ACTUAL LOCATION: LocationName"
		const locationMatch = trimmedLine.match(/ACTUAL LOCATION: (.+)$/);
		if (locationMatch) {
			this.actualLocation = locationMatch[1];
			return { type: 'location_reveal', location: this.actualLocation };
		}

		// Parse result: "🏆 RESULT: SPY WINS!" or "🏆 RESULT: CIVILIANS WIN!"
		const resultMatch = trimmedLine.match(/RESULT: (SPY|CIVILIANS) WIN/);
		if (resultMatch) {
			this.winner = resultMatch[1].toLowerCase();
			return { type: 'result', winner: this.winner, message: trimmedLine };
		}

		const reactionMatch = trimmedLine.match(/^\s+(.) ([\w-]+): "(.+)"$/);
		if (reactionMatch) {
			return { 
				type: 'reaction', 
				emoji: reactionMatch[1], 
				player: this.findPlayerByName(reactionMatch[2]),
				text: reactionMatch[3]
			};
		}

		return null;
	}

	findPlayerByName(name) {
		return this.players.find(p => p.name === name);
	}

	getPlayerAvatar(name) {
		if (name === 'You') return '👤';
		if (name.includes('GPT')) return '🤖';
		if (name.includes('Claude')) return '🤖';
		if (name.includes('Gemini')) return '🤖';
		return '🤖';
	}

	getPlayerColor(index) {
		const colors = ['#a78bfa', '#22c55e', '#ef4444', '#3b82f6', '#f59e0b', '#ec4899', '#14b8a6', '#f97316'];
		return colors[index % colors.length];
	}
}

// Visual Board Renderer
class VisualBoardRenderer {
	constructor(stateManager, audioManager) {
		this.state = stateManager;
		this.audio = audioManager;
		this.playerRing = document.getElementById('playerRing');
		this.turnArrow = document.getElementById('turnArrow');
		this.arrowLine = document.getElementById('arrowLine');
		this.currentRoundEl = document.getElementById('currentRound');
		this.totalRoundsEl = document.getElementById('totalRounds');
		this.currentPhaseEl = document.getElementById('currentPhase');
		this.currentLocationEl = document.getElementById('currentLocation');
		this.turnInfo = document.getElementById('turnInfo');
		this.askerName = document.getElementById('askerName');
		this.targetName = document.getElementById('targetName');
		this.dialogDisplay = document.getElementById('dialogDisplay');
		this.reactionsContainer = document.getElementById('reactionsContainer');
		this.playerCards = new Map();
		this.currentBubbles = [];
		this.currentAsker = null;
		this.currentTarget = null;
	}

	initialize() {
		this.renderPlayers();
		this.updateGameStatus();
		this.dialogDisplay.innerHTML = '';
		
		// Assign voices to players
		if (this.audio) {
			this.state.players.forEach(player => {
				this.audio.assignVoiceToPlayer(player.name);
			});
		}
	}

	renderPlayers() {
		this.playerRing.innerHTML = '';
		this.playerCards.clear();

		const playerCount = this.state.players.length;
		const radius = 250; // Distance from center
		const centerX = 300;
		const centerY = 300;

		this.state.players.forEach((player, index) => {
			const angle = (360 / playerCount) * index - 90; // Start from top
			const rad = (angle * Math.PI) / 180;
			const x = centerX + radius * Math.cos(rad);
			const y = centerY + radius * Math.sin(rad);

			const card = this.createPlayerCard(player, x, y);
			this.playerRing.appendChild(card);
			this.playerCards.set(player.name, card);
		});
	}

	createPlayerCard(player, x, y) {
		const card = document.createElement('div');
		card.className = 'player-card';
		card.style.left = `${x}px`;
		card.style.top = `${y}px`;
		card.dataset.playerId = player.id;

		// Avatar
		const avatar = document.createElement('div');
		avatar.className = 'player-avatar';
		avatar.textContent = player.avatar;
		card.appendChild(avatar);

		// Name
		const name = document.createElement('div');
		name.className = 'player-name';
		name.textContent = player.name;
		card.appendChild(name);

		// Status
		const status = document.createElement('div');
		status.className = 'player-status';
		status.textContent = 'idle';
		card.appendChild(status);

		// Thinking dots
		const thinkingDots = document.createElement('div');
		thinkingDots.className = 'thinking-dots';
		thinkingDots.innerHTML = '<span class="thinking-dot"></span><span class="thinking-dot"></span><span class="thinking-dot"></span>';
		card.appendChild(thinkingDots);

		return card;
	}

	updateGameStatus() {
		if (this.currentRoundEl && this.state.currentRound) {
			this.currentRoundEl.textContent = this.state.currentRound;
		} else if (this.currentRoundEl) {
			this.currentRoundEl.textContent = '-';
		}
		if (this.totalRoundsEl) {
			this.totalRoundsEl.textContent = this.state.totalRounds || '-';
		}
		if (this.currentPhaseEl) {
			this.currentPhaseEl.textContent = this.capitalizePhase(this.state.phase);
		}
		if (this.currentLocationEl) {
			this.currentLocationEl.textContent = this.state.location;
		}
	}

	updateRound(round) {
		if (round && round > 0) {
			this.state.currentRound = round;
			if (this.currentRoundEl) {
				this.currentRoundEl.textContent = round;
			}
		}
	}

	capitalizePhase(phase) {
		return phase.charAt(0).toUpperCase() + phase.slice(1);
	}

	async handleEvent(event) {
		switch (event.type) {
			case 'turn':
				this.updateTurn(event.asker, event.target);
				break;
			case 'question':
				await this.showQuestion(event.text, event.asker);
				break;
			case 'answer':
				await this.showAnswer(event.text, event.target);
				break;
			case 'round':
				this.updateRound(event.round);
				break;
			case 'phase':
				this.updatePhase(event.phase);
				break;
			case 'vote':
				this.showVote(event.voter, event.target);
				break;
			case 'verdict':
				this.showVerdict(event.accused);
				break;
			case 'reveal':
				this.showSpyReveal(event.spy);
				break;
			case 'location_reveal':
				this.showLocationReveal(event.location);
				break;
			case 'result':
				this.showResult(event.winner, event.message);
				break;
			case 'reaction':
				this.showReaction(event.emoji, event.player, event.text);
				break;
		}
	}

	updateTurn(asker, target) {
		// Store current turn players
		this.currentAsker = asker;
		this.currentTarget = target;

		// Clear previous states
		this.playerCards.forEach(card => {
			card.classList.remove('active', 'target', 'thinking');
			const status = card.querySelector('.player-status');
			status.textContent = 'idle';
		});

		// Clear previous speech bubbles
		this.clearBubbles();

		if (asker && target) {
			// Set active states
			const askerCard = this.playerCards.get(asker.name);
			const targetCard = this.playerCards.get(target.name);

			if (askerCard) {
				askerCard.classList.add('active');
				askerCard.querySelector('.player-status').textContent = 'asking';
			}

			if (targetCard) {
				targetCard.classList.add('target', 'thinking');
				targetCard.querySelector('.player-status').textContent = 'answering';
			}

			// Update turn info
			this.askerName.textContent = asker.name;
			this.targetName.textContent = target.name;
			this.turnInfo.style.display = 'block';

			// Hide arrow (removed as per user request)
			this.turnArrow.style.display = 'none';
		}
	}

	clearBubbles() {
		this.currentBubbles.forEach(bubble => bubble.remove());
		this.currentBubbles = [];
	}

	positionBubbleNearPlayer(bubble, playerCard, preferredSide = 'auto') {
		const boardRect = this.playerRing.getBoundingClientRect();
		const cardRect = playerCard.getBoundingClientRect();
		
		// Calculate position relative to the board
		const cardCenterX = cardRect.left + cardRect.width / 2 - boardRect.left;
		const cardCenterY = cardRect.top + cardRect.height / 2 - boardRect.top;
		
		// Determine best position based on card location in circle
		const boardCenterX = boardRect.width / 2;
		const boardCenterY = boardRect.height / 2;
		const angle = Math.atan2(cardCenterY - boardCenterY, cardCenterX - boardCenterX);
		
		let position, direction;
		
		if (preferredSide === 'auto') {
			// Position bubble away from center
			if (Math.abs(angle) < Math.PI / 4) {
				// Right side
				position = { left: cardCenterX + 80, top: cardCenterY - 40 };
				direction = 'from-left';
			} else if (Math.abs(angle) > (3 * Math.PI) / 4) {
				// Left side
				position = { left: cardCenterX - 280 - 80, top: cardCenterY - 40 };
				direction = 'from-right';
			} else if (angle > 0) {
				// Bottom
				position = { left: cardCenterX - 140, top: cardCenterY + 80 };
				direction = 'from-top';
			} else {
				// Top
				position = { left: cardCenterX - 140, top: cardCenterY - 120 };
				direction = 'from-bottom';
			}
		}
		
		// Clamp to board bounds
		position.left = Math.max(10, Math.min(position.left, boardRect.width - 290));
		position.top = Math.max(10, Math.min(position.top, boardRect.height - 100));
		
		bubble.style.left = position.left + 'px';
		bubble.style.top = position.top + 'px';
		bubble.classList.add(direction);
	}

	async showQuestion(text, asker) {
		// Use passed asker or fallback to stored value
		const askerPlayer = asker || this.currentAsker;
		const askerCard = this.playerCards.get(askerPlayer?.name);
		if (!askerCard) return;

		const bubble = document.createElement('div');
		bubble.className = 'speech-bubble question';
		
		const label = document.createElement('div');
		label.className = 'speech-bubble-label';
		label.textContent = `${askerPlayer?.name || '?'} asks`;
		
		const textEl = document.createElement('div');
		textEl.className = 'speech-bubble-text';
		textEl.textContent = text;
		
		bubble.appendChild(label);
		bubble.appendChild(textEl);
		
		this.dialogDisplay.appendChild(bubble);
		this.currentBubbles.push(bubble);
		
		// Position after DOM insertion so we can measure
		setTimeout(() => {
			this.positionBubbleNearPlayer(bubble, askerCard);
		}, 10);
		
		// Speak the question and wait for it to complete
		if (this.audio && askerPlayer) {
			await this.audio.speak(text, askerPlayer.name);
		}
	}

	async showAnswer(text, target) {
		// Use passed target or fallback to stored value
		const targetPlayer = target || this.currentTarget;
		const targetCard = this.playerCards.get(targetPlayer?.name);
		if (!targetCard) return;

		const bubble = document.createElement('div');
		bubble.className = 'speech-bubble answer';
		
		const label = document.createElement('div');
		label.className = 'speech-bubble-label';
		label.textContent = `${targetPlayer?.name || '?'} answers`;
		
		const textEl = document.createElement('div');
		textEl.className = 'speech-bubble-text';
		textEl.textContent = text;
		
		bubble.appendChild(label);
		bubble.appendChild(textEl);
		
		this.dialogDisplay.appendChild(bubble);
		this.currentBubbles.push(bubble);
		
		// Remove thinking state from target
		targetCard.classList.remove('thinking');
		
		// Position after DOM insertion so we can measure
		setTimeout(() => {
			this.positionBubbleNearPlayer(bubble, targetCard);
		}, 10);
		
		// Speak the answer and wait for it to complete
		if (this.audio && targetPlayer) {
			await this.audio.speak(text, targetPlayer.name);
		}
	}

	drawArrow(fromRect, toRect) {
		const containerRect = this.playerRing.getBoundingClientRect();
		const fromX = fromRect.left + fromRect.width / 2 - containerRect.left;
		const fromY = fromRect.top + fromRect.height / 2 - containerRect.top;
		const toX = toRect.left + toRect.width / 2 - containerRect.left;
		const toY = toRect.top + toRect.height / 2 - containerRect.top;

		this.arrowLine.setAttribute('x1', fromX);
		this.arrowLine.setAttribute('y1', fromY);
		this.arrowLine.setAttribute('x2', toX);
		this.arrowLine.setAttribute('y2', toY);
		this.turnArrow.style.display = 'block';
	}

	showReaction(emoji, player, text) {
		const playerCard = this.playerCards.get(player?.name);
		if (!playerCard) return;

		const cardRect = playerCard.getBoundingClientRect();
		const reaction = document.createElement('div');
		reaction.className = 'reaction-popup';
		reaction.style.left = `${cardRect.left + cardRect.width / 2}px`;
		reaction.style.top = `${cardRect.top - 40}px`;
		reaction.innerHTML = `
			<span class="reaction-emoji">${emoji}</span>
			<span class="reaction-text">"${text.substring(0, 30)}${text.length > 30 ? '...' : ''}"</span>
		`;

		this.reactionsContainer.appendChild(reaction);

		// Remove after animation
		setTimeout(() => {
			reaction.remove();
		}, 3000);
	}

	updatePhase(phase) {
		this.state.phase = phase;
		this.updateGameStatus();

		if (phase === 'voting') {
			// Hide turn arrow and clear bubbles for voting
			this.turnArrow.style.display = 'none';
			this.turnInfo.style.display = 'none';
			this.clearBubbles();
			// Clear active states
			this.playerCards.forEach(card => {
				card.classList.remove('active', 'target', 'thinking');
			});
		} else if (phase === 'verdict') {
			this.turnArrow.style.display = 'none';
			this.turnInfo.style.display = 'none';
		}
	}

	showVote(voter, target) {
		if (!target) return;
		const targetCard = this.playerCards.get(target.name);
		if (!targetCard) return;

		// Update vote count badge
		let voteBadge = targetCard.querySelector('.vote-badge');
		if (!voteBadge) {
			voteBadge = document.createElement('div');
			voteBadge.className = 'vote-badge';
			targetCard.appendChild(voteBadge);
		}
		voteBadge.textContent = `${target.votes || 0} 🗳️`;
		voteBadge.style.display = 'block';

		// Add suspected state
		if (target.votes > 0) {
			targetCard.classList.add('suspected');
		}
	}

	showVerdict(accused) {
		this.clearBubbles();
		
		// Highlight the accused player
		if (accused) {
			const accusedCard = this.playerCards.get(accused.name);
			if (accusedCard) {
				accusedCard.classList.add('accused');
				const status = accusedCard.querySelector('.player-status');
				status.textContent = 'ACCUSED';
			}
		}

		// Show verdict message in center
		const verdictEl = document.createElement('div');
		verdictEl.className = 'center-announcement verdict';
		verdictEl.textContent = accused ? `${accused.name} is accused!` : 'It\'s a tie!';
		this.dialogDisplay.appendChild(verdictEl);
		this.currentBubbles.push(verdictEl);
	}

	showSpyReveal(spy) {
		if (!spy) return;
		const spyCard = this.playerCards.get(spy.name);
		if (!spyCard) return;

		// Mark spy card
		spyCard.classList.add('revealed-spy');
		const status = spyCard.querySelector('.player-status');
		status.textContent = '🕵️ SPY';

		// Add spy emoji to avatar
		const avatar = spyCard.querySelector('.player-avatar');
		if (avatar && !avatar.textContent.includes('🕵️')) {
			avatar.textContent = '🕵️';
		}
	}

	showLocationReveal(location) {
		// Update location display
		this.currentLocationEl.textContent = location;
		this.currentLocationEl.style.color = 'var(--green)';
	}

	showResult(winner, message) {
		this.clearBubbles();

		// Show winner announcement
		const resultEl = document.createElement('div');
		resultEl.className = `center-announcement result ${winner}-wins`;
		resultEl.innerHTML = `
			<div class="result-icon">${winner === 'spy' ? '🕵️' : '👥'}</div>
			<div class="result-text">${winner.toUpperCase()} WIN${winner === 'spy' ? 'S' : ''}!</div>
		`;
		this.dialogDisplay.appendChild(resultEl);
		this.currentBubbles.push(resultEl);

		// Highlight winning players
		this.playerCards.forEach(card => {
			const playerName = card.querySelector('.player-name')?.textContent;
			const player = this.state.players.find(p => p.name === playerName);
			if (!player) return;

			const isWinner = (winner === 'spy' && player.isSpy) || (winner === 'civilians' && !player.isSpy);
			if (isWinner) {
				card.classList.add('winner');
				const status = card.querySelector('.player-status');
				status.textContent = '🏆 WINNER';
			} else {
				card.classList.add('loser');
			}
		});
	}
}

// Global instances
const gameState = new GameStateManager();
const audioManager = new AudioManager();
const visualBoardRenderer = new VisualBoardRenderer(gameState, audioManager);

// View toggle handlers
const visualViewBtn = document.getElementById('visualViewBtn');
const logViewBtn = document.getElementById('logViewBtn');
const visualBoardEl = document.getElementById('visualBoard');
const pauseBtn = document.getElementById('pauseBtn');
const speedButtons = document.querySelectorAll('.speed-btn');

if (visualViewBtn && logViewBtn) {
	visualViewBtn.addEventListener('click', () => {
		visualBoardEl.style.display = 'flex';
		logEl.style.display = 'none';
		visualViewBtn.classList.add('active');
		logViewBtn.classList.remove('active');
	});

	logViewBtn.addEventListener('click', () => {
		visualBoardEl.style.display = 'none';
		logEl.style.display = 'block';
		visualViewBtn.classList.remove('active');
		logViewBtn.classList.add('active');
	});
}

// Pause/Resume control
if (pauseBtn) {
	pauseBtn.addEventListener('click', () => {
		gameState.paused = !gameState.paused;
		if (gameState.paused) {
			pauseBtn.textContent = '▶️';
			pauseBtn.classList.add('paused');
			pauseBtn.title = 'Resume';
			// Stop audio when paused
			audioManager.stop();
		} else {
			pauseBtn.textContent = '⏸️';
			pauseBtn.classList.remove('paused');
			pauseBtn.title = 'Pause';
			gameState.processQueue();
		}
	});
}

// Speed controls
speedButtons.forEach(btn => {
	btn.addEventListener('click', () => {
		const speed = parseFloat(btn.dataset.speed);
		gameState.setSpeed(speed);
		
		// Update audio rate to match visualization speed
		audioManager.setRate(speed);
		
		// Update active state
		speedButtons.forEach(b => b.classList.remove('active'));
		btn.classList.add('active');
	});
});

// Audio controls
const audioToggleBtn = document.getElementById('audioToggleBtn');
const volumeSlider = document.getElementById('volumeSlider');

if (audioToggleBtn) {
	audioToggleBtn.addEventListener('click', () => {
		const enabled = !audioManager.enabled;
		audioManager.setEnabled(enabled);
		
		if (enabled) {
			audioToggleBtn.textContent = '🔊';
			audioToggleBtn.title = 'Disable Voice';
			audioToggleBtn.classList.add('active');
		} else {
			audioToggleBtn.textContent = '🔇';
			audioToggleBtn.title = 'Enable Voice';
			audioToggleBtn.classList.remove('active');
		}
	});
}

if (volumeSlider) {
	volumeSlider.addEventListener('input', (e) => {
		const volume = parseInt(e.target.value) / 100;
		audioManager.setVolume(volume);
	});
}

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
		const reactionFrequency = reactionFrequencySelect?.value || "sometimes";
		const selectedLocation = locationSelect.value;
		
		// Encode players as "type:mode:personality" strings (human has no mode/personality)
		const playersParam = players.map(p => {
			if (p.type === "human") return "human";
			const personality = p.personality && p.personality !== "neutral" ? `:${p.personality}` : "";
			return `${p.type}:${p.mode}${personality}`;
		}).join(",");

		const params = {
			rounds: rounds.toString(),
			players: playersParam,
			allowEarlyVote: allowEarlyVote.toString(),
			reactionFrequency: reactionFrequency,
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
