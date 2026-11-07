// Импортируем сторонние пакеты
import Recorder from "opus-recorder";

// Импортируем utils
import { getErrorMessage, getErrorName } from "../helpers/error_util.js";

/**
 * ***************************************************************************
 * Профессиональный менеджер записи звука.
 * Генерирует универсальный Ogg Opus файл с корректными мета-тегами.
 * Поддерживает паузу и встроенный таймер записи (формат 00:00).
 * ***************************************************************************
 */
export class AudioRecorder {

    // Конструктор

    /** Экземпляр opus-recorder (null — записи нет). */
    recorder: Recorder | null;

    /** Поток микрофона, полученный через getUserMedia. */
    stream: MediaStream | null;

    /** Путь к encoderWorker.min.js. */
    workerPath: string;

    // Состояния
    /** Идёт ли запись. */
    isRecording: boolean;

    /** На паузе ли запись. */
    isPaused: boolean;

    // =============================
    // Таймер записи
    // =============================

    /** Время начала записи. */
    startTime: number;

    /** Время начала паузы. */
    pauseStartedAt: number;

    /** Суммарная длительность пауз. */
    pausedDuration: number;

    /** Сколько реально записано (без пауз), мс. */
    elapsedMs: number;

    /** Интервал обновления времени (null — таймер не запущен). */
    timerInterval: ReturnType<typeof setInterval> | null;

    /** Callback для UI (можно подписаться извне) — отформатированное время 00:00. */
    onTimeUpdate: ((formattedTime: string) => void) | null;

    constructor(workerPath: string = "/encoderWorker.min.js") {
        this.recorder = null;
        this.stream = null;
        this.workerPath = workerPath;

        // Состояния
        this.isRecording = false;
        this.isPaused = false;

        // =============================
        // Таймер записи
        // =============================
        this.startTime = 0;          // Время начала записи
        this.pauseStartedAt = 0;     // Время начала паузы
        this.pausedDuration = 0;     // Суммарная длительность пауз
        this.elapsedMs = 0;          // Сколько реально записано (без пауз)
        this.timerInterval = null;   // Интервал обновления времени

        // Callback для UI (можно подписаться извне)
        this.onTimeUpdate = null;
    }

    /**
     * Запуск записи
     * @returns {Promise<void>}
     */
    async start(): Promise<void> {
        if (this.isRecording) return;

        try {
            
            // 1. Получаем доступ к микрофону
            this.stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

            // 2. Настраиваем рекордер
            this.recorder = new Recorder({
                encoderPath: this.workerPath, // Путь к воркеру
                monitorGain: 0,
                numberOfChannels: 1,         // Моно (идеально для голоса)
                encoderBitrate: 32000,       // 32kbps — стандарт ТГ
                encoderSampleRate: 48000,    // 48kHz — стандарт для Opus
                streamPages: false,          // Собираем полный файл
                maxBuffersPerPage: 1000
            });

            // 3. Обработка событий
            this.recorder.onstart = () => {
                this.isRecording = true;
                this.isPaused = false;

                // Инициализация таймера
                this.startTime = Date.now();
                this.pausedDuration = 0;
                this.elapsedMs = 0;
                this._startTimer();

                console.log("🎙 Запись началась...");
            };

            this.recorder.onpause = () => {
                this.isPaused = true;
                this.pauseStartedAt = Date.now();
                console.log("⏸ Запись на паузе");
            };

            this.recorder.onresume = () => {
                this.isPaused = false;

                // Учитываем длительность паузы
                this.pausedDuration += Date.now() - this.pauseStartedAt;
                console.log("▶️ Запись возобновлена");
            };

            // 4. Старт (передаем поток явно)
            await this.recorder.start(this.stream);

        } catch (error) {
            // Если возникла ошибка "Aborted", проверим, не вызвали ли мы очистку слишком рано
            this._cleanup();
            this._handleError(error instanceof Error ? error : new Error(String(error)));
        }
    }

    /**
     * Приостановить запись
     */
    pause(): void {
        if (this.recorder && this.isRecording && !this.isPaused) {
            this.recorder.pause();
        }
    }

    /**
     * Продолжить запись после паузы
     */
    resume(): void {
        if (this.recorder && this.isRecording && this.isPaused) {
            this.recorder.resume();
        }
    }

    /**
     * Остановить запись и получить готовый File
     * @returns {Promise<File>}
     */
    stop(): Promise<File> {
        return new Promise<File>((resolve, reject) => {

            const recorder = this.recorder;

            if (!recorder || !this.isRecording) {
                this._cleanup();
                reject(new Error("Запись не была запущена"));
                return;
            }

            // Обёртка и opus-recorder могут рассинхронизироваться, например
            // после отмены или повторного stop(). Не ждём событий у уже idle-
            // рекордера, потому что они больше не придут.
            if (recorder.state && recorder.state !== "recording" && recorder.state !== "paused") {
                this._cleanup();
                reject(new Error("Запись уже была остановлена"));
                return;
            }

            let settled = false;
            let stopTimer: ReturnType<typeof setTimeout> | null = null;

            /**
             * Завершает остановку после получения финальных данных.
             * @param {ArrayBuffer|ArrayBufferView<ArrayBuffer>} typedArray - Закодированные данные.
             * @returns {void}
             */
            const finish = (typedArray: ArrayBuffer | ArrayBufferView<ArrayBuffer>) => {
                if (settled) return;

                if (stopTimer) clearTimeout(stopTimer);

                try {
                    const blob = new Blob([typedArray], { type: "audio/ogg" });
                    const file = new File([blob], `voice_${Date.now()}.ogg`, {
                        type: "audio/ogg",
                        lastModified: Date.now()
                    });

                    // Освобождаем поток даже до завершения остальных задач
                    // по созданию вложения на форме.
                    this._cleanup();
                    settled = true;
                    resolve(file);
                } catch (error) {
                    fail(error);
                }
            };

            /**
             * Завершает остановку ошибкой и освобождает ресурсы.
             * @param {unknown} error - Причина ошибки.
             * @returns {void}
             */
            const fail = (error: unknown) => {
                if (settled) return;

                settled = true;
                if (stopTimer) clearTimeout(stopTimer);
                this._cleanup();

                reject(error instanceof Error ? error : new Error(String(error)));
            };

            // Получаем финальный Ogg-файл от opus-recorder.
            recorder.ondataavailable = finish;

            // Если библиотека не пришлёт данные, всё равно отпускаем поток.
            recorder.onstop = () => {
                this._stopStream();

                // В штатном opus-recorder onstop вызывается после данных.
                // Небольшая задержка защищает от гонки между этими событиями.
                if (!settled) {
                    setTimeout(() => {
                        if (!settled) fail(new Error("Запись завершилась без аудиоданных"));
                    }, 100);
                }
            };

            // Страховка от зависшего encoder: иначе панель записи могла бы
            // остаться активной бесконечно.
            stopTimer = setTimeout(() => {
                fail(new Error("Тайм-аут остановки записи аудио"));
            }, 10000);

            // Останавливаем дорожки сразу, не дожидаясь финализации Opus.
            this._stopStream();

            try {
                const stopResult = recorder.stop();

                // В некоторых состояниях opus-recorder возвращает уже
                // разрешённый Promise без событий ondataavailable/onstop.
                Promise.resolve(stopResult).then(() => {
                    this._stopStream();
                    if (!settled) fail(new Error("Запись уже была остановлена"));
                }).catch(fail);
            } catch (error) {
                fail(error);
            }

        });
    }

    // ======================================================
    // ==================== ТАЙМЕР ==========================
    // ======================================================

    /**
     * Запуск внутреннего таймера обновления времени
     * @private
     */
    _startTimer(): void {
        this.timerInterval = setInterval(() => {
            if (!this.isRecording || this.isPaused) return;

            // Рассчитываем прошедшее время без учёта пауз
            this.elapsedMs = Date.now() - this.startTime - this.pausedDuration;

            // Если есть подписчик — уведомляем его
            if (typeof this.onTimeUpdate === "function") {
                this.onTimeUpdate(this.getFormattedTime());
            }

        }, 200);
    }

    /**
     * Остановка таймера
     * @private
     */
    _stopTimer(): void {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    /**
     * Получить прошедшее время в миллисекундах
     * @returns {number}
     */
    getElapsedMs(): number {
        return this.elapsedMs;
    }

    /**
     * Получить прошедшее время в формате 00:00
     * @returns {string}
     */
    getFormattedTime(): string {
        const totalSeconds = Math.floor(this.elapsedMs / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;

        return (
            String(minutes).padStart(2, "0") +
            ":" +
            String(seconds).padStart(2, "0")
        );
    }

    /**
     * Останавливает все дорожки потока микрофона.
     * @private
     * @returns {void}
     */
    _stopStream(): void {
        const stream = this.stream;
        this.stream = null;

        if (!stream) return;

        try {
            stream.getTracks?.().forEach((track) => {
                try {
                    track.stop();
                } catch (error) {
                    console.error("AudioRecorder track stop error:", error);
                }
            });
        } catch (error) {
            // Даже если получение дорожек завершилось с ошибкой, ссылка на
            // поток уже очищена и остальные ресурсы можно освободить дальше.
            console.error("AudioRecorder stream stop error:", error);
        }
    }

    /**
     * Закрывает контекст и внутренний поток opus-recorder.
     * @param {Recorder} recorder - Экземпляр opus-recorder.
     * @returns {void}
     */
    _closeRecorder(recorder: Recorder): void {

        // Сначала освобождаем внутренний MediaStream: close() может не
        // дойти до clearStream(), если контекст уже частично закрыт.
        const recorderStream = recorder?.stream;
        if (recorderStream) {
            try {
                const tracks = recorderStream.getTracks?.();
                tracks?.forEach((track) => track.stop());
            } catch (error) {
                console.error("AudioRecorder internal stream stop error:", error);
            }
            recorder.stream = null;
        }

        if (typeof recorder?.close !== "function") return;

        try {
            const closeResult = recorder.close();

            // close() может возвращать Promise закрытия AudioContext.
            if (closeResult) {
                Promise.resolve(closeResult).catch((error) => {
                    console.error("AudioRecorder close error:", error);
                });
            }
        } catch (error) {
            // При частично инициализированном рекордере close() может бросить
            // ошибку; поток уже остановлен, поэтому просто логируем её.
            console.error("AudioRecorder close error:", error);
        }

    }

    /**
     * Полная очистка и принудительная остановка
     */
    _cleanup(): void {
        this.isRecording = false;
        this.isPaused = false;

        // Останавливаем таймер
        this._stopTimer();
        this.elapsedMs = 0;

        // Сначала освобождаем поток, который получили через getUserMedia
        // в обёртке, затем закрываем внутренний Recorder: в opus-recorder
        // это могут быть разные MediaStream.
        this._stopStream();

        // Удаляем экземпляр рекордера и отвязываем его callbacks, чтобы
        // остановленная сессия не удерживала ссылку на форму.
        const recorder = this.recorder;
        this.recorder = null;

        if (recorder) {

            // Отвязываем пустыми функциями, а не null: opus-recorder вызывает
            // onstop() синхронно сразу после ondataavailable (в finish()), и
            // null на этом месте даёт "this.onstop is not a function".
            // Пустышки не держат ссылок на форму — цель отвязки достигается.
            const noop = (): void => { };
            recorder.onstart = noop;
            recorder.onpause = noop;
            recorder.onresume = noop;
            recorder.ondataavailable = noop;
            recorder.onstop = noop;
            this._closeRecorder(recorder);
        }
    }

    /**
     * Обработка типичных ошибок
     * @private
     */
    _handleError(error: Error): void {
        console.error("AudioRecorder Error:", error);

        if (getErrorName(error) === "AbortError" || getErrorMessage(error).includes("aborted")) {
            throw new Error("Не удалось инициализировать запись: Ошибка загрузки воркера. Проверьте путь к encoderWorker.");
        } else if (getErrorName(error) === "NotAllowedError") {
            throw new Error("Доступ к микрофону заблокирован.");
        } else if (getErrorName(error) === "NotFoundError") {
            throw new Error("Микрофон не обнаружен.");
        } else {
            throw new Error("Не удалось инициализировать запись: " + getErrorMessage(error));
        }
    }
}
