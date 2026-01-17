/**
 * Killer Quiz — Foodfight Remaster (Server)
 * Online-friendly tweaks:
 * - /health endpoint for platforms
 * - WebSocket ping keepalive
 * - Serves / and /index.html
 */
const http = require('http');
const path = require('path');
const fs = require('fs');
const WebSocket = require('ws');

const OVEN_PORT = process.env.PORT || 3000;
const MENU_INDEX = path.join(__dirname, 'public', 'index.html');

function serve(req, res) {
  const route = (req.url || '/').split('?')[0];

  if (route === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (route !== '/' && route !== '/index.html') {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
    return;
  }

  fs.readFile(MENU_INDEX, (err, data) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Server error');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(data);
  });
}

const soupServer = http.createServer(serve);
const waffleWSS = new WebSocket.Server({ server: soupServer });

const STARTING_HEALTH = 100;
const DAMAGE_BITE = 20;

const pantry = new Map(); // roomCode -> room

function sendSauce(ws, obj) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
}
function broadcastBasket(room, obj) {
  room.sandwiches.forEach(s => { if (s) sendSauce(s.socket, obj); });
}

function newRoom(code) {
  return {
    code,
    sandwiches: [null, null], // { socket, ready }
    headChef: null,
    health: [STARTING_HEALTH, STARTING_HEALTH],
    cooking: false,
    roundId: 0,
    roundNo: 0,
    order: null,
    qPos: 0,
    currentQ: null,
    resolved: false,
    answered: [false, false],
  };
}

function shuffleTray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function makeRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

const QUESTION_BANK = [{"question": "What is the capital of France?", "choices": ["Paris", "Lyon", "Marseille"], "correctIndex": 0}, {"question": "Which planet is known as the Red Planet?", "choices": ["Venus", "Mars", "Jupiter"], "correctIndex": 1}, {"question": "What gas do plants absorb from the air?", "choices": ["Oxygen", "Nitrogen", "Carbon dioxide"], "correctIndex": 2}, {"question": "Which ocean is the largest?", "choices": ["Atlantic", "Pacific", "Indian"], "correctIndex": 1}, {"question": "How many continents are there?", "choices": ["5", "6", "7"], "correctIndex": 2}, {"question": "What is the chemical symbol for water?", "choices": ["H2O", "CO2", "NaCl"], "correctIndex": 0}, {"question": "Which animal is a mammal?", "choices": ["Shark", "Dolphin", "Salmon"], "correctIndex": 1}, {"question": "What is the capital of Japan?", "choices": ["Kyoto", "Osaka", "Tokyo"], "correctIndex": 2}, {"question": "Which metal is liquid at room temperature?", "choices": ["Mercury", "Iron", "Aluminum"], "correctIndex": 0}, {"question": "Which instrument has 88 keys?", "choices": ["Guitar", "Piano", "Violin"], "correctIndex": 1}, {"question": "What is the largest organ in the human body?", "choices": ["Skin", "Liver", "Heart"], "correctIndex": 0}, {"question": "Which country is famous for the pyramids of Giza?", "choices": ["Mexico", "Egypt", "India"], "correctIndex": 1}, {"question": "Which is a prime number?", "choices": ["21", "23", "25"], "correctIndex": 1}, {"question": "What is the freezing point of water in °C?", "choices": ["0", "32", "-10"], "correctIndex": 0}, {"question": "Which language is primarily spoken in Brazil?", "choices": ["Spanish", "Portuguese", "French"], "correctIndex": 1}, {"question": "What is the capital of Australia?", "choices": ["Sydney", "Canberra", "Melbourne"], "correctIndex": 1}, {"question": "Which planet has rings most famously?", "choices": ["Saturn", "Earth", "Mars"], "correctIndex": 0}, {"question": "What do bees collect from flowers?", "choices": ["Nectar", "Dew", "Sap"], "correctIndex": 0}, {"question": "Which is the smallest prime number?", "choices": ["0", "1", "2"], "correctIndex": 2}, {"question": "How many sides does a hexagon have?", "choices": ["5", "6", "8"], "correctIndex": 1}, {"question": "Which is a renewable energy source?", "choices": ["Coal", "Wind", "Oil"], "correctIndex": 1}, {"question": "What is the capital of Canada?", "choices": ["Toronto", "Ottawa", "Vancouver"], "correctIndex": 1}, {"question": "Which continent is the Sahara Desert on?", "choices": ["Asia", "Africa", "Australia"], "correctIndex": 1}, {"question": "Which is the fastest land animal?", "choices": ["Cheetah", "Lion", "Horse"], "correctIndex": 0}, {"question": "Which blood type is known as the universal donor?", "choices": ["O negative", "AB positive", "A positive"], "correctIndex": 0}, {"question": "Which is the largest planet in our solar system?", "choices": ["Jupiter", "Saturn", "Neptune"], "correctIndex": 0}, {"question": "Which organ pumps blood through the body?", "choices": ["Lung", "Heart", "Kidney"], "correctIndex": 1}, {"question": "What is the capital of New Zealand?", "choices": ["Auckland", "Wellington", "Christchurch"], "correctIndex": 1}, {"question": "Which substance has the chemical formula NaCl?", "choices": ["Sugar", "Salt", "Baking soda"], "correctIndex": 1}, {"question": "Which is a type of triangle with all sides equal?", "choices": ["Scalene", "Isosceles", "Equilateral"], "correctIndex": 2}, {"question": "What is the capital of Spain?", "choices": ["Barcelona", "Madrid", "Seville"], "correctIndex": 1}, {"question": "Which is the largest mammal?", "choices": ["Elephant", "Blue whale", "Giraffe"], "correctIndex": 1}, {"question": "Which is the closest star to Earth?", "choices": ["Polaris", "Sirius", "The Sun"], "correctIndex": 2}, {"question": "Which is the largest continent by area?", "choices": ["Africa", "Asia", "Europe"], "correctIndex": 1}, {"question": "Which is the largest desert (by area)?", "choices": ["Sahara", "Antarctic Desert", "Gobi"], "correctIndex": 1}, {"question": "What is the capital of the United Kingdom?", "choices": ["London", "Manchester", "Edinburgh"], "correctIndex": 0}, {"question": "How many days are in a leap year?", "choices": ["365", "366", "367"], "correctIndex": 1}, {"question": "Which is the largest bone in the human body?", "choices": ["Femur", "Skull", "Rib"], "correctIndex": 0}, {"question": "What is the capital of South Korea?", "choices": ["Busan", "Seoul", "Incheon"], "correctIndex": 1}, {"question": "How many letters are in the English alphabet?", "choices": ["24", "25", "26"], "correctIndex": 2}, {"question": "Which is a common web markup language?", "choices": ["HTML", "SQL", "PNG"], "correctIndex": 0}, {"question": "What is the capital of the USA?", "choices": ["New York", "Washington, D.C.", "Los Angeles"], "correctIndex": 1}, {"question": "Which is a famous painting by Leonardo da Vinci?", "choices": ["Mona Lisa", "Starry Night", "The Scream"], "correctIndex": 0}, {"question": "What is the capital of China?", "choices": ["Shanghai", "Beijing", "Guangzhou"], "correctIndex": 1}, {"question": "Which is the hardest natural substance?", "choices": ["Diamond", "Gold", "Quartz"], "correctIndex": 0}, {"question": "Which month has 28 days in a common year?", "choices": ["February", "June", "All months have at least 28 days"], "correctIndex": 2}, {"question": "What is the capital of India?", "choices": ["Mumbai", "New Delhi", "Bangalore"], "correctIndex": 1}, {"question": "Which continent is Australia in?", "choices": ["Australia/Oceania", "Europe", "South America"], "correctIndex": 0}, {"question": "Which is the smallest continent by area?", "choices": ["Europe", "Australia", "Antarctica"], "correctIndex": 1}, {"question": "What is the capital of Sweden?", "choices": ["Stockholm", "Gothenburg", "Malmö"], "correctIndex": 0}, {"question": "What is the capital of Norway?", "choices": ["Oslo", "Bergen", "Trondheim"], "correctIndex": 0}, {"question": "Which is a gas in Earth's atmosphere?", "choices": ["Oxygen", "Granite", "Steel"], "correctIndex": 0}, {"question": "Which is a type of rock?", "choices": ["Igneous", "Gaseous", "Liquid"], "correctIndex": 0}, {"question": "Which is a browser?", "choices": ["Chrome", "Python", "Windows"], "correctIndex": 0}, {"question": "What is 50 + 17?", "choices": ["74", "67", "64"], "correctIndex": 1}, {"question": "What is 38 − 3?", "choices": ["38", "35", "28"], "correctIndex": 1}, {"question": "What is 12 × 9?", "choices": ["105", "101", "108"], "correctIndex": 2}, {"question": "What is 24 + 42?", "choices": ["68", "66", "59"], "correctIndex": 1}, {"question": "What is 93 − 9?", "choices": ["84", "78", "85"], "correctIndex": 0}, {"question": "What is 3 × 5?", "choices": ["15", "20", "18"], "correctIndex": 0}, {"question": "What is 19 + 23?", "choices": ["35", "41", "42"], "correctIndex": 2}, {"question": "What is 22 − 6?", "choices": ["22", "16", "15"], "correctIndex": 1}, {"question": "What is 10 × 11?", "choices": ["115", "107", "110"], "correctIndex": 2}, {"question": "What is 50 + 49?", "choices": ["98", "105", "99"], "correctIndex": 2}, {"question": "What is 15 − 4?", "choices": ["10", "4", "11"], "correctIndex": 2}, {"question": "What is 9 × 7?", "choices": ["70", "63", "64"], "correctIndex": 1}, {"question": "What is 33 + 32?", "choices": ["72", "65", "63"], "correctIndex": 1}, {"question": "What is 87 − 3?", "choices": ["86", "91", "84"], "correctIndex": 2}, {"question": "What is 10 × 9?", "choices": ["89", "90", "97"], "correctIndex": 1}, {"question": "What is 53 + 30?", "choices": ["77", "80", "83"], "correctIndex": 2}, {"question": "What is 61 − 5?", "choices": ["56", "53", "50"], "correctIndex": 0}, {"question": "What is 6 × 10?", "choices": ["67", "60", "61"], "correctIndex": 1}, {"question": "What is 26 + 18?", "choices": ["44", "42", "51"], "correctIndex": 0}, {"question": "What is 84 − 7?", "choices": ["82", "77", "79"], "correctIndex": 1}, {"question": "What is 5 × 11?", "choices": ["56", "48", "55"], "correctIndex": 2}, {"question": "What is 19 + 50?", "choices": ["76", "69", "67"], "correctIndex": 1}, {"question": "What is 59 − 7?", "choices": ["52", "54", "57"], "correctIndex": 0}, {"question": "What is 11 × 3?", "choices": ["40", "36", "33"], "correctIndex": 2}, {"question": "What is 59 + 51?", "choices": ["110", "103", "109"], "correctIndex": 0}, {"question": "What is 30 − 8?", "choices": ["22", "19", "29"], "correctIndex": 0}, {"question": "What is 11 × 5?", "choices": ["55", "57", "48"], "correctIndex": 0}, {"question": "What is 50 + 42?", "choices": ["86", "94", "92"], "correctIndex": 2}, {"question": "What is 30 − 9?", "choices": ["21", "23", "14"], "correctIndex": 0}, {"question": "What is 10 × 3?", "choices": ["25", "30", "27"], "correctIndex": 1}, {"question": "What is 13 + 25?", "choices": ["31", "40", "38"], "correctIndex": 2}, {"question": "What is 18 − 9?", "choices": ["9", "7", "3"], "correctIndex": 0}, {"question": "What is 6 × 11?", "choices": ["73", "69", "66"], "correctIndex": 2}, {"question": "What is 35 + 52?", "choices": ["87", "82", "90"], "correctIndex": 0}, {"question": "What is 25 − 4?", "choices": ["14", "21", "19"], "correctIndex": 1}, {"question": "What is 12 × 11?", "choices": ["130", "138", "132"], "correctIndex": 2}, {"question": "What is 14 + 55?", "choices": ["72", "62", "69"], "correctIndex": 2}, {"question": "What is 14 − 6?", "choices": ["14", "5", "8"], "correctIndex": 2}, {"question": "What is 10 × 6?", "choices": ["60", "62", "54"], "correctIndex": 0}, {"question": "What is 25 + 60?", "choices": ["86", "90", "85"], "correctIndex": 2}, {"question": "What is 22 − 7?", "choices": ["15", "20", "14"], "correctIndex": 0}, {"question": "What is 3 × 4?", "choices": ["12", "9", "17"], "correctIndex": 0}, {"question": "What is 16 + 25?", "choices": ["41", "39", "35"], "correctIndex": 0}, {"question": "What is 27 − 7?", "choices": ["15", "20", "18"], "correctIndex": 1}, {"question": "What is 4 × 10?", "choices": ["42", "33", "40"], "correctIndex": 2}, {"question": "What is 15 + 58?", "choices": ["73", "67", "71"], "correctIndex": 0}];

function connectedSlots(room) { return room.sandwiches.map(s => !!s); }
function readySlots(room) { return room.sandwiches.map(s => !!(s && s.ready)); }

function updateHeadChef(room) {
  if (room.headChef === null) {
    if (room.sandwiches[0]) room.headChef = 0;
    else if (room.sandwiches[1]) room.headChef = 1;
    return;
  }
  if (!room.sandwiches[room.headChef]) {
    const other = room.headChef === 0 ? 1 : 0;
    room.headChef = room.sandwiches[other] ? other : null;
  }
}

function broadcastPlayers(room) {
  updateHeadChef(room);
  broadcastBasket(room, {
    type: 'players',
    connected: connectedSlots(room),
    ready: readySlots(room),
    hostPlayer: room.headChef
  });
}

function startMatch(room) {
  room.cooking = true;
  room.health = [STARTING_HEALTH, STARTING_HEALTH];
  room.roundId = 0;
  room.roundNo = 0;
  room.qPos = 0;
  room.order = shuffleTray([...Array(QUESTION_BANK.length).keys()]);
  broadcastBasket(room, { type: 'start', health: room.health });
  nextRound(room);
}

function nextRound(room) {
  if (!room.cooking) return;
  room.roundId += 1;
  room.roundNo += 1;
  room.resolved = false;
  room.answered = [false, false];

  if (room.qPos >= room.order.length) room.qPos = 0;
  const q = QUESTION_BANK[room.order[room.qPos++]];
  room.currentQ = q;

  broadcastBasket(room, {
    type: 'question',
    roundId: room.roundId,
    roundNumber: room.roundNo,
    q: { question: q.question, a: q.choices[0], b: q.choices[1], c: q.choices[2] }
  });
}

function resolveRound(room, winnerOrNull) {
  if (room.resolved) return;
  room.resolved = true;

  let bite = 0;
  if (winnerOrNull !== null) {
    bite = DAMAGE_BITE;
    const loser = 1 - winnerOrNull;
    room.health[loser] = Math.max(0, room.health[loser] - DAMAGE_BITE);
  }

  broadcastBasket(room, {
    type: 'result',
    roundWinnerPlayer: winnerOrNull,
    correctIndex: room.currentQ.correctIndex,
    damage: bite,
    health: room.health
  });

  const winner =
    room.health[0] <= 0 ? 1 :
    room.health[1] <= 0 ? 0 :
    null;

  if (winner !== null) {
    room.cooking = false;
    broadcastBasket(room, { type: 'gameover', winnerPlayer: winner, health: room.health });
    return;
  }

  setTimeout(() => nextRound(room), 1100);
}

function handleAnswer(room, slice, roundId, choiceIndex) {
  if (!room.cooking) return;
  if (roundId !== room.roundId) return;
  if (room.resolved) return;
  if (room.answered[slice]) return;

  room.answered[slice] = true;
  const correct = (choiceIndex === room.currentQ.correctIndex);
  if (correct) {
    resolveRound(room, slice);
  } else {
    if (room.answered[0] && room.answered[1]) resolveRound(room, null);
  }
}

function removeSandwich(ws) {
  for (const [code, room] of pantry) {
    const idx = room.sandwiches.findIndex(s => s && s.socket === ws);
    if (idx !== -1) {
      room.sandwiches[idx] = null;

      if (room.cooking) {
        room.cooking = false;
        broadcastBasket(room, { type: 'gameover', winnerPlayer: null, health: room.health });
      } else {
        broadcastBasket(room, { type: 'opponent_left' });
      }

      broadcastPlayers(room);
      if (!room.sandwiches[0] && !room.sandwiches[1]) pantry.delete(code);
      return;
    }
  }
}

function joinRoom(ws, code) {
  if (!pantry.has(code)) pantry.set(code, newRoom(code));
  const room = pantry.get(code);

  const slot = room.sandwiches[0] ? (room.sandwiches[1] ? -1 : 1) : 0;
  if (slot === -1) {
    sendSauce(ws, { type: 'room_full' });
    return null;
  }

  room.sandwiches[slot] = { socket: ws, ready: false };
  if (room.headChef === null) room.headChef = slot;
  updateHeadChef(room);

  sendSauce(ws, { type: 'joined', roomCode: code, playerIndex: slot });
  broadcastPlayers(room);
  return room;
}

function toggleReady(room, slice) {
  const s = room.sandwiches[slice];
  if (!s) return;
  s.ready = !s.ready;
  broadcastBasket(room, { type:'ready_changed', playerIndex: slice, ready: s.ready });
  broadcastPlayers(room);
}

// Keepalive ping (helps on some hosts)
const PING_MS = 25000;
const pingTimer = setInterval(() => {
  waffleWSS.clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      try { ws.ping(); } catch {}
    }
  });
}, PING_MS);

waffleWSS.on('connection', (ws) => {
  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    const type = msg.type;
    const codeRaw = (msg.roomCode || '').toString().trim().toUpperCase();
    const code = codeRaw || makeRoomCode();

    if (type === 'create') {
      joinRoom(ws, code);
      return;
    }
    if (type === 'join') {
      if (!codeRaw) { sendSauce(ws, { type:'error', message:'Room code required.' }); return; }
      joinRoom(ws, codeRaw);
      return;
    }

    if (type === 'toggle_ready') {
      if (!codeRaw || !pantry.has(codeRaw)) return;
      const room = pantry.get(codeRaw);
      const slice = room.sandwiches.findIndex(s => s && s.socket === ws);
      if (slice === -1) return;
      if (room.cooking) { sendSauce(ws, { type:'error', message:'Cannot ready/unready during match.' }); return; }
      toggleReady(room, slice);
      return;
    }

    if (type === 'start_game') {
      if (!codeRaw || !pantry.has(codeRaw)) return;
      const room = pantry.get(codeRaw);
      const slice = room.sandwiches.findIndex(s => s && s.socket === ws);
      if (slice === -1) return;

      updateHeadChef(room);
      const ready = readySlots(room);

      if (!ready[0] || !ready[1]) { sendSauce(ws, { type:'error', message:'Both players must be Ready.' }); return; }
      if (slice !== room.headChef) { sendSauce(ws, { type:'error', message:'Only the host can start.' }); return; }
      if (room.cooking) { sendSauce(ws, { type:'error', message:'Game already started.' }); return; }

      startMatch(room);
      return;
    }

    if (type === 'answer') {
      if (!codeRaw || !pantry.has(codeRaw)) return;
      const room = pantry.get(codeRaw);
      const slice = room.sandwiches.findIndex(s => s && s.socket === ws);
      if (slice === -1) return;
      handleAnswer(room, slice, Number(msg.roundId), Number(msg.choiceIndex));
      return;
    }

    if (type === 'leave') {
      removeSandwich(ws);
      return;
    }
  });

  ws.on('close', () => removeSandwich(ws));
});

soupServer.listen(OVEN_PORT, () => console.log('Killer Quiz running on http://localhost:' + OVEN_PORT));
