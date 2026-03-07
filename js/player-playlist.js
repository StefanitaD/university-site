// All Available Songs
const allSongs = [
  {
    id: 1,
    title: 'calamity kick',
    artist: 'monplaisir',
    file: '../assets/audio/monplaisir - calamity kick.ogg'
  },
  {
    id: 2,
    title: 'lalalatown',
    artist: 'monplaisir',
    file: '../assets/audio/monplaisir - lalalatown.ogg'
  },
  {
    id: 3,
    title: 'sf isnt a lie',
    artist: 'monplaisir',
    file: '../assets/audio/monplaisir - sf isnt a lie.ogg'
  },
  {
    id: 4,
    title: 'sunset pink clouds',
    artist: 'monplaisir',
    file: '../assets/audio/monplaisir - sunset pink clouds.ogg'
  }
];

// Playlist Song Definitions
const playlistSongs = {
  'chill': [ // calamity kick, sunset pink clouds
    allSongs[0],
    allSongs[3]
  ],
  'focus': [ // calamity kick, sf isnt a lie
    allSongs[0],
    allSongs[2]
  ],
  'workout': [ // lalalatown, sf isnt a lie
    allSongs[1],
    allSongs[2]
  ]
};

// Detect which playlist we're on
function getPlaylistType() {
  const currentPage = window.location.pathname;
  if (currentPage.includes('playlist-chill')) return 'chill';
  if (currentPage.includes('playlist-focus')) return 'focus';
  if (currentPage.includes('playlist-workout')) return 'workout';
  return 'all';
}

// Player State
let currentSongIndex = 0;
let isPlaying = false;
let currentPlaylist = [];

// DOM Elements (will be initialized when DOM is ready)
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

// Initialize DOM References
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
}

// Initialize Player
function initPlayer() {
  initDOMElements();
  
  // Load appropriate playlist
  const playlistType = getPlaylistType();
  if (playlistType === 'all') {
    currentPlaylist = allSongs;
  } else {
    currentPlaylist = playlistSongs[playlistType];
  }
  
  loadSong(currentSongIndex);
  renderSongList();
  attachEventListeners();
}

// Load Song
function loadSong(index) {
  const song = currentPlaylist[index];
  audioPlayer.src = song.file;
  updateNowPlaying();
  highlightCurrentSong();
}

// Update Now Playing Display
function updateNowPlaying() {
  const song = currentPlaylist[currentSongIndex];
  currentSongTitle.textContent = song.title;
  currentSongArtist.textContent = song.artist;
}

// Highlight Current Song in List
function highlightCurrentSong() {
  const songItems = document.querySelectorAll('.song-item');
  songItems.forEach((item, index) => {
    item.classList.remove('active');
    if (index === currentSongIndex) {
      item.classList.add('active');
    }
  });
}

// Render Song List
function renderSongList() {
  songList.innerHTML = '';
  currentPlaylist.forEach((song, index) => {
    const li = document.createElement('li');
    li.className = 'song-item';
    if (index === currentSongIndex) {
      li.classList.add('active');
    }
    li.innerHTML = `<strong>${song.artist}</strong> - ${song.title}`;
    li.addEventListener('click', () => {
      currentSongIndex = index;
      loadSong(currentSongIndex);
      play();
    });
    songList.appendChild(li);
  });
}

// Play Function
function play() {
  audioPlayer.play();
  isPlaying = true;
  updatePlayPauseButtons();
}

// Pause Function
function pause() {
  audioPlayer.pause();
  isPlaying = false;
  updatePlayPauseButtons();
}

// Next Song
function nextSong() {
  currentSongIndex = (currentSongIndex + 1) % currentPlaylist.length;
  loadSong(currentSongIndex);
  play();
}

// Previous Song
function prevSong() {
  currentSongIndex = (currentSongIndex - 1 + currentPlaylist.length) % currentPlaylist.length;
  loadSong(currentSongIndex);
  play();
}

// Update Play/Pause Button States
function updatePlayPauseButtons() {
  if (isPlaying) {
    playBtn.style.display = 'none';
    pauseBtn.style.display = 'inline-block';
  } else {
    playBtn.style.display = 'inline-block';
    pauseBtn.style.display = 'none';
  }
}

// Auto-play Next Song When Current Ends
function attachEventListeners() {
  playBtn.addEventListener('click', play);
  pauseBtn.addEventListener('click', pause);
  nextBtn.addEventListener('click', nextSong);
  prevBtn.addEventListener('click', prevSong);

  // Auto-advance to next song when current ends
  audioPlayer.addEventListener('ended', nextSong);

  // Update buttons on play/pause
  audioPlayer.addEventListener('play', () => {
    isPlaying = true;
    updatePlayPauseButtons();
  });

  audioPlayer.addEventListener('pause', () => {
    isPlaying = false;
    updatePlayPauseButtons();
  });

  // Update progress bar and time display
  audioPlayer.addEventListener('timeupdate', updateProgressBar);
  audioPlayer.addEventListener('loadedmetadata', updateDuration);

  // Allow seeking via progress bar
  progressBar.addEventListener('change', seek);
  progressBar.addEventListener('input', function(e) {
    // Only update display while dragging, don't sync back to audio
    if (audioPlayer.duration) {
      currentTimeDisplay.textContent = formatTime((e.target.value / 100) * audioPlayer.duration);
    }
  });
}

// Update progress bar
function updateProgressBar() {
  if (audioPlayer.duration) {
    const percent = (audioPlayer.currentTime / audioPlayer.duration) * 100;
    progressBar.value = percent;
    updateTimeDisplay();
  }
}

// Update time display
function updateTimeDisplay() {
  currentTimeDisplay.textContent = formatTime(audioPlayer.currentTime);
  durationDisplay.textContent = formatTime(audioPlayer.duration);
}

// Format time (seconds to MM:SS)
function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
}

// Seek to position
function seek(e) {
  if (audioPlayer.duration) {
    const percent = e.target.value / 100;
    audioPlayer.currentTime = percent * audioPlayer.duration;
  }
}

// Update duration display on metadata load
function updateDuration() {
  durationDisplay.textContent = formatTime(audioPlayer.duration);
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', initPlayer);
