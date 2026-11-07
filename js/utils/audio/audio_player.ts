// Импортируем сторонние пакеты
import type Hls from "hls.js";

// Импортируем utils
import { CacheManager } from "../cache_manager.js";
import * as StorageUrl from "../network/storage_url.js";

// Импортируем forms
import { MiniAudioPlayer } from "../../forms/audio-player-mini/index.js";

// Импортируем utils
import { getErrorName } from "../helpers/error_util.js";

/**
 * Трек плейлиста: вложение сообщения плюс отображаемые поля
 * (`author`, `title` добавляются при сборке плейлиста на форме).
 */
export interface AudioPlayerTrack {

    /**
     * Идентификатор документа (для сопоставления с активным треком).
     * У локальных (temp/pending) вложений id может отсутствовать — плеер
     * использует его только для сравнения, поэтому null здесь допустим.
     */
    id?: string | number | null;

    /** Токен доступа к файлу в storage. */
    token?: string;

    /** Локальный файл (ещё не загружен на сервер). */
    _file?: Blob | File;

    /** Отображаемое имя автора. */
    author?: string | undefined;

    /** Отображаемое название трека. */
    title?: string | undefined;

    /** Метаданные медиа (теги и флаги). */
    metadata?: {
        tags?: { artist?: string; title?: string };
        flags?: { is_audio_note?: boolean };
        [key: string]: unknown;
    };

    /** Прочие поля вложения. */
    [key: string]: unknown;

}

/**
 * Состояние плеера, рассылаемое подписчикам.
 */
export interface AudioPlayerState {

    /** Позиция воспроизведения (MM:SS). */
    currentTime: string;

    /** Длительность трека (MM:SS). */
    duration: string;

    /** Прогресс, 0..100. */
    progress: number;

    /** Идёт ли воспроизведение. */
    isPlaying: boolean;

    /** Идентификатор текущего трека либо null. */
    trackId: string | number | null;

}

/**
 * Подписчик обновлений плеера: при сбросе/закрытии payload приходит
 * частичным (без `duration` и остальных полей).
 */
export type AudioPlayerCallback = (state: Partial<AudioPlayerState>) => void;

/**
 * Настройки монтирования формы мини-плеера (`{ prepend, after, insertInto }`).
 */
export interface MiniAudioPlayerMountOptions {

    /** Вставить форму первым дочерним элементом контейнера. */
    prepend?: boolean;

    /** Вставить форму после контейнера. */
    after?: boolean;

    /** Куда вставить форму. */
    insertInto?: Element | null | undefined;

}

/**
 * ***************************************************************************
 * Глобальный менеджер аудиоплеера с поддержкой плейлистов и реактивной системой вещания.
 * Управляет только логикой и состоянием воспроизведения.
 * ***************************************************************************
 */
export class AudioPlayerManager {

    /** Единственный экземпляр менеджера (Singleton). */
    static instance: AudioPlayerManager | null = null;

    /**
     * ***************************************************************************
     * Создает экземпляр или возвращает существующий (Singleton).
     * ***************************************************************************
     */
    constructor() {

        // Основной аудио-элемент
        this.audio = new Audio();
        // HLS-ветка удаляется: поле оставлено на время вычистки
        this.hls = null;
        this.currentUrl = null;
        this.audioData = null; // Данные текущего трека

        // Логика плейлиста
        this.playlist = [];
        this.currentIndex = 0;

        // Состояние повтора и перемешивания
        this.isRepeatEnabled = false;
        this.isShuffleEnabled = false;

        // Реестр наблюдателей (Observers)
        this.viewObservers = new Map();

        // Ссылка на экземпляр формы мини-плеера (UI)
        this.miniPlayer = null;
        this.isAudioPlayerOpened = false;

        // Вспомогательные переменные управления
        this._playPromise = null;

        if (AudioPlayerManager.instance) {
            return AudioPlayerManager.instance;
        }

        this._bindAudioEvents();
        this._bindGlobalMediaEvents();

        AudioPlayerManager.instance = this;
    }

    /** Основной аудио-элемент. */
    audio: HTMLAudioElement;

    /** HLS-плеер (поле живёт до вычистки HLS-ветки, сейчас всегда null). */
    hls: Hls | null;

    /** URL текущего загруженного трека. */
    currentUrl: string | null;

    /** Данные текущего трека. */
    audioData: AudioPlayerTrack | null;

    /** Текущий плейлист. */
    playlist: AudioPlayerTrack[];

    /** Индекс текущего трека. */
    currentIndex: number;

    /** Включён ли повтор плейлиста. */
    isRepeatEnabled: boolean;

    /** Включено ли перемешивание. */
    isShuffleEnabled: boolean;

    /** Реестр подписчиков: id канала → множество коллбэков. */
    viewObservers: Map<string, Set<AudioPlayerCallback>>;

    /** Ссылка на экземпляр формы мини-плеера (UI). */
    miniPlayer: MiniAudioPlayer | null;

    /** Открыт ли глобальный аудиоплеер. */
    isAudioPlayerOpened: boolean;

    /** Текущий промис `audio.play()` (null — воспроизведение не запускалось). */
    _playPromise: Promise<void> | null;

    /**
     * ***************************************************************************
     * Реактивная подписка на обновления плеера
     * @param {string} id - Идентификатор подписчика (id канала/сообщения).
     * @param {AudioPlayerCallback} callback - Коллбэк получения состояния.
     * ***************************************************************************
     */
    subscribe(id: string, callback: AudioPlayerCallback): void {
        // get() после set() не выводится компилятором — работаем с Set через локальную
        let observers = this.viewObservers.get(id);
        if (!observers) {
            observers = new Set();
            this.viewObservers.set(id, observers);
        }
        observers.add(callback);
        this._broadcast();
    }

    /**
     * ***************************************************************************
     * Отписка от обновлений
     * @param {string} id - Идентификатор подписчика (id канала/сообщения).
     * @param {AudioPlayerCallback} callback - Ранее подписанный коллбэк.
     * ***************************************************************************
     */
    unsubscribe(id: string, callback: AudioPlayerCallback): void {
        const callbacks = this.viewObservers.get(id);
        if (callbacks instanceof Set) {
            callbacks.delete(callback);
            if (callbacks.size === 0) {
                this.viewObservers.delete(id);
            }
        }
    }

    /**
     * ***************************************************************************
     * Рассылка состояния подписчикам (Broadcast)
     * @param {Partial<AudioPlayerState>|null} forcePayload - Готовый payload
     *        вместо расчётного состояния (сброс/закрытие плеера).
     * ***************************************************************************
     */
    _broadcast(forcePayload: Partial<AudioPlayerState> | null = null): void {

        const currentTime = this.audio.currentTime;
        const duration = this.audio.duration || 0;
        const progressPercent = duration ? (currentTime / duration) * 100 : 0;

        const payload = forcePayload || {
            currentTime: this._formatTime(currentTime),
            duration: this._formatTime(duration),
            progress: progressPercent,
            isPlaying: !this.audio.paused,
            trackId: this.audioData?.id || null
        };

        this.viewObservers.forEach((callbacks) => {
            if (callbacks instanceof Set) {
                callbacks.forEach(cb => {
                    if (typeof cb === "function") cb(payload);
                });
            }
        });

    }

    /**
     * ***************************************************************************
     * Привязка событий к аудио-движку
     * ***************************************************************************
     */
    _bindAudioEvents(): void {
        this.audio.ontimeupdate = () => this._broadcast();
        
        this.audio.onplay = () => {
            this._broadcast();
            window.dispatchEvent(new CustomEvent("[app][audio]::media-play", { detail: { type: "audio" } }));
        };

        this.audio.onpause = () => this._broadcast();
        this.audio.onended = () => this.next();
    }

    /**
     * ***************************************************************************
     * Связка с внешними медиа-событиями (пауза при запуске видео)
     * ***************************************************************************
     */
    _bindGlobalMediaEvents(): void {
        window?.addEventListener("[app][audio]::media-play", (e) => {
            if (e.detail.type === "video") {
                this.audio.pause();
            }
        });
    }

    /**
     * ***************************************************************************
     * Запуск воспроизведения
     * @param {AudioPlayerTrack|AudioPlayerTrack[]} source - Трек либо плейлист.
     * @param {HTMLElement|null} mountContainer - Контейнер монтирования мини-плеера.
     * @param {MiniAudioPlayerMountOptions} mountOptions - Настройки монтирования.
     * @param {number} startIndex - Индекс стартового трека (для плейлиста).
     * @returns {Promise<void>}
     * ***************************************************************************
     */
    async play(
        source: AudioPlayerTrack | AudioPlayerTrack[],
        mountContainer: HTMLElement | null = null,
        mountOptions: MiniAudioPlayerMountOptions = {},
        startIndex = 0
    ): Promise<void> {

        if (Array.isArray(source)) {
            this.playlist = source;
            this.currentIndex = startIndex;
        } else {
            this.playlist = [source];
            this.currentIndex = 0;
        }

        // Загружаем трек в плеер
        await this._loadTrack();

        // Управление жизненным циклом UI мини-плеера:
        // Если мини-плеера ещё нет — инициализируем его, иначе при необходимости перемонтируем
        //
        // NOTE(MIGRATION): легаси вызывал new MiniAudioPlayer(mountContainer, mountOptions),
        // но конструктор принимает ОДИН аргумент options и раскладывает его как {...options}:
        // у DOM-элемента нет собственных перечисляемых свойств, поэтому mountContainer
        // не менял options, а второй аргумент (mountOptions) отбрасывался вовсе.
        // Вызов без аргументов в точности повторяет прежнее поведение (скрытый баг
        // легаси — не исправляется здесь, mountOptions уходит только в remount()).
        if (!this.miniPlayer) {
            this.miniPlayer = new MiniAudioPlayer();
        } else if (mountContainer) {
            this.miniPlayer.remount(mountContainer, mountOptions);
        }

    }

    /**
     * ***************************************************************************
     * Загрузка ресурса и подготовка аудио-потока
     * ***************************************************************************
     */
    async _loadTrack(): Promise<void> {

        const track = this.playlist[this.currentIndex];
        if (!track) return;

        // Отправляем сигнал сброса предыдущего трека
        this._broadcast({
            trackId: null,
            isPlaying: false,
            progress: 0,
            currentTime: "00:00"
        });

        this.audio.pause();

        if (this.hls) {
            this.hls.destroy();
            this.hls = null;
        }

        if (this.currentUrl && this.currentUrl.startsWith("blob:")) {
            URL.revokeObjectURL(this.currentUrl);
        }

        this.audioData = track;
        const fileData = track._file || track;

        try {
            if (fileData instanceof File || fileData instanceof Blob) {
                this.currentUrl = URL.createObjectURL(fileData);
            } else {
                this.currentUrl = CacheManager.getMediaSrc({
                    // id обязателен для медиа-трека; без него URL всё равно
                    // не разрешится — сохраняем легаси-семантику «невалидный URL»
                    url: StorageUrl.forStorage(fileData.id ?? ""),
                    file_token: fileData.token,
                    type: fileData?.metadata?.flags?.is_audio_note === true ? "voice" : "audio"
                });
            }

            // Аудио без HLS-рендерингов (HLS-ветка удаляется)
            this.audio.src = this.currentUrl;

            this._playPromise = this.audio.play();
            await this._playPromise;
            this._playPromise = null;

        } catch (err) {
            this._playPromise = null;
            if (getErrorName(err) !== "AbortError") console.error("AudioPlayerManager Error:", err);
        }

    }

    /**
     * ***************************************************************************
     * Установка позиции воспроизведения (0-100%)
     * ***************************************************************************
     */
    seek(percent: string | number): void {
        if (!this.audio.duration || !isFinite(this.audio.duration)) return;
        // parseFloat приводит аргумент к строке сам — String() здесь только
        // для честной типизации (на вход приходят и проценты-числа)
        const p = parseFloat(String(percent));
        this.audio.currentTime = (p / 100) * this.audio.duration;
        this._broadcast();
    }

    /**
     * ***************************************************************************
     * Переключение состояния воспроизведения
     * ***************************************************************************
     */
    async toggle(): Promise<void> {
        try {
            if (this.audio.paused) {
                this._playPromise = this.audio.play();
                await this._playPromise;
                this._playPromise = null;
            } else {
                if (this._playPromise) await this._playPromise;
                this.audio.pause();
            }
        } catch (e) {
            this._playPromise = null;
        }
    }

    /**
     * ***************************************************************************
     * Переход к следующему треку
     * ***************************************************************************
     */
    next(): void {
        if (this.playlist.length === 0) return;

        if (this.currentIndex < this.playlist.length - 1) {
            this.currentIndex++;
            this._loadTrack();
        } else if (this.isRepeatEnabled) {
            this.currentIndex = 0;
            this._loadTrack();
        }
    }

    /**
     * ***************************************************************************
     * Переход к предыдущему треку
     * ***************************************************************************
     */
    prev(): void {
        if (this.playlist.length === 0) return;

        if (this.audio.currentTime > 3) {
            this.audio.currentTime = 0;
            this._broadcast();
            return;
        }

        if (this.currentIndex > 0) {
            this.currentIndex--;
        } else {
            this.currentIndex = this.playlist.length - 1;
        }
        this._loadTrack();
    }

    /**
     * ***************************************************************************
     * Полное закрытие и сброс состояния
     * ***************************************************************************
     */
    close(): void {

        if (this.hls) {
            this.hls.destroy();
            this.hls = null;
        }

        this.audio.pause();
        this.audio.currentTime = 0;

        this._broadcast({
            trackId: null,
            isPlaying: false,
            progress: 0,
            currentTime: "00:00"
        });

        this.playlist = [];
        this.audioData = null;

        // Уничтожаем форму мини-плеера при закрытии
        if (this.miniPlayer) {
            this.miniPlayer.modal?.close();
            this.miniPlayer = null;
        }

    }

    /**
     * ***************************************************************************
     * Повтор песен
     * ***************************************************************************
     */
    toggleRepeat(): void {
        this.isRepeatEnabled = !this.isRepeatEnabled;
    }

    /**
     * ***************************************************************************
     * Смешивание треков
     * ***************************************************************************
     */
    shuffle(): void {
        if (this.playlist.length <= 1) return;

        const currentTrack = this.playlist[this.currentIndex];
        if (!currentTrack) return;
        const otherTracks = this.playlist.filter((_, idx) => idx !== this.currentIndex);

        for (let i = otherTracks.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const from = otherTracks[i];
            const to = otherTracks[j];
            if (from && to) {
                otherTracks[i] = to;
                otherTracks[j] = from;
            }
        }

        this.playlist = [currentTrack, ...otherTracks];
        this.currentIndex = 0;

        this._broadcast();
    }

    /**
     * ***************************************************************************
     * Формат времени
     * ***************************************************************************
     */
    _formatTime(s: number): string {
        if (isNaN(s) || s < 0) return "00:00";
        const min = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${min.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
    }
}