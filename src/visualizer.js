let isInitialized = false;
let source, analyser, audioContext;

export function initVisualizer(wavesurfer) {
    if (!wavesurfer) return;

    const canvas = document.getElementById('visualizer');
    if (!canvas) return;
    const canvasCtx = canvas.getContext('2d');
    
    const audio = wavesurfer.getMediaElement();
    const ctx = wavesurfer.backend.getAudioContext();

    if (!source) {
        analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8; 

        source = ctx.createMediaElementSource(audio);
        
        source.connect(analyser);
        analyser.connect(ctx.destination);
    }

    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    if (!isInitialized) {
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        function draw() {
            requestAnimationFrame(draw);
            analyser.getByteFrequencyData(dataArray);
            
            canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
            
            let barWidth = (canvas.width / bufferLength) * 2.5;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                const h = (dataArray[i] / 255) * canvas.height;
                canvasCtx.fillStyle = '#6c5ce7';
                canvasCtx.fillRect(x, canvas.height - h, barWidth, h);
                x += barWidth + 1;
            }
            if (isInitialized) return;
            isInitialized = true;
        }

        draw();
        isInitialized = true;
    }
}