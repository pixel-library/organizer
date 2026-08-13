import { useState } from "react";

const playlist = [
  { title: "Morning Chill", artist: "ChillYourMind", img: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=200&auto=format&fit=crop" },
  { title: "Waves", artist: "Mr. Probz", img: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=200&auto=format&fit=crop" }
];

export default function AudioPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSongIdx, setCurrentSongIdx] = useState(0);
  const [progress, setProgress] = useState(33);

  const song = playlist[currentSongIdx];

  const togglePlay = () => setIsPlaying(p => !p);
  const nextSong = () => setCurrentSongIdx((currentSongIdx + 1) % playlist.length);
  const prevSong = () => setCurrentSongIdx((currentSongIdx - 1 + playlist.length) % playlist.length);
  const seekSong = (e) => {
    const percent = (e.nativeEvent.offsetX / e.currentTarget.clientWidth) * 100;
    setProgress(percent);
  };

  return (
    <div className="dashboard-panel audio-panel">
      <div className="audio-left">
        <img id="player-art" src={song.img} alt="Music" />
        <div>
          <span className="panel-kicker">FOCUS AUDIO</span>
          <h4 id="player-title">{song.title}</h4>
          <p id="player-artist">{song.artist}</p>
        </div>
      </div>
      <div className="audio-controls">
        <div className="audio-progress" onClick={seekSong}>
          <span id="player-progress" style={{ width: `${progress}%` }}></span>
        </div>
        <button onClick={prevSong}><i className="fa-solid fa-backward-step"></i></button>
        <button id="play-pause-icon" onClick={togglePlay} className="play-button">
          <i className={`fa-solid ${isPlaying ? "fa-pause" : "fa-play"}`}></i>
        </button>
        <button onClick={nextSong}><i className="fa-solid fa-forward-step"></i></button>
      </div>
    </div>
  );
}
