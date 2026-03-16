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
            const isOverflowing = titleContainer ? title.scrollWidth > titleContainer.offsetWidth : false;
            title.classList.toggle('scrolling', isOverflowing);
        }
        if (artist) artist.textContent = track.artist;
        if (img) img.src = track.img;
    }
}

async function parkActivePlayer() {
    if (currentActiveInstance) {
        currentActiveInstance.setOptions({container: '#player-storage'});
    }
}

function toggleLikeState(trackId, likeIcon, countDisplay) {
    const indexInLiked = likedTracks.indexOf(String(trackId));
    const isAlreadyLikedByMe = indexInLiked !== -1;

    const trackInState = state.allTracks.find(t => String(t.id) === String(trackId));

    if (!trackInState) return;

    if (isAlreadyLikedByMe) {
        trackInState.likesCount = Math.max(0, (trackInState.likesCount || 0) - 1);
        likedTracks.splice(indexInLiked, 1); 
        
        likeIcon.classList.replace('fa-solid', 'fa-regular');
        likeIcon.classList.replace('fas', 'far'); 
    } else {
        trackInState.likesCount = (trackInState.likesCount || 0) + 1;
        likedTracks.push(String(trackId)); 
        
        likeIcon.classList.replace('fa-regular', 'fa-solid');
        likeIcon.classList.replace('far', 'fas');
    }

    countDisplay.textContent = trackInState.likesCount;
    SaveTracks();
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
        backend: 'WebAudio',
    });

    
    players[audioUrl] = wavesurfer;

    wavesurfer.on('play', () => {
        if (icon) icon.classList.replace('fa-play', 'fa-pause');
        const mainIcon = document.querySelector('#main-play-btn i');
        if (mainIcon) mainIcon.classList.replace('fa-play', 'fa-pause');
    });

    wavesurfer.on('pause', () => {
        if (icon) icon.classList.replace('fa-pause', 'fa-play');
        const mainIcon = document.querySelector('#main-play-btn i');
        if (mainIcon) mainIcon.classList.replace('fa-pause', 'fa-play');
    });

    wavesurfer.on('timeupdate', (currentTime) => {
        const currentDisplay = document.querySelector('.current-time');
        if (currentDisplay) currentDisplay.textContent = formatTime(currentTime);
        const duration = wavesurfer.getDuration();
        if (duration && progressBar) progressBar.value = currentTime / duration;
    });

    const globalVol = document.getElementById('global-volume')?.value || 0.5;
    wavesurfer.setVolume(globalVol);

    wavesurfer.on('ready', () => {
        const currentVol = document.getElementById('global-volume')?.value || 0.5;
        wavesurfer.setVolume(currentVol);
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

function preloadWaveforms() {
    setTimeout(() => {
        const cards = document.querySelectorAll('.track-card');

        cards.forEach(card => {
            const container = card.querySelector('.waveform-container');
            const playBtn = card.querySelector('.play-btn');
            const audioUrl = playBtn?.getAttribute('data-audio');

            if (container && audioUrl) {
                if (players[audioUrl]) {
                    players[audioUrl].setOptions({ container: container });
                } else {
                    getOrCreatePlayer(container, audioUrl);
                }
            }
        });
    }, 100); 
}

export function initAudioPlayers() {
    const tracksList = document.getElementById('tracks-list');
    const beatsList = document.getElementById('beats-list');

    const handleListCheck = (e) => {
        const card = e.target.closest('.track-card, .beat-card');
        if (!card) return;

        const playBtn = e.target.closest('.play-btn');
        const likeBtn = e.target.closest('.like-stat');

        const cardTop = card.querySelector('.card-top');
        const trackId = cardTop ? cardTop.getAttribute('data-id') : null;
        const trackInfo = state.allTracks.find(t => String(t.id) === String(trackId));

        if (!trackInfo) return;

        if (playBtn) {
            e.stopPropagation();
            const audioUrl = playBtn.getAttribute('data-audio');
            const container = card.querySelector('.waveform-container');
            const icon = playBtn.querySelector('i');

            const ws = getOrCreatePlayer(container, audioUrl, icon);

            if (currentActiveInstance && currentActiveInstance !== ws) {
                currentActiveInstance.pause();
                currentActiveInstance.setTime(0);

                const progressBar = document.getElementById('progress-bar');
                if (progressBar) progressBar.value = 0;
                
                const currentDisplay = document.querySelector('.current-time');
                if (currentDisplay) currentDisplay.textContent = "0:00";
            }

            ws.playPause();
            currentActiveInstance = ws;
            updateBottomPlayer(trackInfo);
            return;
        }

        if (likeBtn) {
            e.stopPropagation();
            const likeIcon = likeBtn.querySelector('i');
            const countDisplay = likeBtn.querySelector('span');
            toggleLikeState(trackId, likeIcon, countDisplay);
            return; 
        }

        const waveform = e.target.closest('.waveform-container');
        if (waveform) {
            e.stopPropagation();
            return
        }



        parkActivePlayer();
        showTrackPage(trackInfo);
    };

    tracksList?.replaceWith(tracksList.cloneNode(true)); 
    beatsList?.replaceWith(beatsList.cloneNode(true)); 

    document.getElementById('tracks-list')?.addEventListener('click', handleListCheck);
    document.getElementById('beats-list')?.addEventListener('click', handleListCheck);
}

async function initAddTrackPage() {
    const toBase64 = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
    });

    await loadPage('add-track');

    const audioInput = document.getElementById('track-url'); 
    const imgInput = document.getElementById('track-img');

    const form = document.getElementById('add-track-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const audioFile = document.getElementById('track-url').files[0];
        const imgFile = document.getElementById('track-img').files[0];
        
        if (!audioFile || !imgFile) {
            alert("Бля, выбери и музыку, и обложку!");
            return;
        }

        imgInput?.addEventListener('input', (e)  => {
            const url = e.target.value;
            if (url) {
                previewBox.innerHTML = `<img src="${url}" onerror="this.src=''; this.parentElement.innerHTML='Ошибка ссылки'">`;
            } else {
                previewBox.innerHTML = `<span>Превью обложки</span>`;
            }
        });

        const audioBase64 = await toBase64(audioFile);
        const imgBase64 = await toBase64(imgFile);


        const newTrack = {
            id: Date.now(),
            title: document.getElementById('track-title').value,
            artist: document.getElementById('track-artist').value,
            url: audioBase64,
            img: imgBase64,
            description: document.getElementById('track-desc').value,
            category: 'track'
        };

        state.allTracks.push(newTrack);
        SaveTracks();

        alert('Трек добавлен!');

        document.querySelector('[data-page="main-page"]').click();
    });
}

async function SaveTracks() {
    const data = JSON.stringify(state.allTracks);

    localStorage.setItem('my_tracks', data);
}

async function RenderTrackCards() {
    const trackContainer = document.getElementById('tracks-list');
    const beatContainer = document.getElementById('beats-list');

    if (!trackContainer) return;
    if (!beatContainer) return;

    trackContainer.innerHTML = '';
    beatContainer.innerHTML = '';

    const isLiked = JSON.parse(localStorage.getItem('likedTracks')) || [];
    console.log(isLiked)

    state.allTracks.forEach(track => {
        const isAlreadyLiked = isLiked.includes(String(track.id));

        const trackHtml = `
            <div class="track-card">
                <div class="card-top" data-id="${track.id}">
                    <img src="${track.img}" alt="Cover">
                    <div class="card-top-titles">
                        <h3 class="track-title">${track.title}</h3>
                        <h3 class="track-author">${track.artist}</h3>
                    </div>
                </div>
                <div class="card-mid">
                    <div class="waveform-container" id="waveform-${track.id}"></div>
                </div>
                <div class="card-bottom">
                    <button class="play-btn" data-audio="${track.url}">
                        <i class="fas fa-play"></i>
                    </button>
                    
                    <button class="like-stat">
                        <i class="${isAlreadyLiked ? 'fas' : 'far'} fa-heart"></i>
                        <span>${track.likesCount || 0}</span>
                    </button>
                </div>
            </div>
        `;

        if (track.category === 'beat') {
            beatContainer.insertAdjacentHTML('beforeend', trackHtml);
        } else {
            trackContainer.insertAdjacentHTML('beforeend', trackHtml);
        }
    });
    preloadWaveforms();
}

async function showTrackPage(track) {
    if(!track) return;
    console.log("Пытаюсь загрузить страницу для:", track.title);
    
    await loadPage('track-page');
    const pageSection = document.querySelector('.track-page-view');
    if (pageSection) pageSection.classList.add('active');

    const titleEl = document.querySelector('.full-track-title');
    console.log("Найден ли заголовок?", titleEl);
    const artistEl = document.querySelector('.full-track-artist');
    const coverEl = document.querySelector('.full-track-cover');
    const descEl = document.querySelector('.description-text');

    if (titleEl) titleEl.textContent = track.title;
    if (artistEl) artistEl.textContent = track.artist;
    if (coverEl) coverEl.src = track.img;
    if (descEl) descEl.textContent = track.description;

    const playMainBtn = document.querySelector('.play-main');

    if (playMainBtn) {
        playMainBtn.addEventListener('click', () => {
            let ws = players[track.url];

            if (!ws) {
                const hiddenContainer = document.createElement('div');
                hiddenContainer.style.display = 'none';
                document.body.appendChild(hiddenContainer);

                ws = WaveSurfer.create({
                    url: track.url,
                    container: hiddenContainer,
                    ...wavesurferOptions
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
    }


    const backBtn = document.querySelector('.back-btn');
    if (backBtn) {
        backBtn.addEventListener('click', async () => {
            parkActivePlayer();
            await loadPage('main-page');
            await RenderTrackCards();
            initAudioPlayers(); 
            initMainPageEvents();
        });
    }
}

document.addEventListener("DOMContentLoaded", async () => {

    const savedTracks = localStorage.getItem('my_tracks');

    if (savedTracks) {
        state.allTracks = JSON.parse(savedTracks);
    }

    await loadPage('main-page');
    await RenderTrackCards();
    initAudioPlayers();
    initPlayerControls(); 
    initMainPageEvents(); 
    
    document.addEventListener('click', async (e) => {
    const navBtn = e.target.closest('[data-page]');
    if (!navBtn) return;
    parkActivePlayer()
    const page = navBtn.getAttribute('data-page');
    if (page === 'library') {
        await loadPage('library-page');

    } else if (page === 'main-page') {
        await loadPage('main-page');
        await RenderTrackCards();
        initAudioPlayers();
        initMainPageEvents();
    } else if (page === 'add-track') {
        initAddTrackPage();
    }
    });
});

function initPlayerControls() {
    const globalVolume = document.getElementById('global-volume');
    const progressBar = document.getElementById('progress-bar');

    const savedVolume = localStorage.getItem('volume') || 0.5;
    if (globalVolume) globalVolume.value = savedVolume;

    globalVolume?.addEventListener('input', (e) => {
        const val = e.target.value;
        Object.values(players).forEach(ws => {
            ws.setVolume(val);
        });
        localStorage.setItem('volume', val);
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

