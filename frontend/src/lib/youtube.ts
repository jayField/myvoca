// The YouTube IFrame Player API, loaded once on first use. Only the few calls the 노래 page needs are typed.

export interface YouTubePlayer {
  getCurrentTime(): number;
  getPlayerState(): number;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  playVideo(): void;
  destroy(): void;
}

interface PlayerOptions {
  videoId: string;
  width?: string;
  height?: string;
  playerVars?: Record<string, number | string>;
  events?: { onReady?: () => void; onStateChange?: (e: { data: number }) => void; onError?: (e: { data: number }) => void };
}

interface YouTubeApi {
  Player: new (element: HTMLElement, options: PlayerOptions) => YouTubePlayer;
}

declare global {
  interface Window {
    YT?: YouTubeApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

/** YT.PlayerState.PLAYING */
export const PLAYING = 1;

let loading: Promise<YouTubeApi> | null = null;

function loadApi(): Promise<YouTubeApi> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  loading ??= new Promise((resolve, reject) => {
    window.onYouTubeIframeAPIReady = () => resolve(window.YT!);
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.onerror = () => {
      loading = null;
      script.remove();
      reject(new Error('유튜브 플레이어를 불러오지 못했어요. 인터넷 연결을 확인해 주세요.'));
    };
    document.head.append(script);
  });
  return loading;
}

/** Puts a YouTube player in `element` (which it replaces); resolves once the player is ready. */
export async function createPlayer(
  element: HTMLElement,
  videoId: string,
  onStateChange: (state: number) => void,
  onError: (code: number) => void,
): Promise<YouTubePlayer> {
  const YT = await loadApi();
  return new Promise((resolve) => {
    const player = new YT.Player(element, {
      videoId,
      width: '100%',
      height: '100%',
      playerVars: { playsinline: 1, rel: 0 },
      events: {
        onReady: () => resolve(player),
        onStateChange: (e) => onStateChange(e.data),
        onError: (e) => onError(e.data),
      },
    });
  });
}

/** What a YouTube player error code means for the learner. */
export function playerError(code: number): string {
  if (code === 101 || code === 150 || code === 153) {
    return '이 영상은 다른 사이트에서 재생할 수 없게 막혀 있어요. 같은 노래의 다른 영상(공식 오디오 등) 링크로 바꿔 주세요.';
  }
  if (code === 100) return '영상을 찾을 수 없어요. 삭제됐거나 비공개일 수 있어요.';
  return '영상을 재생하지 못했어요. 잠시 뒤 다시 시도해 주세요.';
}
