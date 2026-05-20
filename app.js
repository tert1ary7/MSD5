/**
 * MSD v7.0 - Geographic Routing & Concurrency Engine
 */

// 1. Data Definitions
const NODES = {
    sfo: { x: 180, y: 220, label: "SFO_DATACENTER", vel: "high", status: "active" },
    aus: { x: 260, y: 260, label: "TX_HUB", vel: "med", status: "active" },
    nyc: { x: 340, y: 200, label: "NYC_DATACENTER", vel: "low", status: "active" },
    lon: { x: 580, y: 160, label: "LON_DATACENTER", vel: "low", status: "amber" },
    tok: { x: 1020, y: 230, label: "TOK_HUB", vel: "low", status: "active" }
};

const CHORDS = [
    { from: "sfo", to: "aus", type: "normal" },
    { from: "aus", to: "nyc", type: "normal" },
    { from: "sfo", to: "nyc", type: "normal" },
    { from: "nyc", to: "lon", type: "conflict" }, // Routing Leakage
    { from: "tok", to: "sfo", type: "normal" }
];

// Deep analysis hex clusters (Off-coast pop-outs)
const CLUSTERS = [
    { parent: "sfo", cx: 80, cy: 350, name: "SFO_POOL_USAGE", active: 5, warn: 1, total: 7 },
    { parent: "nyc", cx: 450, cy: 320, name: "NYC_POOL_USAGE", active: 3, warn: 0, total: 7 }
];

const HEX_RADIUS = 12;

// 2. Geometry Engine
function getHexPath(x, y, radius) {
    const pts = [];
    for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 180) * (60 * i - 30);
        pts.push(`${x + radius * Math.cos(angle)},${y + radius * Math.sin(angle)}`);
    }
    return `M ${pts.join(' L ')} Z`;
}

// Map logical hex positions to a clustered grid
function getClusterCoordinates(cx, cy, index, radius) {
    if (index === 0) return { x: cx, y: cy };
    const a = (Math.PI / 180) * (60 * (index - 1) - 30);
    const dist = radius * 1.8;
    return { x: cx + dist * Math.cos(a), y: cy + dist * Math.sin(a) };
}

// 3. Render Functions
function renderMapLayer() {
    const gChords = document.getElementById('layer-chords');
    const gPackets = document.getElementById('layer-packets');
    const gNodes = document.getElementById('layer-nodes');

    // Draw Nodes
    Object.keys(NODES).forEach(key => {
        const n = NODES[key];
        const hex = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        hex.setAttribute('d', getHexPath(n.x, n.y, 14));
        // Apply transform origin for proper pulsing animation
        hex.style.transformOrigin = `${n.x}px ${n.y}px`;
        hex.setAttribute('class', `hex node ${n.status} velocity-${n.vel}`);
        gNodes.appendChild(hex);
    });

    // Draw Chords and Animate Data Packets
    CHORDS.forEach((c, idx) => {
        const n1 = NODES[c.from], n2 = NODES[c.to];
        const ctrlX = (n1.x + n2.x) / 2;
        const ctrlY = Math.min(n1.y, n2.y) - 60;
        const pathData = `M ${n1.x} ${n1.y} Q ${ctrlX} ${ctrlY} ${n2.x} ${n2.y}`;
        const pathId = `path-${idx}`;

        // The line itself
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', pathData);
        path.setAttribute('id', pathId);
        path.setAttribute('class', `chord ${c.type}`);
        gChords.appendChild(path);

        // The animated packet flowing along the line
        const packet = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        packet.setAttribute('r', '3');
        packet.setAttribute('fill', c.type === 'conflict' ? 'var(--amber)' : 'var(--cyan)');
        
        const animate = document.createElementNS('http://www.w3.org/2000/svg', 'animateMotion');
        animate.setAttribute('dur', c.type === 'conflict' ? '2s' : '4s');
        animate.setAttribute('repeatCount', 'indefinite');
        
        const mPath = document.createElementNS('http://www.w3.org/2000/svg', 'mpath');
        mPath.setAttribute('href', `#${pathId}`);
        
        animate.appendChild(mPath);
        packet.appendChild(animate);
        gPackets.appendChild(packet);
    });
}

function renderClusters() {
    const gCallouts = document.getElementById('layer-callouts');
    const gClusters = document.getElementById('layer-clusters');

    CLUSTERS.forEach(cluster => {
        const parent = NODES[cluster.parent];
        
        // Draw rigid callout line
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        line.setAttribute('d', `M ${parent.x} ${parent.y} L ${cluster.cx} ${parent.y} L ${cluster.cx} ${cluster.cy}`);
        line.setAttribute('class', 'callout-line');
        gCallouts.appendChild(line);

        // Draw Label
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', cluster.cx - 40);
        text.setAttribute('y', cluster.cy - 35);
        text.setAttribute('class', 'cluster-label');
        text.textContent = cluster.name;
        gCallouts.appendChild(text);

        // Draw Sub-hexes (The Pool)
        for(let i=0; i<cluster.total; i++) {
            const pos = getClusterCoordinates(cluster.cx, cluster.cy, i, HEX_RADIUS);
            const hex = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            hex.setAttribute('d', getHexPath(pos.x, pos.y, HEX_RADIUS - 1));
            
            let stateClass = '';
            if (i < cluster.warn) stateClass = 'warn';
            else if (i < cluster.active + cluster.warn) stateClass = 'active';
            
            hex.setAttribute('class', `hex cluster-cell ${stateClass}`);
            gClusters.appendChild(hex);
        }
    });
}

// 4. Dynamic Ribbon Matrix
const TIMEZONES = ["PST", "MST", "CST", "EST", "GMT", "CET", "IST", "JST"];
const MATRIX_HEIGHT = 6;

function initRibbon() {
    const track = document.getElementById('ribbon-track');
    track.innerHTML = TIMEZONES.map(tz => `
        <div class="stack-col" id="col-${tz}">
            <div class="stack-col-label">${tz}</div>
            ${Array(MATRIX_HEIGHT).fill('<div class="stack-block"></div>').join('')}
        </div>
    `).join('');
}

function updateRibbonEngine() {
    TIMEZONES.forEach(tz => {
        const col = document.getElementById(`col-${tz}`);
        const blocks = col.querySelectorAll('.stack-block');
        
        // Simulate diurnal wave: arbitrary sine wave logic based on array index and time
        const timeFactor = Date.now() / 2000;
        const wave = Math.sin(timeFactor + TIMEZONES.indexOf(tz)) * 3 + 3; 
        const fillLevel = Math.floor(Math.max(0, Math.min(wave, MATRIX_HEIGHT)));

        blocks.forEach((b, i) => {
            // i=0 is bottom block due to column-reverse
            b.className = 'stack-block'; 
            if (i < fillLevel) {
                b.classList.add('fill');
                if (i >= MATRIX_HEIGHT - 1) b.classList.add('hot'); // Top block goes amber
            }
        });
    });

    // Update Top KPIs
    document.getElementById('stat-velocity').innerText = `+${Math.floor(Math.random() * 20 + 30)}/sec`;
}

// 5. Initialization
window.onload = () => {
    renderMapLayer();
    renderClusters();
    initRibbon();
    setInterval(updateRibbonEngine, 500); // Pulse the matrix every 500ms
};
