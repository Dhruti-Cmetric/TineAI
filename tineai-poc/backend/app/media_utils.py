"""
app/media_utils.py — shared audio/video utilities used by the worker.
"""
import os
import logging

logger = logging.getLogger(__name__)


def extract_audio(video_path: str, out_dir: str = None) -> str:
    """
    Extract audio track from a video file and save as 16kHz mono WAV.
    Returns the path to the extracted WAV file.
    Falls back through: moviepy → ffmpeg subprocess → raises RuntimeError.
    """
    if not video_path or not os.path.exists(video_path):
        raise FileNotFoundError(f"Video file not found: {video_path}")

    base = os.path.splitext(video_path)[0]
    out_dir = out_dir or os.path.dirname(video_path)
    wav_path = os.path.join(out_dir, os.path.basename(base) + "_audio.wav")

    if os.path.exists(wav_path):
        logger.info("Audio already extracted: %s", wav_path)
        return wav_path

    # --- try moviepy ---
    try:
        from moviepy import VideoFileClip
        clip = VideoFileClip(video_path)
        clip.audio.write_audiofile(wav_path, fps=16000, nbytes=2, codec="pcm_s16le", logger=None)
        clip.close()
        logger.info("Audio extracted via moviepy: %s", wav_path)
        return wav_path
    except Exception as e:
        logger.warning("moviepy extraction failed: %s", e)

    # --- try ffmpeg subprocess ---
    try:
        import subprocess
        subprocess.run(
            ["ffmpeg", "-y", "-i", video_path,
             "-vn", "-ac", "1", "-ar", "16000",
             "-sample_fmt", "s16", wav_path,
             "-loglevel", "error"],
            check=True, timeout=300,
        )
        logger.info("Audio extracted via ffmpeg: %s", wav_path)
        return wav_path
    except Exception as e:
        logger.warning("ffmpeg extraction failed: %s", e)

    raise RuntimeError(f"Could not extract audio from {video_path} — install moviepy or ffmpeg")


def get_video_info(video_path: str) -> dict:
    """Return basic video metadata using OpenCV."""
    try:
        import cv2
        cap = cv2.VideoCapture(video_path)
        info = {
            "fps":      cap.get(cv2.CAP_PROP_FPS),
            "frames":   int(cap.get(cv2.CAP_PROP_FRAME_COUNT)),
            "width":    int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)),
            "height":   int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)),
        }
        info["duration_sec"] = round(info["frames"] / info["fps"], 2) if info["fps"] else 0
        cap.release()
        return info
    except Exception as e:
        logger.warning("get_video_info failed: %s", e)
        return {}
