// ***************************************************************************
// Минимальные типы для opus-recorder — только используемая часть API
// (запись Ogg Opus: конструктор, события, start/pause/resume/stop/close).
// ***************************************************************************

/** Опции конструктора Recorder. */
interface OpusRecorderOptions {
    /** Путь к encoderWorker.min.js. */
    encoderPath?: string;
    /** Уровень мониторинга (0 — без мониторинга). */
    monitorGain?: number;
    /** Число каналов (1 — моно). */
    numberOfChannels?: number;
    /** Битрейт кодировщика. */
    encoderBitrate?: number;
    /** Частота дискретизации кодировщика. */
    encoderSampleRate?: number;
    /** Отдавать ли данные порциями (streamPages). */
    streamPages?: boolean;
    /** Максимум страниц в буфере перед выдачей данных. */
    maxBuffersPerPage?: number;
    [key: string]: unknown;
}

/** Экземпляр рекордера opus-recorder. */
declare class OpusRecorder {
    constructor(options?: OpusRecorderOptions);

    /** Текущее состояние ("inactive" | "recording" | "paused"). */
    state?: string;
    /** Внутренний поток микрофона рекордера (может отличаться от переданного). */
    stream: MediaStream | null;

    onstart: (() => void) | null;
    onpause: (() => void) | null;
    onresume: (() => void) | null;
    ondataavailable: ((data: ArrayBuffer | ArrayBufferView<ArrayBuffer>) => void) | null;
    onstop: (() => void) | null;

    start(stream?: MediaStream): Promise<void> | void;
    pause(): void;
    resume(): void;
    stop(): Promise<void> | void;
    close(): Promise<void> | void;
}

declare module "opus-recorder" {
    export = OpusRecorder;
}
