import WaveSurfer from 'https://unpkg.com/wavesurfer.js@7/dist/wavesurfer.esm.js';
import state from './data.js';
import { initVisualizer } from './visualizer.js';
import { loadPage } from './router.js';
import { supabase } from './supabaseClient.js';
import { handleLogout } from './auth.js';

async function testConnection() {
    const { data, error } = await supabase
        .from('tracks')
        .select('*');

    if (error) {
        console.error('Ошибка связи с базой:', error.message);
    } else {
        console.log('Связь установлена! Твои треки из базы:', data);
        state.allTracks = data;
        await RenderTrackCards();
        return data;
    }
}

testConnection();


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

async function updateBottomPlayer(track) {
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
        if (img) img.src = track.cover_url;
    }
}

async function parkActivePlayer() {
    if (currentActiveInstance) {
        currentActiveInstance.setOptions({container: '#player-storage'});
    }
}

async function toggleLikeState(trackId, likeIcon, countDisplay) {
    const indexInLiked = likedTracks.indexOf(String(trackId));
    const isAlreadyLikedByMe = indexInLiked !== -1;
    const trackInState = state.allTracks.find(t => String(t.id) === String(trackId));

    if (!trackInState) return;

    if (isAlreadyLikedByMe) {
        trackInState.likes_count = Math.max(0, (trackInState.likes_count || 0) - 1);
        likedTracks.splice(indexInLiked, 1);
        likeIcon.classList.replace('fa-solid', 'fa-regular');
    } else {
        trackInState.likes_count = (trackInState.likes_count || 0) + 1;
        likedTracks.push(String(trackId));
        likeIcon.classList.replace('fa-regular', 'fa-solid');
    }

    countDisplay.textContent = trackInState.likes_count;
    localStorage.setItem('likedTracks', JSON.stringify(likedTracks));

    const { error } = await supabase
        .from('tracks')
        .update({ likes_count: trackInState.likes_count })
        .eq('id', trackId);

    if (error) {
        console.error('Не удалось сохранить лайк в базе:', error.message);
    }

    await supabase.from('tracks').update({ likes_count: trackInState.likes_count }).eq('id', trackId);
}

async function getOrCreatePlayer(container, audioUrl, icon, progressBar, durationBox) {

    const safeContainer = container || document.createElement('div');
    
    if (players[audioUrl]) {
        if (container) {
            players[audioUrl].setOptions({ container: safeContainer });
        }
        return players[audioUrl];
    }

    const wavesurfer = WaveSurfer.create({
        ...wavesurferOptions,
        container: safeContainer,
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
    const targetBtn = document.querySelector(`[data-audio="${targetTrack.audio_url}"]`);
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

export async function initAudioPlayers() {
    const tracksList = document.getElementById('tracks-list');
    const beatsList = document.getElementById('beats-list');

    const handleListCheck = async (e) => {
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

            const ws = await getOrCreatePlayer(container, audioUrl, icon);

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

    [tracksList, beatsList].forEach(list => {
        if (!list) return;
        const newList = list.cloneNode(true);
        list.replaceWith(newList);
        newList.addEventListener('click', handleListCheck);
    });

    tracksList?.replaceWith(tracksList.cloneNode(true)); 
    beatsList?.replaceWith(beatsList.cloneNode(true)); 

    document.getElementById('tracks-list')?.addEventListener('click', handleListCheck);
    document.getElementById('beats-list')?.addEventListener('click', handleListCheck);
}

async function initAddTrackPage() {
    await loadPage('add-track');

    const audioInput = document.getElementById('track-url'); 
    const imgInput = document.getElementById('track-img');
    const previewBox = document.getElementById('preview-box'); 

    imgInput?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const url = URL.createObjectURL(file);
            if (previewBox) {
                previewBox.innerHTML = `<img src="${url}" style="max-width: 100%; border-radius: 8px;">`;
            }
        }
    });

    const form = document.getElementById('add-track-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const audioFile = document.getElementById('track-url').files[0];
        const imgFile = document.getElementById('track-img').files[0];
        const titleText = document.getElementById('track-title').value;
        const artistText = document.getElementById('track-artist').value;
        const descText = document.getElementById('track-desc').value;
        
        if (!audioFile || !imgFile) {
            alert("Бля, выбери и музыку, и обложку!");
            return;
        }

        const submitBtn = form.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn.textContent;
        submitBtn.textContent = 'Загружаем в облако...';
        submitBtn.disabled = true;

        try {
            const audioPath = `${Date.now()}_${audioFile.name}`;
            const imgPath = `${Date.now()}_${imgFile.name}`;

            const { error: audioError } = await supabase.storage
                .from('audio-files')
                .upload(audioPath, audioFile);
            if (audioError) throw audioError;

            const { error: imgError } = await supabase.storage
                .from('covers')
                .upload(imgPath, imgFile);
            if (imgError) throw imgError;

            const audioUrl = supabase.storage.from('audio-files').getPublicUrl(audioPath).data.publicUrl;
            const imgUrl = supabase.storage.from('covers').getPublicUrl(imgPath).data.publicUrl;
            const category = document.getElementById('track-category').value;

            console.log("Ссылка на аудио:", audioUrl);

            const { data: newTrackData, error: dbError } = await supabase
                .from('tracks')
                .insert([{
                    title: titleText,
                    artist: artistText, 
                    audio_url: audioUrl,
                    cover_url: imgUrl,
                    description: descText,
                    category: category,
                    likes_count: 0
                }])
                .select(); 

            if (dbError) throw dbError;

            if (newTrackData && newTrackData.length > 0) {
                state.allTracks.push(newTrackData[0]);
            }

            document.querySelector('[data-page="main-page"]').click();

        } catch (error) {
            console.error('Ошибка загрузки:', error);
            alert('Случилась хуйня при загрузке: ' + error.message);
        } finally {
            submitBtn.textContent = originalBtnText;
            submitBtn.disabled = false;
        }
    });
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
                    <img src="${track.cover_url}" alt="Cover">
                    <div class="card-top-titles">
                        <h3 class="track-title">${track.title}</h3>
                        <h3 class="track-author">${track.artist}</h3>
                    </div>
                </div>
                <div class="card-mid">
                    <div class="waveform-container" id="waveform-${track.id}"></div>
                </div>
                <div class="card-bottom">
                    <button class="play-btn" data-audio="${track.audio_url}">
                        <i class="fas fa-play"></i>
                    </button>
                    
                    <button class="like-stat">
                        <i class="${isAlreadyLiked ? 'fas' : 'far'} fa-heart"></i>
                        <span>${track.likes_count || 0}</span>
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
    if (!track) return;
    
    await loadPage('track-page'); 

    setTimeout(() => {
        const titleEl = document.querySelector('.full-track-title');
        const artistEl = document.querySelector('.full-track-artist');
        const coverEl = document.querySelector('.full-track-cover');
        const descEl = document.querySelector('.description-text');
        const pageSection = document.querySelector('.track-page-view');
        const backBtn = document.querySelector('.back-btn-simple');
        const playMainBtn = document.querySelector('.play-main');

        console.log("Элементы найдены:", { titleEl, artistEl, coverEl, backBtn });

        if (pageSection) pageSection.classList.add('active');

        if (titleEl) titleEl.textContent = track.title;
        if (artistEl) artistEl.textContent = track.artist;
        if (coverEl) coverEl.src = track.cover_url;
        if (descEl) descEl.textContent = track.description;

        if (backBtn) {
            backBtn.onclick = async () => {
                parkActivePlayer();
                await loadPage('main-page');
                await RenderTrackCards();
                initAudioPlayers(); 
                initMainPageEvents(); 
            };
        }

        if (playMainBtn) {
            playMainBtn.onclick = async () => {
                let ws = await getOrCreatePlayer(null, track.audio_url);
                if (currentActiveInstance && currentActiveInstance !== ws) {
                    currentActiveInstance.pause();
                }
                ws.playPause();
                currentActiveInstance = ws;
                updateBottomPlayer(track);
                initVisualizer(ws); 
            };
        }
    }, 60); 
}

document.addEventListener("DOMContentLoaded", async () => {

    const savedTracks = localStorage.getItem('my_tracks');

    state.allTracks = await testConnection();

    await loadPage('main-page');
    await RenderTrackCards();
    initAudioPlayers();
    initPlayerControls(); 
    initMainPageEvents(); 
    
    document.addEventListener('click', async (e) => {
        const { data: { session } } = await supabase.auth.getSession();
        const navBtn = e.target.closest('[data-page]');
        if (!navBtn) return;
        parkActivePlayer()
        const page = navBtn.getAttribute('data-page');
        
        if (page === 'add-track') {
            initAddTrackPage();
        } else if (page === "profile") {
            if (session) {
                await loadPage('library-page');
                initLibraryEvents();
            } else {
                const authView = document.querySelector('.auth-view');
                if (authView) authView.style.display = "flex";
            }
            
        }
    });

    if (window.updateHeaderText) {
        await window.updateHeaderText();
    }
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

function initLibraryEvents() {
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            if (confirm("Выходим?")) {
                handleLogout();
            }
        })
    }
};

export async function refreshMainPage() {
    state.allTracks = await testConnection();
    await RenderTrackCards();
    
    initAudioPlayers();
    
    initMainPageEvents();
    
    console.log("Главная страница успешно инициализирована!");
}

window.refreshMainPage = refreshMainPage;
