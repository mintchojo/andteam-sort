const SUPABASE_URL = 'https://zhhnrctnawlwixkbouiv.supabase.co';
const SUPABASE_KEY = 'sb_publishable_GPNbcUjNaXy_uIEUSvaelA_hfaldyHN';

let optOut = false;

document.getElementById('consent-btn').addEventListener('click', () => {
    optOut = document.getElementById('opt-out').checked;
    document.getElementById('consent-overlay').classList.add('hidden');
});

function saveRanking(list) {
    fetch(`${SUPABASE_URL}/rest/v1/rankings`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_KEY,
            'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ ranking: list.map(s => s.id) }),
        keepalive: true
    }).catch(() => {});
}

let items = songs.map((songName, idx) => ({ id: idx + 1, title: songName }));

for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
}

let ranked = [items[0]];
let queue = items.slice(1); 
let current = null;
let lo = 0, hi = 0, mid = 0;
let comparisonsDone = 0;

const leftTitle = document.getElementById('left-title');
const rightTitle = document.getElementById('right-title');
const leftBtn = document.getElementById('left-btn');
const rightBtn = document.getElementById('right-btn');
const skipBtn = document.getElementById('skip-btn');
const progressFill = document.getElementById('progress-fill');
const progressText = document.getElementById('progress-text');

const params = new URLSearchParams(location.search);

function remainingComparisons() {
    let total = 0;
    if (current && hi > lo) total += Math.ceil(Math.log2(hi - lo + 1));
    const base = ranked.length + (current ? 1 : 0);
    for (let i = 0; i < queue.length; i++) {
        total += Math.ceil(Math.log2(base + i + 1));
    }
    return total;
}

function updateProgressBar() {
    const remaining = remainingComparisons();
    const total = comparisonsDone + remaining;
    let pct = total > 0 ? Math.floor((comparisonsDone / total) * 100) : 100;
    pct = Math.max(0, Math.min(100, pct));
    progressFill.style.width = `${pct}%`;
    progressText.textContent = `${pct}% complete`;
}

function startNextInsertion() {
    if (queue.length === 0) {
        current = null;
        updateProgressBar();
        if (!optOut) saveRanking(ranked);
        showFinalResults(ranked);
        return;
    }
    current = queue.shift();
    lo = 0;
    hi = ranked.length;
    nextComparison();
}

function nextComparison() {
    if (lo >= hi) {
        ranked.splice(lo, 0, current);
        startNextInsertion();
        return;
    }
    mid = Math.floor((lo + hi) / 2);
    leftTitle.textContent = current.title;
    rightTitle.textContent = ranked[mid].title;
    updateProgressBar();
}

leftBtn.addEventListener('click', () => {
    comparisonsDone++;
    hi = mid;
    nextComparison();
});

rightBtn.addEventListener('click', () => {
    comparisonsDone++;
    lo = mid + 1;
    nextComparison();
});

skipBtn.addEventListener('click', () => {
    comparisonsDone++;
    const other = ranked[mid];
    (current.tiedWith ||= []).push(other.id);
    (other.tiedWith ||= []).push(current.id);
    ranked.splice(mid + 1, 0, current);
    startNextInsertion();
});

function showFinalResults(sortedArray) {
    const n = sortedArray.length;

    const ranks = [];
    let currentRank = 1;
    for (let i = 0; i < n; i++) {
        const prev = sortedArray[i - 1];
        if (!(i > 0 && prev.tiedWith && prev.tiedWith.includes(sortedArray[i].id))) {
            currentRank = i + 1;
        }
        ranks.push(currentRank);
    }

    const ROWS_PER_LIST = 27;
    const rows = Math.max(ROWS_PER_LIST, Math.ceil(n / 2));

    let rowsHTML = '';
    for (let r = 0; r < rows; r++) {
        let cells = '';
        for (let col = 0; col < 2; col++) {
            const i = col * rows + r;
            if (i < n) {
                cells += `<td class="rank-cell">${ranks[i]}</td>
                          <td class="song-cell">${sortedArray[i].title}</td>`;
            } else {
                cells += `<td class="rank-cell empty"></td>
                          <td class="song-cell empty"></td>`;
            }
        }
        rowsHTML += `<tr>${cells}</tr>`;
    }

    const ui = document.querySelector('.ui-container');
    ui.replaceChildren(document.getElementById('results-template').content.cloneNode(true));
    document.getElementById('results-body').innerHTML = rowsHTML;
    setupPager(sortedArray);
}

function setupPager(mine) {
    const pager = document.getElementById('results-pager');

    document.getElementById('nav-down').addEventListener('click', () =>
        pager.scrollTo({ top: pager.clientHeight, behavior: 'smooth' }));
    document.getElementById('nav-up').addEventListener('click', () =>
        pager.scrollTo({ top: 0, behavior: 'smooth' }));

    const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
            observer.disconnect();
            loadPublicResults(mine);
        }
    }, { root: pager, threshold: 0.5 });
    observer.observe(document.getElementById('page-all'));
}

function mockBoard() {
    return [...items].sort(() => Math.random() - 0.5).map((s, i) => ({
        id: s.id, title: s.title, avg_rank: i + 1 + Math.random(), times_ranked: 123
    }));
}

async function loadPublicResults(mine) {
    const box = document.getElementById('public-results');

    if (params.has('debug')) {
        renderPublic(box, mockBoard(), mine);
        return;
    }

    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/public_leaderboard`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY },
            body: '{}'
        });
        if (!res.ok) throw new Error(res.status);
        const board = await res.json();
        const titleById = new Map(items.map(s => [s.id, s.title]));
        board.forEach(s => s.title = titleById.get(s.id));

        if (board.length < 10) {
            box.textContent = 'not enough rankings yet, check back soon!';
            return;
        }
        renderPublic(box, board, mine);
    } catch (e) {
        box.textContent = "couldn't load results right now";
    }
}

function renderPublic(box, board, mine) {
    board.forEach(s => s.avg_rank = Number(s.avg_rank));
    const byAvg = [...board].sort((a, b) => a.avg_rank - b.avg_rank || a.id - b.id);
    const popRank = new Map(byAvg.map((s, i) => [s.id, i + 1]));
    const avgById = new Map(board.map(s => [s.id, s.avg_rank]));

    const slot = (s, place, cls) => `
        <div class="podium-slot ${cls}">
            <div class="podium-rank">${place}</div>
            <div class="podium-title">${s.title}</div>
        </div>`;

    const topRows = mine.slice(0, 10).map((s, i) => `
        <div class="top-row">
            <span>${i + 1}</span>
            <span>${s.title}</span>
            <span class="avg">#${popRank.get(s.id) ?? '–'}</span>
        </div>`).join('');

    const fanRows = byAvg.slice(3, 10).map((s, i) => `
        <div class="top-row">
            <span>${i + 4}</span>
            <span>${s.title}</span>
        </div>`).join('');
            
    const { label, note } = tasteLabel(mine, byAvg, popRank);

    box.innerHTML = `
        <div class="section-label">top 10 among fans (${board[0].times_ranked} rankings)</div>
        <div class="podium">
            ${slot(byAvg[1], 2, '')}${slot(byAvg[0], 1, 'first')}${slot(byAvg[2], 3, 'third')}
        </div>
        <div class="top-rows fan-rows">${fanRows}</div>
        <div class="section-label sub">your top 10 vs. fans</div>
        <div class="top-rows">${topRows}</div>
        <div class="section-label sub">your fandom match</div>
        <div class="taste-label">${label}</div>
        <div class="taste-note">${note}</div>`;
}

const MY_TOP = 10;
const FANDOM_TOP = 10;
const FANDOM_K = 10;

const TASTE_TIERS = [
    { min: 0.801,     label: 'same wavelength',      line: "your list is basically the consensus" },
    { min: 0.726,     label: 'in the loop',      line: "you're with the crowd on most of it" },
    { min: 0.635,     label: 'a little different', line: "you might have some hot takes" },
    { min: -Infinity, label: 'offbeat',          line: "your favorites are uniquely your own" }
];

function tasteScore(mine, byAvg) {
    const n = mine.length;
    const myPos = new Map(mine.map((s, i) => [s.id, i + 1]));
    let total = 0, wsum = 0;
    byAvg.slice(0, FANDOM_K).forEach((s, i) => {
        const w = 1 / Math.log2(i + 2);
        const pos = myPos.get(s.id) ?? n;
        total += w * ((pos - 1) / (n - 1));
        wsum += w;
    });
    return 1 - total / wsum;
}

function tasteFact(mine, popRank) {
    const top = mine[0];
    const fanRank = popRank.get(top.id);
    if (fanRank === undefined) return '';
    if (fanRank === 1) return `your #1 is the fandom's #1 too`;
    return `your #1, ${top.title}, is the fandom's #${fanRank}`;
}

function tasteLabel(mine, byAvg, popRank) {
    if (mine.length < MY_TOP || byAvg.length < FANDOM_K) return { label: '', note: '' };

    const score = tasteScore(mine, byAvg);
    const tier = TASTE_TIERS.find(t => score >= t.min);

    return {
        label: tier.label,
        note: `${tier.line}<br><span class="taste-fact">${tasteFact(mine, popRank)}</span>`
    };
}

startNextInsertion();