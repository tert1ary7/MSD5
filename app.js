/**
 * MSD v5.0 - Digital Twin Engine
 * Implements Tier-1 (Threshold) and Tier-2 (Pattern) Detection
 */

const state = {
    assets: [], // Infrastructure Nodes (The "Ship")
    pools: [],  // Logical Services
    entropy: 0,
    acknowledged: new Set(),
    filter: ""
};

const VENDORS = ["MATLAB", "ANSYS", "AUTOCAD", "CATIA", "SIEMENS", "FLEXLM"];

function init() {
    // 1. Build the Digital Twin Model (The BIM Reference)
    for (let i = 1; i <= 60; i++) {
        state.assets.push({
            id: `SRV-${String(i).padStart(3, '0')}`,
            type: 'PHYSICAL_SERVER',
            status: Math.random() > 0.1 ? 'ok' : 'dark', // 10% are "Dark Nodes" (Unmonitored)
            metrics: { cpu: 20, lastSeen: Date.now() }
        });
    }

    // 2. Build the Logical Dependencies
    for (let i = 0; i < 300; i++) {
        const vendor = VENDORS[Math.floor(Math.random() * VENDORS.length)];
        state.pools.push({
            id: `${vendor}_${2000 + i}`,
            vendor: vendor,
            hostRefs: [state.assets[Math.floor(Math.random() * 60)].id],
            status: 'ok',
            tier2Flag: false // Pattern anomaly flag
        });
    }

    renderBIM();
    renderHexes();
    setInterval(simulationLoop, 3000);
}

function renderBIM() {
    const container = document.getElementById('topo-map');
    container.innerHTML = state.assets.map(a => `
        <div class="asset-node ${a.status}" id="asset-${a.id}">
            <strong>${a.id}</strong>
            <span>${a.status.toUpperCase()}</span>
        </div>
    `).join('');
}

function renderHexes() {
    const container = document.getElementById('service-grid');
    container.innerHTML = state.pools.map(p => `
        <div class="hex ${p.status}" id="hex-${p.id}" onclick="inspect('${p.id}')">
            ${p.vendor.substring(0,3)}
        </div>
    `).join('');
}

function simulationLoop() {
    // Inject Random Failures & Anomalies
    state.assets.forEach(a => {
        if (a.status !== 'dark' && Math.random() > 0.98) {
            a.status = 'error'; // Tier 1 Failure
        }
    });

    state.pools.forEach(p => {
        // Tier 2 Anomaly Detection Logic
        // Simulate a "Flatline" - data is coming in, but doesn't change
        if (Math.random() > 0.99) p.tier2Flag = true; 
        
        const host = state.assets.find(a => a.id === p.hostRefs[0]);
        if (host.status === 'error') p.status = 'crit';
        else if (p.tier2Flag) p.status = 'anomaly';
        else if (host.status === 'dark') p.status = 'dark';
        else p.status = 'ok';
    });

    updateUI();
}

function updateUI() {
    let entropyTotal = 0;
    let darkCount = 0;
    let anomalyCount = 0;

    state.pools.forEach(p => {
        const el = document.getElementById(`hex-${p.id}`);
        const isAck = state.acknowledged.has(p.id);
        
        el.className = `hex ${p.status} ${isAck ? 'ack' : ''}`;
        
        // Entropy Calculation: weighted chaos
        if (p.status === 'crit') entropyTotal += 5;
        if (p.status === 'anomaly') { entropyTotal += 2; anomalyCount++; }
        if (p.status === 'dark') darkCount++;
    });

    // Update Global KPI
    const entropyScore = Math.min(entropyTotal / 10, 100).toFixed(2);
    document.getElementById('entropy-val').innerText = entropyScore;
    document.getElementById('entropy-bar').style.width = `${entropyScore}%`;
    document.getElementById('entropy-bar').style.background = entropyScore > 50 ? 'var(--crit)' : 'var(--ok)';
    document.getElementById('dark-nodes').innerText = darkCount;
    document.getElementById('anomaly-count').innerText = anomalyCount;

    // Update Physical BIM nodes
    state.assets.forEach(a => {
        const el = document.getElementById(`asset-${a.id}`);
        el.className = `asset-node ${a.status}`;
    });
}

function inspect(id) {
    const pool = state.pools.find(p => p.id === id);
    const overlay = document.getElementById('overlay');
    document.getElementById('ov-title').innerText = pool.id;
    document.getElementById('ov-content').innerHTML = `
        <p><strong>Vendor:</strong> ${pool.vendor}</p>
        <p><strong>Primary Host:</strong> ${pool.hostRefs[0]}</p>
        <p><strong>Status:</strong> ${pool.status.toUpperCase()}</p>
        <hr>
        <p><em>Tier 2 Diagnostics:</em> ${pool.tier2Flag ? 'Unusual pattern detected (Flatline/Spike)' : 'Patterns Nominal'}</p>
    `;
    overlay.classList.remove('hidden');
    state.currentSelected = id;
}

function acknowledgeAlert() {
    state.acknowledged.add(state.currentSelected);
    closeOverlay();
    updateUI();
}

function closeOverlay() { document.getElementById('overlay').classList.add('hidden'); }

window.onload = init;
