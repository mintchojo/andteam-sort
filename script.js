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

if (params.has('debug')) {
    showFinalResults(items);
} else {
    startNextInsertion();
}

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
    let rowsHTML = '';
    let currentRank = 1;

    for (let i = 0; i < sortedArray.length; i++) {
        const prev = sortedArray[i - 1];
        if (!(i > 0 && prev.tiedWith && prev.tiedWith.includes(sortedArray[i].id))) {
            currentRank = i + 1;
        }

        rowsHTML += `
            <tr>
                <td class="rank-cell">${currentRank}</td>
                <td class="song-cell">${sortedArray[i].title}</td>
            </tr>
        `;
    }

    document.querySelector('.ui-container').innerHTML = `
        <p class="results-heading">final ranking</p>
        <div class="results-scroll">
            <table class="results-table">
                <tbody>${rowsHTML}</tbody>
            </table>
        </div>
    `;
}

startNextInsertion();