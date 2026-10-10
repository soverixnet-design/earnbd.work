/* SHAKIL m game integration layer
 * Keeps the supplied React party design as the visual shell while wiring the
 * real local games, Firebase login/profile, virtual wallet, ranking and the
 * Socket.IO/LiveKit voice-room backend into it.
 */
(function () {
  'use strict';

  var GAME_META = [
    { id: 'ludo', name: 'লুডো কিং', type: 'বোর্ড গেম', logo: 'assets/game-logos/ludo.svg', file: 'games/ludo.html', nativeWallet: false },
    { id: 'carrom', name: 'ক্যারাম', type: 'বোর্ড গেম', logo: 'assets/game-logos/carrom.svg', file: 'games/carrom.html', nativeWallet: false },
    { id: 'nightFoodWheel', name: 'নাইট ফুড হুইল', type: 'ফ্রি-প্লে', logo: 'assets/game-logos/night-food-wheel.svg', file: 'games/night-food-wheel.html', nativeWallet: true },
    { id: 'singhFoodWheel', name: 'সিংহ ফুড হুইল', type: 'ফ্রি-প্লে', logo: 'assets/game-logos/singh-food-wheel.svg', file: 'games/singh-food-wheel.html', nativeWallet: true },
    { id: 'slots', name: 'স্লটস', type: 'ফ্রি-প্লে', logo: 'assets/game-logos/slots.svg', file: 'games/slots.html', nativeWallet: true },
    { id: 'jackpotFruit', name: 'জ্যাকপট ফ্রুট', type: 'ফ্রি-প্লে', logo: 'assets/game-logos/jackpot-fruit.svg', file: 'games/jackpot-fruit.html', nativeWallet: true }
  ];
  var GIFTS = [
    { id: 'rose', name: 'Rose', emoji: '🌹', price: 10, color: '#ff4d6d' },
    { id: 'heart', name: 'Heart', emoji: '💖', price: 50, color: '#ff3b82' },
    { id: 'coffee', name: 'Coffee', emoji: '☕', price: 30, color: '#d69e2e' },
    { id: 'mic', name: 'Mic', emoji: '🎤', price: 100, color: '#7c4dff' },
    { id: 'diamond', name: 'Diamond', emoji: '💎', price: 200, color: '#00e5ff' },
    { id: 'car', name: 'Car', emoji: '🏎️', price: 500, color: '#ffd60a' },
    { id: 'crown', name: 'Crown', emoji: '👑', price: 1000, color: '#ffb800' },
    { id: 'rocket', name: 'Rocket', emoji: '🚀', price: 750, color: '#7c4dff' }
  ];

  var FIREBASE_CONFIG = {
    apiKey: 'AIzaSyCMwXWSbbFRTHcKx9nixhAg7hHvk-6yr-Y',
    authDomain: 'earnbdwork.firebaseapp.com',
    projectId: 'earnbdwork',
    storageBucket: 'earnbdwork.firebasestorage.app',
    messagingSenderId: '463458443517',
    appId: '1:463458443517:web:ed7e89c1ccb6eee3075e94',
    measurementId: 'G-C8KK0BKHRT'
  };
  var COIN_RATE = 10000000;
  var state = loadState();
  var FB = null;
  var FS = null;
  var ACCOUNT = null;
  var socket = null;
  var socketUrl = '';
  var currentRoom = null;
  var livekitRoom = null;
  var localAudio = null;
  var activeGame = '';
  var gameWalletReady = false;
  var panelRoot = null;
  var playerUnsubscribe = null;

  normalizeWalletState(state);

  function $(s, root) { return (root || document).querySelector(s); }
  function $all(s, root) { return Array.prototype.slice.call((root || document).querySelectorAll(s)); }
  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
  function fmt(value) { return Math.max(0, Math.floor(Number(value) || 0)).toLocaleString('en-US'); }
  function userName() { return state.user && state.user.name ? state.user.name : 'Guest'; }
  function userAvatar() { return state.user && state.user.avatar ? state.user.avatar : '😎'; }
  function todayKey() { return new Date().toISOString().slice(0, 10); }

  function normalizeWalletState(target) {
    if (!target || !target.user) return;
    var coin = Number(target.user.coin);
    var free = Number(target.user.freeCoins);
    var coinValid = Number.isFinite(coin);
    var freeValid = Number.isFinite(free);
    var balance = coinValid || freeValid ? Math.max(coinValid ? coin : 0, freeValid ? free : 0) : 100000000;
    balance = Math.max(0, Math.floor(balance));
    target.user.coin = balance;
    target.user.freeCoins = balance;
  }
  function walletBalance() {
    normalizeWalletState(state);
    return Number(state.user.coin) || 0;
  }
  function setWalletBalance(value) {
    var balance = Math.max(0, Math.floor(Number(value) || 0));
    state.user.coin = balance;
    state.user.freeCoins = balance;
    return balance;
  }

  function loadState() {
    var fallback = {
      user: { name: 'Guest', id: 'guest-' + Math.random().toString(36).slice(2, 8), avatar: '😎', coin: 1000, freeCoins: 100000000, dia: 0, xp: 0, gameStats: {} },
      daily: '', requests: [], history: []
    };
    try {
      var saved = JSON.parse(localStorage.getItem('shakil_shell_state_v1') || 'null');
      if (saved) return Object.assign(fallback, saved, { user: Object.assign(fallback.user, saved.user || {}) });
      var old = JSON.parse(localStorage.getItem('vr3') || 'null');
      if (old && old.u) {
        fallback.user = Object.assign(fallback.user, {
          name: old.u.n || 'Guest', id: old.u.id || fallback.user.id, avatar: old.u.av || '😎',
          coin: Number(old.u.coin) || 1000, freeCoins: Number(old.u.freeCoins) || 100000000,
          dia: Number(old.u.dia) || 0, xp: Number(old.u.xp) || 0, gameStats: old.u.gameStats || {}
        });
        fallback.history = Array.isArray(old.hist) ? old.hist.slice(0, 40) : [];
      }
    } catch (_) {}
    return fallback;
  }
  function saveState() {
    normalizeWalletState(state);
    persistLocalState();
    saveCloud();
    refreshIdentity();
  }
  function persistLocalState() {
    try { localStorage.setItem('shakil_shell_state_v1', JSON.stringify(state)); } catch (_) {}
    refreshIdentity();
  }
  function accountKey(uid) { return 'shakil_account_' + uid; }

  function setupFirebase() {
    if (!window.firebase || FB) return;
    try {
      if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
      FB = firebase.auth();
      FS = firebase.firestore();
      FB.onAuthStateChanged(function (user) {
        ACCOUNT = user || null;
        if (playerUnsubscribe) { playerUnsubscribe(); playerUnsubscribe = null; }
        if (user) hydrateAccount(user);
        else refreshIdentity();
      });
    } catch (_) { FB = null; FS = null; }
  }
  function cloudPayload() {
    normalizeWalletState(state);
    return {
      n: userName(), id: state.user.id, email: state.user.email || '', avatar: userAvatar(),
      coin: walletBalance(),
      freeCoins: walletBalance(),
      dia: Math.max(0, Math.floor(Number(state.user.dia) || 0)), xp: Math.max(0, Math.floor(Number(state.user.xp) || 0)),
      gameStats: state.user.gameStats || {}, coinRequests: (state.requests || []).slice(0, 20),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
  }
  function saveCloud() {
    if (!ACCOUNT || !FS || !window.firebase) return;
    var data = cloudPayload();
    try { localStorage.setItem(accountKey(ACCOUNT.uid), JSON.stringify(data)); } catch (_) {}
    FS.collection('players').doc(ACCOUNT.uid).set(data, { merge: true }).catch(function () {});
    var stats = Object.values(state.user.gameStats || {}).reduce(function (a, x) {
      return { played: a.played + (+x.played || 0), wins: a.wins + (+x.wins || 0), losses: a.losses + (+x.losses || 0), points: a.points + (+x.points || 0) };
    }, { played: 0, wins: 0, losses: 0, points: 0 });
    FS.collection('leaderboards').doc('all').collection('players').doc(ACCOUNT.uid).set({
      name: userName(), av: userAvatar(), played: stats.played, wins: stats.wins, losses: stats.losses, points: stats.points,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true }).catch(function () {});
  }
  function hydrateAccount(user) {
    var local = null;
    try { local = JSON.parse(localStorage.getItem(accountKey(user.uid) || 'null')); } catch (_) {}
    var apply = function (data, persistCloud) {
      data = data || local || {};
      state.user = Object.assign(state.user, data, {
        name: data.n || user.displayName || user.email.split('@')[0] || 'ইউজার',
        email: user.email || '', id: user.uid.slice(0, 12)
      });
      if (Array.isArray(data.coinRequests)) state.requests = data.coinRequests.slice(0, 20);
      normalizeWalletState(state);
      if (persistCloud) saveState(); else persistLocalState();
    };
    if (FS) {
      FS.collection('players').doc(user.uid).get().then(function (snap) {
        apply(snap.exists ? snap.data() : null, true);
        playerUnsubscribe = FS.collection('players').doc(user.uid).onSnapshot(function (live) {
          if (!live.exists || !ACCOUNT || ACCOUNT.uid !== user.uid) return;
          apply(live.data(), false);
        }, function () {});
      }).catch(function () { apply(null, true); });
    } else apply(null, true);
  }
  function loginIn(email, password, message) {
    if (!FB) return message('Firebase connection পাওয়া যায়নি। Guest mode চালু আছে।');
    FB.signInWithEmailAndPassword(email, password).then(function () { closePanel(); notice('লগইন সফল ✅'); }).catch(function (e) { message('লগইন হয়নি: ' + (e.code || 'ইমেইল/পাসওয়ার্ড যাচাই করুন')); });
  }
  function loginUp(email, password, name, message) {
    if (!FB) return message('Firebase connection পাওয়া যায়নি।');
    FB.createUserWithEmailAndPassword(email, password).then(function (result) {
      var update = name ? result.user.updateProfile({ displayName: name }) : Promise.resolve();
      return update.then(function () { closePanel(); notice('অ্যাকাউন্ট তৈরি হয়েছে ✅'); });
    }).catch(function (e) { message('রেজিস্টার হয়নি: ' + (e.code || 'তথ্য যাচাই করুন')); });
  }
  function logout() {
    if (FB) FB.signOut().catch(function () {});
    if (playerUnsubscribe) { playerUnsubscribe(); playerUnsubscribe = null; }
    ACCOUNT = null;
    state.user = { name: 'Guest', id: 'guest-' + Math.random().toString(36).slice(2, 8), avatar: '😎', coin: 100000000, freeCoins: 100000000, dia: 0, xp: 0, gameStats: {} };
    saveState(); closePanel(); notice('লগআউট হয়েছে');
  }

  function installStyle() {
    if ($('#shakil-bridge-style')) return;
    var style = document.createElement('style');
    style.id = 'shakil-bridge-style';
    style.textContent = `
      #shakil-bridge-top-games{position:fixed;left:14px;top:calc(14px + env(safe-area-inset-top));z-index:70;border:1px solid rgba(255,255,255,.14);border-radius:999px;padding:9px 13px;color:#fff;background:linear-gradient(135deg,#7c4dff,#00bcd4);font-size:12px;font-weight:900;box-shadow:0 8px 24px #0008,0 0 18px #7c4dff55;backdrop-filter:blur(14px)}
      #shakil-bridge-dock{position:fixed;right:12px;bottom:86px;z-index:60;display:flex;gap:6px;padding:6px;border-radius:18px;background:rgba(18,18,30,.9);border:1px solid rgba(255,255,255,.1);box-shadow:0 10px 30px #0008;backdrop-filter:blur(14px)}
      #shakil-bridge-dock button{border:0;color:#fff;background:linear-gradient(135deg,#7c4dff,#00bcd4);border-radius:13px;padding:8px 10px;font-size:11px;font-weight:800;box-shadow:0 5px 16px #7c4dff55}
      #shakil-bridge-dock button:last-child{background:linear-gradient(135deg,#ff4d6d,#7c4dff)}
      #shakil-bridge-overlay{position:fixed;inset:0;z-index:1000;display:flex;align-items:flex-end;justify-content:center;background:rgba(2,2,8,.78);backdrop-filter:blur(10px)}
      .sb-panel{width:min(580px,100%);max-height:94dvh;overflow:auto;border:1px solid rgba(255,255,255,.12);border-bottom:0;border-radius:28px 28px 0 0;background:linear-gradient(155deg,#1d1b32,#101018 78%);box-shadow:0 -15px 50px #000b;color:#fff;padding:18px 16px calc(22px + env(safe-area-inset-bottom))}
      .sb-head{display:flex;align-items:center;gap:10px;margin-bottom:15px}.sb-head h2{font-size:18px;font-weight:900;flex:1;margin:0}.sb-close{width:34px;height:34px;border:0;border-radius:50%;background:#ffffff12;color:#fff;font-size:18px}
      .sb-muted{color:rgba(255,255,255,.5);font-size:12px}.sb-card{border:1px solid rgba(255,255,255,.08);border-radius:18px;background:#181824;padding:14px;margin:10px 0}.sb-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.sb-game{border:1px solid rgba(255,255,255,.08);border-radius:18px;background:linear-gradient(145deg,#23213b,#141420);padding:11px;text-align:left;color:#fff;min-height:136px}.sb-game img{width:52px;height:52px;border-radius:15px;margin-bottom:7px;box-shadow:0 7px 14px #0008}.sb-game b{display:block;font-size:13px}.sb-game small{display:block;color:rgba(255,255,255,.48);margin-top:3px;font-size:10px}.sb-btn{border:0;border-radius:14px;padding:11px 13px;color:#fff;background:linear-gradient(135deg,#7c4dff,#5b2eff);font-weight:800;font-size:12px}.sb-btn.alt{background:#ffffff12;border:1px solid rgba(255,255,255,.1)}.sb-btn.cyan{background:linear-gradient(135deg,#00bcd4,#00e5ff);color:#081018}.sb-btn.red{background:linear-gradient(135deg,#ff4d6d,#c52255)}.sb-row{display:flex;gap:8px;flex-wrap:wrap}.sb-row>*{flex:1}.sb-input{width:100%;height:44px;border-radius:13px;border:1px solid rgba(255,255,255,.12);background:#0d0d15;color:#fff;padding:0 12px;outline:none}.sb-input:focus{border-color:#7c4dff}.sb-balance{font-size:36px;font-weight:950;letter-spacing:-1px}.sb-rate{font-size:18px;color:#fcd34d;font-weight:900;margin-top:5px}.sb-list{display:grid;gap:8px}.sb-room{display:flex;align-items:center;gap:10px;padding:12px;border:1px solid rgba(255,255,255,.07);border-radius:16px;background:#181824;color:#fff;text-align:left}.sb-room .sb-room-copy{flex:1;min-width:0}.sb-room b{font-size:13px;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sb-room small{display:block;color:rgba(255,255,255,.48);font-size:10px;margin-top:3px}.sb-room .sb-join{flex:none;padding:8px 10px}.sb-seats{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}.sb-seat{min-width:0;text-align:center;border:1px solid rgba(255,255,255,.08);border-radius:15px;background:#181824;padding:9px 4px;color:#fff;font-size:10px}.sb-seat.me{border-color:#00e5ff;box-shadow:0 0 14px #00e5ff33}.sb-seat .sb-avatar{width:40px;height:40px;border-radius:13px;margin:0 auto 5px;display:grid;place-items:center;background:linear-gradient(135deg,#7c4dff,#00bcd4);font-size:22px}.sb-seat.empty .sb-avatar{background:#ffffff08;color:rgba(255,255,255,.4)}.sb-chat{height:180px;overflow:auto;padding:10px;border-radius:15px;background:#0c0c13;border:1px solid rgba(255,255,255,.07);font-size:12px}.sb-chat p{margin:6px 0;color:rgba(255,255,255,.74)}.sb-chat strong{color:#00e5ff}.sb-game-frame{width:100%;height:min(76dvh,720px);border:0;border-radius:18px;background:#050507}.sb-frame-wrap{position:relative}.sb-frame-badge{position:absolute;left:10px;bottom:10px;z-index:2;padding:5px 8px;border-radius:10px;background:#000b;color:#ffd54a;font-size:10px}.sb-error{padding:12px;border-radius:14px;background:#ff4d6d18;border:1px solid #ff4d6d44;color:#ffb8c4;font-size:12px}.sb-nav-name{font-size:10px;color:rgba(255,255,255,.45);margin-left:7px}
      @media(max-width:420px){#shakil-bridge-top-games{left:10px;top:calc(10px + env(safe-area-inset-top));padding:8px 11px}#shakil-bridge-dock{left:10px;right:10px;justify-content:center}.sb-game{min-height:128px}.sb-seats{gap:5px}.sb-seat{font-size:9px;padding:7px 2px}}
    `;
    document.head.appendChild(style);
  }

  function notice(text) {
    var old = $('#shakil-bridge-notice');
    if (old) old.remove();
    var n = document.createElement('div');
    n.id = 'shakil-bridge-notice';
    n.textContent = text;
    n.style.cssText = 'position:fixed;top:18px;left:50%;transform:translateX(-50%);z-index:1100;padding:10px 16px;border-radius:18px;background:linear-gradient(135deg,#fcd34d,#f59e0b);color:#15100a;font-weight:900;font-size:12px;box-shadow:0 8px 24px #0008';
    document.body.appendChild(n);
    setTimeout(function () { if (n.parentNode) n.remove(); }, 2200);
  }
  function panel(title, body, options) {
    closePanel();
    var overlay = document.createElement('div');
    overlay.id = 'shakil-bridge-overlay';
    if (options && options.keepRoom) overlay.dataset.keepRoom = '1';
    overlay.innerHTML = '<section class="sb-panel"><div class="sb-head"><h2>' + title + '</h2><button class="sb-close" data-sb-close>×</button></div><div data-sb-body>' + body + '</div></section>';
    overlay.addEventListener('click', function (e) { if (e.target === overlay || e.target.closest('[data-sb-close]')) { if (overlay.dataset.keepRoom !== '1') leaveCurrentRoom(); closePanel(); } });
    document.body.appendChild(overlay);
    panelRoot = overlay;
    return overlay;
  }
  function leaveCurrentRoom() {
    if (currentRoom && socket && socket.connected) socket.emit('leave');
    currentRoom = null;
    if (livekitRoom) { try { livekitRoom.disconnect(); } catch (_) {} livekitRoom = null; }
    if (localAudio) { localAudio.getTracks().forEach(function (t) { t.stop(); }); localAudio = null; }
  }
  function closePanel() {
    var overlay = $('#shakil-bridge-overlay');
    if (overlay) overlay.remove();
    panelRoot = null;
    activeGame = '';
  }
  function body() { return panelRoot && $('[data-sb-body]', panelRoot); }
  function refreshIdentity() {
    var dock = $('#shakil-bridge-dock');
    if (dock) {
      var u = $('[data-sb-user]', dock);
      if (u) u.textContent = ACCOUNT ? '👤 ' + userName() : '🔐 লগইন';
    }
    var balance = fmt(walletBalance());
    $all('[data-room-wallet]').forEach(function (el) { el.textContent = '🪙 ' + balance; });
    $all('[data-sb-wallet-balance]').forEach(function (el) { el.textContent = balance + ' 🪙'; });
    $all('[data-sb-game-balance],[data-sb-gift-balance]').forEach(function (el) { el.textContent = balance; });
  }

  function gameBridgeScript(nativeWallet) {
    var genericSpend = nativeWallet ? '' : 'document.addEventListener("pointerdown",function(e){var t=e.target&&e.target.closest&&e.target.closest("button,.dice,#cv,#roll,#shoot");if(!t||!b||Date.now()-last<350)return;last=Date.now();b=Math.max(0,b-10);out()},{capture:true});';
    var genericOutcome = nativeWallet ? '' : 'var o=new MutationObserver(function(){var t=(document.body.innerText||"").toLowerCase();if(!won&&/(winner|you win|won|জিতেছে)/i.test(t)){won=1;b+=50;out()}});o.observe(document.body,{subtree:true,childList:true,characterData:true});';
    return '<script>(function(){var b=0,last=0,won=0;function out(){try{parent.postMessage({type:"shakil-wallet",balance:b},"*")}catch(_){}}addEventListener("message",function(e){var d=e.data||{};if(d.type==="setBalance"&&Number.isFinite(+d.balance)){b=Math.max(0,Math.floor(+d.balance));out()}});' + genericSpend + genericOutcome + '})()<\\/script>';
  }
  function launchGame(id) {
    var meta = GAME_META.find(function (g) { return g.id === id; });
    if (!meta) return;
    activeGame = id;
    gameWalletReady = false;
    var view = panel('🎮 ' + meta.name, '<div class="sb-frame-wrap"><iframe class="sb-game-frame" id="sb-game-frame" sandbox="allow-scripts allow-same-origin allow-forms allow-modals" title="' + esc(meta.name) + '"></iframe><span class="sb-frame-badge">🪙 wallet balance: <span data-sb-game-balance>' + fmt(walletBalance()) + '</span></span></div>', { keepRoom: !!currentRoom });
    var frame = $('#sb-game-frame', view);
    fetch(meta.file).then(function (r) { return r.text(); }).then(function (html) {
      frame.srcdoc = html.replace('</body>', gameBridgeScript(!!meta.nativeWallet) + '</body>');
    }).catch(function () { frame.src = meta.file; });
    frame.addEventListener('load', function () {
      gameWalletReady = true;
      try { frame.contentWindow.postMessage({ type: 'setBalance', balance: walletBalance() }, '*'); } catch (_) {}
    });
  }
  function gamePanel(options) {
    var cards = GAME_META.map(function (g) {
      return '<button class="sb-game" data-game="' + g.id + '"><img src="' + g.logo + '" alt="' + esc(g.name) + ' logo"><b>' + esc(g.name) + '</b><small>' + esc(g.type) + ' · Tap to play</small></button>';
    }).join('');
    var view = panel('🎮 SHAKIL m game', '<p class="sb-muted">গেমগুলো এখন শুধু Games button বা room-এর ভেতর থেকে খুলবে। সব game ও gift একই virtual wallet balance ব্যবহার করে।</p><div class="sb-grid">' + cards + '</div>', options);
    $all('[data-game]', view).forEach(function (b) { b.addEventListener('click', function () { launchGame(b.dataset.game); }); });
  }
  function recordGame(next) {
    var previous = walletBalance();
    next = Math.max(0, Math.floor(Number(next) || 0));
    if (next === previous) return;
    setWalletBalance(next);
    var st = state.user.gameStats[activeGame] || { played: 0, wins: 0, losses: 0, points: 0 };
    st.played += 1;
    if (next > previous) { st.wins += 1; st.points += Math.min(100, Math.floor((next - previous) / 1000) + 1); }
    else st.losses += 1;
    state.user.gameStats[activeGame] = st;
    state.history.unshift((next > previous ? '✅ ' : '➖ ') + activeGame + ': ' + (next - previous > 0 ? '+' : '−') + fmt(Math.abs(next - previous)) + ' free-play coins');
    state.history = state.history.slice(0, 40);
    saveState();
    var b = panelRoot && $('[data-sb-game-balance]', panelRoot); if (b) b.textContent = fmt(next);
  }
  function giftPanel(options) {
    var cards = GIFTS.map(function (g) {
      return '<button class="sb-game" data-gift="' + g.id + '"><span style="font-size:42px;line-height:1.1">' + g.emoji + '</span><b>' + esc(g.name) + '</b><small>🪙 ' + fmt(g.price) + ' coins</small></button>';
    }).join('');
    var view = panel('🎁 Send a Gift', '<div class="sb-card"><div class="sb-muted">CURRENT WALLET</div><div class="sb-balance" data-sb-gift-balance>' + fmt(walletBalance()) + ' 🪙</div><p class="sb-muted">গিফট পাঠালে একই virtual wallet থেকে coins কাটা হবে।</p></div><div class="sb-grid">' + cards + '</div>', options);
    $all('[data-gift]', view).forEach(function (b) {
      b.addEventListener('click', function () {
        var gift = GIFTS.find(function (g) { return g.id === b.dataset.gift; });
        if (gift) sendGift(gift, options);
      });
    });
  }
  function sendGift(gift, options) {
    var before = walletBalance();
    if (before < gift.price) return notice('এই gift পাঠানোর মতো coins নেই');
    setWalletBalance(before - gift.price);
    state.history.unshift('🎁 Gift ' + gift.name + ': −' + fmt(gift.price) + ' virtual coins');
    state.history = state.history.slice(0, 40);
    saveState();
    if (socket && socket.connected && currentRoom) socket.emit('gift', { g: gift.emoji + ' ' + gift.name });
    notice(gift.emoji + ' ' + gift.name + ' পাঠানো হয়েছে · −' + fmt(gift.price));
    if (currentRoom) renderRoomView(currentRoom); else giftPanel(options);
  }
  function showLogin() {
    var view = panel('🔐 SHAKIL m game login', '<div class="sb-card"><p class="sb-muted">লগইন করলে প্রোফাইল, গেম স্ট্যাটস, wallet ও ranking অন্য ডিভাইসেও সিঙ্ক হবে।</p><input class="sb-input" id="sb-email" type="email" placeholder="ইমেইল"><br><br><input class="sb-input" id="sb-pass" type="password" placeholder="পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর)"><br><br><input class="sb-input" id="sb-name" placeholder="নতুন অ্যাকাউন্টের নাম (ঐচ্ছিক)"><p class="sb-muted" id="sb-auth-msg"></p><div class="sb-row"><button class="sb-btn" data-login>লগইন</button><button class="sb-btn cyan" data-register>রেজিস্টার</button></div></div>');
    var msg = function (t) { var e = $('#sb-auth-msg', view); if (e) e.textContent = t; };
    $('[data-login]', view).addEventListener('click', function () { loginIn($('#sb-email', view).value.trim(), $('#sb-pass', view).value, msg); });
    $('[data-register]', view).addEventListener('click', function () { loginUp($('#sb-email', view).value.trim(), $('#sb-pass', view).value, $('#sb-name', view).value.trim(), msg); });
  }
  function profilePanel() {
    var total = Object.values(state.user.gameStats || {}).reduce(function (a, x) { return { played: a.played + (+x.played || 0), wins: a.wins + (+x.wins || 0), points: a.points + (+x.points || 0) }; }, { played: 0, wins: 0, points: 0 });
    var account = ACCOUNT ? '<p class="sb-muted">' + esc(ACCOUNT.email || '') + '</p><button class="sb-btn red" data-logout>লগআউট</button>' : '<button class="sb-btn cyan" data-login-open>লগইন / রেজিস্টার</button>';
    var view = panel('👤 Profile', '<div class="sb-card" style="text-align:center"><div style="font-size:48px">' + esc(userAvatar()) + '</div><h2>' + esc(userName()) + '</h2><p class="sb-muted">ID: ' + esc(state.user.id) + '</p><p>🎮 Games: ' + total.played + ' · জয়: ' + total.wins + ' · Points: ' + total.points + '</p>' + account + '</div><div class="sb-card"><b>📜 নীতিমালা</b><p class="sb-muted">Agency, Admin ও BD policy দেখতে নিচের বাটনে চাপুন। Virtual coins-এর cash-out বা real-money wagering নেই।</p><button class="sb-btn alt" data-policy>নীতিমালা খুলুন</button></div>');
    if ($('[data-logout]', view)) $('[data-logout]', view).addEventListener('click', logout);
    if ($('[data-login-open]', view)) $('[data-login-open]', view).addEventListener('click', showLogin);
    $('[data-policy]', view).addEventListener('click', policyPanel);
  }
  function walletPanel(options) {
    var reqs = (state.requests || []).slice(0, 5).map(function (r) { return '<div class="sb-room"><div class="sb-room-copy"><b>' + fmt(r.amount) + ' coins</b><small>' + esc(r.time || '') + ' · ' + esc(r.status || 'pending') + '</small></div></div>'; }).join('');
    var view = panel('💰 Virtual Wallet', '<div class="sb-card"><div class="sb-muted">GAME + GIFT WALLET</div><div class="sb-balance" data-sb-wallet-balance>' + fmt(walletBalance()) + ' 🪙</div><div class="sb-muted">এই balance গেম খেলা ও gift পাঠানো—দুই জায়গাতেই ব্যবহার হবে এবং refresh-এর পরও থাকবে।</div><div class="sb-row" style="margin-top:12px"><button class="sb-btn" data-daily>🎁 Daily reward</button><button class="sb-btn alt" data-request>📝 Coin request</button></div></div><div class="sb-card"><b>📊 Display-only coin rate</b><div class="sb-rate">' + fmt(COIN_RATE) + ' virtual coins = $1</div><p class="sb-muted">এই rate শুধু হিসাব দেখায়। coin বিক্রি, টাকা জমা, বাজি বা cash-out চালু নেই।</p></div><div class="sb-card"><b>📝 আমার coin requests</b>' + (reqs || '<p class="sb-muted">এখনো কোনো request নেই।</p>') + '</div><div class="sb-card"><b>📒 Virtual ledger</b>' + ((state.history || []).map(function (x) { return '<p class="sb-muted" style="margin:5px 0">' + esc(x) + '</p>'; }).join('') || '<p class="sb-muted">এখনো কোনো লেনদেন নেই।</p>') + '</div>', options);
    $('[data-daily]', view).addEventListener('click', dailyReward);
    $('[data-request]', view).addEventListener('click', requestCoins);
  }
  function dailyReward() {
    if (state.daily === todayKey()) return notice('আজকের reward নেওয়া হয়েছে');
    state.daily = todayKey(); setWalletBalance(walletBalance() + 50); state.user.xp += 20; state.history.unshift('🎁 Daily reward +50 virtual coins'); saveState(); notice('+৫০ virtual coins ✅'); walletPanel();
  }
  function requestCoins() {
    var amount = Math.floor(Number(prompt('কত virtual coin request করবেন?', '1000000')) || 0);
    if (!Number.isFinite(amount) || amount < 1 || amount > 1000000000) return notice('সঠিক coin সংখ্যা দিন');
    state.requests.unshift({ id: Date.now(), amount: amount, status: 'pending', time: new Date().toLocaleString('bn-BD') });
    state.history.unshift('📝 Virtual coin request: ' + fmt(amount)); state.history = state.history.slice(0, 40); saveState(); notice('Request ledger-এ যোগ হয়েছে'); walletPanel();
  }
  function policyPanel() {
    panel('📜 SHAKIL m game policy', '<div class="sb-card"><b>🏢 Agency Policy</b><p class="sb-muted">অনুমোদিত representative শুধু support পরিচালনা করবেন; password বা ব্যক্তিগত তথ্য চাইবেন না; off-platform প্রতারণা নিষিদ্ধ।</p></div><div class="sb-card"><b>🛡️ Admin Policy</b><p class="sb-muted">Admin access public UI-তে নেই। Role change, balance audit, ban ও policy edit server-side audit log দিয়ে করতে হবে।</p></div><div class="sb-card"><b>🇧🇩 BD Policy</b><p class="sb-muted">স্থানীয় আইন ও platform policy মানতে হবে। এই প্ল্যাটফর্মের coins virtual-only; টাকা জমা, বাজি, নগদ বিক্রি বা cash-out নেই।</p></div>');
  }

  function configuredSocketUrl() {
    var q = new URLSearchParams(location.search).get('voiceServer');
    return q || window.SHAKIL_VOICE_SERVER_URL || localStorage.getItem('shakil_voice_server') || '';
  }
  function connectSocket(onReady) {
    socketUrl = configuredSocketUrl();
    if (!socketUrl || !window.io) return onReady(null);
    if (socket && socket.connected) return onReady(socket);
    socket = window.io(socketUrl, { transports: ['websocket', 'polling'] });
    socket.on('connect_error', function () { notice('Voice server সংযোগ পাওয়া যায়নি'); });
    socket.on('rooms', function (rooms) { if (panelRoot && $('[data-room-list]', panelRoot) && !currentRoom) renderRoomList(rooms); if (currentRoom) { var r = rooms.find(function (x) { return String(x.id) === String(currentRoom.id); }); if (r) { currentRoom = r; renderRoomView(r); } } });
    socket.on('kicked', function () { currentRoom = null; notice('Owner আপনাকে room থেকে বের করেছেন'); showRooms(); });
    socket.on('blocked', function () { currentRoom = null; notice('এই room-এ আপনার access বন্ধ'); showRooms(); });
    socket.on('disconnect', function () { if (currentRoom) notice('Voice server সংযোগ বিচ্ছিন্ন'); });
    socket.on('connect', function () { onReady(socket); });
    return socket;
  }
  function demoRooms() { return [{ id: 'demo-1', name: 'Rater Adda', o: 'Nusrat', n: 5, cat: 'Adda', pw: false }, { id: 'demo-2', name: 'Gaming Squad', o: 'Rafi', n: 4, cat: 'Gaming', pw: false }, { id: 'demo-3', name: 'Night Chill', o: 'Mim', n: 3, cat: 'Chill', pw: false }]; }
  function localRooms() {
    var rooms = [];
    try { rooms = JSON.parse(localStorage.getItem('shakil_demo_rooms') || '[]'); } catch (_) {}
    return rooms.concat(demoRooms()).slice(0, 20);
  }
  function showRooms() {
    leaveCurrentRoom();
    var view = panel('🎙️ Voice Rooms', '<p class="sb-muted">সর্বোচ্চ ৫ জনের room। Voice চালাতে browser-এর microphone permission-এ Allow চাপতে হবে।</p><div class="sb-card"><div class="sb-row"><input class="sb-input" id="sb-room-name" placeholder="Room name"><button class="sb-btn" data-create-room>＋ Create room</button></div><p class="sb-muted" style="margin:8px 0 0">Online mode চালাতে URL-এ <code>?voiceServer=https://your-service</code> দিতে হবে।</p></div><div class="sb-list" data-room-list></div>');
    $('[data-create-room]', view).addEventListener('click', function () { var n = $('#sb-room-name', view).value.trim(); if (!n) return notice('Room name লিখুন'); createRoom(n); });
    connectSocket(function () { if (!socket) renderRoomList(localRooms()); });
  }
  function renderRoomList(rooms) {
    var list = $('[data-room-list]', panelRoot); if (!list) return;
    list.innerHTML = (rooms || []).map(function (r) { return '<button class="sb-room" data-join-room="' + esc(r.id) + '"><span style="font-size:26px">🎙️</span><span class="sb-room-copy"><b>' + esc(r.name) + '</b><small>' + esc(r.o || 'Host') + ' · ' + esc(r.cat || 'Live') + ' · ' + (r.n || 0) + '/5 online</small></span><span class="sb-join">Join</span></button>'; }).join('') || '<p class="sb-muted">এখনো কোনো live room নেই।</p>';
    $all('[data-join-room]', panelRoot).forEach(function (b) { b.addEventListener('click', function () { joinRoom(b.dataset.joinRoom); }); });
  }
  function createRoom(name) {
    if (socket && socket.connected) return socket.emit('create', { name: name, n: userName(), sc: 5, pw: '' }, function (id) { joinRoom(id); });
    var local = { id: 'local-' + Date.now(), name: name, o: userName(), n: 1, cat: 'Live', pw: false, seats: [{ n: userName(), e: userAvatar(), m: 1 }], chat: ['✨ ' + userName() + ' room খুলেছেন'] };
    var rooms = []; try { rooms = JSON.parse(localStorage.getItem('shakil_demo_rooms') || '[]'); } catch (_) {}
    rooms.unshift(local); try { localStorage.setItem('shakil_demo_rooms', JSON.stringify(rooms.slice(0, 20))); } catch (_) {}
    joinRoom(local.id, local);
  }
  function joinRoom(id, demo) {
    if (socket && socket.connected && !demo) return socket.emit('join', { id: Number(id), n: userName() }, function (ok) { if (ok) { currentRoom = { id: id }; renderRoomView(currentRoom); } else notice('Room-এ join করা যায়নি'); });
    currentRoom = demo || (demoRooms().find(function (r) { return String(r.id) === String(id); }) || { id: id, name: 'Demo room', o: 'Host', n: 1, seats: [] });
    renderRoomView(currentRoom);
  }
  function renderRoomView(room) {
    var view = panel('🎙️ ' + esc(room.name || 'Voice Room'), '<div class="sb-muted">Host: ' + esc(room.o || 'Host') + ' · ' + (room.n || (room.seats || []).filter(Boolean).length || 1) + '/5 online</div><div class="sb-card" style="display:flex;align-items:center;gap:10px;justify-content:space-between"><div><div class="sb-muted">ROOM WALLET</div><b data-room-wallet>🪙 ' + fmt(walletBalance()) + '</b></div><button class="sb-btn alt" data-room-wallet-open>Wallet</button></div><div class="sb-seats" data-seats></div><div class="sb-row" style="margin:12px 0"><button class="sb-btn cyan" data-mic>🎤 Mic</button><button class="sb-btn" data-room-games>🎮 Games</button><button class="sb-btn" data-room-gift>🎁 Gift</button><button class="sb-btn alt" data-leave-room>← Rooms</button></div><div class="sb-chat" data-chat></div><div class="sb-row" style="margin-top:8px"><input class="sb-input" id="sb-chat-input" placeholder="মেসেজ লিখুন"><button class="sb-btn" data-send-chat>➤</button></div>');
    $('[data-leave-room]', view).addEventListener('click', showRooms);
    $('[data-mic]', view).addEventListener('click', toggleMic);
    $('[data-room-games]', view).addEventListener('click', function () { gamePanel({ keepRoom: true }); });
    $('[data-room-gift]', view).addEventListener('click', function () { giftPanel({ keepRoom: true }); });
    $('[data-room-wallet-open]', view).addEventListener('click', function () { walletPanel({ keepRoom: true }); });
    $('[data-send-chat]', view).addEventListener('click', sendChat);
    var input = $('#sb-chat-input', view); input.addEventListener('keydown', function (e) { if (e.key === 'Enter') sendChat(); });
    paintRoom(room);
  }
  function paintRoom(room) {
    if (!panelRoot) return;
    var seats = $('[data-seats]', panelRoot); var list = room.seats || [];
    if (!list.length) list = [{ n: userName(), e: userAvatar(), me: true }];
    while (list.length < 5) list.push(null);
    seats.innerHTML = list.slice(0, 5).map(function (s, i) { return '<button class="sb-seat ' + (s && (s.me || s.n === userName()) ? 'me' : '') + ' ' + (!s ? 'empty' : '') + '" data-seat="' + i + '"><div class="sb-avatar">' + (s ? esc(s.e || '🙂') : '+') + '</div>' + (s ? '<b>' + esc(s.n || 'User') + '</b>' : '<span>Seat ' + (i + 1) + '</span>') + '</button>'; }).join('');
    $all('[data-seat]', panelRoot).forEach(function (b) { b.addEventListener('click', function () { if (socket && socket.connected && currentRoom) socket.emit('seat', { i: Number(b.dataset.seat) }); }); });
    var chat = $('[data-chat]', panelRoot); chat.innerHTML = (room.chat || []).slice(-40).map(function (x) { return '<p>' + esc(x) + '</p>'; }).join('') || '<p class="sb-muted">Room chat শুরু করুন।</p>'; chat.scrollTop = chat.scrollHeight;
  }
  function sendChat() {
    var input = $('#sb-chat-input', panelRoot); var text = input && input.value.trim(); if (!text || !currentRoom) return;
    if (socket && socket.connected) socket.emit('chat', { t: text });
    else { currentRoom.chat = currentRoom.chat || []; currentRoom.chat.push(userName() + ': ' + text); paintRoom(currentRoom); }
    input.value = '';
  }
  function toggleMic() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return notice('এই browser microphone support করে না');
    if (!localAudio) {
      navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }).then(function (stream) {
        localAudio = stream; if (socket && socket.connected) socket.emit('mute', 0); notice('🎤 Microphone চালু হয়েছে'); tryLiveKit(stream);
      }).catch(function () { notice('Microphone permission-এ Allow চাপুন'); });
    } else {
      var track = localAudio.getAudioTracks()[0]; track.enabled = !track.enabled; if (socket && socket.connected) socket.emit('mute', track.enabled ? 0 : 1); notice(track.enabled ? '🎤 Mic চালু' : '🔇 Mic বন্ধ');
    }
  }
  function tryLiveKit(stream) {
    if (!socket || !socket.connected || !window.LivekitClient || !socketUrl || !currentRoom) return;
    fetch(socketUrl.replace(/\/$/, '') + '/token?room=' + encodeURIComponent(currentRoom.id) + '&name=' + encodeURIComponent(userName()) + '&id=' + encodeURIComponent(socket.id)).then(function (r) { return r.json(); }).then(function (data) {
      if (!data.token) return;
      var Room = window.LivekitClient.Room; livekitRoom = new Room();
      return livekitRoom.connect(data.url, data.token).then(function () { return livekitRoom.localParticipant.setMicrophoneEnabled(true); });
    }).catch(function () { notice('LiveKit voice server এখনো configured নয়'); });
  }
  function leaderboardPanel() {
    var view = panel('🏆 Ranking', '<p class="sb-muted">প্রতি গেমের virtual points ও wins এখানে দেখা যাবে।</p><div class="sb-list" data-rank-list><p class="sb-muted">লোড হচ্ছে…</p></div>');
    var list = $('[data-rank-list]', view);
    if (!FS || !ACCOUNT) { list.innerHTML = '<p class="sb-muted">Global ranking দেখতে login করুন।</p>'; return; }
    FS.collection('leaderboards').doc('all').collection('players').orderBy('points', 'desc').limit(10).get().then(function (snap) {
      list.innerHTML = snap.docs.map(function (d, i) { var x = d.data(); return '<div class="sb-room"><span style="font-size:22px">' + ['🥇', '🥈', '🥉'][i] + '</span><span class="sb-room-copy"><b>' + esc(x.name || 'User') + '</b><small>জয় ' + (x.wins || 0) + ' · গেম ' + (x.played || 0) + '</small></span><strong>' + (x.points || 0) + '</strong></div>'; }).join('') || '<p class="sb-muted">এখনো ranking data নেই।</p>';
    }).catch(function () { list.innerHTML = '<p class="sb-muted">Ranking এখন পাওয়া যাচ্ছে না।</p>'; });
  }

  function installDock() {
    if ($('#shakil-bridge-dock')) return;
    var topGames = document.createElement('button');
    topGames.id = 'shakil-bridge-top-games';
    topGames.type = 'button';
    topGames.textContent = '🎮 Games';
    topGames.addEventListener('click', function () { gamePanel(); });
    document.body.appendChild(topGames);
    var dock = document.createElement('div');
    dock.id = 'shakil-bridge-dock';
    dock.innerHTML = '<button data-sb-action="rooms">🎙️ রুম</button><button data-sb-action="rank">🏆 র‍্যাংক</button><button data-sb-action="user" data-sb-user>🔐 লগইন</button>';
    dock.addEventListener('click', function (e) {
      var action = e.target.closest('[data-sb-action]'); if (!action) return;
      if (action.dataset.sbAction === 'rooms') showRooms();
      if (action.dataset.sbAction === 'rank') leaderboardPanel();
      if (action.dataset.sbAction === 'user') profilePanel();
    });
    document.body.appendChild(dock); refreshIdentity();
  }
  function interceptDesignButtons() {
    document.addEventListener('click', function (e) {
      if (e.target.closest('#shakil-bridge-overlay') || e.target.closest('#shakil-bridge-dock') || e.target.closest('#shakil-bridge-top-games')) return;
      var button = e.target.closest('button'); if (!button) return;
      var text = (button.textContent || '').replace(/\s+/g, ' ').trim();
      if (text === 'Wallet' || text === 'ওয়ালেট') { e.preventDefault(); e.stopPropagation(); walletPanel(); return; }
      if (text === 'Profile' || text === 'প্রোফাইল') { e.preventDefault(); e.stopPropagation(); profilePanel(); return; }
      if (text === 'Gift' || text === '🎁 Gift') { e.preventDefault(); e.stopPropagation(); giftPanel({ keepRoom: !!currentRoom }); return; }
      if (/Mini Games/i.test(text)) { e.preventDefault(); e.stopPropagation(); gamePanel({ keepRoom: !!currentRoom }); return; }
      if (/Create Room|Lucky Room|Join Live Party|Create Voice Room/i.test(text)) { e.preventDefault(); e.stopPropagation(); showRooms(); }
    }, true);
  }
  function start() {
    installStyle(); installDock(); interceptDesignButtons(); setupFirebase();
    window.addEventListener('message', function (e) {
      var d = e.data || {};
      if (activeGame && gameWalletReady && (d.type === 'shakil-wallet' || d.type === 'wallet') && Number.isFinite(+d.balance)) recordGame(+d.balance);
    });
    window.addEventListener('storage', function (e) {
      if (e.key !== 'shakil_shell_state_v1' || !e.newValue) return;
      try { var incoming = JSON.parse(e.newValue); if (incoming && incoming.user) { state = incoming; normalizeWalletState(state); refreshIdentity(); } } catch (_) {}
    });
    if (!window.firebase) setTimeout(setupFirebase, 1200);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
