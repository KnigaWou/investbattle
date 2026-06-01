// Firebase config
const firebaseConfig = {
    databaseURL: "https://investbattle-45545-default-rtdb.firebaseio.com",
    projectId: "investbattle-45545"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// App State
let state = {
    pid: '', name: 'Трейдер', avatar: 'icons/avatar1.png', stars: 0, dollars: 100,
    startCash: 10000, roundTime: 30, totalRounds: 5,
    roomCode: null, inGame: false, isMultiplayer: false,
    currentCase: null, myCash: 10000, myPortfolio: {},
    opponentCash: 10000, opponentPortfolio: {}, opponentName: 'Бот',
    marketPrices: {}, fairPrices: {},
    currentRound: 0, cases: [], ready: false,
    leftPlayers: [], lang: 'ru', history: [],
    friends: [], friendRequests: [], gameInvites: []
};

// Helper functions
function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('toast-show');
    setTimeout(() => toast.classList.remove('toast-show'), 2000);
}

function formatMoney(n) { return '$' + Math.round(n).toLocaleString(); }

function getPlayerId() {
    if (window.Telegram?.WebApp?.initDataUnsafe?.user?.id) 
        return 'tg_' + window.Telegram.WebApp.initDataUnsafe.user.id;
    let id = localStorage.getItem('player_id');
    if (!id) { id = 'web_' + Math.random().toString(36).substr(2, 9); localStorage.setItem('player_id', id); }
    return id;
}

// Save profile to Firebase
function saveProfile() {
    if (!state.pid) return;
    db.ref(`users/${state.pid}`).update({
        name: state.name, avatar: state.avatar, stars: state.stars, dollars: state.dollars,
        friends: state.friends, lastSeen: Date.now()
    });
    db.ref(`online/${state.pid}`).set({ name: state.name, avatar: state.avatar, online: true });
    db.ref(`online/${state.pid}`).onDisconnect().remove();
}

// Load profile from Firebase
function loadProfile(callback) {
    db.ref(`users/${state.pid}`).once('value', snap => {
        const data = snap.val();
        if (data) {
            state.name = data.name || 'Трейдер';
            state.avatar = data.avatar || 'icons/avatar1.png';
            state.stars = data.stars || 0;
            state.dollars = data.dollars || 100;
            state.friends = data.friends || [];
        }
        updateUI();
        if (callback) callback();
    });
}

// Update UI elements
function updateUI() {
    document.getElementById('profileName').textContent = state.name;
    document.getElementById('profileAvatar').innerHTML = `<img src="${state.avatar}" style="width:100%;height:100%;object-fit:cover;">`;
    document.getElementById('profileStars').textContent = state.stars;
    document.getElementById('profileDollars').textContent = state.dollars;
    document.getElementById('editName').value = state.name;
}

// Buy asset
function buyAsset() {
    if (!state.currentCase || !state.inGame) return;
    const price = state.marketPrices[state.currentCase.symbol] || state.currentCase.price;
    const qty = Math.max(1, parseInt(document.getElementById('buyQty').value) || 1);
    const cost = price * qty;
    if (state.myCash < cost) { showToast('Недостаточно денег!'); return; }
    
    state.myCash -= cost;
    if (!state.myPortfolio[state.currentCase.symbol]) 
        state.myPortfolio[state.currentCase.symbol] = { qty: 0, avgPrice: 0 };
    const item = state.myPortfolio[state.currentCase.symbol];
    item.avgPrice = (item.qty * item.avgPrice + cost) / (item.qty + qty);
    item.qty += qty;
    
    updatePortfolio();
    updateUI();
    if (state.isMultiplayer) syncMultiplayer();
}

// Update portfolio table
function updatePortfolio() {
    const tbody = document.getElementById('portfolioBody');
    const entries = Object.entries(state.myPortfolio);
    if (entries.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-secondary">Нет активов</td></tr>';
        return;
    }
    tbody.innerHTML = entries.map(([sym, data]) => {
        const price = state.marketPrices[sym] || data.avgPrice;
        const value = price * data.qty;
        const pnl = (price - data.avgPrice) * data.qty;
        const pnlPercent = data.avgPrice ? ((price - data.avgPrice) / data.avgPrice * 100) : 0;
        const pnlClass = pnl >= 0 ? 'text-success' : 'text-danger';
        const sign = pnl >= 0 ? '+' : '';
        return `
            <tr class="${pnl >= 5 ? 'portfolio-gain' : (pnl <= -5 ? 'portfolio-loss' : '')}">
                <td class="text-primary" style="font-weight: 700;">${sym}</td>
                <td>${data.qty}</td>
                <td>${formatMoney(price)}</td>
                <td>${formatMoney(value)}</td>
                <td class="${pnlClass}">${sign}${pnlPercent.toFixed(1)}%</td>
                <td><button class="sell-btn" data-sym="${sym}">Продать</button></td>
            </tr>
        `;
    }).join('');
    
    document.querySelectorAll('.sell-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const sym = btn.dataset.sym;
            const data = state.myPortfolio[sym];
            if (!data) return;
            const price = state.marketPrices[sym] || data.avgPrice;
            state.myCash += price * data.qty;
            delete state.myPortfolio[sym];
            updatePortfolio();
            updateUI();
            if (state.isMultiplayer) syncMultiplayer();
            showToast(`Продано ${sym}`);
        });
    });
}

// Load game cases
function loadCases() {
    fetch('cases.json')
        .then(r => r.json())
        .then(data => {
            state.cases = data.filter(c => c && c.symbol && c.price);
            document.getElementById('loadingScreen').style.display = 'none';
            document.getElementById('menuScreen').style.display = 'block';
        })
        .catch(e => {
            console.error(e);
            document.getElementById('loadingScreen').innerHTML = '<div class="text-center text-danger">Ошибка загрузки</div>';
        });
}

// Start game
function startGame() {
    state.inGame = true;
    state.myCash = state.startCash;
    state.myPortfolio = {};
    state.currentRound = 0;
    state.marketPrices = {};
    state.fairPrices = {};
    
    document.getElementById('menuScreen').style.display = 'none';
    document.getElementById('gameScreen').style.display = 'block';
    
    updatePortfolio();
    nextRound();
}

// Next round
function nextRound() {
    if (state.currentRound >= state.totalRounds) {
        finishGame();
        return;
    }
    state.currentRound++;
    updateMarket();
    const newCase = getRandomCase();
    if (newCase) {
        state.currentCase = newCase;
        if (!state.marketPrices[newCase.symbol]) 
            state.marketPrices[newCase.symbol] = newCase.price;
        updateCaseDisplay();
    }
    startTimer();
}

// Update case display
function updateCaseDisplay() {
    document.getElementById('caseTitle').textContent = `${state.currentCase.symbol} - ${state.currentCase.name || ''}`;
    document.getElementById('caseDesc').textContent = state.currentCase.desc || '';
    document.getElementById('casePrice').textContent = formatMoney(state.marketPrices[state.currentCase.symbol]);
    document.getElementById('roundBadge').textContent = `${state.currentRound}/${state.totalRounds}`;
}

// Timer
function startTimer() {
    let time = state.roundTime;
    const timerEl = document.getElementById('timer');
    timerEl.textContent = time;
    timerEl.classList.remove('timer-urgent');
    
    if (state.timerInterval) clearInterval(state.timerInterval);
    state.timerInterval = setInterval(() => {
        time--;
        timerEl.textContent = time;
        if (time <= 5) timerEl.classList.add('timer-urgent');
        if (time <= 0) {
            clearInterval(state.timerInterval);
            nextRound();
        }
    }, 1000);
}

// Finish game
function finishGame() {
    clearInterval(state.timerInterval);
    state.inGame = false;
    
    const totalValue = state.myCash + Object.entries(state.myPortfolio).reduce((sum, [sym, data]) => 
        sum + (state.marketPrices[sym] || data.avgPrice) * data.qty, 0);
    const profit = totalValue - state.startCash;
    const won = profit > 0;
    
    document.getElementById('gameScreen').style.display = 'none';
    document.getElementById('resultModal').classList.add('modal-show');
    document.getElementById('resultEmoji').textContent = won ? '🏆' : '💔';
    document.getElementById('resultTitle').textContent = won ? 'Победа!' : 'Поражение';
    document.getElementById('resultCash').textContent = formatMoney(totalValue);
    document.getElementById('resultDetails').innerHTML = `
        Прибыль: <span class="${profit >= 0 ? 'text-success' : 'text-danger'}">${profit >= 0 ? '+' : ''}${formatMoney(profit)}</span><br>
        Раундов: ${state.totalRounds}
    `;
    
    if (won) state.dollars += 100;
    else state.dollars = Math.max(0, state.dollars - 100);
    saveProfile();
    updateUI();
}

// Event listeners
function bindEvents() {
    // Navigation
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('nav-item-active'));
            btn.classList.add('nav-item-active');
        });
    });
    
    // Close modals
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.closest('.modal').classList.remove('modal-show');
        });
    });
    
    // Menu navigation
    document.getElementById('playMenuBtn').addEventListener('click', () => {
        document.getElementById('playMenu').style.display = 'block';
        document.getElementById('playMenuBtn').style.display = 'none';
        document.getElementById('historyBtn').style.display = 'none';
    });
    
    document.getElementById('backMenuBtn').addEventListener('click', () => {
        document.getElementById('playMenu').style.display = 'none';
        document.getElementById('playMenuBtn').style.display = 'block';
        document.getElementById('historyBtn').style.display = 'block';
    });
    
    document.getElementById('compBtn').addEventListener('click', () => {
        document.getElementById('playMenu').style.display = 'none';
        document.getElementById('compMenu').style.display = 'block';
    });
    
    document.getElementById('compBackBtn').addEventListener('click', () => {
        document.getElementById('compMenu').style.display = 'none';
        document.getElementById('playMenu').style.display = 'block';
    });
    
    // Game actions
    document.getElementById('soloBtn').addEventListener('click', () => {
        document.getElementById('soloModal').classList.add('modal-show');
    });
    
    document.getElementById('startSoloBtn').addEventListener('click', () => {
        state.startCash = parseInt(document.querySelector('#sCashChips .chip-active')?.dataset.cash || 10000);
        state.totalRounds = parseInt(document.querySelector('#sRoundsChips .chip-active')?.dataset.rounds || 10);
        state.roundTime = parseInt(document.querySelector('#sTimeChips .chip-active')?.dataset.time || 30);
        state.isMultiplayer = false;
        document.getElementById('soloModal').classList.remove('modal-show');
        startGame();
    });
    
    document.getElementById('createRoomBtn').addEventListener('click', () => {
        document.getElementById('roomModal').classList.add('modal-show');
    });
    
    document.getElementById('joinRoomBtn').addEventListener('click', () => {
        document.getElementById('joinModal').classList.add('modal-show');
    });
    
    document.getElementById('confirmJoinBtn').addEventListener('click', () => {
        const code = document.getElementById('joinCodeInput').value.trim().toUpperCase();
        if (code) joinRoom(code);
        document.getElementById('joinModal').classList.remove('modal-show');
    });
    
    document.getElementById('openRoomsBtn').addEventListener('click', showOpenRooms);
    document.getElementById('settingsBtn').addEventListener('click', () => {
        document.getElementById('settingsModal').classList.add('modal-show');
    });
    document.getElementById('profileAvatar').addEventListener('click', () => {
        document.getElementById('profileModal').classList.add('modal-show');
    });
    document.getElementById('saveProfileBtn').addEventListener('click', () => {
        const newName = document.getElementById('editName').value.trim() || 'Трейдер';
        if (newName !== state.name) {
            db.ref('users').orderByChild('name').equalTo(newName).once('value', snap => {
                if (snap.exists() && Object.keys(snap.val()).filter(k => k !== state.pid).length > 0) {
                    showToast('Это имя уже занято!');
                    return;
                }
                state.name = newName;
                saveProfile();
                updateUI();
                document.getElementById('profileModal').classList.remove('modal-show');
            });
        } else {
            document.getElementById('profileModal').classList.remove('modal-show');
        }
    });
    
    document.getElementById('closeResultBtn').addEventListener('click', () => {
        document.getElementById('resultModal').classList.remove('modal-show');
        document.getElementById('menuScreen').style.display = 'block';
        document.getElementById('gameScreen').style.display = 'none';
    });
    
    document.getElementById('buyBtn').addEventListener('click', buyAsset);
    document.getElementById('sellAllBtn').addEventListener('click', sellAll);
    document.getElementById('waitBtn').addEventListener('click', () => {
        if (state.timerInterval) clearInterval(state.timerInterval);
        nextRound();
    });
    document.getElementById('qtyMinus').addEventListener('click', () => {
        const inp = document.getElementById('buyQty');
        let v = parseInt(inp.value) || 1;
        inp.value = Math.max(1, v - 1);
    });
    document.getElementById('qtyPlus').addEventListener('click', () => {
        const inp = document.getElementById('buyQty');
        let v = parseInt(inp.value) || 1;
        inp.value = Math.min(1000, v + 1);
    });
    
    // Chip selection
    document.querySelectorAll('.chip').forEach(chip => {
        chip.addEventListener('click', function() {
            const parent = this.parentElement;
            if (parent.classList.contains('chip-row')) {
                parent.querySelectorAll('.chip').forEach(c => c.classList.remove('chip-active'));
                this.classList.add('chip-active');
            }
        });
    });
    
    // Default selections
    document.querySelector('#sCashChips .chip[data-cash="10000"]')?.classList.add('chip-active');
    document.querySelector('#sRoundsChips .chip[data-rounds="10"]')?.classList.add('chip-active');
    document.querySelector('#sTimeChips .chip[data-time="30"]')?.classList.add('chip-active');
    document.querySelector('#betChips .chip[data-bet="0"]')?.classList.add('chip-active');
    document.querySelector('#maxChips .chip[data-max="4"]')?.classList.add('chip-active');
}

// Initialization
state.pid = getPlayerId();
loadProfile(() => {
    loadCases();
    bindEvents();
});