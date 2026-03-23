const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, 'assets', 'audio')),
  filename: (req, file, cb) => {
    // keep original name, sanitize basic chars
    const name = file.originalname.replace(/[^a-zA-Z0-9._\- ]/g, '_');
    cb(null, name);
  }
});
const upload = multer({ storage });
const PORT = process.env.PORT || 3000;
const audioDir = path.join(__dirname, 'assets', 'audio');
const dbPath = path.join(__dirname, 'data', 'music.db');

// ensure data folder exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Could not open SQLite database:', err.message);
    process.exit(1);
  }
});

function initDb() {
  db.serialize(() => {
    db.run('PRAGMA foreign_keys = ON');

    db.run(`CREATE TABLE IF NOT EXISTS songs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      artist TEXT NOT NULL,
      file_path TEXT NOT NULL UNIQUE,
      play_count INTEGER NOT NULL DEFAULT 0
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS playlists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS playlist_songs (
      playlist_id INTEGER NOT NULL,
      song_id INTEGER NOT NULL,
      position INTEGER DEFAULT 0,
      PRIMARY KEY (playlist_id, song_id),
      FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
      FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
    )`);

    scanAndSyncSongs();
    ensureDefaultPlaylists();
  });
}

function parseSongFilename(filename) {
  const ext = path.extname(filename);
  const basename = path.basename(filename, ext);
  const parts = basename.split(' - ');
  if (parts.length >= 2) {
    return {
      artist: parts[0].trim(),
      title: parts.slice(1).join(' - ').trim(),
      file_path: `assets/audio/${filename}`
    };
  }
  return {
    artist: 'Unknown Artist',
    title: basename.trim(),
    file_path: `assets/audio/${filename}`
  };
}

function scanAndSyncSongs() {
  const supported = ['.ogg', '.mp3', '.wav', '.flac'];
  let files = [];
  try {
    files = fs.readdirSync(audioDir).filter((f) => supported.includes(path.extname(f).toLowerCase()));
  } catch (err) {
    console.error('Audio folder scan failed:', err.message);
    return;
  }

  const detectedPaths = files.map((f) => `assets/audio/${f}`);

  db.serialize(() => {
    db.all('SELECT id, file_path FROM songs', [], (err, rows) => {
      if (err) {
        console.error('DB select all error', err);
        return;
      }

      const knownPaths = new Set(rows.map((row) => row.file_path));
      const insertStmt = db.prepare('INSERT OR IGNORE INTO songs (title, artist, file_path) VALUES (?, ?, ?)');

      files.forEach((file) => {
        const parsed = parseSongFilename(file);
        if (!knownPaths.has(parsed.file_path)) {
          insertStmt.run(parsed.title, parsed.artist, parsed.file_path, (err2) => {
            if (err2) console.error('DB insert error', err2);
          });
        }
      });

      insertStmt.finalize((err2) => {
        if (err2) console.error('DB statement finalize error', err2);
      });

      rows.forEach((s) => {
        if (!detectedPaths.includes(s.file_path)) {
          db.run('DELETE FROM songs WHERE id = ?', s.id, (err3) => {
            if (err3) console.error('DB delete error', err3);
          });
        }
      });
    });
  });
}

function ensureDefaultPlaylists() {
  const defaults = {
    'chill': ['calamity kick', 'sunset pink clouds'],
    'focus': ['calamity kick', 'sf isnt a lie'],
    'workout': ['lalalatown', 'sf isnt a lie']
  };

  db.serialize(() => {
    const insertPlaylist = db.prepare('INSERT OR IGNORE INTO playlists (name) VALUES (?)');
    Object.keys(defaults).forEach((playlistName) => {
      insertPlaylist.run(playlistName);
    });
    insertPlaylist.finalize();

    db.all('SELECT id, name FROM playlists', [], (err, playlists) => {
      if (err) return console.error(err);

      playlists.forEach((playlist) => {
        const targetNames = defaults[playlist.name] || [];
        targetNames.forEach((songName, index) => {
          db.get('SELECT id FROM songs WHERE LOWER(title)=LOWER(?) LIMIT 1', [songName], (err2, songRow) => {
            if (err2 || !songRow) return;
            db.run('INSERT OR IGNORE INTO playlist_songs (playlist_id, song_id, position) VALUES (?, ?, ?)', [playlist.id, songRow.id, index]);
          });
        });
      });
    });
  });
}

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname)));
app.use('/audio', express.static(audioDir));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/songs', (req, res) => {
  db.all('SELECT * FROM songs ORDER BY title', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/songs/:id', (req, res) => {
  db.get('SELECT * FROM songs WHERE id = ?', [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Song not found' });
    res.json(row);
  });
});

app.post('/api/songs/:id/play', (req, res) => {
  db.run('UPDATE songs SET play_count = play_count + 1 WHERE id = ?', [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ updated: this.changes });
  });
});

app.get('/api/playlists', (req, res) => {
  db.all('SELECT * FROM playlists ORDER BY name', [], (err, playlists) => {
    if (err) return res.status(500).json({ error: err.message });

    const result = [];
    let done = 0;
    if (playlists.length === 0) return res.json([]);

    playlists.forEach((playlist) => {
      db.all(
        `SELECT songs.* FROM songs
         JOIN playlist_songs ON songs.id = playlist_songs.song_id
         WHERE playlist_songs.playlist_id = ?
         ORDER BY playlist_songs.position`,
        [playlist.id],
        (err2, songs) => {
          if (err2) {
            return res.status(500).json({ error: err2.message });
          }
          result.push({ ...playlist, songs });
          done += 1;
          if (done === playlists.length) {
            res.json(result);
          }
        }
      );
    });
  });
});

app.get('/api/playlists/:name', (req, res) => {
  const name = req.params.name.toLowerCase();
  db.get('SELECT * FROM playlists WHERE LOWER(name) = ?', [name], (err, playlist) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!playlist) return res.status(404).json({ error: 'Playlist not found' });

    db.all(
      `SELECT songs.* FROM songs
       JOIN playlist_songs ON songs.id = playlist_songs.song_id
       WHERE playlist_songs.playlist_id = ?
       ORDER BY playlist_songs.position`,
      [playlist.id],
      (err2, songs) => {
        if (err2) return res.status(500).json({ error: err2.message });
        res.json({ ...playlist, songs });
      }
    );
  });
});

app.post('/api/playlists', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Playlist name is required' });

  db.run('INSERT INTO playlists(name) VALUES(?)', [name], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ id: this.lastID, name });
  });
});

app.post('/api/playlists/:id/songs', (req, res) => {
  const playlistId = req.params.id;
  const { songIds } = req.body;
  if (!Array.isArray(songIds)) return res.status(400).json({ error: 'songIds array required' });

  const tx = db;
  tx.serialize(() => {
    const insert = tx.prepare('INSERT OR IGNORE INTO playlist_songs (playlist_id, song_id, position) VALUES (?, ?, ?)');
    songIds.forEach((songId, idx) => insert.run(playlistId, songId, idx));
    insert.finalize((err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ updated: songIds.length });
    });
  });
});

app.post('/api/upload', upload.array('files'), async (req, res) => {
  if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files uploaded' });

  const added = [];
  for (const file of req.files) {
    const parsed = parseSongFilename(file.filename);
    await new Promise((resolve) => {
      db.run('INSERT OR IGNORE INTO songs (title, artist, file_path) VALUES (?, ?, ?)', [parsed.title, parsed.artist, parsed.file_path], function (err) {
        if (err) {
          console.error('DB insert error on upload', err);
        } else if (this.changes > 0) {
          added.push(file.filename);
        }
        resolve();
      });
    });
  }

  res.json({ uploaded: req.files.length, added });
});

app.get('/api/audio/:id', (req, res) => {
  db.get('SELECT file_path FROM songs WHERE id = ?', [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Audio not found' });

    const fileLocation = path.join(__dirname, row.file_path);
    if (!fs.existsSync(fileLocation)) return res.status(404).json({ error: 'Audio file missing on disk' });

    res.sendFile(fileLocation);
  });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  initDb();
});
