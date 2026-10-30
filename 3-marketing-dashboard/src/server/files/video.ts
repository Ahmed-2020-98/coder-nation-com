import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

export type VideoInfo = { durationSeconds: number | null; width: number | null; height: number | null; fps: number | null };

/**
 * Reads duration / size / fps with ffprobe. Arguments are fixed and the file is passed as a single argv entry
 * (no shell), so a file name can never become a command. Returns null when ffprobe is missing or the file isn't
 * a readable video, which is how uploads get validated.
 */
export async function probeVideo(file: string): Promise<VideoInfo | null> {
  try {
    const { stdout } = await run(
      "ffprobe",
      ["-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height,r_frame_rate,avg_frame_rate", "-of", "json", file],
      { timeout: 15_000, maxBuffer: 1024 * 1024 },
    );
    const data = JSON.parse(stdout) as {
      format?: { duration?: string };
      streams?: { codec_type?: string; width?: number; height?: number; r_frame_rate?: string; avg_frame_rate?: string }[];
    };
    const video = data.streams?.find((stream) => stream.codec_type === "video");
    if (!video) return null;
    // avg_frame_rate is the real rate; r_frame_rate can be a timebase artefact (browser recordings report 1000)
    const ratio = (value?: string): number | null => {
      const [numerator, denominator] = (value ?? "0/1").split("/").map(Number);
      const result = denominator ? numerator / denominator : null;
      return result && Number.isFinite(result) && result > 0 ? result : null;
    };
    const fps = ratio(video.avg_frame_rate) ?? ratio(video.r_frame_rate);
    const duration = Number(data.format?.duration);
    return {
      durationSeconds: Number.isFinite(duration) ? duration : null,
      width: video.width ?? null,
      height: video.height ?? null,
      fps: fps && Number.isFinite(fps) ? Math.round(fps * 100) / 100 : null,
    };
  } catch {
    return null;
  }
}

/** `ffmpeg -version` / `ffprobe -version`, to show in the health badge. */
export async function toolAvailable(tool: "ffmpeg" | "ffprobe"): Promise<boolean> {
  try {
    await run(tool, ["-version"], { timeout: 5_000 });
    return true;
  } catch {
    return false;
  }
}
