(function() {
    // ========== 1. НАСТРОЙКА FIREBASE ==========
    const firebaseConfig = {
        databaseURL: "https://investbattle-45545-default-rtdb.firebaseio.com",
        projectId: "investbattle-45545"
    };
    firebase.initializeApp(firebaseConfig);
    const db = firebase.database();
    
    // ========== 2. TELEGRAM INTEGRATION ==========
    const tg = window.Telegram && window.Telegram.WebApp;
    if (tg) {
        tg.ready();
        tg.expand();
    }

    // ========== 3. ПРАВА ДОСТУПА ==========
    const ADMIN_IDS = ['web_rfzuxppca', 'web_xg6jxslm7', 'web_d5keb8o6f', 'tg_5909465804'];
    const MOD_IDS = ['web_rfzuxppca', 'web_xg6jxslm7', 'web_d5keb8o6f', 'tg_5909465804'];
    let adminButtonVisible = false;
    let modButtonVisible = false;

    // ========== 4. ЛОГГИРОВАНИЕ ==========
    let consoleLogs = [];
    
    function log(message, type = 'log') {
        const entry = {
            time: new Date().toLocaleTimeString(),
            msg: message,
            type: type
        };
        consoleLogs.push(entry);
        if (consoleLogs.length > 50) consoleLogs.shift();
        if (type === 'error' || type === 'warn') console[type](message);
        updateConsoleDisplay();
    }

    function updateConsoleDisplay() {
        const modal = document.getElementById('consoleModal');
        if (!modal || !modal.classList.contains('show')) return;
        
        const content = document.getElementById('consoleContent');
        if (!content) return;
        
        content.innerHTML = consoleLogs.slice().reverse().map(log => {
            const color = log.type === 'error' ? 'var(--red)' : 
                         log.type === 'warn' ? 'var(--gold)' : 'var(--green)';
            return `<div style="border-bottom:1px solid #222;padding:1px 0;">
                        <span style="color:#888;">${log.time}</span> 
                        <span style="color:${color};">${log.msg}</span>
                    </div>`;
        }).join('');
    }

    // ========== 5. ЗВУКОВЫЕ ЭФФЕКТЫ ==========
    let lastBuySoundTime = 0;
    let lastSellSoundTime = 0;
    
    function playBuySound() {
        const now = Date.now();
        if (now - lastBuySoundTime < 300) return;
        lastBuySoundTime = now;
        try {
            new Audio('music/buy.mp3').play().catch(() => {});
        } catch(e) {}
    }
    
    function playSellSound() {
        const now = Date.now();
        if (now - lastSellSoundTime < 300) return;
        lastSellSoundTime = now;
        try {
            new Audio('music/sell.mp3').play().catch(() => {});
        } catch(e) {}
    }

    // ========== 6. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========
    function generateRandomNick() {
        const prefixes = ['Быстрый', 'Умный', 'Хитрый', 'Смелый', 'Тихий', 'Громкий', 'Ловкий', 'Стойкий', 'Дерзкий', 'Мудрый'];
        const suffixes = ['Трейдер', 'Инвестор', 'Брокер', 'Бык', 'Медведь', 'Волк', 'Лис', 'Орёл', 'Ястреб', 'Тигр'];
        return prefixes[Math.floor(Math.random() * prefixes.length)] + 
               suffixes[Math.floor(Math.random() * suffixes.length)] + 
               Math.floor(Math.random() * 900 + 100);
    }

    function getPlayerId() {
        if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user && tg.initDataUnsafe.user.id) {
            return `tg_${tg.initDataUnsafe.user.id}`;
        }
        let id = localStorage.getItem('ib_pid_v10');
        if (!id) {
            id = `web_${Math.random().toString(36).substr(2, 9)}`;
            localStorage.setItem('ib_pid_v10', id);
        }
        return id;
    }

    function isAdmin() {
        return ADMIN_IDS.includes(state.playerId);
    }

    function isMod() {
        return MOD_IDS.includes(state.playerId) && !isAdmin();
    }

    function formatNumber(n) {
        return Math.round(n).toLocaleString('en-US');
    }

    function formatMoney(n) {
        return '$' + formatNumber(n);
    }

    function getWeekKey() {
        const now = new Date();
        let day = now.getDay();
        now.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
        now.setHours(0, 0, 0, 0);
        return `week_${now.toISOString().split('T')[0]}`;
    }

    function showToast(message) {
        const toast = document.getElementById('copiedToast');
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 1500);
    }

    function copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            showToast('Скопировано!');
        }).catch(() => {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            showToast('Скопировано!');
        });
    }

    function getAvatarHtml(avatar) {
        if (avatar && avatar.indexOf('icons/') === 0) {
            return `<img src="${avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
        }
        return avatar || '?';
    }

    // ========== 7. СОСТОЯНИЕ ИГРЫ ==========
    const state = {
        // Профиль
        playerName: 'Трейдер',
        playerAvatar: 'icons/avatar1.png',
        playerStars: 0,
        playerDollars: 0,
        
        // Настройки игры по умолчанию
        startCapital: 10000,
        roundTime: 30,
        totalRounds: 5,
        maxPlayers: 4,
        roomCode: null,
        roomName: 'Комната',
        roomAccess: 'open',
        roomMode: 'hard',
        betAmount: 0,
        
        // Текущая игра
        currentRound: 0,
        ownCash: 10000,
        opponentCash: 10000,
        ownPortfolio: {},
        opponentPortfolio: {},
        currentCase: null,
        isGameActive: false,
        isFinalPhase: false,
        finalTimeLeft: 90,
        
        // Данные игры
        usedCases: [],
        marketPrices: {},
        fairPrices: {},
        finalInterval: null,
        finalPriceInterval: null,
        isWaiting: false,
        roundTimer: null,
        roundReady: false,
        
        // Комната и игроки
        lobbyPlayers: [],
        activeCasesList: [],
        isRoomReady: false,
        isMultiplayer: false,
        opponentName: 'Бот-Трейдер',
        opponentAvatar: 'Бот',
        
        // Системные
        playerId: '',
        hostId: '',
        casesList: [],
        isFakeAlert: false,
        fakeWinText: '',
        previewAvatar: null,
        language: 'ru',
        gameHistory: [],
        roomListener: null,
        pendingJoin: null,
        friends: [],
        friendRequests: [],
        gameInvites: [],
        leftPlayers: [],
        currentTab: 'menu',
        tradeShown: {},
        
        // UI состояния
        logoClickCount: 0,
        logoClickTimer: null,
        
        // Инвайты и приглашения
        customChipCallback: null,
        customChipKey: '',
        customChipMin: 0,
        customChipMax: 0,
        inviteFromFriends: false,
        lastSupportTime: 0,
        freelancerUnlocked: false,
        skipLobby: false,
        inviteFromRoom: false,
        isGhost: false,
        ghostRoomCode: null,
        ghostWatchPlayerId: null,
        
        // Игровые раунды
        gameCases: [],
        gameRound: 0,
        
        // Чит-коды (админ)
        cheats: {
            predictOutcome: false
        },
        
        // Флаги состояния
        _hostNotified: false
    };

    // ========== 8. ПРОФИЛЬ И БАЗА ДАННЫХ ==========
    function saveProfileToDB() {
        if (!state.playerId) return;
        
        db.ref(`u/${state.playerId}`).update({
            n: state.playerName,
            a: state.playerAvatar,
            st: state.playerStars,
            do: state.playerDollars,
            fr: state.friends,
            ls: firebase.database.ServerValue.TIMESTAMP
        });
        
        db.ref(`on/${state.playerId}`).set({
            n: state.playerName,
            ts: firebase.database.ServerValue.TIMESTAMP
        });
        db.ref(`on/${state.playerId}`).onDisconnect().remove();
    }

    function loadProfile(callback) {
        db.ref(`u/${state.playerId}`).once('value', snapshot => {
            const data = snapshot.val();
            
            if (data) {
                // Проверка бана
                if (data.banned && data.banUntil && data.banUntil > Date.now()) {
                    showBanNotice(data.banReason || 'Нарушение правил', data.banUntil);
                    return;
                }
                if (data.banned && data.banUntil && data.banUntil <= Date.now()) {
                    db.ref(`u/${state.playerId}/banned`).remove();
                    db.ref(`u/${state.playerId}/banReason`).remove();
                    db.ref(`u/${state.playerId}/banUntil`).remove();
                }
                
                state.playerName = data.n || 'Трейдер';
                state.playerAvatar = data.a || 'icons/avatar1.png';
                state.playerStars = typeof data.st === 'number' ? data.st : 0;
                state.playerDollars = typeof data.do === 'number' ? data.do : 0;
                state.friends = data.fr || [];
                state.freelancerUnlocked = data.flUnlocked || false;
            } else {
                // Новый игрок
                const randomName = generateRandomNick();
                let startCoins = 100;
                
                db.ref('settings/startCoins').once('value', snap => {
                    startCoins = snap.val() !== undefined ? snap.val() : 100;
                    state.playerName = randomName;
                    state.playerAvatar = `icons/avatar${Math.floor(Math.random() * 5) + 1}.png`;
                    state.playerDollars = startCoins;
                    
                    db.ref(`u/${state.playerId}`).set({
                        n: state.playerName,
                        a: state.playerAvatar,
                        st: 0,
                        do: state.playerDollars,
                        fr: []
                    });
                    callback();
                });
                return;
            }
            
            // Восстановление из localStorage
            const saved = localStorage.getItem('ib_v15');
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    if (state.playerName === 'Трейдер' && parsed.playerName) state.playerName = parsed.playerName;
                    if (state.playerAvatar === 'icons/avatar1.png' && parsed.playerAvatar) state.playerAvatar = parsed.playerAvatar;
                    if (!state.playerStars && parsed.playerStars) state.playerStars = parsed.playerStars;
                    if (!state.playerDollars && parsed.playerDollars) state.playerDollars = parsed.playerDollars;
                    if (!state.friends.length && parsed.friends) state.friends = parsed.friends;
                    if (parsed.cheats) state.cheats = parsed.cheats;
                } catch(e) {}
            }
            
            const history = localStorage.getItem('ib_history');
            if (history) state.gameHistory = JSON.parse(history);
            
            const savedLang = localStorage.getItem('ib_lang');
            if (savedLang) state.language = savedLang;
            
            state.lastSupportTime = parseInt(localStorage.getItem('ib_lastSupport') || '0');
            
            callback();
        }, error => {
            log(`Ошибка профиля: ${error.message}`, 'error');
            callback();
        });
    }

    function showBanNotice(reason, until) {
        document.getElementById('banReason').textContent = `Причина: ${reason}`;
        const date = new Date(until);
        document.getElementById('banUntil').textContent = `До: ${date.toLocaleString()}`;
        document.getElementById('banNotice').classList.add('show');
    }

    function saveGameState() {
        localStorage.setItem('ib_v15', JSON.stringify({
            playerName: state.playerName,
            playerAvatar: state.playerAvatar,
            playerStars: state.playerStars,
            playerDollars: state.playerDollars,
            friends: state.friends,
            cheats: state.cheats
        }));
        localStorage.setItem('ib_lang', state.language);
        localStorage.setItem('ib_history', JSON.stringify(state.gameHistory.slice(0, 50)));
        localStorage.setItem('ib_lastSupport', state.lastSupportTime);
        
        if (tg && tg.CloudStorage) {
            tg.CloudStorage.setItems([
                { key: 'ib_name', value: state.playerName },
                { key: 'ib_avatar', value: state.playerAvatar },
                { key: 'ib_stars', value: String(state.playerStars) },
                { key: 'ib_dollars', value: String(state.playerDollars) }
            ]);
        }
        saveProfileToDB();
    }

    function updateUI() {
        document.getElementById('profileName').textContent = state.playerName;
        document.getElementById('profileAvatar').innerHTML = getAvatarHtml(state.playerAvatar);
        document.getElementById('editAvatarBig').innerHTML = getAvatarHtml(state.previewAvatar || state.playerAvatar);
        document.getElementById('editName').value = state.playerName;
        document.getElementById('profileStars').textContent = state.playerStars;
        document.getElementById('profileDollars').textContent = state.playerDollars;
        
        document.querySelectorAll('#avatarChips .chip').forEach(chip => {
            chip.classList.toggle('selected', chip.dataset.avatar === (state.previewAvatar || state.playerAvatar));
        });
        
        document.querySelectorAll('#langChips .chip').forEach(chip => {
            chip.classList.toggle('selected', chip.dataset.lang === state.language);
        });
        
        applyLanguage();
    }

    // ========== 9. АДМИНСКАЯ ПАНЕЛЬ ==========
    function updateAdminStats() {
        if (!isAdmin() && !isMod()) return;
        
        db.ref('on').once('value', snapshot => {
            const count = snapshot.val() ? Object.keys(snapshot.val()).length : 0;
            const onlineEl = document.getElementById('aOnline2');
            if (onlineEl) onlineEl.textContent = count;
            const modOnlineEl = document.getElementById('mOnline');
            if (modOnlineEl) modOnlineEl.textContent = count;
        });
        
        db.ref('u').once('value', snapshot => {
            const count = snapshot.val() ? Object.keys(snapshot.val()).length : 0;
            const totalEl = document.getElementById('aTotal2');
            if (totalEl) totalEl.textContent = count;
            const modTotalEl = document.getElementById('mTotal');
            if (modTotalEl) modTotalEl.textContent = count;
        });
        
        db.ref('rooms').once('value', snapshot => {
            const rooms = snapshot.val();
            let playing = 0;
            if (rooms) {
                Object.values(rooms).forEach(room => {
                    if (room && room.st === 'playing') playing++;
                });
            }
            const playingEl = document.getElementById('aPlaying2');
            if (playingEl) playingEl.textContent = playing;
            const modPlayingEl = document.getElementById('mPlaying');
            if (modPlayingEl) modPlayingEl.textContent = playing;
        });
    }

    function showFakeCoinsPopup() {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.95);z-index:9999;display:flex;align-items:center;justify-content:center;flex-direction:column;transition:opacity 0.5s';
        overlay.innerHTML = '<div style="font-size:48px;color:var(--gold);font-weight:900;">+100 500 💰</div><div style="font-size:24px;color:#fff;">Монет зачислено!</div>';
        document.body.appendChild(overlay);
        
        setTimeout(() => {
            overlay.style.opacity = '0';
            setTimeout(() => overlay.remove(), 500);
        }, 2000);
        
        setTimeout(() => {
            const jokeOverlay = document.createElement('div');
            jokeOverlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);z-index:9999;display:flex;align-items:center;justify-content:center;flex-direction:column;transition:opacity 0.5s';
            jokeOverlay.innerHTML = '<div style="font-size:60px;">😂</div><div style="font-size:20px;color:#fff;">Шутка!</div>';
            document.body.appendChild(jokeOverlay);
            
            setTimeout(() => {
                jokeOverlay.style.opacity = '0';
                setTimeout(() => jokeOverlay.remove(), 500);
            }, 1500);
        }, 2500);
    }

    function showBroadcast(text, coins, duration, announcementId) {
        const toast = document.getElementById('broadcastToast');
        toast.innerHTML = (text || '') + (coins > 0 ? `<br><span style="color:var(--gold);">+${coins} монет</span>` : '');
        
        if (toast._hideTimeout) clearTimeout(toast._hideTimeout);
        
        toast.style.transition = 'none';
        toast.style.top = '70px';
        toast.style.opacity = '1';
        toast.classList.add('show');
        
        function hideBroadcast() {
            toast.style.transition = 'all 0.5s ease-in';
            toast.style.top = '-200px';
            toast.style.opacity = '0';
            clearTimeout(toast._hideTimeout);
            toast._hideTimeout = setTimeout(() => toast.classList.remove('show'), 500);
        }
        
        if (duration > 0) {
            toast._hideTimeout = setTimeout(hideBroadcast, duration * 1000);
        }
        
        toast.onclick = () => {
            hideBroadcast();
            if (announcementId) {
                db.ref(`announcements/${announcementId}/dismissed/${state.playerId}`).set(true);
            }
        };
    }

    // ========== 10. ДРУЗЬЯ И ПРИГЛАШЕНИЯ ==========
    function loadFriendRequests() {
        db.ref(`frc/${state.playerId}`).on('value', snapshot => {
            const data = snapshot.val();
            state.friendRequests = data ? Object.keys(data).filter(key => data[key] && !data[key].accepted) : [];
            updateFriendsDot();
        });
    }

    function loadGameInvites() {
        db.ref(`gi/${state.playerId}`).on('value', snapshot => {
            const data = snapshot.val();
            state.gameInvites = data ? Object.entries(data).filter(([key, inv]) => inv && (inv.status === 'pending' || inv.status === 'host_transfer')) : [];
            updateFriendsDot();
        });
    }

    function updateFriendsDot() {
        const dot = document.getElementById('friendsDot');
        if (!dot) return;
        dot.style.display = (state.friendRequests.length > 0 || state.gameInvites.length > 0) ? 'block' : 'none';
        dot.className = 'dot' + (state.gameInvites.length > 0 ? ' game-invite' : '');
    }

    function sendFriendRequest(targetId) {
        db.ref(`frc/${targetId}/${state.playerId}`).set({
            n: state.playerName,
            a: state.playerAvatar,
            ts: firebase.database.ServerValue.TIMESTAMP
        }, error => {
            if (error) {
                log(`Ошибка: ${error.message}`, 'error');
            } else {
                showToast('Заявка отправлена!');
            }
        });
    }

    function acceptFriendRequest(fromId) {
        db.ref(`frc/${state.playerId}/${fromId}`).remove();
        if (!state.friends.includes(fromId)) state.friends.push(fromId);
        db.ref(`frc/${fromId}/${state.playerId}`).set({
            n: state.playerName,
            a: state.playerAvatar,
            accepted: true
        });
        saveGameState();
        updateUI();
        showToast('Друг добавлен!');
    }

    function declineFriendRequest(fromId) {
        db.ref(`frc/${state.playerId}/${fromId}`).remove();
        showToast('Отклонено');
    }

    function sendGameInvite(targetId) {
        state.roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        
        db.ref(`rooms/${state.roomCode}`).set({
            hid: state.playerId,
            rn: 'Комната',
            mp: state.maxPlayers || 4,
            sc: state.startCapital || 10000,
            rt: state.roundTime || 30,
            tr: state.totalRounds || 5,
            pl: {},
            st: 'waiting',
            access: 'open',
            rm: state.roomMode || 'hard',
            bet: state.betAmount || 0
        });
        
        db.ref(`gi/${targetId}/${state.roomCode}`).set({
            from: state.playerId,
            fromName: state.playerName,
            fromAvatar: state.playerAvatar,
            roomCode: state.roomCode,
            roomName: state.roomName,
            bet: state.betAmount,
            mp: state.maxPlayers,
            sc: state.startCapital,
            rt: state.roundTime,
            tr: state.totalRounds,
            rm: state.roomMode,
            status: 'pending',
            ts: firebase.database.ServerValue.TIMESTAMP
        });
        
        showToast('Приглашение отправлено!');
        document.getElementById('inviteModal').classList.remove('show');
        document.getElementById('friendsModal').classList.remove('show');
        resetBottomNav();
        
        state.inviteFromFriends = true;
        state.skipLobby = true;
        document.getElementById('roomCodePreview').style.display = 'block';
        document.getElementById('roomCodeText').textContent = state.roomCode;
        document.getElementById('roomModalTitle').textContent = '⚙️ Настройка комнаты';
        document.getElementById('confirmRoomBtn').textContent = '🚪 Открыть';
        document.getElementById('roomModal').classList.add('show');
    }

    function acceptGameInvite(inviteId, invite) {
        db.ref(`rooms/${invite.roomCode}`).once('value', snapshot => {
            if (!snapshot.val()) {
                db.ref(`gi/${state.playerId}/${inviteId}`).remove();
                showToast('Комната не найдена');
                document.getElementById('friendsModal').classList.remove('show');
                resetBottomNav();
                return;
            }
            
            db.ref(`gi/${state.playerId}/${inviteId}`).update({ status: 'accepted' });
            document.getElementById('friendsModal').classList.remove('show');
            resetBottomNav();
            
            if (invite.status === 'host_transfer') {
                state.roomCode = invite.roomCode;
                state.inviteFromFriends = true;
                state.skipLobby = true;
                document.getElementById('roomCodePreview').style.display = 'block';
                document.getElementById('roomCodeText').textContent = state.roomCode;
                document.getElementById('roomModalTitle').textContent = '⚙️ Настройка комнаты';
                document.getElementById('confirmRoomBtn').textContent = '🚪 Открыть';
                document.getElementById('roomModal').classList.add('show');
                return;
            }
            
            if (invite.rm === 'free' && state.playerId !== invite.from) {
                state.pendingJoin = invite.roomCode;
                document.getElementById('joinParamsModal').classList.add('show');
            } else {
                joinRoom(invite.roomCode, null);
            }
        });
    }

    function declineGameInvite(inviteId) {
        db.ref(`gi/${state.playerId}/${inviteId}`).update({ status: 'declined' });
    }

    // ========== 11. ОНЛАЙН ИГРОКИ И КОМНАТЫ ==========
    function showOnlinePlayers() {
        const modal = document.getElementById('onlinePlayersModal');
        modal.classList.add('show');
        const searchInput = document.getElementById('onlineSearchInput2');
        searchInput.value = '';
        loadOnlinePlayers('');
        searchInput.oninput = () => loadOnlinePlayers(searchInput.value.trim());
    }

    function loadOnlinePlayers(query) {
        db.ref('on').once('value', snapshot => {
            const data = snapshot.val();
            const list = document.getElementById('onlinePlayersList2');
            
            if (!data) {
                list.innerHTML = '<p style="color:var(--text2);">Никого</p>';
                return;
            }
            
            const ids = Object.keys(data);
            Promise.all(ids.map(id => db.ref(`u/${id}`).once('value'))).then(snapshots => {
                let players = snapshots.map((snap, i) => {
                    const user = snap.val();
                    if (!user) return null;
                    return { id: ids[i], name: user.n || 'Игрок', avatar: user.a };
                }).filter(p => p !== null);
                
                if (query) {
                    players = players.filter(p => 
                        p.name.toLowerCase().includes(query.toLowerCase()) || 
                        p.id.toLowerCase().includes(query.toLowerCase())
                    );
                }
                
                list.innerHTML = players.length === 0 
                    ? '<p style="color:var(--text2);">Ничего</p>'
                    : players.map(p => `
                        <div class="lobby-player" data-pid="${p.id}">
                            <span class="avatar">${getAvatarHtml(p.avatar)}</span>
                            <span>${p.name}</span>
                        </div>
                    `).join('');
                
                bindPlayerClicks(list);
            });
        });
    }

    function showAllPlayers() {
        const modal = document.getElementById('allPlayersModal2');
        modal.classList.add('show');
        const searchInput = document.getElementById('allSearchInput2');
        searchInput.value = '';
        loadAllPlayers('');
        searchInput.oninput = () => loadAllPlayers(searchInput.value.trim());
    }

    function loadAllPlayers(query) {
        db.ref('u').once('value', snapshot => {
            const data = snapshot.val();
            const list = document.getElementById('allPlayersList2');
            
            if (!data) {
                list.innerHTML = '<p style="color:var(--text2);">Нет</p>';
                return;
            }
            
            let players = Object.entries(data).map(([id, user]) => ({
                id: id,
                name: user.n || 'Игрок',
                avatar: user.a
            }));
            
            if (query) {
                players = players.filter(p => 
                    p.name.toLowerCase().includes(query.toLowerCase()) || 
                    p.id.toLowerCase().includes(query.toLowerCase())
                );
            }
            
            list.innerHTML = players.length === 0
                ? '<p style="color:var(--text2);">Ничего</p>'
                : players.map(p => `
                    <div class="lobby-player" data-pid="${p.id}">
                        <span class="avatar">${getAvatarHtml(p.avatar)}</span>
                        <span>${p.name}</span>
                    </div>
                `).join('');
            
            bindPlayerClicks(list);
        });
    }

    function bindPlayerClicks(container) {
        container.querySelectorAll('.lobby-player').forEach(el => {
            el.addEventListener('click', () => {
                if (el.dataset.pid) showPlayerDetail(el.dataset.pid);
            });
        });
    }

    function showPlayerDetail(playerId) {
        db.ref(`u/${playerId}`).once('value', snapshot => {
            const user = snapshot.val();
            if (!user) return;
            
            const modal = document.getElementById('adminPlayerDetailModal');
            const content = document.getElementById('adminPlayerDetailContent');
            
            content.innerHTML = `
                <div style="text-align:center;margin-bottom:12px;">
                    <div class="profile-avatar" style="margin:0 auto 10px;width:64px;height:64px;">
                        ${getAvatarHtml(user.a)}
                    </div>
                    <h3>${user.n || 'Игрок'}</h3>
                </div>
                <div class="admin-detail">
                    <div class="row"><span class="label">ID:</span><span class="value" style="font-size:9px;">${playerId}</span></div>
                    <div class="row"><span class="label">Ник:</span><span class="value">${user.n || '—'}</span></div>
                    <div class="row"><span class="label">Монеты:</span><span class="value">${user.do || 0}</span></div>
                </div>
            `;
            
            modal.classList.add('show');
        });
    }

    // ========== 12. ПРОСМОТР ИГР (GHOST MODE) ==========
    function showGhostRooms() {
        const modal = document.getElementById('activeGamesModal2');
        modal.classList.add('show');
        const searchInput = document.getElementById('ghostSearchInput');
        if (searchInput) {
            searchInput.value = '';
            loadGhostRooms('');
            searchInput.oninput = () => loadGhostRooms(searchInput.value.trim());
        }
    }

    function loadGhostRooms(query) {
        db.ref('rooms').once('value', snapshot => {
            const data = snapshot.val();
            const list = document.getElementById('ghostRoomsList');
            let allRooms = [];
            
            if (data) {
                allRooms = Object.entries(data).filter(([code, room]) => 
                    room && (room.st === 'playing' || room.st === 'waiting')
                );
            }
            
            if (query) {
                allRooms = allRooms.filter(([code, room]) => 
                    code.toLowerCase().includes(query.toLowerCase()) ||
                    (room.rn || '').toLowerCase().includes(query.toLowerCase()) ||
                    Object.values(room.pl || {}).some(p => (p.n || '').toLowerCase().includes(query.toLowerCase()))
                );
            }
            
            list.innerHTML = allRooms.length === 0 
                ? '<p style="color:var(--text2);">Нет игр</p>'
                : allRooms.map(([code, room]) => {
                    const playerCount = room.pl ? Object.keys(room.pl).filter(id => !room.pl[id]?.left).length : 0;
                    return `
                        <div class="lobby-player ghost-room" data-code="${code}">
                            <span>🎮</span>
                            <span>
                                <b>${room.rn || 'Комната'}</b><br>
                                <span style="font-size:9px;color:var(--text2);">
                                    ${code} | ${playerCount}/${room.mp || 4} | ${room.st || '—'}
                                </span>
                            </span>
                        </div>
                    `;
                }).join('');
            
            list.querySelectorAll('.ghost-room').forEach(el => {
                el.addEventListener('click', () => showGhostDetail(el.dataset.code));
            });
        });
    }

    function showGhostDetail(code) {
        document.getElementById('ghostRoomsList').style.display = 'none';
        const detail = document.getElementById('ghostRoomDetail');
        detail.style.display = 'block';
        
        db.ref(`rooms/${code}`).once('value', snapshot => {
            const room = snapshot.val();
            if (!room) return;
            
            const playerCount = room.pl ? Object.keys(room.pl).filter(id => !room.pl[id]?.left).length : 0;
            
            let infoHTML = `
                <div style="background:var(--surface);border-radius:10px;padding:8px;margin:8px 0;font-size:10px;line-height:1.4;">
                    <b>Код:</b> ${code} | <b>Название:</b> ${room.rn || 'Комната'}<br>
                    <b>Статус:</b> ${room.st === 'playing' ? '🟢 Игра идёт' : '🟡 Ожидание'} | <b>Игроков:</b> ${playerCount}/${room.mp || 4}<br>
                    <b>💰</b> ${formatMoney(room.sc || 10000)} | <b>⏱</b> ${room.rt || 30}с | <b>📊</b> ${room.tr || 5} раундов
                    ${room.bet > 0 ? ` | <b>Ставка:</b> ${room.bet} 💵` : ''}
                </div>
            `;
            
            let playersList = '';
            if (room.pl) {
                playersList = '<div class="section-title">Игроки:</div>';
                Object.entries(room.pl).forEach(([id, player]) => {
                    if (player.left) return;
                    playersList += `
                        <div style="display:flex;align-items:center;gap:6px;padding:5px 8px;background:var(--surface);border-radius:6px;margin-bottom:2px;font-size:11px;">
                            <span class="avatar" style="width:20px;height:20px;font-size:9px;">${getAvatarHtml(player.a)}</span>
                            <span>${player.n || 'Игрок'}${id === room.hid ? ' ⭐' : ''}</span>
                            <span style="margin-left:auto;color:var(--gold);font-size:10px;">💰 ${formatMoney(player.c || 0)}</span>
                        </div>
                    `;
                });
            }
            
            detail.innerHTML = infoHTML + playersList + `
                <button class="btn gold" id="ghostWatchBtn" style="margin-top:8px;">👁 Смотреть игру</button>
                <button class="btn" id="ghostBackBtn" style="margin-top:6px;">↩ Назад</button>
            `;
            
            document.getElementById('ghostBackBtn').addEventListener('click', () => {
                detail.style.display = 'none';
                document.getElementById('ghostRoomsList').style.display = 'block';
                document.getElementById('ghostSearchInput').value = '';
                loadGhostRooms('');
            });
            
            document.getElementById('ghostWatchBtn').addEventListener('click', () => {
                document.getElementById('activeGamesModal2').classList.remove('show');
                startGhostMode(code);
            });
        });
    }

    function startGhostMode(roomCode) {
        state.roomCode = roomCode;
        state.isGhost = true;
        state.isGameActive = false;
        state.isMultiplayer = false;
        state.ownPortfolio = {};
        state.ownCash = 0;
        state.lobbyPlayers = [];
        state.usedCases = [];
        state.isWaiting = false;
        state.marketPrices = {};
        state.fairPrices = {};
        state.currentRound = 0;
        state.leftPlayers = [];
        
        document.getElementById('menuScreen').style.display = 'none';
        document.getElementById('gameScreen').style.display = 'block';
        document.getElementById('lobbyModal').classList.remove('show');
        document.getElementById('finalOverlay').classList.remove('show');
        document.getElementById('resultOverlay').classList.remove('show');
        document.getElementById('buyBtn').style.display = 'none';
        document.getElementById('waitBtn').style.display = 'none';
        document.getElementById('sellAllBtn').style.display = 'none';
        document.getElementById('readyStatus').style.display = 'none';
        document.querySelector('.action-row').style.display = 'none';
        document.querySelector('.quick-qty').style.display = 'none';
        
        if (isAdmin() && state.cheats.predictOutcome) {
            document.getElementById('ghostPredictBox').style.display = 'block';
            updateGhostPredict();
        } else {
            document.getElementById('ghostPredictBox').style.display = 'none';
        }
        
        startRoomListener();
        updatePortfolioDisplay();
        updatePlayersDisplay();
    }

    function updateGhostPredict() {
        if (!state.currentCase) return;
        
        const symbol = state.currentCase.symbol;
        const price = state.marketPrices[symbol] || state.currentCase.price;
        const fairPrice = state.fairPrices[symbol] || price;
        const changePercent = (fairPrice - price) / price * 100;
        const direction = changePercent > 0 ? '↑' : '↓';
        const color = changePercent > 0 ? 'var(--green)' : 'var(--red)';
        
        document.getElementById('ghostPredictBox').innerHTML = `
            🔮 <b>ПРОГНОЗ:</b> <span style="color:${color};">${direction} ${Math.abs(changePercent).toFixed(1)}%</span><br>
            💰 ${formatMoney(price)} | ⚖️ ${formatMoney(fairPrice)}
        `;
    }

    // ========== 13. АДМИНСКИЕ ИНСТРУМЕНТЫ ==========
    function showConsoleModal() {
        document.getElementById('consoleModal').classList.add('show');
        updateConsoleDisplay();
    }

    function showAdminCheats() {
        const modal = document.getElementById('adminCheatsModal');
        modal.classList.add('show');
        
        const cheatsList = document.getElementById('cheatsList');
        cheatsList.innerHTML = `
            <div class="section-title">🔮 Прогноз цен</div>
            <div class="cheat-toggle" id="cheatPredict">
                <span>Исход игры</span>
                <span style="font-size:9px;color:var(--text2);">Показывает прогноз цен в любой игре</span>
                <div class="switch${state.cheats.predictOutcome ? ' on' : ''}"></div>
            </div>
            <p style="font-size:9px;color:var(--text2);text-align:center;margin-top:6px;">
                При включении в любой игре будет показан прогноз: куда пойдёт цена и насколько
            </p>
        `;
        
        document.getElementById('cheatPredict').addEventListener('click', () => {
            state.cheats.predictOutcome = !state.cheats.predictOutcome;
            document.querySelector('#cheatPredict .switch').classList.toggle('on', state.cheats.predictOutcome);
            saveGameState();
            showToast(state.cheats.predictOutcome ? 'Исход игры ВКЛ' : 'Исход игры ВЫКЛ');
            
            if (state.isGameActive || state.isGhost) {
                document.getElementById('ghostPredictBox').style.display = state.cheats.predictOutcome ? 'block' : 'none';
                if (state.cheats.predictOutcome && state.currentCase) updateGhostPredict();
            }
        });
    }

    function showAdminCoins() {
        const modal = document.getElementById('adminCoinsModal');
        modal.classList.add('show');
        const searchInput = document.getElementById('coinsSearchInput');
        searchInput.value = '';
        document.getElementById('coinsDetail').style.display = 'none';
        document.getElementById('coinsSearchList').style.display = 'block';
        loadCoinsSearch('');
        searchInput.oninput = () => loadCoinsSearch(searchInput.value.trim());
    }

    function loadCoinsSearch(query) {
        db.ref('u').once('value', snapshot => {
            const data = snapshot.val();
            const list = document.getElementById('coinsSearchList');
            
            if (!data) {
                list.innerHTML = '<p style="color:var(--text2);">Нет</p>';
                return;
            }
            
            let players = Object.entries(data).map(([id, user]) => ({
                id: id,
                name: user.n || 'Игрок',
                avatar: user.a,
                dollars: user.do || 0
            }));
            
            if (query) {
                players = players.filter(p => 
                    p.name.toLowerCase().includes(query.toLowerCase()) || 
                    p.id.toLowerCase().includes(query.toLowerCase())
                );
            }
            
            list.innerHTML = players.length === 0
                ? '<p style="color:var(--text2);">Ничего</p>'
                : players.map(p => `
                    <div class="lobby-player coins-player" 
                         data-pid="${p.id}" 
                         data-pname="${p.name}" 
                         data-pavatar="${p.avatar}" 
                         data-pdollars="${p.dollars}">
                        <span class="avatar">${getAvatarHtml(p.avatar)}</span>
                        <span>${p.name}</span>
                        <span style="color:var(--gold);margin-left:auto;">${p.dollars}</span>
                    </div>
                `).join('');
            
            list.querySelectorAll('.coins-player').forEach(el => {
                el.addEventListener('click', () => showCoinsDetail(el.dataset));
            });
        });
    }

    function showCoinsDetail(data) {
        document.getElementById('coinsSearchList').style.display = 'none';
        const detail = document.getElementById('coinsDetail');
        detail.style.display = 'block';
        const playerId = data.pid;
        
        db.ref(`coinLog/${playerId}`).once('value', snapshot => {
            const log = snapshot.val();
            let totalGiven = 0, totalTaken = 0;
            if (log) {
                totalGiven = log.totalGiven || 0;
                totalTaken = log.totalTaken || 0;
            }
            
            detail.innerHTML = `
                <div style="text-align:center;margin-bottom:12px;">
                    <div class="profile-avatar" style="margin:0 auto 10px;width:48px;height:48px;">
                        ${getAvatarHtml(data.pavatar)}
                    </div>
                    <h3>${data.pname}</h3>
                    <p style="color:var(--gold);">Монет: ${data.pdollars}</p>
                </div>
                <div class="admin-detail">
                    <div class="row"><span class="label">Выдано:</span><span class="value" style="color:var(--green);">+${totalGiven}</span></div>
                    <div class="row"><span class="label">Отнято:</span><span class="value" style="color:var(--red);">-${totalTaken}</span></div>
                </div>
                <div class="coin-input-row">
                    <input type="number" id="coinsAmount" placeholder="Сумма" min="1" value="100">
                    <button class="add" id="coinsAddBtn">Добавить</button>
                </div>
                <div class="coin-input-row">
                    <input type="number" id="coinsTakeAmount" placeholder="Сумма" min="1" value="100">
                    <button class="take" id="coinsTakeBtn">Забрать</button>
                </div>
                <button class="btn" id="coinsBackBtn" style="margin-top:8px;">↩ Назад</button>
            `;
            
            document.getElementById('coinsBackBtn').addEventListener('click', () => {
                detail.style.display = 'none';
                document.getElementById('coinsSearchList').style.display = 'block';
                document.getElementById('coinsSearchInput').value = '';
                loadCoinsSearch('');
            });
            
            document.getElementById('coinsAddBtn').addEventListener('click', () => {
                let amount = parseInt(document.getElementById('coinsAmount').value);
                if (isNaN(amount) || amount <= 0) {
                    showToast('Введите число!');
                    return;
                }
                
                db.ref(`u/${playerId}/do`).transaction(current => (current || 0) + amount, (error, committed, snapshot) => {
                    if (error) return;
                    if (committed) {
                        db.ref(`coinLog/${playerId}`).update({
                            totalGiven: firebase.database.ServerValue.increment(amount),
                            lastGiven: amount,
                            lastTime: new Date().toLocaleString(),
                            lastAdmin: state.playerId
                        });
                        showToast(`+${amount}`);
                        data.pdollars = snapshot.val() || 0;
                        detail.querySelector('p').textContent = `Монет: ${data.pdollars}`;
                    }
                });
            });
            
            document.getElementById('coinsTakeBtn').addEventListener('click', () => {
                let amount = parseInt(document.getElementById('coinsTakeAmount').value);
                if (isNaN(amount) || amount <= 0) {
                    showToast('Введите число!');
                    return;
                }
                
                db.ref(`u/${playerId}/do`).transaction(current => Math.max(0, (current || 0) - amount), (error, committed, snapshot) => {
                    if (error) return;
                    if (committed) {
                        db.ref(`coinLog/${playerId}`).update({
                            totalTaken: firebase.database.ServerValue.increment(amount),
                            lastTaken: amount,
                            lastTakenTime: new Date().toLocaleString(),
                            lastAdmin: state.playerId
                        });
                        showToast(`-${amount}`);
                        data.pdollars = snapshot.val() || 0;
                        detail.querySelector('p').textContent = `Монет: ${data.pdollars}`;
                    }
                });
            });
        });
    }

    function showAdminBan() {
        const modal = document.getElementById('adminBanModal');
        modal.classList.add('show');
        const searchInput = document.getElementById('banSearchInput');
        searchInput.value = '';
        document.getElementById('banDetail').style.display = 'none';
        document.getElementById('banSearchList').style.display = 'block';
        loadBanSearch('');
        searchInput.oninput = () => loadBanSearch(searchInput.value.trim());
    }

    function loadBanSearch(query) {
        db.ref('u').once('value', snapshot => {
            const data = snapshot.val();
            const list = document.getElementById('banSearchList');
            
            if (!data) {
                list.innerHTML = '<p style="color:var(--text2);">Нет</p>';
                return;
            }
            
            let players = Object.entries(data).map(([id, user]) => ({
                id: id,
                name: user.n || 'Игрок',
                avatar: user.a,
                banned: user.banned || false,
                muted: user.muted || false
            }));
            
            if (query) {
                players = players.filter(p => 
                    p.name.toLowerCase().includes(query.toLowerCase()) || 
                    p.id.toLowerCase().includes(query.toLowerCase())
                );
            }
            
            list.innerHTML = players.length === 0
                ? '<p style="color:var(--text2);">Ничего</p>'
                : players.map(p => `
                    <div class="lobby-player ban-player" 
                         data-pid="${p.id}" 
                         data-pname="${p.name}" 
                         data-pavatar="${p.avatar}" 
                         data-banned="${p.banned}" 
                         data-muted="${p.muted}">
                        <span class="avatar">${getAvatarHtml(p.avatar)}</span>
                        <span>${p.name}</span>
                        <span style="margin-left:auto;font-size:9px;color:${p.banned ? 'var(--red)' : p.muted ? 'var(--orange)' : 'var(--green)'};">
                            ${p.banned ? 'BAN' : p.muted ? 'MUTE' : 'OK'}
                        </span>
                    </div>
                `).join('');
            
            list.querySelectorAll('.ban-player').forEach(el => {
                el.addEventListener('click', () => showBanDetail(el.dataset));
            });
        });
    }

    function showBanDetail(data) {
        document.getElementById('banSearchList').style.display = 'none';
        const detail = document.getElementById('banDetail');
        detail.style.display = 'block';
        
        const playerId = data.pid;
        const isBanned = data.banned === 'true';
        const isMuted = data.muted === 'true';
        
        detail.innerHTML = `
            <div style="text-align:center;margin-bottom:12px;">
                <div class="profile-avatar" style="margin:0 auto 10px;width:48px;height:48px;">
                    ${getAvatarHtml(data.pavatar)}
                </div>
                <h3>${data.pname}</h3>
            </div>
            <p style="text-align:center;color:${isBanned ? 'var(--red)' : isMuted ? 'var(--orange)' : 'var(--green)'};">
                ${isBanned ? 'ЗАБАНЕН' : isMuted ? 'ЗАМУЧЕН' : 'Активен'}
            </p>
            <div class="coin-input-row">
                <button class="${isBanned ? 'add' : 'take'}" id="banToggleBtn">${isBanned ? 'Разбанить' : 'Забанить'}</button>
            </div>
            <div style="display:flex;gap:8px;margin-top:8px;">
                <input type="text" id="banReasonInput" placeholder="Причина" style="flex:1;padding:12px;background:#000;border:2px solid var(--gold);color:#fff;border-radius:10px;font-size:14px;">
                <input type="number" id="banMinutesInput" placeholder="Минут" min="1" value="60" style="width:80px;padding:12px;background:#000;border:2px solid var(--gold);color:#fff;border-radius:10px;font-size:14px;text-align:center;">
            </div>
            <div class="coin-input-row" style="margin-top:8px;">
                <input type="number" id="muteMinutes" placeholder="Минут" min="1" value="60">
                <button class="${isMuted ? 'add' : 'take'}" id="muteToggleBtn">${isMuted ? 'Размутить' : 'Замутить'}</button>
            </div>
            <div class="coin-input-row">
                <input type="text" id="newNickInput" placeholder="Новый ник">
                <button class="add" id="changeNickBtn">Сменить</button>
            </div>
            <button class="btn" id="banBackBtn" style="margin-top:8px;">↩ Назад</button>
        `;
        
        document.getElementById('banBackBtn').addEventListener('click', () => {
            detail.style.display = 'none';
            document.getElementById('banSearchList').style.display = 'block';
            document.getElementById('banSearchInput').value = '';
            loadBanSearch('');
        });
        
        document.getElementById('banToggleBtn').addEventListener('click', () => {
            if (isBanned) {
                db.ref(`u/${playerId}/banned`).set(false);
                db.ref(`u/${playerId}/banReason`).remove();
                db.ref(`u/${playerId}/banUntil`).remove();
                showToast('Разбанен');
            } else {
                const reason = document.getElementById('banReasonInput').value.trim() || 'Нарушение';
                const minutes = parseInt(document.getElementById('banMinutesInput').value) || 60;
                db.ref(`u/${playerId}/banned`).set(true);
                db.ref(`u/${playerId}/banReason`).set(reason);
                db.ref(`u/${playerId}/banUntil`).set(Date.now() + minutes * 60000);
                showToast(`Забанен на ${minutes} мин`);
            }
            data.banned = (!isBanned).toString();
            showBanDetail(data);
        });
        
        document.getElementById('muteToggleBtn').addEventListener('click', () => {
            const minutes = parseInt(document.getElementById('muteMinutes').value) || 60;
            if (isMuted) {
                db.ref(`u/${playerId}/muted`).set(false);
                db.ref(`u/${playerId}/muteUntil`).remove();
                showToast('Размучен');
            } else {
                db.ref(`u/${playerId}/muted`).set(true);
                db.ref(`u/${playerId}/muteUntil`).set(Date.now() + minutes * 60000);
                showToast(`Замучен на ${minutes} мин`);
            }
            data.muted = (!isMuted).toString();
            showBanDetail(data);
        });
        
        document.getElementById('changeNickBtn').addEventListener('click', () => {
            const newNick = document.getElementById('newNickInput').value.trim();
            if (!newNick) {
                showToast('Введите ник!');
                return;
            }
            db.ref(`u/${playerId}/n`).set(newNick);
            showToast('Ник изменён');
        });
    }

    function showAdminStats() {
        const modal = document.getElementById('adminStatsModal');
        modal.classList.add('show');
        const content = document.getElementById('statsContent');
        content.innerHTML = '<p>Загрузка...</p>';
        
        db.ref('u').once('value', snapshot => {
            const data = snapshot.val();
            if (!data) return;
            
            let totalCoins = 0;
            const players = Object.entries(data).map(([id, user]) => {
                totalCoins += user.do || 0;
                return { name: user.n || 'Игрок', coins: user.do || 0 };
            }).sort((a, b) => b.coins - a.coins);
            
            content.innerHTML = `
                <div class="admin-detail">
                    <div class="row"><span class="label">Всего монет:</span><span class="value" style="color:var(--gold);">${totalCoins}</span></div>
                    <div class="row"><span class="label">Игроков:</span><span class="value">${players.length}</span></div>
                </div>
                <div class="section-title">Топ-10</div>
                ${players.slice(0, 10).map((p, i) => `
                    <div class="lobby-player">
                        <span>${i + 1}.</span>
                        <span>${p.name}</span>
                        <span style="margin-left:auto;color:var(--gold);">${p.coins}</span>
                    </div>
                `).join('')}
            `;
        });
    }

    function showAdminBroadcast() {
        const modal = document.getElementById('adminBroadcastModal');
        modal.classList.add('show');
        document.getElementById('broadcastMsg').value = '';
        document.getElementById('broadcastCoins').value = '0';
        document.getElementById('broadcastDuration').value = '10';
        
        document.getElementById('broadcastSendBtn').onclick = () => {
            const message = document.getElementById('broadcastMsg').value.trim();
            const coins = parseInt(document.getElementById('broadcastCoins').value) || 0;
            const duration = parseInt(document.getElementById('broadcastDuration').value) || 10;
            
            if (!message && !coins) {
                showToast('Введите текст или монеты!');
                return;
            }
            
            const now = Date.now();
            const announcementRef = db.ref('announcements').push();
            announcementRef.set({
                text: message,
                coins: coins,
                createdAt: now,
                expireAt: now + duration * 1000,
                time: firebase.database.ServerValue.TIMESTAMP
            });
            
            if (coins > 0) {
                db.ref('on').once('value', snapshot => {
                    const onlinePlayers = snapshot.val();
                    if (!onlinePlayers) return;
                    
                    Object.keys(onlinePlayers).forEach(playerId => {
                        db.ref(`u/${playerId}/do`).transaction(current => (current || 0) + coins);
                    });
                });
            }
            
            showToast('Отправлено!');
            modal.classList.remove('show');
        };
    }

    function showAdminReports() {
        const modal = document.getElementById('adminReportsModal');
        modal.classList.add('show');
        
        db.ref('support').once('value', snapshot => {
            const data = snapshot.val();
            const list = document.getElementById('reportsList');
            
            if (!data) {
                list.innerHTML = '<p style="color:var(--text2);">Нет</p>';
                return;
            }
            
            list.innerHTML = Object.entries(data).map(([id, report]) => `
                <div style="background:var(--surface);border-radius:8px;padding:10px;margin:4px 0;font-size:11px;">
                    <div style="color:var(--gold);">${report.fromName || 'Игрок'}</div>
                    <div style="color:var(--text);margin:4px 0;">${report.text}</div>
                    <button class="btn-sm close-report" data-id="${id}" style="border-color:var(--green);color:var(--green);margin-top:6px;">Закрыть</button>
                </div>
            `).join('');
            
            list.querySelectorAll('.close-report').forEach(btn => {
                btn.addEventListener('click', () => {
                    db.ref(`support/${btn.dataset.id}`).remove();
                    showAdminReports();
                });
            });
        });
    }

    function showAdminSettings() {
        const modal = document.getElementById('adminSettingsModal');
        modal.classList.add('show');
        
        db.ref('settings/startCoins').once('value', snapshot => {
            document.getElementById('startCoinsInput').value = snapshot.val() !== undefined ? snapshot.val() : 100;
        });
        
        document.getElementById('startCoinsSaveBtn').onclick = () => {
            const value = parseInt(document.getElementById('startCoinsInput').value);
            if (isNaN(value) || value < 0) {
                showToast('0 или больше!');
                return;
            }
            db.ref('settings/startCoins').set(value);
            showToast(`Монеты: ${value}`);
        };
        
        document.getElementById('avatarUrlSaveBtn').onclick = () => {
            const url = document.getElementById('avatarUrlInput').value.trim();
            const target = document.getElementById('avatarPlayerSearch').value.trim();
            
            if (!url) {
                showToast('Введите URL!');
                return;
            }
            
            let playerId = target ? null : state.playerId;
            if (target) {
                db.ref('u').orderByChild('n').equalTo(target).once('value', snapshot => {
                    const user = snapshot.val();
                    if (user) playerId = Object.keys(user)[0];
                    if (!playerId) {
                        showToast('Не найден, себе');
                        playerId = state.playerId;
                    }
                    addCustomAvatar(playerId, url);
                });
            } else {
                addCustomAvatar(state.playerId, url);
            }
        };
        
        document.getElementById('musicUrlSaveBtn').onclick = () => {
            const url = document.getElementById('musicUrlInput').value.trim();
            const target = document.getElementById('musicPlayerSearch').value.trim();
            
            if (!url) {
                showToast('Введите URL!');
                return;
            }
            
            let playerId = target ? null : state.playerId;
            if (target) {
                db.ref('u').orderByChild('n').equalTo(target).once('value', snapshot => {
                    const user = snapshot.val();
                    if (user) playerId = Object.keys(user)[0];
                    if (!playerId) {
                        showToast('Не найден, себе');
                        playerId = state.playerId;
                    }
                    addCustomMusic(playerId, url);
                });
            } else {
                addCustomMusic(state.playerId, url);
            }
        };
        
        loadCustomAvatars();
        loadCustomMusic();
    }

    function addCustomAvatar(playerId, url) {
        db.ref(`settings/customAvatars/${playerId}`).push(url);
        showToast('Аватар добавлен!');
        loadCustomAvatars();
    }

    function addCustomMusic(playerId, url) {
        db.ref(`settings/customMusic/${playerId}`).push(url);
        showToast('Музыка добавлена!');
        loadCustomMusic();
    }

    function loadCustomAvatars() {
        db.ref('settings/customAvatars').once('value', snapshot => {
            const data = snapshot.val();
            const list = document.getElementById('customAvatarsList');
            
            if (!data) {
                list.innerHTML = '';
                return;
            }
            
            let html = '<div class="section-title">Аватарки</div>';
            Object.entries(data).forEach(([playerId, avatars]) => {
                if (!avatars) return;
                Object.entries(avatars).forEach(([key, url]) => {
                    html += `
                        <div class="lobby-player">
                            <span style="font-size:9px;">${playerId}</span>
                            <span class="btn-sm" data-pid="${playerId}" data-key="${key}" style="margin-left:auto;color:var(--red);">✕</span>
                        </div>
                    `;
                });
            });
            list.innerHTML = html;
            
            list.querySelectorAll('.btn-sm').forEach(btn => {
                btn.addEventListener('click', () => {
                    db.ref(`settings/customAvatars/${btn.dataset.pid}/${btn.dataset.key}`).remove();
                    db.ref(`u/${btn.dataset.pid}/a`).set('icons/avatar1.png');
                    showToast('Удалён');
                    loadCustomAvatars();
                });
            });
        });
    }

    function loadCustomMusic() {
        db.ref('settings/customMusic').once('value', snapshot => {
            const data = snapshot.val();
            const list = document.getElementById('customMusicList');
            
            if (!data) {
                list.innerHTML = '';
                return;
            }
            
            let html = '<div class="section-title">Музыка</div>';
            Object.entries(data).forEach(([playerId, tracks]) => {
                if (!tracks) return;
                Object.entries(tracks).forEach(([key, url]) => {
                    html += `
                        <div class="lobby-player">
                            <span style="font-size:9px;">${playerId}</span>
                            <span class="btn-sm" data-pid="${playerId}" data-key="${key}" style="margin-left:auto;color:var(--red);">✕</span>
                        </div>
                    `;
                });
            });
            list.innerHTML = html;
            
            list.querySelectorAll('.btn-sm').forEach(btn => {
                btn.addEventListener('click', () => {
                    db.ref(`settings/customMusic/${btn.dataset.pid}/${btn.dataset.key}`).remove();
                    showToast('Удалена');
                    loadCustomMusic();
                });
            });
        });
    }

    function showAdminScare() {
        document.getElementById('adminScareModal').classList.add('show');
    }

    // ========== 14. ПОДДЕРЖКА ==========
    function showSupportModal() {
        const modal = document.getElementById('supportModal');
        modal.classList.add('show');
        
        const now = Date.now();
        const cooldown = 300000; // 5 минут
        const remaining = cooldown - (now - state.lastSupportTime);
        
        if (remaining > 0) {
            const minutes = Math.ceil(remaining / 60000);
            document.getElementById('supportCd').textContent = `Повторно через ${minutes} мин.`;
            document.getElementById('supportSendBtn').disabled = true;
        } else {
            document.getElementById('supportCd').textContent = '';
            document.getElementById('supportSendBtn').disabled = false;
        }
        
        document.getElementById('supportMsg').value = '';
        
        document.getElementById('supportSendBtn').onclick = () => {
            const message = document.getElementById('supportMsg').value.trim();
            if (!message) {
                showToast('Введите текст!');
                return;
            }
            
            const nowTime = Date.now();
            if (nowTime - state.lastSupportTime < cooldown) {
                showToast('Подождите!');
                return;
            }
            
            state.lastSupportTime = nowTime;
            db.ref('support').push({
                from: state.playerId,
                fromName: state.playerName,
                text: message,
                time: firebase.database.ServerValue.TIMESTAMP,
                saved: false
            });
            saveGameState();
            showToast('Отправлено!');
            modal.classList.remove('show');
        };
    }

    // ========== 15. ПОЛЬЗОВАТЕЛЬСКИЙ ВВОД ==========
    function showCustomInput(title, min, max, callback) {
        state.customChipCallback = callback;
        state.customChipMin = min;
        state.customChipMax = max;
        
        document.getElementById('customInputTitle').textContent = title;
        document.getElementById('customInputHint').textContent = `От ${min} до ${max}`;
        document.getElementById('customInputValue').value = '';
        document.getElementById('customInputOverlay').classList.add('show');
        
        setTimeout(() => document.getElementById('customInputValue').focus(), 100);
    }

    // ========== 16. ДРУЗЬЯ И ПОИСК ==========
    function showInviteModal(friendId, friendName, friendAvatar) {
        state.roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        
        db.ref(`rooms/${state.roomCode}`).set({
            hid: state.playerId,
            rn: 'Комната',
            mp: 4,
            sc: 10000,
            rt: 30,
            tr: 5,
            pl: {},
            st: 'waiting',
            access: 'open',
            rm: 'hard',
            bet: 0
        });
        
        document.getElementById('inviteFriendList').innerHTML = `
            <div class="lobby-player" style="cursor:pointer;" id="sendInvite">
                <span class="avatar">${getAvatarHtml(friendAvatar || '?')}</span>
                ${friendName} — Отправить
            </div>
        `;
        
        document.getElementById('sendInvite').addEventListener('click', () => {
            sendGameInvite(friendId);
        });
        
        document.getElementById('inviteModal').classList.add('show');
    }

    function searchFriendByName(query) {
        if (!query || query.length < 2) return;
        
        db.ref('u').orderByChild('n').startAt(query).endAt(query + '\uf8ff').limitToFirst(10).once('value', snapshot => {
            const users = snapshot.val();
            const results = document.getElementById('friendSearchResults');
            
            if (!users) {
                results.innerHTML = '<p style="color:var(--text2);">Ничего</p>';
                return;
            }
            
            const filtered = Object.entries(users).filter(([id]) => id !== state.playerId);
            
            results.innerHTML = filtered.length === 0
                ? '<p style="color:var(--text2);">Ничего</p>'
                : filtered.map(([id, user]) => {
                    const isFriend = state.friends.includes(id);
                    return `
                        <div class="lobby-player">
                            <span class="avatar">${getAvatarHtml(user.a)}</span>
                            <span>${user.n || 'Игрок'}</span>
                            ${!isFriend 
                                ? `<button class="btn-sm add-fr-btn" data-id="${id}" style="border-color:var(--gold);color:var(--gold);margin-left:auto;">Добавить</button>`
                                : '<span style="color:var(--green);margin-left:4px;">✓</span>'}
                            ${state.inviteFromRoom
                                ? `<button class="btn-sm invite-fr-btn-room" data-id="${id}" data-name="${user.n || 'Игрок'}" data-avatar="${user.a || ''}" style="border-color:var(--blue);color:var(--blue);margin-left:4px;">В комн.</button>`
                                : `<button class="btn-sm invite-fr-btn" data-id="${id}" data-name="${user.n || 'Игрок'}" data-avatar="${user.a || ''}" style="border-color:var(--blue);color:var(--blue);margin-left:4px;">Пригл.</button>`}
                        </div>
                    `;
                }).join('');
            
            results.querySelectorAll('.add-fr-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    sendFriendRequest(btn.dataset.id);
                    btn.textContent = '✓';
                    btn.disabled = true;
                });
            });
            
            results.querySelectorAll('.invite-fr-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    showInviteModal(btn.dataset.id, btn.dataset.name, btn.dataset.avatar);
                });
            });
            
            results.querySelectorAll('.invite-fr-btn-room').forEach(btn => {
                btn.addEventListener('click', () => {
                    inviteToGameFromRoom(btn.dataset.id);
                });
            });
        }, error => {
            log(`Ошибка: ${error.message}`, 'error');
        });
    }

    function inviteToGameFromRoom(friendId) {
        if (!state.roomCode) return;
        
        db.ref(`gi/${friendId}/${state.roomCode}`).set({
            from: state.playerId,
            fromName: state.playerName,
            fromAvatar: state.playerAvatar,
            roomCode: state.roomCode,
            roomName: state.roomName,
            bet: state.betAmount,
            mp: state.maxPlayers,
            sc: state.startCapital,
            rt: state.roundTime,
            tr: state.totalRounds,
            rm: state.roomMode,
            status: 'pending',
            ts: firebase.database.ServerValue.TIMESTAMP
        });
        
        showToast('Приглашение в комнату!');
    }

    function inviteToGame(friendId) {
        db.ref(`u/${friendId}`).once('value', snapshot => {
            const data = snapshot.val();
            if (data) {
                showInviteModal(friendId, data.n || 'Игрок', data.a || '');
            }
        });
    }

    function showFriendsModal() {
        const modal = document.getElementById('friendsModal');
        modal.classList.add('show');
        
        // Заявки в друзья
        if (state.friendRequests.length === 0) {
            document.getElementById('frcList').innerHTML = '<p style="color:var(--text2);">Нет</p>';
        } else {
            Promise.all(state.friendRequests.map(id => db.ref(`u/${id}`).once('value'))).then(snapshots => {
                let html = '';
                snapshots.forEach((snap, i) => {
                    const data = snap.val();
                    if (data) {
                        html += `
                            <div class="lobby-player">
                                <span class="avatar">${getAvatarHtml(data.a)}</span>
                                ${data.n || 'Игрок'}
                                <button class="btn-sm accept-fr" data-id="${state.friendRequests[i]}" style="border-color:var(--green);color:var(--green);">V</button>
                                <button class="btn-sm decline-fr" data-id="${state.friendRequests[i]}" style="border-color:var(--red);color:var(--red);">X</button>
                            </div>
                        `;
                    }
                });
                document.getElementById('frcList').innerHTML = html || '<p>Нет</p>';
                
                document.querySelectorAll('.accept-fr').forEach(btn => {
                    btn.onclick = () => {
                        acceptFriendRequest(btn.dataset.id);
                        showFriendsModal();
                    };
                });
                document.querySelectorAll('.decline-fr').forEach(btn => {
                    btn.onclick = () => {
                        declineFriendRequest(btn.dataset.id);
                        showFriendsModal();
                    };
                });
            }).catch(error => log(`Ошибка: ${error.message}`, 'error'));
        }
        
        // Приглашения в игры
        if (state.gameInvites.length === 0) {
            document.getElementById('gameInvitesList').innerHTML = '<p style="color:var(--text2);">Нет</p>';
        } else {
            Promise.all(state.gameInvites.map(([key, inv]) => db.ref(`u/${inv.from}`).once('value'))).then(snapshots => {
                let html = '';
                snapshots.forEach((snap, i) => {
                    const data = snap.val();
                    const inv = state.gameInvites[i][1];
                    if (data && inv) {
                        const isTransfer = inv.status === 'host_transfer';
                        html += `
                            <div class="lobby-player">
                                <span class="avatar">${getAvatarHtml(inv.fromAvatar || data.a)}</span>
                                ${data.n || 'Игрок'} → ${inv.roomName || 'Комната'}${inv.bet > 0 ? ` [${inv.bet}]` : ''}
                                ${isTransfer ? '<span style="color:var(--gold);font-size:9px;">Хост</span>' : ''}
                                <button class="btn-sm accept-gi" data-inv-id="${state.gameInvites[i][0]}" data-inv="${encodeURIComponent(JSON.stringify(inv))}" style="border-color:var(--green);color:var(--green);">
                                    ${isTransfer ? 'Настр.' : 'V'}
                                </button>
                                <button class="btn-sm decline-gi" data-inv-id="${state.gameInvites[i][0]}" style="border-color:var(--red);color:var(--red);">X</button>
                            </div>
                        `;
                    }
                });
                document.getElementById('gameInvitesList').innerHTML = html || '<p>Нет</p>';
                
                document.querySelectorAll('.accept-gi').forEach(btn => {
                    btn.onclick = () => {
                        const invite = JSON.parse(decodeURIComponent(btn.dataset.inv));
                        acceptGameInvite(btn.dataset.invId, invite);
                    };
                });
                document.querySelectorAll('.decline-gi').forEach(btn => {
                    btn.onclick = () => {
                        declineGameInvite(btn.dataset.invId);
                        showFriendsModal();
                    };
                });
            }).catch(error => log(`Ошибка: ${error.message}`, 'error'));
        }
        
        // Список друзей
        if (state.friends.length === 0) {
            document.getElementById('friendsList').innerHTML = '<p style="color:var(--text2);">Нет</p>';
        } else {
            Promise.all(state.friends.map(id => db.ref(`u/${id}`).once('value'))).then(snapshots => {
                let html = '';
                snapshots.forEach(snap => {
                    const data = snap.val();
                    if (data) {
                        html += `
                            <div class="lobby-player">
                                <span class="avatar">${getAvatarHtml(data.a)}</span>
                                ${data.n || 'Игрок'}
                                <button class="btn-sm invite-game" data-id="${snap.key}" style="border-color:var(--blue);color:var(--blue);">
                                    ${state.inviteFromRoom ? 'В комн.' : 'Пригл.'}
                                </button>
                            </div>
                        `;
                    }
                });
                document.getElementById('friendsList').innerHTML = html || '<p>Нет</p>';
                
                document.querySelectorAll('.invite-game').forEach(btn => {
                    btn.onclick = () => {
                        if (state.inviteFromRoom) {
                            inviteToGameFromRoom(btn.dataset.id);
                        } else {
                            inviteToGame(btn.dataset.id);
                        }
                    };
                });
            }).catch(error => log(`Ошибка: ${error.message}`, 'error'));
        }
    }

    // ========== 17. НАВИГАЦИЯ ==========
    function switchTab(tab) {
        state.currentTab = tab;
        document.querySelectorAll('#bottomNav .nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });
        if (tab === 'friends') showFriendsModal();
    }

    function resetBottomNav() {
        state.currentTab = 'menu';
        document.querySelectorAll('#bottomNav .nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === 'menu');
        });
    }

    // ========== 18. МУЗЫКА ==========
    const musicTracks = ['music/track1.mp3', 'music/track2.mp3', 'music/track3.mp3'];
    let currentTrackIndex = 0;
    let musicEnabled = false;
    const backgroundMusic = new Audio();

    function playNextTrack() {
        if (!musicEnabled || !musicTracks[currentTrackIndex]) return;
        backgroundMusic.src = musicTracks[currentTrackIndex];
        backgroundMusic.play().catch(() => {});
        backgroundMusic.onended = () => {
            currentTrackIndex = (currentTrackIndex + 1) % musicTracks.length;
            playNextTrack();
        };
    }

    // ========== 19. ИГРОВАЯ ЛОГИКА ==========
    function generateGameCases() {
        state.gameCases = [];
        state.gameRound = 0;
        const usedIds = [];
        
        for (let i = 0; i < state.totalRounds; i++) {
            const available = state.activeCasesList.filter(c => c && c.symbol && !usedIds.includes(c.id));
            const selectedCase = available.length > 0 
                ? available[Math.floor(Math.random() * available.length)]
                : state.activeCasesList[0];
            
            if (!selectedCase) continue;
            
            usedIds.push(selectedCase.id);
            state.gameCases.push({
                id: selectedCase.id,
                symbol: selectedCase.symbol,
                round: i + 1,
                name: selectedCase.name || '',
                desc: selectedCase.desc || '',
                trend: selectedCase.trend || 'volatile'
            });
        }
    }

    function getRandomCase() {
        // Для мультиплеера
        if (state.isMultiplayer && state.gameCases.length > 0) {
            if (state.gameRound >= state.gameCases.length) state.gameRound = 0;
            const selected = state.gameCases[state.gameRound];
            state.gameRound++;
            if (selected && selected.symbol && !state.usedCases.includes(selected.id)) {
                return selected;
            }
        }
        
        // Для соло или фрилансера
        const pool = state.isFakeAlert 
            ? state.activeCasesList.filter(c => c && c.symbol && c.price && c.price >= 1 && c.price <= 15)
            : state.activeCasesList;
        
        const available = pool.filter(c => c && c.symbol && c.price && !state.usedCases.includes(c.id));
        
        if (!available.length) {
            state.usedCases = [];
            return pool[Math.floor(Math.random() * pool.length)];
        }
        
        return available[Math.floor(Math.random() * available.length)];
    }

    function updateMarketPrices() {
        const cases = state.isFakeAlert 
            ? state.activeCasesList.filter(c => c && c.price && c.price >= 1 && c.price <= 15)
            : state.activeCasesList;
        
        for (let i = 0; i < cases.length; i++) {
            const c = cases[i];
            if (!c || !c.symbol || !c.price) continue;
            
            if (!state.marketPrices[c.symbol]) {
                state.marketPrices[c.symbol] = Number(c.price) || 10;
                state.fairPrices[c.symbol] = Number(c.price) || 10;
            }
            
            const currentPrice = state.marketPrices[c.symbol];
            const fairPrice = state.fairPrices[c.symbol];
            const volatilityMultiplier = state.isFakeAlert ? 2.5 : 1;
            
            let trendBias = 0;
            if (c.trend === 'up') trendBias = 0.5;
            else if (c.trend === 'down') trendBias = -0.4;
            else if (c.trend === 'volatile') trendBias = (Math.random() - 0.5) * 1.5;
            
            const followTrend = Math.random() < 0.667;
            const bias = followTrend ? trendBias : -trendBias;
            
            let change = ((fairPrice - currentPrice) / fairPrice) * 30 * volatilityMultiplier +
                         (Math.random() - 0.5 + bias * 0.4) * 12 * volatilityMultiplier;
            
            if (Math.random() < 0.06 * volatilityMultiplier) {
                change = (Math.random() > 0.5 ? 1 : -1) * (15 + Math.random() * 20);
            }
            
            change = Math.max(-50, Math.min(50, change));
            state.marketPrices[c.symbol] = Math.max(0.05, currentPrice * (1 + change / 100));
            state.fairPrices[c.symbol] = fairPrice * (1 + (Math.random() - 0.49) * 4 / 100);
        }
        
        if ((state.isGhost || state.cheats.predictOutcome) && isAdmin() && state.currentCase) {
            updateGhostPredict();
        }
    }

    function showLeftNotice(playerName) {
        const notice = document.getElementById('leftNotice');
        notice.innerHTML = `${playerName} вышел! <button class="btn-sm" id="leaveAfterThem">Выйти</button>`;
        notice.classList.add('show');
        
        document.getElementById('leaveAfterThem').addEventListener('click', () => {
            notice.classList.remove('show');
            leaveGame();
        });
        
        setTimeout(() => notice.classList.remove('show'), 15000);
    }

    function forceLose() {
        state.ownCash = 0;
        state.ownPortfolio = {};
        state.playerDollars = Math.max(0, state.playerDollars - 100);
        saveGameState();
        updateUI();
    }

    function leaveGame() {
        if (state.isGameActive) {
            forceLose();
            if (state.roomCode) {
                db.ref(`rooms/${state.roomCode}/pl/${state.playerId}`).update({
                    c: 0,
                    p: {},
                    left: true
                });
                db.ref(`rooms/${state.roomCode}/rd/${state.playerId}`).remove();
            }
        }
        
        if (state.ghostRoomCode) {
            db.ref(`rooms/${state.ghostRoomCode}`).remove();
            state.ghostRoomCode = null;
        }
        
        state.isGameActive = false;
        clearInterval(state.roundTimer);
        clearInterval(state.finalInterval);
        clearInterval(state.finalPriceInterval);
        
        document.getElementById('gameScreen').style.display = 'none';
        document.getElementById('finalOverlay').classList.remove('show');
        document.getElementById('resultOverlay').classList.remove('show');
        document.getElementById('menuScreen').style.display = 'block';
        document.getElementById('playMenu').style.display = 'block';
        document.getElementById('playMenuBtn').style.display = 'none';
        document.getElementById('historyBtn').style.display = 'none';
        document.getElementById('leftNotice').classList.remove('show');
        
        document.getElementById('buyBtn').style.display = '';
        document.getElementById('waitBtn').style.display = '';
        document.getElementById('sellAllBtn').style.display = '';
        document.getElementById('readyStatus').style.display = '';
        document.querySelector('.action-row').style.display = '';
        document.querySelector('.quick-qty').style.display = '';
        document.getElementById('ghostPredictBox').style.display = 'none';
    }

    function showConfirm(message, callback) {
        document.getElementById('confirmMsg').textContent = message;
        document.getElementById('confirmModal').classList.add('show');
        
        document.getElementById('confirmYes').onclick = () => {
            document.getElementById('confirmModal').classList.remove('show');
            if (callback) callback(true);
        };
        
        document.getElementById('confirmNo').onclick = () => {
            document.getElementById('confirmModal').classList.remove('show');
            if (callback) callback(false);
        };
    }

    window.setBuyQty = function(value) {
        const input = document.getElementById('buyQty');
        if (value === 'max') {
            const price = state.currentCase ? (state.marketPrices[state.currentCase.symbol] || state.currentCase.price) : 1;
            input.value = Math.floor(state.ownCash / price);
            if (input.value < 1) input.value = '1';
        } else {
            input.value = value;
        }
        updateBuyButton();
    };

    function updatePortfolioDisplay() {
        const table = document.getElementById('portfolioBody');
        const assets = Object.entries(state.ownPortfolio);
        
        table.innerHTML = assets.length === 0 
            ? `<tr><td colspan="8">Нет активов</td></tr>`
            : assets.map(([symbol, data]) => {
                const price = state.marketPrices[symbol] || data.avgPrice;
                const value = price * data.qty;
                const percentChange = data.avgPrice ? ((price - data.avgPrice) / data.avgPrice * 100) : 0;
                const changeClass = percentChange >= 0 ? 'up' : 'down';
                const changeSign = percentChange >= 0 ? '+' : '';
                const absPercent = Math.abs(percentChange).toFixed(1);
                const rowClass = percentChange >= 5 ? 'gain' : (percentChange <= -5 ? 'loss' : '');
                
                const caseItem = state.activeCasesList.find(c => c && c.symbol === symbol);
                let comment = '';
                if (caseItem) {
                    comment = percentChange >= 0 ? (caseItem.reason_up || '') : (caseItem.reason_down || '');
                }
                
                let prediction = '';
                let predColor = '';
                if (isAdmin() && state.cheats.predictOutcome && state.fairPrices[symbol]) {
                    const fairPrice = state.fairPrices[symbol];
                    const changePercent = (fairPrice - price) / price * 100;
                    if (changePercent > 0) {
                        prediction = `↑+${changePercent.toFixed(1)}%`;
                        predColor = 'var(--green)';
                    } else {
                        prediction = `↓${Math.abs(changePercent).toFixed(1)}%`;
                        predColor = 'var(--red)';
                    }
                }
                
                return `
                    <tr class="${rowClass}">
                        <td class="sym">${symbol}</td>
                        <td>${data.qty}</td>
                        <td>${formatMoney(price)}</td>
                        <td>${formatMoney(value)}</td>
                        <td class="${changeClass}">${changeSign}${absPercent}%</td>
                        <td style="color:${predColor};font-weight:bold;">${prediction}</td>
                        <td class="pf-comment" title="${comment || ''}">${comment || '—'}</td>
                        <td>
                            <input class="qty-input" id="sq_${symbol}" value="${data.qty}">
                            <button class="btn-sm sell" id="sl_${symbol}">Продать</button>
                        </td>
                    </tr>
                `;
            }).join('');
        
        assets.forEach(([symbol]) => {
            const sellBtn = document.getElementById(`sl_${symbol}`);
            if (sellBtn) {
                sellBtn.onclick = () => {
                    const data = state.ownPortfolio[symbol];
                    if (!data) return;
                    
                    const input = document.getElementById(`sq_${symbol}`);
                    let quantity = Math.max(1, Math.min(data.qty, parseInt((input || {}).value) || data.qty));
                    
                    const price = state.marketPrices[symbol] || data.avgPrice;
                    state.ownCash += price * quantity;
                    data.qty -= quantity;
                    
                    if (data.qty <= 0) delete state.ownPortfolio[symbol];
                    
                    playSellSound();
                    updatePortfolioDisplay();
                    updatePlayersDisplay();
                    syncPortfolioToDB();
                };
            }
        });
    }

    function updatePlayersDisplay() {
        if (state.isGhost) {
            const activePlayers = state.lobbyPlayers.filter(p => !state.leftPlayers.includes(p.id));
            const players = activePlayers.map(p => ({
                n: p.n,
                a: p.a,
                c: p.c || state.startCapital,
                you: false,
                id: p.id,
                left: state.leftPlayers.includes(p.id)
            }));
            
            document.getElementById('playersRow').innerHTML = players.map(p => `
                <div class="player-card ${p.left ? 'left ' : ''}">
                    <div class="avatar">${getAvatarHtml(p.a)}</div>
                    <div class="name">${p.n}${p.left ? ' (вышел)' : ''}</div>
                    <div class="cash">${formatMoney(p.c)}</div>
                </div>
            `).join('');
            return;
        }
        
        const activePlayers = state.lobbyPlayers.filter(p => !state.leftPlayers.includes(p.id));
        let players;
        
        if (state.isMultiplayer && activePlayers.length > 0) {
            players = activePlayers.map(p => ({
                n: p.n,
                a: p.a,
                c: p.c || state.startCapital,
                you: p.id === state.playerId,
                id: p.id,
                left: state.leftPlayers.includes(p.id)
            }));
        } else {
            players = [
                { n: state.playerName, a: state.playerAvatar, c: state.ownCash, you: true },
                { n: state.opponentName, a: state.opponentAvatar, c: state.opponentCash, you: false }
            ];
        }
        
        document.getElementById('playersRow').innerHTML = players.map(p => `
            <div class="player-card ${p.you ? 'you ' : ''}${p.left ? 'left ' : ''}" 
                 data-pid="${p.id || ''}" 
                 data-pname="${p.n}" 
                 data-pavatar="${p.a}">
                <div class="avatar">${getAvatarHtml(p.a)}</div>
                <div class="name">${p.n}${p.left ? ' (вышел)' : ''}</div>
                <div class="cash">${formatMoney(p.c)}</div>
            </div>
        `).join('');
        
        document.querySelectorAll('.player-card:not(.you):not(.left)').forEach(card => {
            card.addEventListener('click', () => showPlayerProfile(card.dataset));
        });
    }

    function showPlayerProfile(data) {
        if (data.pid === state.playerId) return;
        
        const content = document.getElementById('ppContent');
        const isFriend = state.friends.includes(data.pid);
        
        content.innerHTML = `
            <h3>${data.pname || 'Игрок'}</h3>
            <div class="profile-avatar" style="margin:0 auto 10px;width:64px;height:64px;">
                ${getAvatarHtml(data.pavatar)}
            </div>
            <p>${data.pname || 'Игрок'}</p>
            ${!isFriend && data.pid ? '<button class="btn gold" id="addFriendBtn">Добавить в друзья</button>' : ''}
            <button class="btn gold" id="offerTradeBtn" style="margin-top:6px;">Купить акции</button>
        `;
        
        document.getElementById('playerProfileModal').classList.add('show');
        
        const addFriendBtn = document.getElementById('addFriendBtn');
        if (addFriendBtn) {
            addFriendBtn.addEventListener('click', () => {
                sendFriendRequest(data.pid);
                document.getElementById('playerProfileModal').classList.remove('show');
            });
        }
        
        const offerTradeBtn = document.getElementById('offerTradeBtn');
        if (offerTradeBtn) {
            offerTradeBtn.addEventListener('click', () => showTradeOffer(data));
        }
    }

    function showTradeOffer(data) {
        const content = document.getElementById('tradeContent');
        content.innerHTML = `
            <h3>Купить акции у ${data.pname}</h3>
            <div class="section-title">Ваши деньги: ${formatMoney(state.ownCash)}</div>
            <div id="tradeSymbols"></div>
        `;
        
        document.getElementById('tradeModal').classList.add('show');
        
        const opponentPortfolio = (state.isMultiplayer && state.roomCode)
            ? (state.lobbyPlayers.find(p => p.id === data.pid) || {}).p || {}
            : state.opponentPortfolio || {};
        
        const symbols = Object.keys(opponentPortfolio).filter(sym => 
            opponentPortfolio[sym] && opponentPortfolio[sym].qty > 0
        );
        
        if (symbols.length === 0) {
            content.innerHTML += '<p style="color:var(--text2);">Нет акций</p>';
            return;
        }
        
        document.getElementById('tradeSymbols').innerHTML = symbols.map(symbol => {
            const price = state.marketPrices[symbol] || 10;
            return `
                <div style="background:var(--surface);padding:10px;border-radius:8px;margin:4px 0;cursor:pointer;" 
                     class="trade-sym" 
                     data-sym="${symbol}" 
                     data-price="${price}" 
                     data-target="${data.pid}">
                    <b>${symbol}</b> | ${formatMoney(price)} | Доступно: ${opponentPortfolio[symbol].qty}
                </div>
            `;
        }).join('');
        
        document.querySelectorAll('.trade-sym').forEach(el => {
            el.addEventListener('click', () => {
                const symbol = el.dataset.sym;
                const price = parseFloat(el.dataset.price);
                const target = el.dataset.target;
                
                if (state.ownCash >= price) {
                    const tradeKey = `${target}_${symbol}`;
                    if (state.tradeShown[tradeKey]) {
                        showToast('Предложение уже отправлено!');
                        return;
                    }
                    
                    state.tradeShown[tradeKey] = true;
                    db.ref(`rooms/${state.roomCode}/trades/${tradeKey}`).set({
                        from: state.playerId,
                        to: target,
                        sym: symbol,
                        price: price,
                        qty: 1,
                        fromName: state.playerName,
                        status: 'pending',
                        ts: firebase.database.ServerValue.TIMESTAMP
                    }, error => {
                        if (error) {
                            log(`Ошибка: ${error.message}`, 'error');
                            state.tradeShown[tradeKey] = false;
                        } else {
                            showToast(`Предложение: ${symbol}`);
                            document.getElementById('tradeModal').classList.remove('show');
                        }
                    });
                } else {
                    showToast('Недостаточно денег');
                }
            });
        });
    }

    function showTradeRequest(trade) {
        const key = `${trade.from}_${trade.sym}`;
        if (state.tradeShown[key]) return;
        state.tradeShown[key] = true;
        
        const notice = document.getElementById('tradeNotice');
        notice.innerHTML = `
            <b>${trade.fromName}</b> хочет купить <b>${trade.sym}</b> за <b>${formatMoney(trade.price)}</b><br>
            <button class="btn-sm" id="acceptTrade" style="border-color:var(--green);color:var(--green);">Принять</button>
            <button class="btn-sm" id="declineTrade" style="border-color:var(--red);color:var(--red);">Отклонить</button>
        `;
        notice.classList.add('show');
        
        document.getElementById('acceptTrade').addEventListener('click', () => {
            if (state.opponentPortfolio[trade.sym] && state.opponentPortfolio[trade.sym].qty > 0) {
                state.opponentCash += trade.price;
                state.opponentPortfolio[trade.sym].qty--;
                if (state.opponentPortfolio[trade.sym].qty <= 0) {
                    delete state.opponentPortfolio[trade.sym];
                }
                
                db.ref(`rooms/${state.roomCode}/pl/${trade.from}`).once('value', snapshot => {
                    const fromData = snapshot.val();
                    if (fromData) {
                        let fromCash = fromData.c || 0;
                        fromCash -= trade.price;
                        
                        if (!fromData.p) fromData.p = {};
                        if (!fromData.p[trade.sym]) fromData.p[trade.sym] = { qty: 0, avgPrice: 0 };
                        fromData.p[trade.sym].qty++;
                        fromData.p[trade.sym].avgPrice = trade.price;
                        
                        db.ref(`rooms/${state.roomCode}/pl/${trade.from}`).update({
                            c: fromCash,
                            p: fromData.p
                        });
                    }
                });
                
                delete state.tradeShown[key];
                db.ref(`rooms/${state.roomCode}/trades/${key}`).update({ status: 'done' });
                showToast('Сделка!');
            }
            notice.classList.remove('show');
        });
        
        document.getElementById('declineTrade').addEventListener('click', () => {
            delete state.tradeShown[key];
            db.ref(`rooms/${state.roomCode}/trades/${key}`).update({ status: 'declined' });
            notice.classList.remove('show');
        });
        
        setTimeout(() => {
            notice.classList.remove('show');
            delete state.tradeShown[key];
        }, 15000);
    }

    function setCurrentCase(caseData) {
        if (!caseData || !caseData.symbol) return;
        
        state.currentCase = caseData;
        
        if (!state.marketPrices[caseData.symbol]) {
            state.marketPrices[caseData.symbol] = Number(caseData.price) || 10;
            state.fairPrices[caseData.symbol] = Number(caseData.price) || 10;
        }
        
        document.getElementById('caseTitle').textContent = `${caseData.symbol} - ${caseData.name || ''}`;
        document.getElementById('caseDesc').textContent = caseData.desc || '';
        
        let priceHtml = formatMoney(state.marketPrices[caseData.symbol]);
        if (isAdmin() && state.cheats.predictOutcome && state.fairPrices[caseData.symbol]) {
            const fairPrice = state.fairPrices[caseData.symbol];
            const changePercent = (fairPrice - state.marketPrices[caseData.symbol]) / state.marketPrices[caseData.symbol] * 100;
            if (changePercent > 0) {
                priceHtml += ` <span style="color:var(--green);">↑+${changePercent.toFixed(1)}%</span>`;
            } else {
                priceHtml += ` <span style="color:var(--red);">↓${Math.abs(changePercent).toFixed(1)}%</span>`;
            }
        }
        document.getElementById('casePrice').innerHTML = priceHtml;
        document.getElementById('roundBadge').textContent = `${state.currentRound}/${state.totalRounds}`;
        
        updatePortfolioDisplay();
        updatePlayersDisplay();
        updateBuyButton();
        
        if ((state.isGhost || state.cheats.predictOutcome) && isAdmin()) {
            updateGhostPredict();
        }
    }

    function updateBuyButton() {
        if (!state.currentCase) return;
        
        const price = state.marketPrices[state.currentCase.symbol] || state.currentCase.price;
        const input = document.getElementById('buyQty');
        let quantity = Math.max(1, parseInt((input || {}).value) || 1);
        if (isNaN(quantity)) quantity = 1;
        
        document.getElementById('buyBtn').disabled = state.ownCash < price * quantity;
    }

    function purchaseAsset() {
        if (!state.isGameActive || state.isFinalPhase || !state.currentCase || state.isGhost) return;
        
        const caseData = state.currentCase;
        const price = state.marketPrices[caseData.symbol] || caseData.price;
        const input = document.getElementById('buyQty');
        let quantity = Math.max(1, parseInt((input || {}).value) || 1);
        if (isNaN(quantity)) quantity = 1;
        
        if (state.ownCash < price * quantity) return;
        
        state.ownCash -= price * quantity;
        
        if (!state.ownPortfolio[caseData.symbol]) {
            state.ownPortfolio[caseData.symbol] = { qty: 0, avgPrice: 0 };
        }
        
        const portfolio = state.ownPortfolio[caseData.symbol];
        portfolio.avgPrice = (portfolio.qty * portfolio.avgPrice + price * quantity) / (portfolio.qty + quantity);
        portfolio.qty += quantity;
        
        playBuySound();
        updatePortfolioDisplay();
        updatePlayersDisplay();
        updateBuyButton();
        syncPortfolioToDB();
    }

    function sellAllAssets() {
        if (Object.keys(state.ownPortfolio).length === 0) return;
        
        showConfirm('Продать ВСЕ активы?', confirmed => {
            if (confirmed) {
                for (const symbol in state.ownPortfolio) {
                    const price = state.marketPrices[symbol] || state.ownPortfolio[symbol].avgPrice;
                    state.ownCash += price * state.ownPortfolio[symbol].qty;
                }
                state.ownPortfolio = {};
                playSellSound();
                updatePortfolioDisplay();
                updatePlayersDisplay();
                syncPortfolioToDB();
            }
        });
    }

    function toggleWait() {
        if (!state.isMultiplayer || state.isGhost) {
            nextRound();
            return;
        }
        
        if (state.isWaiting) return;
        state.isWaiting = true;
        document.getElementById('waitBtn').classList.add('held');
        
        if (state.roomCode) {
            db.ref(`rooms/${state.roomCode}/rd/${state.playerId}`).set(true);
        }
    }

    function syncPortfolioToDB() {
        if (!state.roomCode || !state.isMultiplayer) return;
        
        db.ref(`rooms/${state.roomCode}/pl/${state.playerId}`).update({
            n: state.playerName,
            a: state.playerAvatar,
            c: state.ownCash,
            p: state.ownPortfolio
        });
    }

    function botAction() {
        if (!state.currentCase || state.isMultiplayer) return;
        
        const symbol = state.currentCase.symbol;
        const price = state.marketPrices[symbol] || state.currentCase.price;
        const botPortfolio = state.opponentPortfolio[symbol];
        const fairPrice = state.fairPrices[symbol] || price;
        
        // Покупка
        if (Math.random() < 0.8 && state.opponentCash >= price * 2) {
            const maxQuantity = Math.floor(state.opponentCash / price);
            let quantity = Math.floor(Math.random() * 8) + 3;
            if (quantity > maxQuantity) quantity = maxQuantity;
            
            if (quantity > 0 && state.opponentCash >= price * quantity) {
                state.opponentCash -= price * quantity;
                
                if (!state.opponentPortfolio[symbol]) {
                    state.opponentPortfolio[symbol] = { qty: 0, avgPrice: 0 };
                }
                
                const portfolio = state.opponentPortfolio[symbol];
                portfolio.avgPrice = (portfolio.qty * portfolio.avgPrice + price * quantity) / (portfolio.qty + quantity);
                portfolio.qty += quantity;
            }
        }
        // Продажа
        else if (botPortfolio && botPortfolio.qty > 0 && (price > botPortfolio.avgPrice * 1.15 || price > fairPrice * 1.08)) {
            let quantity = Math.min(botPortfolio.qty, Math.ceil(botPortfolio.qty * 0.8));
            if (quantity > 0) {
                state.opponentCash += price * quantity;
                botPortfolio.qty -= quantity;
                if (botPortfolio.qty <= 0) delete state.opponentPortfolio[symbol];
            }
        }
        
        updatePlayersDisplay();
    }

    function botSellAll() {
        for (const symbol in state.opponentPortfolio) {
            const price = state.marketPrices[symbol] || state.opponentPortfolio[symbol].avgPrice;
            state.opponentCash += price * state.opponentPortfolio[symbol].qty;
        }
        state.opponentPortfolio = {};
    }

    function calculateRoomParameters(room) {
        if (!room.votes || Object.keys(room.votes).length === 0) return;
        
        const totals = {
            sc: room.sc || 10000,
            rt: room.rt || 30,
            tr: room.tr || 5
        };
        let count = 1;
        
        for (const key in room.votes) {
            const vote = room.votes[key];
            totals.sc += vote.sc || room.sc;
            totals.rt += vote.rt || room.rt;
            totals.tr += vote.tr || room.tr;
            count++;
        }
        
        db.ref(`rooms/${state.roomCode}`).update({
            sc: Math.ceil(totals.sc / count),
            rt: Math.ceil(totals.rt / count),
            tr: Math.ceil(totals.tr / count)
        });
    }

    // ========== 20. КОМНАТЫ И ЛОББИ ==========
    function startRoomListener() {
        if (!state.roomCode) return;
        if (state.roomListener) db.ref(`rooms/${state.roomCode}`).off('value', state.roomListener);
        
        state.roomListener = snapshot => {
            const room = snapshot.val();
            
            if (!room) {
                document.getElementById('lobbyModal').classList.remove('show');
                state.roomCode = null;
                state.isMultiplayer = false;
                state.isGhost = false;
                state.ghostWatchPlayerId = null;
                return;
            }
            
            state.hostId = room.hid || '';
            state.startCapital = room.sc || 10000;
            state.roundTime = room.rt || 30;
            state.totalRounds = room.tr || 5;
            state.maxPlayers = room.mp || 4;
            state.roomMode = room.rm || 'hard';
            state.roomAccess = room.access || 'open';
            state.betAmount = room.bet || 0;
            
            // Уведомление о хосте
            if (state.playerId === room.hid && !state._hostNotified && state.lobbyPlayers.length > 0) {
                showToast('👑 Вы стали хостом! Настройте комнату при необходимости');
                state._hostNotified = true;
            }
            
            // Показ параметров для свободной комнаты
            if (room.showParams && state.playerId !== room.hid && !state.pendingJoin && !state.isGhost) {
                state.pendingJoin = state.roomCode;
                document.getElementById('joinParamsModal').classList.add('show');
            }
            
            // Проверка пустой комнаты
            if (room.pl && Object.keys(room.pl).filter(id => !room.pl[id]?.left).length === 0 && room.st === 'waiting') {
                if (!(state.playerId === room.hid && !state.skipLobby)) {
                    db.ref(`rooms/${state.roomCode}`).remove();
                    state.roomCode = null;
                    state.isMultiplayer = false;
                    state.isGhost = false;
                    document.getElementById('lobbyModal').classList.remove('show');
                    return;
                }
            }
            
            // Синхронизация кейсов
            if (room.cs && room.cs.length > 0 && state.currentRound < room.cs.length) {
                const caseData = room.cs[state.currentRound];
                if (caseData && caseData.symbol) {
                    state.currentCase = {
                        symbol: caseData.symbol,
                        name: caseData.name || '',
                        desc: caseData.desc || '',
                        trend: caseData.trend || 'volatile',
                        price: state.marketPrices[caseData.symbol] || 10
                    };
                }
            }
            
            if (room.gameCases && room.gameCases.length > 0) {
                state.gameCases = room.gameCases;
                state.gameRound = 0;
            }
            
            // Синхронизация игроков
            if (room.pl) {
                const previousPlayers = state.lobbyPlayers.slice();
                state.lobbyPlayers = Object.keys(room.pl).map(id => ({
                    id: id,
                    n: room.pl[id].n || 'Игрок',
                    a: room.pl[id].a || '?',
                    c: room.pl[id].c || state.startCapital,
                    p: room.pl[id].p || {},
                    left: room.pl[id].left || false
                }));
                
                if (state.isGameActive && previousPlayers.length > state.lobbyPlayers.length) {
                    const leftPlayer = previousPlayers.find(pp => !state.lobbyPlayers.find(lp => lp.id === pp.id));
                    if (leftPlayer && !state.leftPlayers.includes(leftPlayer.id)) {
                        state.leftPlayers.push(leftPlayer.id);
                        showLeftNotice(leftPlayer.n);
                    }
                }
                
                if (!state.isGhost) {
                    const myData = room.pl[state.playerId];
                    if (myData && myData.left) {
                        forceLose();
                        endGame();
                        return;
                    }
                }
            }
            
            // Старт игры
            if (room.st === 'playing' && !state.isGameActive && !state.skipLobby && !state.isGhost) {
                document.getElementById('lobbyModal').classList.remove('show');
                startMatch();
                return;
            }
            
            if (room.st === 'playing' && state.skipLobby && !state.isGhost) {
                state.skipLobby = false;
                document.getElementById('roomModal').classList.remove('show');
                document.getElementById('lobbyModal').classList.add('show');
                startMatch();
                return;
            }
            
            if (room.st === 'playing' && state.isGhost) {
                document.getElementById('lobbyModal').classList.remove('show');
                state.isGameActive = false;
                state.isMultiplayer = false;
            }
            
            // Обработка готовности
            if (room.rd && state.isGameActive && !state.isGhost) {
                const activePlayers = state.lobbyPlayers.filter(p => !state.leftPlayers.includes(p.id) && !p.left);
                const readyCount = Object.keys(room.rd).filter(id => room.rd[id] && !state.leftPlayers.includes(id)).length;
                const totalActive = activePlayers.length;
                
                document.getElementById('readyStatus').textContent = `NO: ${readyCount}/${totalActive}`;
                
                if (readyCount >= totalActive && totalActive >= 2 && !state.roundReady) {
                    state.roundReady = true;
                    clearInterval(state.roundTimer);
                    
                    let timer = 5;
                    document.getElementById('timer').textContent = timer;
                    state.roundTimer = setInterval(() => {
                        timer--;
                        document.getElementById('timer').textContent = timer;
                        if (timer <= 0) {
                            clearInterval(state.roundTimer);
                            state.roundReady = false;
                            nextRound();
                        }
                    }, 1000);
                }
            }
            
            // Обновление лобби
            if (document.getElementById('lobbyModal').classList.contains('show')) {
                updateLobbyUI(room);
            }
            
            // Чат
            if (room.ch && document.getElementById('chatMsgs')) {
                const messages = Object.values(room.ch).sort((a, b) => a.t - b.t);
                const chatContainer = document.getElementById('chatMsgs');
                chatContainer.innerHTML = messages.map(msg => `
                    <div class="chat-msg">
                        <span class="author">${msg.n}:</span> ${msg.tx}
                    </div>
                `).join('');
                chatContainer.scrollTop = chatContainer.scrollHeight;
            }
            
            // Расчет параметров для свободной комнаты
            if (room.rm === 'free' && room.votes) {
                calculateRoomParameters(room);
            }
            
            // Синхронизация оппонента
            if (state.isGameActive && room.pl && !state.isGhost) {
                const opponentId = Object.keys(room.pl).find(id => 
                    id !== state.playerId && !state.leftPlayers.includes(id) && !room.pl[id]?.left
                );
                
                if (opponentId) {
                    state.opponentCash = room.pl[opponentId].c || state.startCapital;
                    state.opponentPortfolio = room.pl[opponentId].p || {};
                    state.opponentName = room.pl[opponentId].n || 'Игрок';
                    state.opponentAvatar = room.pl[opponentId].a || '?';
                } else {
                    if (state.lobbyPlayers.filter(p => !state.leftPlayers.includes(p.id) && !p.left).length <= 1 && state.isMultiplayer) {
                        endGame();
                    }
                }
                updatePlayersDisplay();
            }
            
            // Торговые предложения
            if (room.trades) {
                Object.values(room.trades).forEach(trade => {
                    if (trade && trade.to === state.playerId && trade.status === 'pending') {
                        showTradeRequest(trade);
                    }
                });
            }
            
            // Обновление для призрака
            if (state.isGhost) {
                updatePlayersDisplay();
                if (isAdmin() && state.cheats.predictOutcome && state.currentCase) {
                    updateGhostPredict();
                }
            }
        };
        
        db.ref(`rooms/${state.roomCode}`).on('value', state.roomListener);
    }

    function updateLobbyUI(room) {
        const container = document.getElementById('lobbyContent');
        const isHost = state.playerId === room.hid;
        const modeText = room.rm === 'free' ? 'Свободная' : 'Жёсткая';
        const accessText = room.access === 'open' ? 'Открытая' : 'Закрытая';
        
        container.innerHTML = `
            <h3>${room.rn || 'Комната'}</h3>
            ${room.bet > 0 ? '<div style="text-align:center;color:var(--gold);">Ставка: ' + room.bet + ' монет</div>' : ''}
            <div class="room-link" id="copyRoomCode">Код: ${state.roomCode}</div>
            <div class="room-link" id="copyDeepLink">Пригласить</div>
            <div class="room-info-box">
                💰 ${formatMoney(room.sc || 10000)} | ⏱ ${room.rt || 30}с | 📊 ${room.tr || 5} раундов<br>
                🔓 ${accessText} | ⚙️ ${modeText}
            </div>
            <p style="text-align:center;color:var(--text2);">${state.lobbyPlayers.length}/${room.mp || 4}</p>
            <div class="section-title">Участники:</div>
            ${state.lobbyPlayers.map(p => `
                <div class="lobby-player">
                    <span class="avatar">${getAvatarHtml(p.a)}</span>
                    ${p.n} ${p.id === state.playerId ? '(Вы)' : ''} ${p.id === room.hid ? '⭐' : ''}
                </div>
            `).join('')}
            <div class="chat-box" id="chatMsgs"></div>
            <div class="chat-input-row">
                <input id="chatInput" placeholder="Сообщение..." maxlength="100">
                <button class="btn-sm" id="chatSend">Отпр.</button>
            </div>
            ${isHost 
                ? `<button class="btn" id="roomSettingsBtn" style="margin-top:10px;border-color:var(--gold);color:var(--gold);">⚙️</button>
                   <button class="btn gold" id="startLobbyBtn" style="margin-top:6px;" ${state.lobbyPlayers.length < 2 ? 'disabled' : ''}>
                       НАЧАТЬ (${state.lobbyPlayers.length}/${room.mp || 4})
                   </button>`
                : '<p style="text-align:center;color:var(--text2);">Ожидание...</p>'}
            <button class="btn" id="leaveLobbyBtn" style="margin-top:6px;">Выйти</button>
        `;
        
        setTimeout(() => {
            document.getElementById('copyRoomCode').addEventListener('click', () => copyToClipboard(state.roomCode));
            document.getElementById('copyDeepLink').addEventListener('click', () => {
                state.inviteFromRoom = true;
                showFriendsModal();
            });
            
            const settingsBtn = document.getElementById('roomSettingsBtn');
            if (settingsBtn) {
                settingsBtn.addEventListener('click', showRoomSettings);
            }
            
            const startBtn = document.getElementById('startLobbyBtn');
            if (startBtn) {
                startBtn.disabled = state.lobbyPlayers.filter(p => !p.left).length < 2;
                startBtn.addEventListener('click', hostStartGame);
            }
            
            document.getElementById('leaveLobbyBtn').addEventListener('click', leaveRoom);
            document.getElementById('chatSend').addEventListener('click', sendChatMessage);
            document.getElementById('chatInput').addEventListener('keypress', e => {
                if (e.key === 'Enter') sendChatMessage();
            });
        }, 50);
    }

    function showRoomSettings() {
        document.getElementById('roomNameInput').value = state.roomName || 'Комната';
        resetChipsToValue('accessChips', 'access', state.roomAccess);
        resetChipsToValue('modeChips', 'mode', state.roomMode);
        resetChipsToValue('betChips', 'bet', state.betAmount);
        resetChipsToValue('maxChips', 'max', state.maxPlayers);
        resetChipsToValue('cashChips', 'cash', state.startCapital);
        resetChipsToValue('timeChips', 'time', state.roundTime);
        resetChipsToValue('roundsChips', 'rounds', state.totalRounds);
        
        document.getElementById('roomCodePreview').style.display = 'block';
        document.getElementById('roomCodeText').textContent = state.roomCode;
        document.getElementById('roomModalTitle').textContent = '⚙️ Настройки';
        document.getElementById('confirmRoomBtn').textContent = '💾 Сохранить';
        document.getElementById('roomModal').style.zIndex = '300';
        document.getElementById('roomModal').classList.add('show');
        
        document.getElementById('confirmRoomBtn').onclick = () => {
            const newName = document.getElementById('roomNameInput').value || 'Комната';
            const newMaxPlayers = parseInt((document.querySelector('#maxChips .selected') || {}).dataset.max || state.maxPlayers);
            const newStartCapital = parseInt((document.querySelector('#cashChips .selected') || {}).dataset.cash || state.startCapital);
            const newRoundTime = parseInt((document.querySelector('#timeChips .selected') || {}).dataset.time || state.roundTime);
            const newTotalRounds = parseInt((document.querySelector('#roundsChips .selected') || {}).dataset.rounds || state.totalRounds);
            const newAccess = (document.querySelector('#accessChips .selected') || {}).dataset.access || state.roomAccess;
            const newMode = (document.querySelector('#modeChips .selected') || {}).dataset.mode || state.roomMode;
            const newBet = parseInt((document.querySelector('#betChips .selected') || {}).dataset.bet || state.betAmount);
            
            state.roomName = newName;
            state.maxPlayers = newMaxPlayers;
            state.startCapital = newStartCapital;
            state.roundTime = newRoundTime;
            state.totalRounds = newTotalRounds;
            state.roomAccess = newAccess;
            state.roomMode = newMode;
            state.betAmount = newBet;
            
            db.ref(`rooms/${state.roomCode}`).update({
                rn: newName,
                mp: newMaxPlayers,
                sc: newStartCapital,
                rt: newRoundTime,
                tr: newTotalRounds,
                access: newAccess,
                rm: newMode,
                bet: newBet
            }).then(() => {
                db.ref(`rooms/${state.roomCode}/pl/${state.playerId}`).set({
                    n: state.playerName,
                    a: state.playerAvatar,
                    c: state.startCapital
                });
                
                if (newMode === 'free') {
                    db.ref(`rooms/${state.roomCode}/showParams`).set(true);
                    setTimeout(() => db.ref(`rooms/${state.roomCode}/showParams`).remove(), 30000);
                }
                
                state.isMultiplayer = true;
                state.lobbyPlayers = [];
                document.getElementById('lobbyModal').classList.add('show');
                
                if (state.roomListener) db.ref(`rooms/${state.roomCode}`).off('value', state.roomListener);
                startRoomListener();
                showToast('Настройки комнаты обновлены!');
            }).catch(() => showToast('Ошибка при обновлении'));
            
            document.getElementById('roomModal').style.zIndex = '250';
            document.getElementById('roomModal').classList.remove('show');
        };
    }

    function resetChipsToValue(rowId, key, value) {
        const row = document.getElementById(rowId);
        if (!row) return;
        
        row.querySelectorAll('.chip').forEach(chip => chip.classList.remove('selected'));
        row.querySelectorAll('.chip.custom-selected').forEach(chip => chip.remove());
        
        let found = false;
        row.querySelectorAll('.chip:not(.custom)').forEach(chip => {
            if (chip.dataset[key] == value) {
                chip.classList.add('selected');
                found = true;
            }
        });
        
        if (!found) {
            const newChip = document.createElement('div');
            newChip.className = 'chip selected custom-selected';
            newChip.dataset[key] = value;
            newChip.textContent = value;
            newChip.addEventListener('click', () => {
                row.querySelectorAll('.chip').forEach(chip => chip.classList.remove('selected'));
                newChip.classList.add('selected');
            });
            
            const customBtn = row.querySelector('.chip.custom');
            if (customBtn) {
                customBtn.parentNode.insertBefore(newChip, customBtn);
            } else {
                row.appendChild(newChip);
            }
        }
    }

    function sendChatMessage() {
        const input = document.getElementById('chatInput');
        if (!input || !input.value.trim() || !state.roomCode) return;
        
        db.ref(`rooms/${state.roomCode}/ch`).push({
            n: state.playerName,
            tx: input.value.trim().substring(0, 100),
            t: firebase.database.ServerValue.TIMESTAMP
        });
        
        input.value = '';
    }

    function hostStartGame() {
        if (!state.roomCode) return;
        
        generateGameCases();
        db.ref(`rooms/${state.roomCode}/gameCases`).set(state.gameCases);
        
        if (state.roomMode === 'free') {
            db.ref(`rooms/${state.roomCode}/starting`).set(true);
            let countdown = 5;
            const startBtn = document.getElementById('startLobbyBtn');
            if (startBtn) startBtn.disabled = true;
            
            const interval = setInterval(() => {
                countdown--;
                if (startBtn) startBtn.textContent = `СТАРТ ЧЕРЕЗ ${countdown}...`;
                
                if (countdown <= 0) {
                    clearInterval(interval);
                    const activePlayers = state.lobbyPlayers.filter(p => !p.left).length;
                    
                    if (activePlayers < 2) {
                        showToast('Недостаточно игроков для старта');
                        db.ref(`rooms/${state.roomCode}`).update({ st: 'waiting' });
                        if (startBtn) {
                            startBtn.disabled = false;
                            startBtn.textContent = `НАЧАТЬ (${activePlayers}/${state.maxPlayers || 4})`;
                        }
                        db.ref(`rooms/${state.roomCode}/starting`).remove();
                        return;
                    }
                    
                    db.ref(`rooms/${state.roomCode}/starting`).remove();
                    db.ref(`rooms/${state.roomCode}`).update({ st: 'playing' });
                }
            }, 1000);
        } else {
            db.ref(`rooms/${state.roomCode}`).update({ st: 'playing' });
        }
    }

    function leaveRoom() {
        if (!state.roomCode) return;
        
        if (state.roomListener) {
            db.ref(`rooms/${state.roomCode}`).off('value', state.roomListener);
            state.roomListener = null;
        }
        
        db.ref(`rooms/${state.roomCode}/pl/${state.playerId}`).remove();
        db.ref(`rooms/${state.roomCode}/rd/${state.playerId}`).remove();
        db.ref(`rooms/${state.roomCode}/votes/${state.playerId}`).remove();
        
        db.ref(`rooms/${state.roomCode}/pl`).once('value', snapshot => {
            const players = snapshot.val();
            const remainingPlayers = players ? Object.keys(players).filter(id => !players[id]?.left) : [];
            
            if (remainingPlayers.length === 0) {
                db.ref('gi').orderByChild('roomCode').equalTo(state.roomCode).once('value', snap => {
                    snap.forEach(child => child.ref.remove());
                });
                db.ref(`rooms/${state.roomCode}`).remove();
            } else {
                db.ref(`rooms/${state.roomCode}/hid`).once('value', snap => {
                    const currentHost = snap.val();
                    if (currentHost === state.playerId) {
                        const newHost = remainingPlayers[0];
                        db.ref(`rooms/${state.roomCode}/hid`).set(newHost);
                        showToast('Вы стали хостом! Настройте комнату при необходимости');
                    }
                });
            }
        });
        
        document.getElementById('lobbyModal').classList.remove('show');
        state.roomCode = null;
        state.isMultiplayer = false;
        state.lobbyPlayers = [];
        state.isGhost = false;
        state.inviteFromRoom = false;
        state.ghostWatchPlayerId = null;
        state._hostNotified = false;
    }

    function createRoom() {
        if (!state.roomCode) {
            state.roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        }
        
        const playerData = {
            n: state.playerName || 'Игрок',
            a: state.playerAvatar || '?',
            c: state.startCapital
        };
        
        state.isMultiplayer = true;
        state.lobbyPlayers = [{ id: state.playerId, n: playerData.n, a: playerData.a, c: state.startCapital }];
        document.getElementById('lobbyModal').classList.add('show');
        updateLobbyUI({
            rn: state.roomName,
            mp: state.maxPlayers,
            sc: state.startCapital,
            rt: state.roundTime,
            tr: state.totalRounds,
            pl: {},
            hid: state.playerId,
            rm: state.roomMode,
            access: state.roomAccess,
            bet: state.betAmount
        });
        
        const players = {};
        players[state.playerId] = playerData;
        startRoomListener();
        
        const roomData = {
            hid: state.playerId,
            rn: state.roomName,
            mp: state.maxPlayers,
            sc: state.startCapital,
            rt: state.roundTime,
            tr: state.totalRounds,
            pl: players,
            st: 'waiting',
            access: state.roomAccess,
            rm: state.roomMode,
            bet: state.betAmount
        };
        
        if (state.roomMode === 'free') {
            const votes = {};
            votes[state.playerId] = { sc: state.startCapital, rt: state.roundTime, tr: state.totalRounds };
            roomData.votes = votes;
        }
        
        db.ref(`rooms/${state.roomCode}`).set(roomData);
        log(`Комната создана: ${state.roomCode}`);
    }

    function joinRoom(roomCode, params) {
        roomCode = roomCode.toUpperCase().trim();
        
        db.ref(`rooms/${roomCode}`).once('value', snapshot => {
            const room = snapshot.val();
            
            if (!room) {
                alert('Комната не найдена');
                return;
            }
            
            if (room.st !== 'waiting') {
                alert('Игра уже идёт');
                return;
            }
            
            const activePlayers = room.pl ? Object.keys(room.pl).filter(id => !room.pl[id]?.left) : [];
            if (activePlayers.length >= (room.mp || 4)) {
                alert('Комната заполнена');
                return;
            }
            
            if (room.bet > 0 && state.playerDollars < room.bet) {
                alert(`Недостаточно монет! Нужно ${room.bet}`);
                return;
            }
            
            state.roomCode = roomCode;
            state.hostId = room.hid || '';
            state.startCapital = room.sc || 10000;
            state.roundTime = room.rt || 30;
            state.totalRounds = room.tr || 5;
            state.maxPlayers = room.mp || 4;
            state.roomMode = room.rm || 'hard';
            state.roomAccess = room.access || 'open';
            state.betAmount = room.bet || 0;
            
            if (state.betAmount > 0) {
                state.playerDollars -= state.betAmount;
                saveGameState();
                updateUI();
            }
            
            if (room.gameCases) {
                state.gameCases = room.gameCases;
                state.gameRound = 0;
            }
            
            if (state.roomMode === 'free' && params && state.playerId !== state.hostId) {
                db.ref(`rooms/${roomCode}/votes/${state.playerId}`).set(params);
            }
            
            state.isMultiplayer = true;
            state.lobbyPlayers = [];
            document.getElementById('lobbyModal').classList.add('show');
            startRoomListener();
            
            db.ref(`rooms/${roomCode}/pl/${state.playerId}`).set({
                n: state.playerName,
                a: state.playerAvatar,
                c: state.startCapital
            });
            
            log(`Вход в комнату: ${roomCode}`);
        });
    }

    window._joinRoom = function(roomCode) {
        roomCode = roomCode.toUpperCase().trim();
        
        db.ref(`rooms/${roomCode}`).once('value', snapshot => {
            const room = snapshot.val();
            
            if (!room) {
                alert('Комната не найдена');
                return;
            }
            
            if (room.rm === 'free' && state.playerId !== room.hid) {
                state.pendingJoin = roomCode;
                document.getElementById('joinParamsModal').classList.add('show');
            } else {
                joinRoom(roomCode, null);
            }
        });
    };

    // ========== 21. ИГРОВОЙ ЦИКЛ ==========
    function startMatch() {
        state.ownCash = state.startCapital;
        state.ownPortfolio = {};
        state.marketPrices = {};
        state.fairPrices = {};
        state.currentRound = 0;
        state.isGameActive = true;
        state.isFinalPhase = false;
        state.usedCases = [];
        state.isWaiting = false;
        state.leftPlayers = [];
        state.roundReady = false;
        state.tradeShown = {};
        state.gameRound = 0;
        
        if (!state.gameCases.length) generateGameCases();
        
        document.getElementById('menuScreen').style.display = 'none';
        document.getElementById('gameScreen').style.display = 'block';
        document.getElementById('readyStatus').textContent = 'NO: 0/0';
        document.getElementById('resultOverlay').classList.remove('show');
        document.getElementById('finalOverlay').classList.remove('show');
        
        if (isAdmin() && state.cheats.predictOutcome) {
            document.getElementById('ghostPredictBox').style.display = 'block';
        }
        
        updatePortfolioDisplay();
        updatePlayersDisplay();
        nextRound();
    }

    function nextRound() {
        if (state.currentRound >= state.totalRounds) {
            startFinalPhase();
            return;
        }
        
        state.currentRound++;
        updateMarketPrices();
        state.isWaiting = false;
        document.getElementById('waitBtn').classList.remove('held');
        state.roundReady = false;
        
        const activeCount = state.lobbyPlayers.filter(p => !state.leftPlayers.includes(p.id) && !p.left).length || 1;
        document.getElementById('readyStatus').textContent = `NO: 0/${activeCount}`;
        
        if (state.roomCode) {
            db.ref(`rooms/${state.roomCode}/rd`).remove();
        }
        
        const selectedCase = getRandomCase();
        if (!selectedCase) {
            nextRound();
            return;
        }
        
        state.usedCases.push(selectedCase.id);
        setCurrentCase(selectedCase);
        
        if (!state.isMultiplayer) botAction();
        
        startRoundTimer();
    }

    function startRoundTimer() {
        let timeLeft = state.roundTime;
        document.getElementById('timer').textContent = timeLeft;
        document.getElementById('timer').classList.remove('urgent');
        clearInterval(state.roundTimer);
        
        state.roundTimer = setInterval(() => {
            timeLeft--;
            document.getElementById('timer').textContent = timeLeft;
            if (timeLeft <= 5) document.getElementById('timer').classList.add('urgent');
            if (timeLeft <= 0) {
                clearInterval(state.roundTimer);
                state.roundReady = false;
                nextRound();
            }
        }, 1000);
    }

    function startSoloGame() {
        if (!state.isRoomReady) {
            alert('Загрузка...');
            return;
        }
        
        state.ownCash = state.startCapital;
        state.opponentCash = state.startCapital;
        state.ownPortfolio = {};
        state.opponentPortfolio = {};
        state.marketPrices = {};
        state.fairPrices = {};
        state.currentRound = 0;
        state.isGameActive = true;
        state.isFinalPhase = false;
        state.usedCases = [];
        state.isWaiting = false;
        state.leftPlayers = [];
        state.roundReady = false;
        state.tradeShown = {};
        state.gameCases = [];
        state.gameRound = 0;
        
        generateGameCases();
        
        const soloRoomCode = `solo_${state.playerId}`;
        db.ref(`rooms/${soloRoomCode}`).set({
            hid: state.playerId,
            rn: `${state.playerName} (соло)`,
            mp: 1,
            sc: state.startCapital,
            rt: state.roundTime,
            tr: state.totalRounds,
            pl: { [state.playerId]: { n: state.playerName, a: state.playerAvatar, c: state.startCapital } },
            st: 'playing',
            access: 'open',
            rm: 'hard',
            bet: 0,
            gameCases: state.gameCases
        });
        
        state.ghostRoomCode = soloRoomCode;
        document.getElementById('menuScreen').style.display = 'none';
        document.getElementById('gameScreen').style.display = 'block';
        document.getElementById('readyStatus').textContent = 'NO: 0/0';
        document.getElementById('resultOverlay').classList.remove('show');
        document.getElementById('finalOverlay').classList.remove('show');
        
        if (isAdmin() && state.cheats.predictOutcome) {
            document.getElementById('ghostPredictBox').style.display = 'block';
        }
        
        if (!state.isMultiplayer) {
            state.opponentName = 'Бот-Трейдер';
            state.opponentAvatar = 'Бот';
        }
        
        updatePortfolioDisplay();
        updatePlayersDisplay();
        nextRound();
    }

    function startFinalPhase() {
        state.isFinalPhase = true;
        state.finalTimeLeft = 90;
        clearInterval(state.finalInterval);
        clearInterval(state.finalPriceInterval);
        
        document.getElementById('gameScreen').style.display = 'none';
        document.getElementById('finalOverlay').classList.add('show');
        updateFinalPortfolio();
        updateFinalPlayers();
        
        state.finalInterval = setInterval(() => {
            if (!state.isMultiplayer) botAction();
            updateFinalPlayers();
            checkAllPlayersSold();
        }, 3000);
        
        state.finalPriceInterval = setInterval(() => {
            state.finalTimeLeft -= 5;
            if (state.finalTimeLeft < 0) state.finalTimeLeft = 0;
            document.getElementById('finalTimer').textContent = state.finalTimeLeft;
            
            for (const symbol in state.marketPrices) {
                state.marketPrices[symbol] = Math.max(0.02, state.marketPrices[symbol] * (1 + (Math.random() - 0.46) * 14 / 100));
            }
            
            updateFinalPortfolio();
            updateFinalPlayers();
            checkAllPlayersSold();
        }, 5000);
        
        setTimeout(() => {
            if (!state.isMultiplayer) botSellAll();
            checkAllPlayersSold();
        }, 85000);
    }

    function checkAllPlayersSold() {
        if (!state.isFinalPhase) return false;
        
        let allSold = true;
        
        for (let i = 0; i < state.lobbyPlayers.length; i++) {
            const player = state.lobbyPlayers[i];
            if (player.left) continue;
            if (player.p && Object.keys(player.p).length > 0) {
                allSold = false;
                break;
            }
        }
        
        if (!state.isMultiplayer && state.opponentPortfolio && Object.keys(state.opponentPortfolio).length > 0) {
            allSold = false;
        }
        
        if (allSold && state.isFinalPhase) {
            clearInterval(state.finalInterval);
            clearInterval(state.finalPriceInterval);
            if (!state.isMultiplayer) botSellAll();
            sellAllFinal();
            endGame();
            return true;
        }
        
        return false;
    }

    function updateFinalPortfolio() {
        const table = document.getElementById('finalBody');
        const assets = Object.entries(state.ownPortfolio);
        
        table.innerHTML = assets.length === 0 
            ? `<tr><td colspan="6">Нет активов</td></table>`
            : assets.map(([symbol, data]) => {
                const price = state.marketPrices[symbol] || data.avgPrice;
                const value = price * data.qty;
                const percentChange = data.avgPrice ? ((price - data.avgPrice) / data.avgPrice * 100) : 0;
                const pnl = (price - data.avgPrice) * data.qty;
                const changeClass = percentChange >= 0 ? 'up' : 'down';
                const changeSign = percentChange >= 0 ? '+' : '';
                const absPercent = Math.abs(percentChange).toFixed(1);
                const pnlClass = pnl >= 0 ? 'pos' : 'neg';
                const pnlSign = pnl >= 0 ? '+' : '';
                
                return `
                    <tr>
                        <td class="sym">${symbol}</td>
                        <td>${data.qty}</td>
                        <td>${formatMoney(price)}</td>
                        <td>${formatMoney(value)}</td>
                        <td class="${changeClass}">${changeSign}${absPercent}%</td>
                        <td class="final-pnl"><span class="${pnlClass}">${pnlSign}${formatMoney(pnl)}</span></td>
                    </tr>
                `;
            }).join('');
        
        let totalPnl = state.ownCash - state.startCapital;
        for (const symbol in state.ownPortfolio) {
            totalPnl += (state.marketPrices[symbol] - state.ownPortfolio[symbol].avgPrice) * state.ownPortfolio[symbol].qty;
        }
        
        let totalValue = state.ownCash;
        totalValue += assets.reduce((sum, [symbol, data]) => {
            return sum + (state.marketPrices[symbol] || data.avgPrice) * data.qty;
        }, 0);
        
        const pnlClass = totalPnl >= 0 ? 'pos' : 'neg';
        const pnlSign = totalPnl >= 0 ? '+' : '';
        document.getElementById('finalTotal').innerHTML = `${formatMoney(totalValue)} <span class="final-pnl"><span class="${pnlClass}">(${pnlSign}${formatMoney(totalPnl)})</span></span>`;
    }

    function updateFinalPlayers() {
        const container = document.getElementById('finalPlayers');
        
        let myTotal = state.ownCash;
        for (const [symbol, data] of Object.entries(state.ownPortfolio)) {
            myTotal += (state.marketPrices[symbol] || data.avgPrice) * data.qty;
        }
        
        let opponentTotal = state.opponentCash;
        for (const [symbol, data] of Object.entries(state.opponentPortfolio)) {
            opponentTotal += (state.marketPrices[symbol] || data.avgPrice) * data.qty;
        }
        
        const isWin = myTotal > opponentTotal;
        const myPnl = myTotal - state.startCapital;
        const opponentPnl = opponentTotal - state.startCapital;
        
        const myClass = isWin ? 'win' : 'lose';
        const opponentClass = isWin ? 'lose' : 'win';
        const myPnlClass = myPnl >= 0 ? 'pos' : 'neg';
        const opponentPnlClass = opponentPnl >= 0 ? 'pos' : 'neg';
        const myPnlSign = myPnl >= 0 ? '+' : '';
        const opponentPnlSign = opponentPnl >= 0 ? '+' : '';
        
        container.innerHTML = `
            <div class="final-player">
                <div class="fp-name">${state.playerName} (Вы)</div>
                <div>
                    <div class="fp-cash ${myClass}">${formatMoney(myTotal)}</div>
                    <div class="final-pnl"><span class="${myPnlClass}">${myPnlSign}${formatMoney(myPnl)}</span></div>
                </div>
            </div>
            <div class="final-player">
                <div class="fp-name">${state.opponentName}</div>
                <div>
                    <div class="fp-cash ${opponentClass}">${formatMoney(opponentTotal)}</div>
                    <div class="final-pnl"><span class="${opponentPnlClass}">${opponentPnlSign}${formatMoney(opponentPnl)}</span></div>
                </div>
            </div>
        `;
    }

    function sellAllFinal() {
        for (const symbol in state.ownPortfolio) {
            const price = state.marketPrices[symbol] || state.ownPortfolio[symbol].avgPrice;
            state.ownCash += price * state.ownPortfolio[symbol].qty;
        }
        state.ownPortfolio = {};
        updateFinalPortfolio();
        checkAllPlayersSold();
    }

    function endGame() {
        state.isGameActive = false;
        state.isFinalPhase = false;
        clearInterval(state.finalInterval);
        clearInterval(state.finalPriceInterval);
        document.getElementById('finalOverlay').classList.remove('show');
        
        if (state.ghostRoomCode) {
            db.ref(`rooms/${state.ghostRoomCode}`).remove();
            state.ghostRoomCode = null;
        }
        
        if (state.isFakeAlert) {
            const earnings = state.ownCash - 100;
            if (state.fakeWinText) {
                db.ref(`fr/${state.fakeWinText}/${state.playerId}`).update({
                    te: firebase.database.ServerValue.increment(earnings > 0 ? earnings : -earnings),
                    lb: state.ownCash,
                    gp: firebase.database.ServerValue.increment(1),
                    lu: firebase.database.ServerValue.TIMESTAMP
                });
            }
            
            document.getElementById('resultOverlay').classList.add('show');
            document.getElementById('resultEmoji').textContent = earnings > 0 ? '📈' : '📉';
            document.getElementById('resultTitle').textContent = earnings > 0 ? 'ПРИБЫЛЬ!' : 'УБЫТОК';
            document.getElementById('resultCash').textContent = formatMoney(state.ownCash);
            
            state.isFakeAlert = false;
            saveGameState();
            updateUI();
            
            setTimeout(() => {
                document.getElementById('resultOverlay').classList.remove('show');
                document.getElementById('gameScreen').style.display = 'none';
                document.getElementById('menuScreen').style.display = 'block';
                document.getElementById('playMenu').style.display = 'block';
                document.getElementById('playMenuBtn').style.display = 'none';
                document.getElementById('historyBtn').style.display = 'none';
                resetBottomNav();
            }, 2000);
            return;
        }
        
        const myTotal = state.ownCash;
        const opponentTotal = state.opponentCash;
        const isWin = myTotal > opponentTotal;
        
        document.getElementById('resultOverlay').classList.add('show');
        document.getElementById('resultEmoji').textContent = isWin ? '🏆' : '💔';
        document.getElementById('resultTitle').textContent = isWin ? 'ПОБЕДА!' : 'ПОРАЖЕНИЕ';
        document.getElementById('resultCash').textContent = formatMoney(myTotal);
        
        const myPnl = myTotal - state.startCapital;
        let prizeText = `${state.opponentName}: ${formatMoney(opponentTotal)}<br>P&L: <span style="color:${myPnl >= 0 ? 'var(--green)' : 'var(--red)'}">${myPnl >= 0 ? '+' : ''}${formatMoney(myPnl)}</span>`;
        
        if (isWin) {
            state.playerDollars += 100;
            if (state.betAmount > 0) {
                const winBet = state.betAmount * (state.lobbyPlayers.filter(p => !p.left).length);
                state.playerDollars += winBet;
                prizeText += `<br>Выигрыш ставки: +${winBet} монет`;
            }
        } else {
            state.playerDollars = Math.max(0, state.playerDollars - 100);
            if (state.betAmount > 0) {
                prizeText += `<br>Проигрыш ставки: -${state.betAmount} монет`;
            }
        }
        
        document.getElementById('resultPrize').innerHTML = prizeText;
        
        state.gameHistory.push({
            date: new Date().toISOString(),
            cash: myTotal,
            profit: myPnl,
            result: isWin ? 'win' : 'lose',
            rounds: state.totalRounds,
            opponent: state.opponentName
        });
        
        saveGameState();
        updateUI();
        
        if (state.roomCode) {
            if (state.roomListener) {
                db.ref(`rooms/${state.roomCode}`).off('value', state.roomListener);
                state.roomListener = null;
            }
            db.ref('gi').orderByChild('roomCode').equalTo(state.roomCode).once('value', snapshot => {
                snapshot.forEach(child => child.ref.remove());
            });
            db.ref(`rooms/${state.roomCode}`).remove();
            state.roomCode = null;
            state.isMultiplayer = false;
            state.isGhost = false;
            state.ghostWatchPlayerId = null;
        }
        
        log(`Игра завершена: ${isWin ? 'Победа' : 'Поражение'} ${formatMoney(myTotal)}`);
    }

    // ========== 22. ФРИЛАНСЕР РЕЖИМ ==========
    function startFreelancer() {
        if (!state.freelancerUnlocked) {
            if (state.playerDollars < 5000) {
                alert('Недостаточно! Нужно 5 000 монет');
                return;
            }
            state.playerDollars -= 5000;
            state.freelancerUnlocked = true;
            db.ref(`u/${state.playerId}/flUnlocked`).set(true);
            db.ref(`u/${state.playerId}/do`).set(state.playerDollars);
            saveGameState();
            updateUI();
            showToast('Фрилансер разблокирован на неделю!');
        }
        
        if (!state.isRoomReady) {
            alert('Загрузка...');
            return;
        }
        
        state.fakeWinText = getWeekKey();
        state.isFakeAlert = true;
        state.startCapital = 100;
        state.ownCash = 100;
        state.opponentCash = 100;
        state.totalRounds = 10;
        state.roundTime = 30;
        state.ownPortfolio = {};
        state.opponentPortfolio = {};
        state.marketPrices = {};
        state.fairPrices = {};
        state.currentRound = 0;
        state.isMultiplayer = false;
        state.opponentName = 'Бот-Фрилансер';
        state.opponentAvatar = '?';
        state.isGameActive = false;
        state.isFinalPhase = false;
        state.usedCases = [];
        state.isWaiting = false;
        saveGameState();
        updateUI();
        
        document.getElementById('freelancerIntroModal').classList.remove('show');
        document.getElementById('flConfirmModal').classList.add('show');
        
        db.ref(`fr/${state.fakeWinText}/${state.playerId}`).set({
            n: state.playerName,
            a: state.playerAvatar,
            te: 0,
            gp: 0,
            lu: firebase.database.ServerValue.TIMESTAMP
        });
    }

    function showFreelancerRating() {
        document.getElementById('freelancerRatingModal').classList.add('show');
        
        const weekKey = getWeekKey();
        const now = new Date();
        let day = now.getDay();
        const nextMonday = new Date(now);
        nextMonday.setDate(now.getDate() + (day === 0 ? 1 : 8 - day));
        nextMonday.setHours(0, 0, 0, 0);
        
        const diff = nextMonday - now;
        const daysLeft = Math.floor(diff / 86400000);
        const hoursLeft = Math.floor((diff % 86400000) / 3600000);
        document.getElementById('ratingTimer').textContent = `До конца: ${daysLeft}д ${hoursLeft}ч`;
        
        db.ref(`fr/${weekKey}`).orderByChild('te').limitToLast(20).once('value', snapshot => {
            const data = snapshot.val();
            const list = document.getElementById('ratingList');
            
            if (!data) {
                list.innerHTML = '<p>Нет данных</p>';
                return;
            }
            
            const sorted = Object.entries(data).sort((a, b) => (b[1].te || 0) - (a[1].te || 0));
            list.innerHTML = sorted.map(([id, record], index) => `
                <div class="lobby-player">
                    <span>${index + 1}.</span>
                    <span class="avatar">${getAvatarHtml(record.a)}</span>
                    <span>${record.n || 'Игрок'}</span>
                    <span style="margin-left:auto;color:var(--gold);">${(record.te || 0).toFixed(0)}</span>
                </div>
            `).join('');
        });
    }

    function showGameHistory() {
        document.getElementById('historyModal').classList.add('show');
        const list = document.getElementById('historyList');
        
        if (state.gameHistory.length === 0) {
            list.innerHTML = '<p style="color:var(--text2);">Нет истории</p>';
            return;
        }
        
        list.innerHTML = state.gameHistory.slice().reverse().map(game => {
            const pnl = game.profit || 0;
            return `
                <div style="background:var(--surface);padding:8px;margin:4px 0;font-size:10px">
                    <div style="color:${game.result === 'win' ? 'var(--green)' : 'var(--red)'};">
                        ${game.result === 'win' ? 'Победа' : 'Поражение'}
                    </div>
                    <div>${formatMoney(game.cash)} | ${game.rounds} раундов</div>
                    <div style="color:${pnl >= 0 ? 'var(--green)' : 'var(--red)'};">
                        P&L: ${pnl >= 0 ? '+' : ''}${formatMoney(pnl)}
                    </div>
                </div>
            `;
        }).join('');
    }

    // ========== 23. ЛОКАЛИЗАЦИЯ ==========
    const translations = {
        ru: {
            play: '🎮 ИГРАТЬ', solo: '🤖 Тренировка с ботом', create: '👥 Создать комнату',
            join: '🔗 Подключиться', open: '🌍 Открытые комнаты', comp: '🏆 Соревнования',
            fl: '💼 Начинающий фрилансер', back: '↩ Назад', compBack: '↩ Назад',
            settings: '⚙️', save: '💾 Сохранить', buy: 'КУПИТЬ', sell: 'ПРОДАТЬ',
            wait: 'NO', musicOff: '🔊 Выкл', musicOn: '🔇 Вкл', history: '📜 ИСТОРИЯ ИГР'
        },
        en: {
            play: '🎮 PLAY', solo: '🤖 Bot Training', create: '👥 Create Room',
            join: '🔗 Join', open: '🌍 Open Rooms', comp: '🏆 Competitions',
            fl: '💼 Freelancer', back: '↩ Back', compBack: '↩ Back',
            settings: '⚙️ Settings', save: '💾 Save', buy: 'BUY', sell: 'SELL',
            wait: 'NO', musicOff: '🔊 Off', musicOn: '🔇 On', history: '📜 HISTORY'
        }
    };

    function translate(key) {
        const lang = state.language === 'en' ? 'en' : 'ru';
        return translations[lang][key] || key;
    }

    function applyLanguage() {
        const buttons = {
            playMenuBtn: 'play', soloBtn: 'solo', createRoomBtn: 'create',
            joinRoomBtn: 'join', openRoomsBtn: 'open', compBtn: 'comp',
            freelancerBtn: 'fl', compBackBtn: 'compBack', backMenuBtn: 'back',
            settingsBtn: 'settings', saveProfileBtn: 'save', historyBtn: 'history'
        };
        
        for (const [id, key] of Object.entries(buttons)) {
            const element = document.getElementById(id);
            if (element) element.textContent = translate(key);
        }
        
        document.getElementById('buyBtn').textContent = translate('buy');
        document.getElementById('waitBtn').textContent = translate('wait');
        document.getElementById('musicToggleBtn').textContent = musicEnabled ? translate('musicOff') : translate('musicOn');
        document.getElementById('musicFloatBtn').textContent = musicEnabled ? '🎵' : '🔇';
        
        if (state.freelancerUnlocked) {
            document.getElementById('flEnterBtn').textContent = '🎮 ИГРАТЬ';
        }
    }

    function handleCustomChip(row, key, min, max, title) {
        row.querySelectorAll('.chip.custom').forEach(chip => {
            chip.addEventListener('click', () => {
                showCustomInput(title || 'Введите', min, max, value => {
                    row.querySelectorAll('.chip.custom-selected').forEach(c => c.remove());
                    
                    const newChip = document.createElement('div');
                    newChip.className = 'chip selected custom-selected';
                    newChip.dataset[key] = value;
                    newChip.textContent = value;
                    newChip.addEventListener('click', () => {
                        row.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
                        newChip.classList.add('selected');
                    });
                    
                    const customBtn = row.querySelector('.chip.custom');
                    customBtn.parentNode.insertBefore(newChip, customBtn);
                });
            });
        });
    }

    // ========== 24. ЗАГРУЗКА КЕЙСОВ ==========
    function loadCases() {
        log('Загрузка кейсов...');
        
        fetch('cases.json')
            .then(response => response.json())
            .then(cases => {
                state.activeCasesList = cases.filter(c => c && c.symbol && c.price);
                state.isRoomReady = true;
                log(`Кейсы загружены: ${state.activeCasesList.length}`);
            })
            .catch(error => {
                state.isRoomReady = true;
                log(`Ошибка загрузки кейсов: ${error.message}`, 'error');
            })
            .finally(() => {
                document.getElementById('loadingScreen').style.display = 'none';
                document.getElementById('menuScreen').style.display = 'block';
                document.getElementById('bottomNav').style.display = 'flex';
                
                if (isAdmin()) log('Админ-режим активен');
                if (isMod()) log('Модератор-режим активен');
                log('Приложение готово');
            });
    }

    // ========== 25. ОБРАБОТЧИКИ СОБЫТИЙ ==========
    function bindEventListeners() {
        // Навигация
        document.querySelectorAll('#bottomNav .nav-btn').forEach(btn => {
            btn.addEventListener('click', () => switchTab(btn.dataset.tab));
        });
        
        document.getElementById('friendsCloseBtn').addEventListener('click', () => {
            document.getElementById('friendsModal').classList.remove('show');
            state.inviteFromRoom = false;
            resetBottomNav();
        });
        
        document.getElementById('playMenuBtn').addEventListener('click', () => {
            document.getElementById('playMenu').style.display = 'block';
            document.getElementById('playMenuBtn').style.display = 'none';
            document.getElementById('historyBtn').style.display = 'none';
        });
        
        document.getElementById('backMenuBtn').addEventListener('click', () => {
            document.getElementById('playMenu').style.display = 'none';
            document.getElementById('compMenu').style.display = 'none';
            document.getElementById('playMenuBtn').style.display = 'block';
            document.getElementById('historyBtn').style.display = 'block';
            resetBottomNav();
        });
        
        document.getElementById('compBtn').addEventListener('click', () => {
            document.getElementById('playMenu').style.display = 'none';
            document.getElementById('compMenu').style.display = 'block';
        });
        
        document.getElementById('compBackBtn').addEventListener('click', () => {
            document.getElementById('compMenu').style.display = 'none';
            document.getElementById('playMenu').style.display = 'block';
        });
        
        document.getElementById('freelancerBtn').addEventListener('click', () => {
            document.getElementById('compMenu').style.display = 'none';
            document.getElementById('freelancerIntroModal').classList.add('show');
            if (state.freelancerUnlocked) {
                document.getElementById('flEnterBtn').textContent = '🎮 ИГРАТЬ';
            }
        });
        
        document.getElementById('flCloseBtn').addEventListener('click', () => {
            document.getElementById('freelancerIntroModal').classList.remove('show');
            document.getElementById('compMenu').style.display = 'block';
        });
        
        document.getElementById('flRatingViewBtn').addEventListener('click', () => {
            document.getElementById('freelancerIntroModal').classList.remove('show');
            showFreelancerRating();
        });
        
        document.getElementById('flRatingCloseBtn').addEventListener('click', () => {
            document.getElementById('freelancerRatingModal').classList.remove('show');
            document.getElementById('freelancerIntroModal').classList.add('show');
        });
        
        document.getElementById('flEnterBtn').addEventListener('click', startFreelancer);
        
        document.getElementById('flPlayBtn').addEventListener('click', () => {
            document.getElementById('flConfirmModal').classList.remove('show');
            state.isGameActive = true;
            document.getElementById('menuScreen').style.display = 'none';
            document.getElementById('gameScreen').style.display = 'block';
            updatePortfolioDisplay();
            updatePlayersDisplay();
            nextRound();
        });
        
        document.getElementById('flConfirmCloseBtn').addEventListener('click', () => {
            document.getElementById('flConfirmModal').classList.remove('show');
        });
        
        // Профиль
        document.getElementById('profileAvatar').addEventListener('click', () => {
            state.previewAvatar = state.playerAvatar;
            updateUI();
            document.getElementById('profileModal').classList.add('show');
        });
        
        document.getElementById('profileCloseBtn').addEventListener('click', () => {
            document.getElementById('profileModal').classList.remove('show');
        });
        
        document.getElementById('settingsBtn').addEventListener('click', () => {
            document.getElementById('settingsModal').classList.add('show');
        });
        
        document.getElementById('settingsCloseBtn').addEventListener('click', () => {
            document.getElementById('settingsModal').classList.remove('show');
        });
        
        document.getElementById('supportBtn').addEventListener('click', showSupportModal);
        document.getElementById('supportCloseBtn').addEventListener('click', () => {
            document.getElementById('supportModal').classList.remove('show');
        });
        
        document.getElementById('saveProfileBtn').addEventListener('click', () => {
            const newName = document.getElementById('editName').value.trim() || 'Трейдер';
            
            if (newName !== state.playerName) {
                db.ref('u').orderByChild('n').equalTo(newName).once('value', snapshot => {
                    const existing = snapshot.val();
                    if (existing && Object.keys(existing).filter(k => k !== state.playerId).length > 0) {
                        alert('Этот ник уже занят!');
                        return;
                    }
                    state.playerName = newName;
                    state.playerAvatar = state.previewAvatar || state.playerAvatar;
                    state.previewAvatar = null;
                    saveGameState();
                    updateUI();
                    document.getElementById('profileModal').classList.remove('show');
                });
            } else {
                state.playerAvatar = state.previewAvatar || state.playerAvatar;
                state.previewAvatar = null;
                saveGameState();
                updateUI();
                document.getElementById('profileModal').classList.remove('show');
            }
        });
        
        // Игровые кнопки
        document.getElementById('soloBtn').addEventListener('click', () => {
            state.isFakeAlert = false;
            state.betAmount = 0;
            document.getElementById('soloModal').classList.add('show');
        });
        
        document.getElementById('soloCloseBtn').addEventListener('click', () => {
            document.getElementById('soloModal').classList.remove('show');
        });
        
        document.getElementById('startSoloBtn').addEventListener('click', () => {
            state.startCapital = parseInt((document.querySelector('#sCashChips .selected') || {}).dataset.cash || 10000);
            state.totalRounds = parseInt((document.querySelector('#sRoundsChips .selected') || {}).dataset.rounds || 10);
            state.roundTime = parseInt((document.querySelector('#sTimeChips .selected') || {}).dataset.time || 30);
            state.isMultiplayer = false;
            state.isFakeAlert = false;
            state.betAmount = 0;
            document.getElementById('soloModal').classList.remove('show');
            startSoloGame();
        });
        
        document.getElementById('buyBtn').addEventListener('click', purchaseAsset);
        document.getElementById('waitBtn').addEventListener('click', toggleWait);
        document.getElementById('sellAllBtn').addEventListener('click', sellAllAssets);
        
        document.getElementById('sellAllFinalBtn').addEventListener('click', () => {
            if (!state.isMultiplayer) botSellAll();
            sellAllFinal();
            endGame();
        });
        
        // Количество покупки
        document.getElementById('qtyMinus').addEventListener('click', () => {
            const input = document.getElementById('buyQty');
            let value = parseInt(input.value) || 1;
            input.value = Math.max(1, value - 1);
            updateBuyButton();
        });
        
        document.getElementById('qtyPlus').addEventListener('click', () => {
            const input = document.getElementById('buyQty');
            let value = parseInt(input.value) || 1;
            input.value = Math.min(1000, value + 1);
            updateBuyButton();
        });
        
        document.getElementById('buyQty').addEventListener('input', function() {
            this.value = this.value.replace(/[^0-9]/g, '');
            if (!this.value || parseInt(this.value) < 1) this.value = '1';
            updateBuyButton();
        });
        
        // Меню выхода
        document.getElementById('menuBtn').addEventListener('click', () => {
            clearInterval(state.roundTimer);
            clearInterval(state.finalInterval);
            clearInterval(state.finalPriceInterval);
            
            if (state.roomListener && state.roomCode) {
                db.ref(`rooms/${state.roomCode}`).off('value', state.roomListener);
                state.roomListener = null;
            }
            
            if (state.ghostRoomCode) {
                db.ref(`rooms/${state.ghostRoomCode}`).remove();
                state.ghostRoomCode = null;
            }
            
            if (state.isFinalPhase) {
                sellAllFinal();
                endGame();
            }
            
            document.getElementById('resultOverlay').classList.remove('show');
            document.getElementById('finalOverlay').classList.remove('show');
            document.getElementById('gameScreen').style.display = 'none';
            document.getElementById('menuScreen').style.display = 'block';
            document.getElementById('playMenu').style.display = 'block';
            document.getElementById('playMenuBtn').style.display = 'none';
            document.getElementById('historyBtn').style.display = 'none';
            document.getElementById('compMenu').style.display = 'none';
            resetBottomNav();
            
            state.isGameActive = false;
            state.isFinalPhase = false;
            state.isFakeAlert = false;
            state.isGhost = false;
            state.ghostWatchPlayerId = null;
            state.roomCode = null;
            state._hostNotified = false;
        });
        
        document.getElementById('shareBtn').addEventListener('click', () => {
            const text = `InvestBattle: ${formatMoney(state.ownCash)}`;
            if (navigator.share) {
                navigator.share({ title: 'InvestBattle', text: text });
            } else {
                copyToClipboard(text);
            }
        });
        
        // Создание комнаты
        document.getElementById('createRoomBtn').addEventListener('click', () => {
            state.inviteFromFriends = false;
            state.skipLobby = false;
            state.roomCode = null;
            document.getElementById('roomCodePreview').style.display = 'none';
            document.getElementById('roomModalTitle').textContent = '👥 Создать комнату';
            document.getElementById('confirmRoomBtn').textContent = '🏆 Создать';
            document.getElementById('roomModal').classList.add('show');
        });
        
        document.getElementById('roomCloseBtn').addEventListener('click', () => {
            document.getElementById('roomModal').style.zIndex = '250';
            document.getElementById('roomModal').classList.remove('show');
            
            if (state.inviteFromFriends && state.roomCode) {
                db.ref(`rooms/${state.roomCode}/pl`).once('value', snapshot => {
                    const players = snapshot.val();
                    const otherPlayers = players ? Object.keys(players).filter(id => id !== state.playerId && !players[id]?.left) : [];
                    
                    if (otherPlayers.length > 0) {
                        const newHost = otherPlayers[0];
                        db.ref(`rooms/${state.roomCode}/hid`).set(newHost);
                        db.ref(`gi/${newHost}/${state.roomCode}`).set({
                            from: state.playerId,
                            fromName: state.playerName,
                            fromAvatar: state.playerAvatar,
                            roomCode: state.roomCode,
                            roomName: state.roomName,
                            bet: state.betAmount,
                            mp: state.maxPlayers,
                            sc: state.startCapital,
                            rt: state.roundTime,
                            tr: state.totalRounds,
                            rm: state.roomMode,
                            status: 'host_transfer',
                            ts: firebase.database.ServerValue.TIMESTAMP
                        });
                        db.ref(`rooms/${state.roomCode}/pl/${state.playerId}`).remove();
                        db.ref(`rooms/${state.roomCode}/rd/${state.playerId}`).remove();
                        db.ref(`rooms/${state.roomCode}/votes/${state.playerId}`).remove();
                    } else {
                        db.ref('gi').orderByChild('roomCode').equalTo(state.roomCode).once('value', snap => {
                            snap.forEach(child => child.ref.remove());
                        });
                        db.ref(`rooms/${state.roomCode}`).remove();
                    }
                });
                state.roomCode = null;
                state.inviteFromFriends = false;
                state.skipLobby = false;
            }
        });
        
        document.getElementById('confirmRoomBtn').addEventListener('click', () => {
            state.roomName = document.getElementById('roomNameInput').value || 'Комната';
            state.maxPlayers = parseInt((document.querySelector('#maxChips .selected') || {}).dataset.max || 4);
            state.startCapital = parseInt((document.querySelector('#cashChips .selected') || {}).dataset.cash || 10000);
            state.roundTime = parseInt((document.querySelector('#timeChips .selected') || {}).dataset.time || 30);
            state.totalRounds = parseInt((document.querySelector('#roundsChips .selected') || {}).dataset.rounds || 5);
            state.roomAccess = (document.querySelector('#accessChips .selected') || {}).dataset.access || 'open';
            state.roomMode = (document.querySelector('#modeChips .selected') || {}).dataset.mode || 'hard';
            state.betAmount = parseInt((document.querySelector('#betChips .selected') || {}).dataset.bet || 0);
            
            if (state.betAmount > 0 && state.playerDollars < state.betAmount) {
                alert('Недостаточно монет!');
                return;
            }
            
            if (state.maxPlayers > 20 || state.startCapital > 100000 || state.roundTime > 90 || state.totalRounds > 100) {
                alert('Превышен лимит!');
                return;
            }
            
            document.getElementById('roomModal').style.zIndex = '250';
            document.getElementById('roomModal').classList.remove('show');
            
            if (state.inviteFromFriends && state.roomCode) {
                db.ref(`rooms/${state.roomCode}`).update({
                    rn: state.roomName,
                    mp: state.maxPlayers,
                    sc: state.startCapital,
                    rt: state.roundTime,
                    tr: state.totalRounds,
                    access: state.roomAccess,
                    rm: state.roomMode,
                    bet: state.betAmount
                }).then(() => {
                    db.ref(`rooms/${state.roomCode}/pl/${state.playerId}`).set({
                        n: state.playerName,
                        a: state.playerAvatar,
                        c: state.startCapital
                    });
                    
                    if (state.roomMode === 'free') {
                        db.ref(`rooms/${state.roomCode}/showParams`).set(true);
                        setTimeout(() => db.ref(`rooms/${state.roomCode}/showParams`).remove(), 30000);
                    }
                    
                    state.isMultiplayer = true;
                    state.lobbyPlayers = [];
                    document.getElementById('lobbyModal').classList.add('show');
                    
                    if (state.roomListener) db.ref(`rooms/${state.roomCode}`).off('value', state.roomListener);
                    startRoomListener();
                    state.inviteFromFriends = false;
                    state.skipLobby = false;
                    showToast('Настройки комнаты обновлены!');
                }).catch(() => showToast('Ошибка при обновлении'));
            } else {
                createRoom();
            }
        });
        
        // Присоединение к комнате
        document.getElementById('joinRoomBtn').addEventListener('click', () => {
            document.getElementById('joinModal').classList.add('show');
        });
        
        document.getElementById('joinCloseBtn').addEventListener('click', () => {
            document.getElementById('joinModal').classList.remove('show');
        });
        
        document.getElementById('confirmJoinBtn').addEventListener('click', () => {
            const code = document.getElementById('joinCodeInput').value.trim().toUpperCase();
            if (code) {
                window._joinRoom(code);
                document.getElementById('joinModal').classList.remove('show');
            }
        });
        
        document.getElementById('confirmJoinParamsBtn').addEventListener('click', () => {
            const sc = parseInt((document.querySelector('#jpCashChips .selected') || {}).dataset.cash || 10000);
            const rt = parseInt((document.querySelector('#jpTimeChips .selected') || {}).dataset.time || 30);
            const tr = parseInt((document.querySelector('#jpRoundsChips .selected') || {}).dataset.rounds || 5);
            document.getElementById('joinParamsModal').classList.remove('show');
            
            if (state.pendingJoin) {
                joinRoom(state.pendingJoin, { sc: sc, rt: rt, tr: tr });
                state.pendingJoin = null;
            }
        });
        
        document.getElementById('joinParamsCloseBtn').addEventListener('click', () => {
            document.getElementById('joinParamsModal').classList.remove('show');
            state.pendingJoin = null;
        });
        
        // Открытые комнаты
        document.getElementById('openRoomsBtn').addEventListener('click', () => {
            const modal = document.createElement('div');
            modal.className = 'modal show';
            modal.innerHTML = `
                <div class="modal-content">
                    <button class="modal-close" id="openRoomsClose">X</button>
                    <h3>Открытые комнаты</h3>
                    <div id="openRoomsList" style="max-height:300px;overflow-y:auto;"></div>
                </div>
            `;
            document.body.appendChild(modal);
            
            document.getElementById('openRoomsClose').addEventListener('click', () => {
                document.body.removeChild(modal);
            });
            
            db.ref('rooms').once('value', snapshot => {
                const rooms = snapshot.val();
                const list = modal.querySelector('#openRoomsList');
                
                if (!rooms) {
                    list.innerHTML = '<p>Нет комнат</p>';
                    return;
                }
                
                const openRooms = Object.entries(rooms).filter(([code, room]) => 
                    room && room.st === 'waiting' && room.access === 'open'
                );
                
                list.innerHTML = openRooms.length === 0 
                    ? '<p>Нет открытых комнат</p>'
                    : openRooms.map(([code, room]) => `
                        <div style="background:var(--surface);padding:12px;border-radius:10px;margin-bottom:6px;cursor:pointer;" id="rm_${code}">
                            <b>${room.rn || 'Комната'}</b>${room.bet > 0 ? ` <span class="bet-badge">Ставка: ${room.bet}</span>` : ''}<br>
                            ${room.pl ? Object.keys(room.pl).length : 0}/${room.mp || 4} | ${formatMoney(room.sc || 10000)}
                        </div>
                    `).join('');
                
                openRooms.forEach(([code]) => {
                    const element = modal.querySelector(`#rm_${code}`);
                    if (element) {
                        element.addEventListener('click', () => {
                            document.body.removeChild(modal);
                            window._joinRoom(code);
                        });
                    }
                });
            });
        });
        
        // История
        document.getElementById('historyBtn').addEventListener('click', showGameHistory);
        document.getElementById('historyCloseBtn').addEventListener('click', () => {
            document.getElementById('historyModal').classList.remove('show');
        });
        
        // Музыка
        document.getElementById('musicToggleBtn').addEventListener('click', () => {
            musicEnabled = !musicEnabled;
            document.getElementById('musicToggleBtn').textContent = musicEnabled ? translate('musicOff') : translate('musicOn');
            document.getElementById('musicFloatBtn').textContent = musicEnabled ? '🎵' : '🔇';
            if (musicEnabled) playNextTrack();
            else backgroundMusic.pause();
        });
        
        document.getElementById('musicFloatBtn').addEventListener('click', () => {
            musicEnabled = !musicEnabled;
            document.getElementById('musicFloatBtn').textContent = musicEnabled ? '🎵' : '🔇';
            document.getElementById('musicToggleBtn').textContent = musicEnabled ? translate('musicOff') : translate('musicOn');
            if (musicEnabled) playNextTrack();
            else backgroundMusic.pause();
        });
        
        // Админские кнопки
        document.getElementById('adminFloatBtn').addEventListener('click', () => {
            if (!isAdmin() || !adminButtonVisible) return;
            document.getElementById('adminModal').classList.add('show');
            updateAdminStats();
        });
        
        document.getElementById('modFloatBtn').addEventListener('click', () => {
            if (!isMod() || !modButtonVisible) return;
            document.getElementById('modModal').classList.add('show');
            updateAdminStats();
        });
        
        document.getElementById('adminConsoleBtn3').addEventListener('click', showConsoleModal);
        document.getElementById('modConsoleBtn').addEventListener('click', showConsoleModal);
        document.getElementById('consoleCloseBtn').addEventListener('click', () => {
            document.getElementById('consoleModal').classList.remove('show');
        });
        
        document.getElementById('adminOnlineBtn2').addEventListener('click', showOnlinePlayers);
        document.getElementById('adminTotalBtn2').addEventListener('click', showAllPlayers);
        document.getElementById('adminPlayingBtn2').addEventListener('click', showGhostRooms);
        document.getElementById('adminCoinsBtn2').addEventListener('click', showAdminCoins);
        document.getElementById('adminBanBtn2').addEventListener('click', showAdminBan);
        document.getElementById('adminStatsBtn2').addEventListener('click', showAdminStats);
        document.getElementById('adminBroadcastBtn2').addEventListener('click', showAdminBroadcast);
        document.getElementById('adminReportsBtn2').addEventListener('click', showAdminReports);
        document.getElementById('adminSettingsBtn2').addEventListener('click', showAdminSettings);
        document.getElementById('adminCheatsBtn2').addEventListener('click', showAdminCheats);
        document.getElementById('adminScareBtn2').addEventListener('click', showAdminScare);
        
        document.getElementById('modOnlineBtn').addEventListener('click', showOnlinePlayers);
        document.getElementById('modTotalBtn').addEventListener('click', showAllPlayers);
        document.getElementById('modPlayingBtn').addEventListener('click', showGhostRooms);
        document.getElementById('modWatchBtn').addEventListener('click', showGhostRooms);
        document.getElementById('modReportsBtn').addEventListener('click', showAdminReports);
        
        // Закрытие модальных окон
        const closeButtons = [
            'adminCoinsCloseBtn', 'adminBanCloseBtn', 'adminStatsCloseBtn',
            'adminBroadcastCloseBtn', 'adminReportsCloseBtn', 'adminSettingsCloseBtn',
            'adminScareCloseBtn', 'onlinePlayersCloseBtn', 'allPlayersCloseBtn2',
            'activeGamesCloseBtn2', 'adminPlayerDetailCloseBtn', 'adminCloseBtn',
            'modCloseBtn', 'ppCloseBtn', 'tradeCloseBtn'
        ];
        
        closeButtons.forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.addEventListener('click', () => {
                    const modal = btn.closest('.modal');
                    if (modal) modal.classList.remove('show');
                });
            }
        });
        
        // Чипсы
        document.querySelectorAll('.chip-row').forEach(row => {
            row.querySelectorAll('.chip:not(.custom)').forEach(chip => {
                chip.addEventListener('click', function() {
                    this.parentElement.querySelectorAll('.chip').forEach(x => x.classList.remove('selected'));
                    this.classList.add('selected');
                });
            });
        });
        
        handleCustomChip(document.getElementById('betChips'), 'bet', 0, 100000, 'Ставка');
        handleCustomChip(document.getElementById('maxChips'), 'max', 2, 20, 'Игроков');
        handleCustomChip(document.getElementById('cashChips'), 'cash', 100, 100000, 'Капитал');
        handleCustomChip(document.getElementById('timeChips'), 'time', 5, 90, 'Секунд');
        handleCustomChip(document.getElementById('roundsChips'), 'rounds', 1, 100, 'Раундов');
        
        // Аватарки
        document.querySelectorAll('#avatarChips .chip').forEach(chip => {
            chip.addEventListener('click', function() {
                this.parentElement.querySelectorAll('.chip').forEach(x => x.classList.remove('selected'));
                this.classList.add('selected');
                state.previewAvatar = this.dataset.avatar;
                document.getElementById('editAvatarBig').innerHTML = getAvatarHtml(state.previewAvatar);
            });
        });
        
        // Язык
        document.querySelectorAll('#langChips .chip').forEach(chip => {
            chip.addEventListener('click', function() {
                this.parentElement.querySelectorAll('.chip').forEach(x => x.classList.remove('selected'));
                this.classList.add('selected');
                state.language = this.dataset.lang;
                applyLanguage();
                localStorage.setItem('ib_lang', state.language);
            });
        });
        
        document.getElementById('lobbyCloseX').addEventListener('click', leaveRoom);
        
        // Логотип для админки
        const logoElement = document.getElementById('logoClick');
        if (logoElement) {
            logoElement.addEventListener('click', () => {
                if (!isAdmin() && !isMod()) return;
                
                state.logoClickCount++;
                clearTimeout(state.logoClickTimer);
                
                if (state.logoClickCount >= 3) {
                    if (isAdmin()) {
                        adminButtonVisible = !adminButtonVisible;
                        const adminBtn = document.getElementById('adminFloatBtn');
                        if (adminBtn) adminBtn.style.display = adminButtonVisible ? 'flex' : 'none';
                        showToast(adminButtonVisible ? 'Админ-панель показана' : 'Админ-панель скрыта');
                    }
                    if (isMod()) {
                        modButtonVisible = !modButtonVisible;
                        const modBtn = document.getElementById('modFloatBtn');
                        if (modBtn) modBtn.style.display = modButtonVisible ? 'flex' : 'none';
                        showToast(modButtonVisible ? 'Панель модератора показана' : 'Панель модератора скрыта');
                    }
                    state.logoClickCount = 0;
                }
                
                state.logoClickTimer = setTimeout(() => {
                    state.logoClickCount = 0;
                }, 2000);
            });
        }
        
        // Telegram deep link
        if (tg && tg.initDataUnsafe && tg.initDataUnsafe.start_param) {
            const roomCode = tg.initDataUnsafe.start_param.toUpperCase().trim();
            setTimeout(() => window._joinRoom(roomCode), 1500);
        }
        
        // Перед закрытием страницы
        window.addEventListener('beforeunload', () => {
            if (state.isGameActive) {
                forceLose();
                if (state.roomCode) {
                    db.ref(`rooms/${state.roomCode}/pl/${state.playerId}`).update({ c: 0, p: {}, left: true });
                }
            }
            if (state.ghostRoomCode) {
                db.ref(`rooms/${state.ghostRoomCode}`).remove();
            }
        });
    }

    // ========== 26. ТОЧКА ВХОДА ==========
    function init() {
        state.playerId = getPlayerId();
        log(`ID игрока: ${state.playerId}`);
        
        loadProfile(() => {
            loadFriendRequests();
            loadGameInvites();
            updateUI();
            saveProfileToDB();
            
            if (isAdmin()) {
                setInterval(updateAdminStats, 5000);
                updateAdminStats();
                log('Админ-панель активирована');
            }
            if (isMod()) {
                setInterval(updateAdminStats, 5000);
                updateAdminStats();
                log('Модератор-панель активирована');
            }
            
            log('Профиль загружен');
            
            db.ref(`u/${state.playerId}/do`).on('value', snapshot => {
                state.playerDollars = snapshot.val() || 0;
                updateUI();
                saveGameState();
            });
            
            db.ref(`u/${state.playerId}/banned`).on('value', snapshot => {
                if (snapshot.val()) {
                    db.ref(`u/${state.playerId}`).once('value', snap => {
                        const data = snap.val();
                        if (data && data.banUntil && data.banUntil > Date.now()) {
                            showBanNotice(data.banReason || 'Нарушение', data.banUntil);
                        } else {
                            document.getElementById('banNotice').classList.remove('show');
                        }
                    });
                } else {
                    document.getElementById('banNotice').classList.remove('show');
                }
            });
            
            db.ref('announcements').limitToLast(1).on('child_added', snapshot => {
                const announcement = snapshot.val();
                if (announcement.expireAt > Date.now()) {
                    showBroadcast(announcement.text, announcement.coins, 
                                 Math.ceil((announcement.expireAt - Date.now()) / 1000), 
                                 snapshot.key);
                }
            });
            
            db.ref('adminActions/scare').on('value', snapshot => {
                if (snapshot.val() === 'fakeCoins') {
                    showFakeCoinsPopup();
                    db.ref('adminActions/scare').remove();
                }
            });
        });
        
        // Очистка пустых комнат
        setInterval(() => {
            db.ref('rooms').once('value', snapshot => {
                const rooms = snapshot.val();
                if (!rooms) return;
                
                Object.entries(rooms).forEach(([code, room]) => {
                    if (!room || !room.pl || Object.keys(room.pl).filter(id => !room.pl[id]?.left).length === 0) {
                        db.ref(`rooms/${code}`).remove();
                        db.ref('gi').orderByChild('roomCode').equalTo(code).once('value', snap => {
                            snap.forEach(child => child.ref.remove());
                        });
                    }
                });
            });
        }, 30000);
    }
    
    // ========== 27. ЗАПУСК ==========
    init();
    loadCases();
    bindEventListeners();
    log('v1.0 готово');
})();
