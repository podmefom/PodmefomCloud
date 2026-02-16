import WaveSurfer from 'wavesurfer.js'

export const wavesurfer = WaveSurfer.create({
    ...wavesurferOptions,
    container: container,
    url: audioUrl,
    });