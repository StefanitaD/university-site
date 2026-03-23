# University Site

A music streaming web app for a university project (full-stack with Node.js + Express + SQLite). The app now uses a backend API and serves audio files with database-based metadata.

Project structure:

- `index.html` - main landing page.
- `pages/` - playlist pages.
- `styles/` - CSS files.
- `js/` - JavaScript code.
- `assets/audio/` - source audio files.
- `server.js` - Node/Express server plus SQLite sync logic.
- `data/music.db` (created at runtime) - SQLite database for songs and playlists.

Usage
-----

1. Install Node.js (>=18) and npm.
2. From the project root:

```bash
npm install
npm start
```

3. Open `http://localhost:3000` in your browser.

Start/Stop Server
-----------------

To start the project server:

```bash
cd "..\university-site"
npm start
```

Or:

```bash
node server.js
```

To stop the server:

- Press `Ctrl+C` in the terminal where it is running.
- If the process is detached, find and kill it by PID:

  - Windows:
```bash
tasklist /FI "IMAGENAME eq node.exe" 
ntaskkill /PID <PID> /F
```


API Endpoints
-------------

- `GET /api/health` → `{ status: 'ok' }`
- `GET /api/songs` → list of songs
- `GET /api/songs/:id` → song metadata
- `POST /api/songs/:id/play` → increments play count
- `GET /api/playlists` → playlists + song membership
- `GET /api/playlists/:name` → named playlist songs
- `GET /api/audio/:id` → stream audio file
- `POST /api/upload` → upload audio files (multipart/form-data `files`)

The UI now loads songs from the API and plays via `/api/audio/:id`.

Drag & Drop Upload
------------------

On each page, there is a drag-and-drop uploader in the left navigation. You can drag your local audio files and drop them there, or click to use the file picker. Files are saved to `assets/audio` and automatically added to the database.
Legacy static-use note:

If you still need quick static-view mode, you can run:

```bash
python -m http.server 8000
```

and open `http://localhost:8000`.

Contributing
------------

Edit the HTML/JS files and refresh the browser to see changes. For backend improvements, edit `server.js`.

---
Created for a university project.
