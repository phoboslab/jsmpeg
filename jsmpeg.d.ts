declare module "jsmpeg"{

    export class Player {
        options: PlayerOptions;
        source: VideoSource;

        maxAudioLag: number;
        loop: boolean;
        autoplay: boolean;
        isPlaying: boolean;

        demuxer: any;

        constructor(url: string, options: PlayerOptions);

        showHide(): void;

        play(): void;
        pause(): void;
        stop(): void;
        destroy(): void;
        update(): void;
        updateForStreaming(): void;
        updateForStaticFile(): void;

        seek(): void;

        getCurrentTime(): number;
        getVolume(): number;
        setVolume(level:number): void;
    }

    export interface PlayerOptions {
        canvas?: Element;
        protocols?: string;
        audio?: boolean;
        loop?: boolean;
        streaming?: boolean;
        poster?: string;
        pauseWhenHidden?: boolean;
        source?: boolean;
        progressive?: boolean;
        maxAudioLag?: number;
        autoplay?: boolean;
        video?: boolean;
        disableGl?: boolean;
        playingStateChange?: (playingState: boolean) => void;
        dataLoaded?: () => void;
    }

    export interface VideoSource {
        destroy(): void;
    }

    export class WebSocket implements VideoSource {
        public url: string;
        public options: PlayerOptions;
        public socket: any;

        constructor(url: string, options: PlayerOptions);

        connect(): void;
        destroy(): void;
        start(): void;
        resume(): void;
        onOpen(): void;
        onClose(): void;
        onMessage(): void;
    }

}
