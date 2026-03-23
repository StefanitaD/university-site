let songs = [];
let currentSongIndex = 0;
let isPlaying = false;

// DOM Elements
let audioPlayer;
let playBtn;
let pauseBtn;
let nextBtn;
let prevBtn;
let currentSongTitle;
let currentSongArtist;
let songList;
let progressBar;
let currentTimeDisplay;
let durationDisplay;
let dropZone;
let fileInput;

function getPlaylistType() {
  const currentPage = window.location.pathname.toLowerCase();
  if (currentPage.includes('playlist-chill')) return 'chill';
  if (currentPage.includes('playlist-focus')) return 'focus';
  if (currentPage.includes('playlist-workout')) return 'workout';
  return 'all';
}

function initDOMElements() {
  audioPlayer = document.getElementById('audioPlayer');
  playBtn = document.getElementById('playBtn');
  pauseBtn = document.getElementById('pauseBtn');
  nextBtn = document.getElementById('nextBtn');
  prevBtn = document.getElementById('prevBtn');
  currentSongTitle = document.getElementById('currentSongTitle');
  currentSongArtist = document.getElementById('currentSongArtist');
  songList = document.getElementById('songList');
  progressBar = document.getElementById('progressBar');
  currentTimeDisplay = document.getElementById('currentTime');
  durationDisplay = document.getElementById('duration');
  dropZone = document.getElementById('dropZone');
  fileInput = document.getElementById('fileInput');
}

function initUploadZone() {
  if (!dropZone || !fileInput) return;

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
    dropZone.textContent = 'Release to upload the files';
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
    dropZone.textContent = 'Drag and drop audio files here\nor click to select files';
  });

  dropZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const files = Array.from(e.dataTransfer.files).filter((file) => file.type.startsWith('audio/'));
    if (!files.length) {
      dropZone.textContent = 'Only audio files are supported';
      return;
    }
    await uploadFiles(files);
  });

  dropZone.addEventListener('click', () => {
    fileInput.click();
  });

  fileInput.addEventListener('change', async () => {
    if (fileInput.files.length === 0) return;
    const files = Array.from(fileInput.files).filter((file) => file.type.startsWith('audio/'));
    await uploadFiles(files);
    fileInput.value = '';
  });
}

async function uploadFiles(files) {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));

  try {
    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    if (!res.ok) {
      throw new Error(`Upload failed (${res.status})`);
    }
    const result = await res.json();
    dropZone.textContent = `Uploaded ${result.uploaded} file(s).`; 
    await refreshSongs();
  } catch (err) {
    dropZone.textContent = `Upload error: ${err.message}`;
  }
}

async function refreshSongs() {
  songs = await fetchSongs();
  if (songs.length === 0) return;
  currentSongIndex = 0;
  loadSong(currentSongIndex);
  renderSongList();
}

async function fetchSongs() {
  const playlistType = getPlaylistType();
  if (playlistType === 'all') {
    const response = await fetch('/api/songs');
    return response.ok ? response.json() : [];
  }

  const response = await fetch(`/api/playlists/${playlistType}`);
  if (!response.ok) return [];
  const playlist = await response.json();
  return playlist.songs || [];
}

async function initPlayer() {
  initDOMElements();
  initUploadZone();

  songs = await fetchSongs();
  if (!songs.length) {
    currentSongTitle.textContent = 'No songs found';
    currentSongArtist.textContent = 'Add files in assets/audio and restart server';
    return;
  }

  currentSongIndex = 0;
  loadSong(currentSongIndex);
  renderSongList();
  attachEventListeners();
}

function loadSong(index) {
  if (!songs || !songs.length) return;
  currentSongIndex = (index + songs.length) % songs.length;
  const song = songs[currentSongIndex];
  audioPlayer.src = `/api/audio/${song.id}`;
  updateNowPlaying();
  highlightCurrentSong();
  postPlayCount(song.id).catch(() => {});
}

function updateNowPlaying() {
  const song = songs[currentSongIndex];
  currentSongTitle.textContent = song.title;
  currentSongArtist.textContent = `${song.artist} • Played ${song.play_count || 0} times`;
}

function highlightCurrentSong() {
  const songItems = document.querySelectorAll('.song-item');
  songItems.forEach((item, index) => {
    item.classList.toggle('active', index === currentSongIndex);
  });
}

function renderSongList() {
  songList.innerHTML = '';
  songs.forEach((song, index) => {
    const li = document.createElement('li');
    li.className = 'song-item';
    if (index === currentSongIndex) li.classList.add('active');
    li.innerHTML = `<strong>${song.artist}</strong> - ${song.title} <span class="playcount">(${song.play_count || 0})</span>`;
    li.addEventListener('click', () => {
      loadSong(index);
      play();
    });
    songList.appendChild(li);
  });
}

function play() {
  audioPlayer.play();
  isPlaying = true;
  updatePlayPauseButtons();
}

function pause() {
  audioPlayer.pause();
  isPlaying = false;
  updatePlayPauseButtons();
}

function nextSong() {
  loadSong(currentSongIndex + 1);
  play();
}

function prevSong() {
  loadSong(currentSongIndex - 1);
  play();
}

function updatePlayPauseButtons() {
  playBtn.style.display = isPlaying ? 'none' : 'inline-block';
  pauseBtn.style.display = isPlaying ? 'inline-block' : 'none';
}

function attachEventListeners() {
  playBtn.addEventListener('click', play);
  pauseBtn.addEventListener('click', pause);
  nextBtn.addEventListener('click', nextSong);
  prevBtn.addEventListener('click', prevSong);

  audioPlayer.addEventListener('ended', nextSong);
  audioPlayer.addEventListener('play', () => {
    isPlaying = true;
    updatePlayPauseButtons();
  });
  audioPlayer.addEventListener('pause', () => {
    isPlaying = false;
    updatePlayPauseButtons();
  });

  audioPlayer.addEventListener('timeupdate', updateProgressBar);
  audioPlayer.addEventListener('loadedmetadata', updateDuration);

  progressBar.addEventListener('change', seek);
  progressBar.addEventListener('input', (e) => {
    if (audioPlayer.duration) {
      currentTimeDisplay.textContent = formatTime((e.target.value / 100) * audioPlayer.duration);
    }
  });
}

function updateProgressBar() {
  if (!audioPlayer.duration) return;
  const percent = (audioPlayer.currentTime / audioPlayer.duration) * 100;
  progressBar.value = percent;
  updateTimeDisplay();
}

function updateTimeDisplay() {
  currentTimeDisplay.textContent = formatTime(audioPlayer.currentTime);
  durationDisplay.textContent = formatTime(audioPlayer.duration);
}

function updateDuration() {
  if (!audioPlayer.duration) {
    durationDisplay.textContent = '0:00';
    return;
  }
  durationDisplay.textContent = formatTime(audioPlayer.duration);
}

function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function seek(e) {
  if (!audioPlayer.duration) return;
  audioPlayer.currentTime = (e.target.value / 100) * audioPlayer.duration;
}

async function postPlayCount(songId) {
  await fetch(`/api/songs/${songId}/play`, { method: 'POST' });
}

document.addEventListener('DOMContentLoaded', initPlayer);
