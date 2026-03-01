const tracks = [
    {
        id: 1,
        title: "Night Drive",
        artist: "Podmefom",
        url: "/audio/1.mp3",
        img: "/images/1.jpg",
        description: "1",
        lyrics: "мяу"
    },
    {
        id: 2,
        title: "Neon City",
        artist: "Podmefom",
        url: "/audio/2.mp3",
        img: "/images/1.jpg",
        description: "2",
        lyrics: "vze"
    }, 
    {
        id: 3,
        title: "Trap Soul",
        artist: "Type Beat",
        url: "/audio/3.mp3",
        img: "/images/1.jpg",
        description: "3",
        lyrics: "гав"
    }
];

const state = {
    allTracks: tracks,
    currentTrackIndex: 0,
    volume: 0.5,
    isPlaying: false
};

export default state;