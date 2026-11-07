// Импортируем сторонние пакеты (Mediabunny — потоковое чтение длинного аудио)
import {
    BlobSource,
    Input,
    AudioSampleSink,
    MP3,
    OGG,
    WAVE,
    FLAC,
    MP4,
    QTFF
} from "mediabunny";

// Импортируем типы
import type { InputAudioTrack } from "mediabunny";
import type { MediaInput } from "../../types/media.js";

// Количество точек дорожки, которое требует серверный контракт v2
const DEFAULT_SAMPLES = 60;

// Порог длительности: короче декодируем целиком через decodeAudioData
// (быстро и дёшево), длиннее — стримим через AudioSampleSink, чтобы не
// держать весь трек в памяти (10-минутный PCM f32 — это ~212 МБ).
const STREAM_THRESHOLD_SECONDS = 60;

// Форматы, из которых умеем читать аудиодорожку через Mediabunny.
// Голосовые заметки пишутся Ogg/Opus, треки — MP3/M4A/FLAC/WAV.
const AUDIO_FORMATS = [MP3, OGG, WAVE, FLAC, MP4, QTFF];

/**
 * ***************************************************************************
 * Извлекает данные о громкости (пики) из аудио-файла.
 *
 * Зачем потоковый режим. decodeAudioData декодирует ВЕСЬ файл в память:
 * 10-минутный трек в PCM float32 при 44.1 кГц стерео — это ~212 МБ, на
 * телефоне такой расчёт сливает память вкладки. Поэтому длинные треки
 * читаются потоково через AudioSampleSink (пачками, без полного
 * декодирования), а короткие — по-старому, через decodeAudioData.
 *
 * Результат нормализуется идентично старому серверу: пики делятся на
 * максимум, округляются до 3 знаков, null/NaN -> 0.
 *
 * Функция никогда не бросает исключение: битый файл даёт пустой массив,
 * а не рвёт импорт остальных вложений.
 *
 * @param {File|Blob} file - Аудио-файл.
 * @param {number} [samples=60] - Количество полосок на выходе.
 * @returns {Promise<number[]>} - Массив чисел от 0 до 1.
 * ***************************************************************************
 */
export async function getWaveformPoints(file: MediaInput, samples: number = DEFAULT_SAMPLES): Promise<number[]> {

    try {

        // ---------- STRATEGY SELECT ----------
        // Узнаём длительность из метаданных контейнера (дёшево, без
        // полного чтения) и выбираем способ декодирования по порогу.
        const duration = await _readDuration(file);

        if (duration !== null && duration >= STREAM_THRESHOLD_SECONDS) {
            return await _streamWaveform(file, samples);
        }

        return await _decodeWaveform(file, samples);

    } catch (error) {

        // Битый файл / нет WebCodecs — пустая дорожка, но без падений
        return [];

    }

}

/**
 * ***************************************************************************
 * Узнаёт длительность аудиофайла через MediaBunny (из метаданных контейнера).
 *
 * @param {File|Blob} file - Аудио-файл.
 * @returns {Promise<number|null>} - Длительность в секундах или null.
 * ***************************************************************************
 */
async function _readDuration(file: MediaInput): Promise<number | null> {

    const input = new Input({
        formats: AUDIO_FORMATS,
        source: new BlobSource(file)
    });

    try {

        // Метаданные контейнера обычно содержат длительность; если нет —
        // точный расчёт по трекам тоже допустим на этой стадии
        const fromMetadata = await input.getDurationFromMetadata();
        if (typeof fromMetadata === "number" && Number.isFinite(fromMetadata)) {
            return fromMetadata;
        }

        const computed = await input.computeDuration();
        return (typeof computed === "number" && Number.isFinite(computed)) ? computed : null;

    } catch (error) {

        // Не смогли открыть (нет WebCodecs / неподдерживаемый формат) —
        // пусть решает вызывающий путь: неизвестная длительность трактуется
        // как «короткий файл» и уходит в decodeAudioData
        return null;

    } finally {

        // Освобождаем источник в любом случае
        input.dispose();

    }

}

/**
 * ***************************************************************************
 * Потоковое чтение громкости через AudioSampleSink (для длинных треков).
 *
 * Идём по сэмплам пачками, каждый фрейм раскладываем по бакету
 * «время / (длительность / samples)» и усредняем амплитуду по бакетам.
 * Полный PCM в память не попадает ни в какой момент.
 *
 * @param {File|Blob} file - Аудио-файл.
 * @param {number} samples - Количество полосок.
 * @returns {Promise<number[]>} - Нормализованные пики 0..1.
 * ***************************************************************************
 */
async function _streamWaveform(file: MediaInput, samples: number): Promise<number[]> {

    const input = new Input({
        formats: AUDIO_FORMATS,
        source: new BlobSource(file)
    });

    try {

        const track = await input.getPrimaryAudioTrack();
        if (!track) return [];

        // Длительность из метаданных; если вдруг исчезла — считаем точно
        const duration = await _readDurationForTrack(input, track);

        const sink = new AudioSampleSink(track);

        // Бакеты: сумма амплитуд и число фреймов в каждом
        const sums = new Array<number>(samples).fill(0);
        const counts = new Array<number>(samples).fill(0);

        const bucketTime = duration / samples;

        for await (const sample of sink.samples()) {

            // Копируем первый канал во float32 (interleaved: длина = фреймы x каналы)
            const interleaved = new Float32Array(sample.numberOfFrames * sample.numberOfChannels);
            sample.copyTo(interleaved, { planeIndex: 0, format: "f32" });

            for (let i = 0; i < sample.numberOfFrames; i++) {

                const value = interleaved[i * sample.numberOfChannels];
                if (typeof value !== "number" || !Number.isFinite(value)) continue; // null/NaN -> 0

                const time = sample.timestamp + (i / sample.sampleRate);
                const bucket = Math.min(samples - 1, Math.max(0, Math.floor(time / bucketTime)));

                sums[bucket] = (sums[bucket] ?? 0) + Math.abs(value);
                counts[bucket] = (counts[bucket] ?? 0) + 1;

            }

            // Сэмпл — ресурс, закрываем сразу после чтения
            sample.close();

        }

        return _normalize(sums, counts, samples, duration);

    } finally {

        // Освобождаем источник в любом случае
        input.dispose();

    }

}

/**
 * ***************************************************************************
 * Длительность для потокового пути (из метаданных, с фолбэком на расчёт).
 *
 * @param {import("mediabunny").Input} input - Открытый вход.
 * @param {import("mediabunny").InputAudioTrack} track - Аудиодорожка.
 * @returns {Promise<number>} - Длительность в секундах.
 * ***************************************************************************
 */
async function _readDurationForTrack(input: Input, track: InputAudioTrack): Promise<number> {

    const fromMetadata = await input.getDurationFromMetadata();
    if (typeof fromMetadata === "number" && Number.isFinite(fromMetadata) && fromMetadata > 0) {
        return fromMetadata;
    }

    const computed = await input.computeDuration([track]);
    if (typeof computed === "number" && Number.isFinite(computed) && computed > 0) {
        return computed;
    }

    // Совсем не узнали — это уже аномалия, но дорожку всё равно вернём
    return 1;

}

/**
 * ***************************************************************************
 * Декодирование короткого файла целиком через decodeAudioData.
 *
 * @param {File|Blob} file - Аудио-файл.
 * @param {number} samples - Количество полосок.
 * @returns {Promise<number[]>} - Нормализованные пики 0..1.
 * ***************************************************************************
 */
async function _decodeWaveform(file: MediaInput, samples: number): Promise<number[]> {

    const arrayBuffer = await file.arrayBuffer();
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) {
        throw new Error("AudioContext недоступен");
    }

    const audioContext = new AudioContextClass();

    try {

        // Декодируем аудио (работает для ogg, mp4, wav)
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        const rawData = audioBuffer.getChannelData(0); // Данные первого канала
        const blockSize = Math.floor(rawData.length / samples);
        const sums = new Array<number>(samples).fill(0);
        const counts = new Array<number>(samples).fill(0);

        for (let i = 0; i < samples; i++) {
            const blockStart = blockSize * i;
            let sum = 0;
            for (let j = 0; j < blockSize; j++) {
                sum = sum + Math.abs(rawData[blockStart + j] ?? 0); // Амплитуда
            }
            sums[i] = sum;
            counts[i] = blockSize;
        }

        return _normalize(sums, counts, samples, audioBuffer.duration);

    } finally {

        // Освобождаем контекст даже при ошибке декодирования, иначе после
        // нескольких голосовых сообщений останется много активных AudioContext.
        if (typeof audioContext.close === "function") {
            try {
                await audioContext.close();
            } catch (error) {
                console.error("Waveform AudioContext close error:", error);
            }
        }

    }

}

/**
 * ***************************************************************************
 * Нормализует амплитуды бакетов: среднее по бакету, деление на максимум,
 * округление до 3 знаков, null/NaN -> 0.
 *
 * @param {number[]} sums - Суммы амплитуд по бакетам.
 * @param {number[]} counts - Число фреймов по бакетам.
 * @param {number} samples - Количество полосок.
 * @param {number} duration - Длительность (не используется напрямую, оставлена
 *   для симметрии сигнатуры).
 * @returns {number[]} - Нормализованные пики 0..1.
 * ***************************************************************************
 */
function _normalize(sums: number[], counts: number[], samples: number, duration: number): number[] {

    // Средние амплитуды по бакетам (пустой бакет — тишина)
    const averages: number[] = [];
    for (let i = 0; i < samples; i++) {
        const count = counts[i] ?? 0;
        const value = count > 0 ? (sums[i] ?? 0) / count : 0;
        averages.push(Number.isFinite(value) ? value : 0);
    }

    // Самый громкий пик = 1
    let max = 0;
    for (const value of averages) {
        if (value > max) max = value;
    }

    if (max <= 0) return averages.map(() => 0);

    // Округление до 3 знаков — ровно как делал старый сервер
    return averages.map(value => Number(((value / max)).toFixed(3)));

}