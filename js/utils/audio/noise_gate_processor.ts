// Импортируем сторонние пакеты
import type { Track, TrackProcessor, AudioProcessorOptions } from "livekit-client";

// Импортируем utils
import { Logger } from "../logs/logger.js";

/**
 * Опции инициализации процессора — контракт `TrackProcessor` из livekit-client.
 */
export interface NoiseGateProcessorOptions {

    /** Тип трека (для этого процессора — аудио). */
    kind?: Track.Kind;

    /** Исходный трек микрофона. */
    track?: MediaStreamTrack | null;

    /** Медиаэлемент, для которого устанавливается процессор. */
    element?: HTMLMediaElement;

    /** Общий AudioContext комнаты (свой создаётся только как fallback). */
    audioContext?: AudioContext;

}

/**
 * ***************************************************************************
 * NoiseGateProcessor - аудио-процессор шумоподавления для конференций.
 *
 * Реализует контракт `TrackProcessor` из `livekit-client` (`name`, `init`,
 * `restart`, `destroy`, `processedTrack`) и вешается на публикацию
 * микрофона через `track.setProcessor(...)`.
 *
 * Что делает: пропускает звук через «фильтр верхних частот + адаптивный
 * гейт». Highpass убирает гул и низкочастотный шум, гейт закрывает сигнал
 * в паузах между фразами - добивая то, что встроенное WebRTC
 * шумоподавление браузера оставило (гул, вентилятор, шорох).
 *
 * Принципы, из которых следует вся реализация:
 * - AudioContext берём общий, комнатный (LiveKit передаёт его в `init`):
 *   собственный контекст создаем только как fallback и закрываем в
 *   `destroy()` - иначе контексты накапливались бы при каждой смене
 *   микрофона.
 * - Опрос уровня - через `setInterval`, а не `requestAnimationFrame`:
 *   rAF в фоновой вкладке не вызывается, и гейт «залипал» бы.
 * - Пороги считаются от адаптивного шумового пола, а не константами:
 *   уровень пола сильно зависит от микрофона и от автоусиления.
 * - Gain едет автоматизацией AudioParam (ramp), а не присваиванием:
 *   присваивание даёт ступени на сигнале - «зиппер» и щелчки.
 * - Атака быстрая, релиз медленный: иначе гейт срезал бы окончания слов.
 * - Ошибка процессора никогда не должна ронять включение микрофона:
 *   `init()` завершается контролируемо, а не исключением.
 * ***************************************************************************
 */
export class NoiseGateProcessor implements TrackProcessor<Track.Kind.Audio, AudioProcessorOptions> {

    /**
     * ***************************************************************************
     * Имя процессора. LiveKit и наш код опознают процессор по нему:
     * чужой процессор при включении заменяется, свой - не пересоздаётся.
     * ***************************************************************************
     */
    static PROCESSOR_NAME = "noise-gate";

    // Параметры обработки (см. комментарии у полей ниже)
    static HIGHPASS_FREQ = 100;      // Срез highpass, Гц: ниже - гул и низкий шум
    static POLL_MS = 50;             // Период опроса уровня, мс (40-60 мс)
    static OPEN_MARGIN_DB = 8;       // Порог открытия над шумовым полом, дБ
    static CLOSE_MARGIN_DB = 4;      // Порог закрытия над шумовым полом, дБ (гистерезис)
    static MIN_FLOOR_DB = -85;       // Нижняя граница шумового пола, дБ
    static MAX_FLOOR_DB = -35;       // Верхняя граница шумового пола, дБ
    static FLOOR_RISE_DB = 0.5;      // Всплытие пола за тик, дБ (вниз - мгновенно)
    static ATTACK_MS = 20;           // Скорость открытия, мс (быстро)
    static RELEASE_MS = 300;         // Скорость закрытия, мс (медленно)
    static SILENCE_DB = -120;        // Потолок «тишины»: всё ниже считаем ею

    /**
     * Имя процессора - часть контракта `TrackProcessor`.
     */
    name = NoiseGateProcessor.PROCESSOR_NAME;

    /**
     * Трек, который LiveKit публикует вместо исходного («обработанный»).
     * Отсутствие значения — контракт `TrackProcessor`: граф ещё не собран.
     */
    processedTrack?: MediaStreamTrack;

    /**
     * Поддерживается ли фича в этом браузере. Ставится в `false` при
     * отсутствии Web Audio и читается UI, чтобы отключить тумблер.
     */
    isSupported = true;

    // Узлы графа и контекст
    /** Общий (комнатный) либо собственный fallback-контекст. */
    _context: AudioContext | null;

    /** Принадлежит ли `_context` этому процессору (закрывается в destroy). */
    _ownContext: boolean;

    /** Источник: MediaStreamSource от трека микрофона. */
    _source: MediaStreamAudioSourceNode | null;

    /** Фильтр верхних частот (highpass). */
    _filter: BiquadFilterNode | null;

    /** Измерительный узел для снятия уровня. */
    _analyser: AnalyserNode | null;

    /** Сам гейт: коэффициент 1 (открыто) .. 0 (закрыто). */
    _gain: GainNode | null;

    /** Приёмник обработанного сигнала - его трек и публикует LiveKit. */
    _destination: MediaStreamAudioDestinationNode | null;

    /** Буфер выборки уровня (по размеру fft анализатора). */
    _levelBuffer: Float32Array<ArrayBuffer> | null;

    // Таймер опроса уровня
    /** Интервал опроса уровня (null - таймер не запущен). */
    _timer: ReturnType<typeof setInterval> | null;

    // Состояние гейта и оценка шумового пола
    /** Открыт ли гейт сейчас. */
    _isOpen: boolean;

    /** Оценка шумового пола, дБ (null - ещё не измерялся). */
    _floorDb: number | null;

    /**
     * ***************************************************************************
     * Конструктор - пустое состояние до `init()`.
     * ***************************************************************************
     */
    constructor() {

        // Узлы графа и контекст
        this._context = null;
        this._ownContext = false;
        this._source = null;
        this._filter = null;
        this._analyser = null;
        this._gain = null;
        this._destination = null;
        this._levelBuffer = null;

        // Таймер опроса уровня
        this._timer = null;

        // Состояние гейта и оценка шумового пола
        this._isOpen = false;
        this._floorDb = null;

    }

    /**
     * ***************************************************************************
     * Проверка поддержки фичи браузером - для UI.
     *
     * Проверяем конструктор и оба «диагностических» узла, без которых
     * граф не собрать. Сам AudioContext при этом НЕ создаётся: создание
     * контекста вне жеста пользователя может получить autoplay-политику
     * и повести себя по-другому, чем в реальном сценарии.
     * @returns {boolean} - Доступен ли Web Audio для нашей цепочки.
     * ***************************************************************************
     */
    static isSupported(): boolean {

        const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;

        if (typeof AudioContextClass !== "function") return false;

        return typeof AudioContextClass.prototype?.createMediaStreamSource === "function"
            && typeof AudioContextClass.prototype?.createMediaStreamDestination === "function";

    }

    /**
     * ***************************************************************************
     * init - инициализация процессора (контракт `TrackProcessor`).
     *
     * Берёт общий контекст комнаты из `opts.audioContext`; свой создаёт
     * только как fallback и помечает флагом `_ownContext`, чтобы закрыть
     * именно его, а не чужой контекст LiveKit.
     *
     * Никогда не кидает исключение наружу: недоступность Web Audio -
     * это `isSupported = false` + предупреждение в лог, а не падение
     * включения микрофона.
     * @param {NoiseGateProcessorOptions} opts - Опции процессора `{ kind, track, element, audioContext }`.
     * @returns {Promise<void>}
     * ***************************************************************************
     */
    async init(opts: NoiseGateProcessorOptions): Promise<void> {

        try {

            // Общий контекст комнаты предпочтительнее собственного
            const context = opts?.audioContext || NoiseGateProcessor._createContext();

            if (!context) {
                this.isSupported = false;
                Logger.warn("🔇 [noise-gate]: AudioContext недоступен, процессор отключён");
                return;
            }

            // Свой контекст - только когда LiveKit своего не дал
            this._ownContext = !opts?.audioContext;
            this._context = context;

            this._buildGraph(opts?.track, context);
            this._startTimer();

            Logger.debug("🔇 [noise-gate]: Процессор инициализирован");

        } catch (error) {
            // Контролируемое завершение вместо необработанного исключения
            this.isSupported = false;
            Logger.warn("🔇 [noise-gate]: Не удалось инициализировать процессор:", error);
        }

    }

    /**
     * ***************************************************************************
     * restart - пересборка графа от нового трека (контракт `TrackProcessor`).
     *
     * LiveKit вызывает её при смене микрофона: трек пересоздан, узлы
     * старого графа привязаны к мёртвому источнику. Прежние узлы и старый
     * `processedTrack` снимаются, всё строится заново - общая с `init()`
     * логика через `_buildGraph(track, ctx)`.
     * @param {NoiseGateProcessorOptions} opts - Опции процессора `{ kind, track, element, audioContext }`.
     * @returns {Promise<void>}
     * ***************************************************************************
     */
    async restart(opts: NoiseGateProcessorOptions): Promise<void> {

        if (!this.isSupported) return;

        try {

            const context = opts?.audioContext || this._context;

            if (!context) {
                this.isSupported = false;
                Logger.warn("🔇 [noise-gate]: Нет контекста для пересборки графа");
                return;
            }

            // Свой fallback заменяется на общий контекст комнаты:
            // старый закрываем, чтобы не копить контексты
            if (this._ownContext && opts?.audioContext && this._context !== context) {
                this._closeContext(this._context);
                this._ownContext = false;
            }

            this._context = context;

            this._buildGraph(opts?.track, context);
            this._startTimer();

            Logger.debug("🔇 [noise-gate]: Граф пересобран от нового трека");

        } catch (error) {
            this.isSupported = false;
            Logger.warn("🔇 [noise-gate]: Не удалось пересобрать процессор:", error);
        }

    }

    /**
     * ***************************************************************************
     * destroy - полная очистка (контракт `TrackProcessor`).
     *
     * Останавливает интервал, отключает узлы, останавливает
     * `processedTrack` и закрывает **только свой** fallback-контекст:
     * общий контекст LiveKit живёт вместе с комнатой.
     * @returns {Promise<void>}
     * ***************************************************************************
     */
    async destroy(): Promise<void> {

        // Узлы, интервал и обработанный трек
        this._teardownGraph();

        const context = this._context;
        const ownContext = this._ownContext;

        this._context = null;
        this._ownContext = false;

        // Чужой контекст не трогаем - его закроет сама комната
        if (ownContext) await this._closeContext(context);

        Logger.debug("🔇 [noise-gate]: Процессор уничтожен");

    }

    /**
     * ***************************************************************************
     * _buildGraph - сборка аудио-цепочки от трека.
     *
     * Схема:
     * `MediaStreamSource` -> `BiquadFilter` (highpass) -> `AnalyserNode`
     * -> `GainNode` (гейт) -> `MediaStreamDestination`.
     *
     * Analyser стоит «примерочным» узлом посреди цепочки: сигнал через
     * него проходит насквозь, а мы снимаем с него уровень для решений
     * гейта. Гейт - это GainNode: общий коэффициент 1 (открыто) .. 0
     * (закрыто), плавно двигается в `_tick()`.
     *
     * Реестр узлов общий для `init()` и `restart()`: рестарт сначала
     * снимает прежний граф, чтобы не осталось узлов, привязанных к
     * старому треку.
     * @param {MediaStreamTrack} track - Новый трек микрофона.
     * @param {AudioContext} context - Контекст, в котором строим граф.
     * @returns {void}
     * ***************************************************************************
     */
    _buildGraph(track: MediaStreamTrack | null | undefined, context: AudioContext): void {

        // Прежний граф - к сносу: restart приходит при живом источнике
        this._teardownGraph();

        if (!track) throw new Error("NoiseGateProcessor: не передан трек");

        // Источник: свежий MediaStream вокруг нового MediaStreamTrack
        this._source = context.createMediaStreamSource(new MediaStream([track]));

        // Глушим низ: гул, вентилятор и низкочастотный шум микрофона
        this._filter = context.createBiquadFilter();
        this._filter.type = "highpass";
        this._filter.frequency.value = NoiseGateProcessor.HIGHPASS_FREQ;

        // Измерительный узел - сам он звук не меняет
        this._analyser = context.createAnalyser();
        this._levelBuffer = new Float32Array(this._analyser.fftSize);

        // Сам гейт. Стартуем открытым: первое измерение закроет сигнал,
        // если тишина, а начало первой фразы не будет срезано
        this._gain = context.createGain();
        this._gain.gain.value = 1;
        this._isOpen = false;

        // Новый источник - свой шумовой пол
        this._floorDb = null;

        // Приёмник обработанного сигнала: его трек LiveKit и публикует
        this._destination = context.createMediaStreamDestination();

        this._source.connect(this._filter);
        this._filter.connect(this._analyser);
        this._analyser.connect(this._gain);
        this._gain.connect(this._destination);

        const processed = this._destination.stream.getAudioTracks()[0];
        if (processed) {
            this.processedTrack = processed;
        } else {
            delete this.processedTrack;
        }

    }

    /**
     * ***************************************************************************
     * _teardownGraph - снятие текущего графа и таймера.
     *
     * Отключает узлы (источник держит MediaStreamTrack, пока подключён),
     * останавливает обработанный трек и обнуляет ссылки. Идемпотентно:
     * можно звать на пустом состоянии.
     * @returns {void}
     * ***************************************************************************
     */
    _teardownGraph(): void {

        this._stopTimer();

        // Отключение узла без соединений не кидает исключение,
        // но на старых движках перестрахуемся optional-чейном
        this._source?.disconnect();
        this._filter?.disconnect();
        this._analyser?.disconnect();
        this._gain?.disconnect();
        this._destination?.disconnect();

        this.processedTrack?.stop();

        this._source = null;
        this._filter = null;
        this._analyser = null;
        this._gain = null;
        this._destination = null;
        this._levelBuffer = null;
        delete this.processedTrack;

    }

    /**
     * ***************************************************************************
     * _startTimer - запуск периодического опроса уровня.
     *
     * `setInterval`, а не `rAF`: кадровый цикл в фоновой вкладке стоит,
     * и гейт в фоне перестал бы реагировать на тишину.
     * @returns {void}
     * ***************************************************************************
     */
    _startTimer(): void {

        this._stopTimer();

        this._timer = setInterval(() => this._tick(), NoiseGateProcessor.POLL_MS);

    }

    /**
     * ***************************************************************************
     * _stopTimer - остановка опроса уровня.
     * @returns {void}
     * ***************************************************************************
     */
    _stopTimer(): void {

        if (this._timer !== null) {
            clearInterval(this._timer);
            this._timer = null;
        }

    }

    /**
     * ***************************************************************************
     * _tick - один шаг обработки: замер уровня и движение gain.
     *
     * Тик не должен ронять ни процессор, ни комнату: любая ошибка
     * логируется и гасится, а gain остаётся в прежнем значении.
     * @returns {void}
     * ***************************************************************************
     */
    _tick(): void {

        if (!this._analyser || !this._gain || !this._levelBuffer) return;

        try {

            // Замеряем отрезок сигнала и переводим в децибелы
            this._analyser.getFloatTimeDomainData(this._levelBuffer);
            const levelDb = NoiseGateProcessor.rmsToDb(NoiseGateProcessor.rms(this._levelBuffer));

            // Шумовой пол: скользящий минимум уровня, пороги считаются от него
            this._floorDb = NoiseGateProcessor.calcFloor(this._floorDb, levelDb);

            // Гистерезис: состояние гейта меняется только на своём пороге,
            // между порогами - держится, чтобы не «дрожать» на грани тишины
            const thresholds = NoiseGateProcessor.calcThresholds(this._floorDb);
            const open = NoiseGateProcessor.calcGate(levelDb, this._isOpen, thresholds.openDb, thresholds.closeDb);

            // Gain двигаем только на переходах и автоматизацией AudioParam:
            // поступательное присваивание каждый тик давало бы ступени - «зиппер»
            if (open !== this._isOpen) {
                this._isOpen = open;
                this._setGate(open);
            }

        } catch (error) {
            Logger.warn("🔇 [noise-gate]: Ошибка тика гейта:", error);
        }

    }

    /**
     * ***************************************************************************
     * _setGate - плавное движение gain к открытому/закрытому состоянию.
     *
     * Линейный ramp по AudioParam: значение меняется непрерывно, без
     * ступеней и щелчков на границах слов. Прежний переход отменяется с
     * фиксацией текущего значения - гейт может дёргаться на пороге.
     * @param {boolean} open - Открыть (true) или закрыть (false) гейт.
     * @returns {void}
     * ***************************************************************************
     */
    _setGate(open: boolean): void {

        if (!this._gain || !this._context) return;

        const param = this._gain.gain;
        const target = open ? 1 : 0;
        const duration = (open ? NoiseGateProcessor.ATTACK_MS : NoiseGateProcessor.RELEASE_MS) / 1000;

        // Текущее значение читаем до отмены расписания
        const current = param.value;
        const now = this._context.currentTime;

        param.cancelScheduledValues(now);
        param.setValueAtTime(current, now);
        param.linearRampToValueAtTime(target, now + duration);

    }

    /**
     * ***************************************************************************
     * calcFloor - чистый шаг оценки шумового пола (без Web Audio).
     *
     * Скользящий минимум уровня: вниз - мгновенно (тихий участок сразу
     * опускает пол), вверх - по чуть-чуть за тик (речь не должна тянуть
     * пол за собой). Пол держится в границах MIN_FLOOR_DB..MAX_FLOOR_DB.
     * @param {number|null} floorDb - Прежняя оценка пола, дБ (null - ещё не было).
     * @param {number} levelDb - Текущий уровень сигнала, дБ.
     * @returns {number} - Новая оценка пола, дБ.
     * ***************************************************************************
     */
    static calcFloor(floorDb: number | null, levelDb: number): number {

        const level = NoiseGateProcessor.clampDb(levelDb);

        const next = floorDb === null || level < floorDb
            ? level
            : floorDb + NoiseGateProcessor.FLOOR_RISE_DB;

        return Math.min(NoiseGateProcessor.MAX_FLOOR_DB, Math.max(NoiseGateProcessor.MIN_FLOOR_DB, next));

    }

    /**
     * ***************************************************************************
     * calcThresholds - чистый расчёт порогов гейта от шумового пола.
     * @param {number} floorDb - Оценка шумового пола, дБ (см. calcFloor).
     * @returns {{openDb: number, closeDb: number}} - Пороги открытия и закрытия, дБ.
     * ***************************************************************************
     */
    static calcThresholds(floorDb: number): { openDb: number; closeDb: number } {

        return {
            openDb: floorDb + NoiseGateProcessor.OPEN_MARGIN_DB,
            closeDb: floorDb + NoiseGateProcessor.CLOSE_MARGIN_DB
        };

    }

    /**
     * ***************************************************************************
     * calcGate - чистый расчёт: закрыт гейт или открыт (без Web Audio).
     *
     * Гистерезис: закрытый гейт открывается на `openDb`, открытый
     * закрывается только на `closeDb` (ниже). В интервале между
     * порогами состояние не меняется - на этом держится устойчивость
     * к шуму на грани чувствительности.
     * @param {number} levelDb - Уровень сигнала, дБ.
     * @param {boolean} isOpen - Текущее состояние гейта.
     * @param {number} openDb - Порог открытия, дБ.
     * @param {number} closeDb - Порог закрытия, дБ.
     * @returns {boolean} - Новое состояние гейта.
     * ***************************************************************************
     */
    static calcGate(levelDb: number, isOpen: boolean, openDb: number, closeDb: number): boolean {

        const level = NoiseGateProcessor.clampDb(levelDb);

        return isOpen
            ? level >= closeDb   // открыт: закроемся ниже нижнего порога
            : level >= openDb;   // закрыт: откроемся выше верхнего порога

    }

    /**
     * ***************************************************************************
     * rmsToDb - среднеквадратичное значение амплитуды в децибелы.
     * @param {number} rms - RMS-значение отрезка сигнала (0..1).
     * @returns {number} - Уровень в дБ (-Infinity для полной тишины).
     * ***************************************************************************
     */
    static rmsToDb(rms: number): number {

        // Ноль и мусор - это тишина, а не NaN в дальнейших расчётах
        if (!Number.isFinite(rms) || rms <= 0) return -Infinity;

        return 20 * Math.log10(rms);

    }

    /**
     * ***************************************************************************
     * rms - чистый RMS по выборке отрезка сигнала.
     * @param {Float32Array|Array<number>} values - Выборка времени (окно AnalyserNode).
     * @returns {number} - Среднеквадратичное значение (0, если окно пусто).
     * ***************************************************************************
     */
    static rms(values: Float32Array | number[]): number {

        if (!values || values.length === 0) return 0;

        let sum = 0;

        for (let i = 0; i < values.length; i++) {
            // NaN в выборке (обрыв данных) считаем нулём, а не тянем в сумму
            const sample = values[i] ?? 0;
            const value = Number.isFinite(sample) ? sample : 0;
            sum += value * value;
        }

        return Math.sqrt(sum / values.length);

    }

    /**
     * ***************************************************************************
     * clampDb - приведение уровня к рабочему диапазону дБ.
     *
     * Не-числа (NaN, -Infinity из `rmsToDb` для тишины) становятся
     * «потолком тишины» - гейт от этого закроется, а не сломает расчёт.
     * @param {number} value - Исходный уровень, дБ.
     * @returns {number} - Уровень в диапазоне от `SILENCE_DB` до 0.
     * ***************************************************************************
     */
    static clampDb(value: number): number {

        if (!Number.isFinite(value)) return NoiseGateProcessor.SILENCE_DB;

        return Math.min(0, Math.max(NoiseGateProcessor.SILENCE_DB, value));

    }

    /**
     * ***************************************************************************
     * _createContext - собственный fallback-контекст.
     *
     * Нужен только если LiveKit не передал свой: в этом случае он
     * считается «своим» (`_ownContext`) и закрывается в `destroy()`.
     * @returns {AudioContext|null} - Контекст или null, если Web Audio нет.
     * ***************************************************************************
     */
    static _createContext(): AudioContext | null {

        const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;

        if (typeof AudioContextClass !== "function") return null;

        try {
            return new AudioContextClass();
        } catch (error) {
            Logger.warn("🔇 [noise-gate]: Не удалось создать AudioContext:", error);
            return null;
        }

    }

    /**
     * ***************************************************************************
     * _closeContext - безопасное закрытие контекста.
     *
     * `close()` возвращает Promise и может отклониться (контекст уже
     * закрыт) - ошибка здесь не должна ронять `destroy()`.
     * @param {AudioContext|null} context - Контекст для закрытия.
     * @returns {Promise<void>}
     * ***************************************************************************
     */
    async _closeContext(context: AudioContext | null): Promise<void> {

        if (!context || typeof context.close !== "function") return;

        try {
            await context.close();
        } catch (error) {
            Logger.warn("🔇 [noise-gate]: Контекст уже закрыт:", error);
        }

    }

}
