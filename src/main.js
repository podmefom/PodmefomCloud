import WaveSurfer from 'https://unpkg.com/wavesurfer.js@7/dist/wavesurfer.esm.js';
import state from './data.js';
import { initVisualizer } from './visualizer.js';
import { loadPage } from './router.js';

let currentActiveInstance;
let likedTracks = JSON.parse(localStorage.getItem('likedTracks')) || [];
const players = {};

const wavesurferOptions = {
    waveColor: '#4F4A85',
    progressColor: '#6c5ce7',
    height: 40,
    barWidth: 2,
    cursorWidth: 0,
};

function formatTime(seconds) {
    if (!seconds) return "0:00";
    const minutes = Math.floor(seconds / 60);
    const secondsRemainder = Math.floor(seconds % 60);
    const s = secondsRemainder < 10 ? '0' + secondsRemainder : secondsRemainder;
    return minutes + ':' + s;
}

function updateBottomPlayer(track) {
    const title = document.querySelector('.current-track-title');
    const artist = document.querySelector('.current-track-artist');
    const img = document.querySelector('.current-track-img');
    const titleContainer = document.querySelector('.track-title-container');
    if (track) {
        if (title) {
            title.textContent = track.title;
            title.setAttribute('data-text', track.title);
            title.classList.toggle('scrolling', title.scrollWidth > titleContainer.offsetWidth);
        }
        if (artist) artist.textContent = track.artist;
        if (img) img.src = track.img;
    }
}

function toggleLikeState(trackId, likeIcon, countDisplay) {
    let currentCount = parseInt(countDisplay.textContent) || 0;
    const isLiked = likeIcon.classList.toggle('fa-solid');
    likeIcon.classList.toggle('fa-regular');
    countDisplay.textContent = isLiked ? currentCount + 1 : Math.max(0, currentCount - 1);
    const index = likedTracks.indexOf(trackId);
    if (index === -1) {
        likedTracks.push(trackId);
    } else {
        likedTracks.splice(index, 1);
    }
    localStorage.setItem('likedTracks', JSON.stringify(likedTracks));
}

function getOrCreatePlayer(container, audioUrl, icon, progressBar, durationBox) {
    if (players[audioUrl]) {
    players[audioUrl].setOptions({ container: container });
    return players[audioUrl];
    }

    const wavesurfer = WaveSurfer.create({
        ...wavesurferOptions,
        container: container,
        url: audioUrl,
    });

    players[audioUrl] = wavesurfer;

    wavesurfer.on('play', () => {
        icon.classList.replace('fa-play', 'fa-pause');
        const mainIcon = document.querySelector('#main-play-btn i');
        if (mainIcon) mainIcon.classList.replace('fa-play', 'fa-pause');
    });

    wavesurfer.on('pause', () => {
        icon.classList.replace('fa-pause', 'fa-play');
        const mainIcon = document.querySelector('#main-play-btn i');
        if (mainIcon) mainIcon.classList.replace('fa-pause', 'fa-play');
    });

    wavesurfer.on('timeupdate', (currentTime) => {
        const currentDisplay = document.querySelector('.current-time');
        if (currentDisplay) currentDisplay.textContent = formatTime(currentTime);
        const duration = wavesurfer.getDuration();
        if (duration && progressBar) progressBar.value = currentTime / duration;
    });

    wavesurfer.on('ready', () => {
        initVisualizer(wavesurfer);
        if (durationBox) durationBox.textContent = formatTime(wavesurfer.getDuration());
        const totalDisplay = document.querySelector('.total-duration');
        if (totalDisplay) totalDisplay.textContent = formatTime(wavesurfer.getDuration());
    });

    wavesurfer.on('finish', () => changeTrack(1));
    return wavesurfer;
}

function changeTrack(direction) {
    state.currentTrackIndex = (state.currentTrackIndex + direction + state.allTracks.length) % state.allTracks.length;
    const targetTrack = state.allTracks[state.currentTrackIndex];
    const targetBtn = document.querySelector(`[data-audio="${targetTrack.url}"]`);
    if (targetBtn) targetBtn.click();
}
 
export function initAudioPlayers() {
    const playButtons = document.querySelectorAll('.play-btn');
    const progressBar = document.getElementById('progress-bar');
    const globalVolume = document.getElementById('global-volume');
    
    playButtons.forEach(btn => {
        const card = btn.closest('.track-card, .beat-card');
        const container = card.querySelector('.waveform-container');
        const audioUrl = btn.getAttribute('data-audio');
        const icon = btn.querySelector('i');
        const durationBox = card.querySelector('.card-duration');
        const likeButton = card.querySelector('.like-stat');
        const likeIcon = likeButton?.querySelector('i');
        const countDisplay = likeButton?.querySelector('span');
        const knownTrack = state.allTracks.find(t => t.url === audioUrl);
        const trackInfo = knownTrack || {
            id: null,
            title: card.querySelector('.track-title')?.textContent?.trim() || 'Untitled',
            artist: card.querySelector('.track-author')?.textContent?.trim() || 'Unknown artist',
            url: audioUrl,
            img: card.querySelector('img')?.getAttribute('src') || '/images/1.jpg',
            description: 'Описание пока не добавлено.'
        };

        const wavesurfer = getOrCreatePlayer(container, audioUrl, icon, progressBar, durationBox);

        

        if (trackInfo && likeIcon && countDisplay && likedTracks.includes(trackInfo.id)) {
            likeIcon.classList.replace('fa-regular', 'fa-solid');
            countDisplay.textContent = (parseInt(countDisplay.textContent) || 0) + 1;
        }

        if (likeButton && trackInfo?.id && likeIcon && countDisplay) {
            likeButton.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleLikeState(trackInfo.id, likeIcon, countDisplay);
            });
        }

        card.addEventListener('click', (e) => {
            if (!e.target.closest('.play-btn') && !e.target.closest('.like-stat')) {
                showTrackPage(trackInfo);
            }
        });

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (currentActiveInstance && currentActiveInstance !== wavesurfer) {
                currentActiveInstance.pause();
            }
            wavesurfer.playPause();
            currentActiveInstance = wavesurfer;
            if (knownTrack) {
                state.currentTrackIndex = state.allTracks.indexOf(knownTrack);
            }
            updateBottomPlayer(trackInfo);
            currentActiveInstance.setVolume(globalVolume.value);
            initVisualizer(currentActiveInstance);
        });
    });
}

async function showTrackPage(track) {
    if(!track) return;

    await loadPage('track-page');

    const titleEl = document.querySelector('.full-track-title');
    const artistEl = document.querySelector('.full-track-artist');
    const coverEl = document.querySelector('.full-track-cover');
    const descEl = document.querySelector('.description-text');

    if (titleEl) titleEl.textContent = track.title;
    if (artistEl) artistEl.textContent = track.artist;
    if (coverEl) coverEl.src = track.img;
    if (descEl) descEl.textContent = track.description;

    const playMainBtn = document.querySelector('.play-main');

    playMainBtn.addEventListener('click', () => {
        let ws = players[track.url];

        if (!ws) {
            const hiddenContainer = document.createElement('div');
            hiddenContainer.style.display = 'none';
            document.body.appendChild(hiddenContainer);

            ws = WaveSurfer.create({
                ...wavesurferOptions,
                url: track.url,
                container: hiddenContainer,
            });
            players[track.url] = ws;
        }

        if (currentActiveInstance && currentActiveInstance !== ws) {
            currentActiveInstance.pause();
        }

        ws.playPause();
        currentActiveInstance = ws;
        
        updateBottomPlayer(track);
        initVisualizer(ws); 
    });

    const backBtn = document.querySelector('.back-btn');
    if (backBtn) {
        backBtn.addEventListener('click', async () => {
            await loadPage('main-page');
            initAudioPlayers(); 
            initMainPageEvents();
        });
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    await loadPage('main-page');
    initAudioPlayers();
    initPlayerControls(); 
    initMainPageEvents(); 
    
    document.addEventListener('click', async (e) => {
    const navBtn = e.target.closest('[data-page]');
    if (!navBtn) return;

    const page = navBtn.getAttribute('data-page');
    if (page === 'library') {
        await loadPage('library-page');

    } else if (page === 'main-page') {
        await loadPage('main-page');
        initAudioPlayers();
        initMainPageEvents();
    }
    });
});

function initPlayerControls() {
    const globalVolume = document.getElementById('global-volume');
    const progressBar = document.getElementById('progress-bar');


    globalVolume?.addEventListener('input', (e) => {
        currentActiveInstance?.setVolume(e.target.value);
    });

    const savedVolume = localStorage.getItem('volume');
    if (savedVolume !== null) globalVolume.value = savedVolume;

    globalVolume?.addEventListener('input', (e) => {
        currentActiveInstance?.setVolume(e.target.value);
        localStorage.setItem('volume', e.target.value);
    });

    progressBar?.addEventListener('input', (e) => {
        currentActiveInstance?.seekTo(parseFloat(e.target.value));
    });

    document.getElementById('prev-btn')?.addEventListener('click', () => changeTrack(-1));
    document.getElementById('next-btn')?.addEventListener('click', () => changeTrack(1));
    document.getElementById('main-play-btn')?.addEventListener('click', () => {
        currentActiveInstance ? currentActiveInstance.playPause() : document.querySelector('.play-btn')?.click();
    });
}

function initMainPageEvents() {
    const titleBtnTrack = document.getElementById('tab-tracks');
    const titleBtnBeats = document.getElementById('tab-beats');
    const tracksList = document.getElementById('tracks-list');
    const beatsList = document.getElementById('beats-list');

    titleBtnTrack?.addEventListener('click', () => {
        tracksList.style.display = "flex";
        beatsList.style.display = "none";
        titleBtnTrack.classList.add('active');
        titleBtnBeats.classList.remove('active');
    });

    titleBtnBeats?.addEventListener('click', () => {
        beatsList.style.display = "flex";
        tracksList.style.display = "none";
        titleBtnBeats.classList.add('active');
        titleBtnTrack.classList.remove('active');
    });
}

