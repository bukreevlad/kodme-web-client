// Импортируем utils
import { FileUploader } from "../network/file_uploader.js";

// Импортируем типы
import type { MediaBlobItem } from "../../types/media.js";

// Импортируем utils
import { getErrorCode, getErrorStatus } from "../helpers/error_util.js";

// Паузы между ретраями: 1 с, 2 с, 4 с
const RETRY_DELAYS = [1000, 2000, 4000];

// Сколько производных объектов грузить одновременно: на
// мобильном интернете шесть параллельных POST делят канал и всё становится
// медленнее, плюс держится слишком много незавершённых запросов
const DERIVED_CONCURRENCY = 3;

/**
 * Цель загрузки из ответа upload-сервиса.
 */
interface UploadTargetItem {
    /** Путь объекта в S3. */
    path: string;
    /** Роль объекта (original | thumbnail | rendition). */
    kind?: string;
    /** Ширина превью/рендерации. */
    width?: number;
    /** Метка рендерации качества. */
    label?: string;
    /** URL бакета. */
    url?: string;
    /** Поля presigned POST политики. */
    fields?: Record<string, string>;
    /** MIME-тип. */
    mime_type?: string;
    /** Максимальный размер. */
    max_size?: number;
}

/**
 * Блоб, сопоставленный с целью загрузки (путь берётся из ответа сервера).
 */
interface MatchedBlob {
    /** Путь объекта (совпадает с targets[].path). */
    path: string;
    /** Данные объекта. */
    blob: Blob;
    /** MIME-тип. */
    mime_type?: string | undefined;
}

/** Ответ upload-сервиса с целями загрузки. */
interface UploadRequest {
    /** Id документа. */
    document_id?: string;
    /** Цели загрузки (original + производные). */
    targets: UploadTargetItem[];
}

/** Колбэк суммарного прогресса загрузки. */
type ProgressEmit = (e: { path: string | null; loaded?: number | undefined; total?: number | undefined; percent: number }) => void;

/** Агрегатор суммарного прогресса по всем целям. */
interface ProgressAggregator {
    /** Обновить долю готовности одной цели. */
    update(path: string, ratio: number, loaded?: number, total?: number): void;
    /** Пометить цель полностью загруженной. */
    complete(path: string): void;
    /** Завершить шкалу (100%). */
    finish(): void;
}

/** Один файл производной загрузки. */
interface DerivedJob {
    /** Цель загрузки. */
    target: UploadTargetItem;
    /** Данные объекта. */
    blob: Blob;
}

/** Контекст одиночного POST (отмена, реестр активных, прогресс). */
interface PostContext {
    /** Сигнал отмены. */
    signal?: AbortSignal | undefined;
    /** Реестр активных загрузчиков (для общей отмены). */
    active?: Set<FileUploader>;
    /** Колбэк прогресса. */
    onProgress?: (loaded: number, total: number, percent: number) => void;
}

/** Результат загрузки производных объектов. */
interface UploadDerivedAssetsResult {
    /** Пути, которые дошли до S3. */
    uploaded: string[];
    /** Упавшие производные (путь + код ошибки). */
    failed: Array<{ path: string; code: string }>;
}

/**
 * ***************************************************************************
 * Загрузить объекты в S3 по выданным сервером presigned-целям.
 *
 * Два сценария вызова:
 * - вложения сообщений/комментариев — один блоб `kind: "original"`
 *   (превью и метадату создаёт сервер);
 * - обложки и файлы облака — `processMedia` приносит оригинал плюс
 *   производные, каждый блоб сопоставляется со своей целью.
 *
 * Оригинал идёт первым и в одиночку (упавший — фатален), остальные цели —
 * параллельно (лимит 3). Ретраи: три попытки с экспоненциальной
 * паузой на сетевых сбоях и 5xx; на 4xx — сразу.
 *
 * @param {Object} [e] - Объект { request, blobs, signal, onProgress }.
 * @returns {Promise<UploadDerivedAssetsResult>} - { uploaded, failed }.
 * @throws {ApiError} С кодом `UPLOAD_ABORTED` | `UPLOAD_FAILED`.
 * ***************************************************************************
 */
export async function uploadDerivedAssets(e: {
    request: UploadRequest;
    blobs: MatchedBlob[];
    signal?: AbortSignal;
    onProgress?: ProgressEmit;
}): Promise<UploadDerivedAssetsResult> {

    // ---------- VALIDATE ----------

    if (!e?.request?.targets || !Array.isArray(e.request.targets) || e.request.targets.length === 0) {
        throw new Error("UploadDerivedAssets: targets не пришли от сервера");
    }

    if (!Array.isArray(e?.blobs) || e.blobs.length === 0) {
        throw new Error("UploadDerivedAssets: нечего загружать");
    }

    // ---------- SET DEFAULT ----------

    // Индекс «путь объекта → цель загрузки»: сервер выдал URL только на то,
    // что он знает. Блобы, которым нет цели, молча пропускаем.
    const byPath = new Map<string, UploadTargetItem>(e.request.targets.map(target => [target.path, target]));

    // Активные загрузчики: по сигналу отмены прерываем все сразу
    const active = new Set<FileUploader>();

    // ---------- ABORT ----------

    if (e.signal) {

        // Прерываем все незавершённые POST. Каждый вызванный `abort()`
        // заставляет FileUploader отклонить свой промис с UPLOAD_ABORTED.
        e.signal.addEventListener("abort", () => {
            active.forEach(uploader => uploader.abort());
        }, { once: true });

    }

    // ---------- ORIGINAL ----------

    // Оригинал — единственная цель с `kind: "original"`. Остальное —
    // производные. Оригинал грузим строго один, первым и досрочно.
    const originalBlob = e.blobs.find(blob => byPath.get(blob.path)?.kind === "original")
        || e.blobs[0];
    if (!originalBlob) throw new Error("UploadDerivedAssets: нет блобов для загрузки");

    const originalTarget = byPath.get(originalBlob.path);

    if (!originalTarget) {
        throw new Error("UploadDerivedAssets: оригиналу не выдана цель загрузки");
    }

    const uploaded: string[] = [];

    // Суммарный прогресс по всем целям: размеры блобов известны до старта.
    const progress = _createProgressAggregator(e.blobs, e.onProgress);

    // Упавший после всех ретраев оригинал — фатальная ошибка.
    await _postWithRetry(originalTarget, originalBlob.blob, {
        signal: e.signal,
        active,
        onProgress: (loaded, total) => progress.update(originalTarget.path, total ? loaded / total : 0, loaded, total)
    });

    // Оригинал доехал — фиксируем его долю как полностью загруженную
    progress.complete(originalTarget.path);
    uploaded.push(originalTarget.path);

    // ---------- DERIVED ----------

    // Производные объекты: те блобы, у которых есть цель, но не оригинал.
    const derivedJobs: DerivedJob[] = [];

    for (const blob of e.blobs) {

        // Оригинал уже загружен, повторно не берём
        if (blob.path === originalTarget.path) continue;

        const target = byPath.get(blob.path);
        if (!target) continue; // сервер не выдавал URL на этот путь — не грузим

        derivedJobs.push({ target, blob: blob.blob });

    }

    // Упавшие производные не роняют операцию: фатален только оригинал
    const failed: Array<{ path: string; code: string }> = [];

    await _runConcurrent(derivedJobs, DERIVED_CONCURRENCY, async ({ target, blob }) => {

        try {

            await _postWithRetry(target, blob, {
                signal: e.signal,
                active,
                onProgress: (loaded, total) => progress.update(target.path, total ? loaded / total : 0, loaded, total)
            });

            // Цель доехала — фиксируем её долю как полностью загруженную
            progress.complete(target.path);
            uploaded.push(target.path);

        } catch (error) {

            // Отмена общая — не превращаем её в failed, а поднимаем наверх
            if (getErrorCode(error) === "UPLOAD_ABORTED") throw error;

            failed.push({ path: target.path, code: getErrorCode(error) || "UPLOAD_FAILED" });

        }

    });

    // Фаза загрузки закончена — шкала добивается до 100%
    progress.finish();

    // Возвращаем результат
    return { uploaded, failed };

}

/**
 * ***************************************************************************
 * Сопоставить блобы с целями загрузки из ответа upload-сервиса.
 *
 * Пути клиент не собирает сам — только берёт из ответа сервера.
 * Ключи сопоставления: оригинал — единственный, превью — по ширине,
 * рендерация — по метке качества. Блобы без цели отбрасываются: сервер
 * не выдавал URL на этот объект.
 *
 * @param {UploadTargetItem[]} targets - Цели из ответа upload-сервиса.
 * @param {MediaBlobItem[]} blobs - Блобы для загрузки (оригинал и/или производные).
 * @returns {MatchedBlob[]} - Готовый аргумент `blobs` для uploadDerivedAssets.
 * ***************************************************************************
 */
export function matchBlobsToTargets(targets: UploadTargetItem[], blobs: MediaBlobItem[]): MatchedBlob[] {

    if (!Array.isArray(targets) || !Array.isArray(blobs)) return [];

    // Индексы целей по семантике. Оригинал один, превью — по ширине,
    // рендерации — по метке качества.
    let original: UploadTargetItem | null = null;
    const thumbnailsByWidth = new Map<number, UploadTargetItem>();
    const renditionsByLabel = new Map<string, UploadTargetItem>();

    for (const target of targets) {

        if (target?.kind === "original") { original = target; continue; }

        // Превью без ширины и рендерация без метки не сматчатся с blob по
        // ключу — такие цели не индексируем
        if (target?.kind === "thumbnail") {
            if (target.width !== undefined) thumbnailsByWidth.set(target.width, target);
            continue;
        }
        if (target?.kind === "rendition") {
            if (target.label !== undefined) renditionsByLabel.set(target.label, target);
            continue;
        }

    }

    const list: MatchedBlob[] = [];

    for (const blob of blobs) {

        let target: UploadTargetItem | null = null;

        if (blob?.kind === "original") target = original;
        if (blob?.kind === "thumbnail") target = (blob.width !== undefined ? thumbnailsByWidth.get(blob.width) : undefined) || null;
        if (blob?.kind === "rendition") target = (blob.label !== undefined ? renditionsByLabel.get(blob.label) : undefined) || null;

        // Сервер не выдавал URL на этот объект — грузить нечем
        if (!target) continue;

        list.push({
            path: target.path,
            blob: blob.blob,
            mime_type: blob.mime_type || target.mime_type
        });

    }

    return list;

}

/**
 * ***************************************************************************
 * Агрегатор суммарного прогресса загрузки всех целей документа.
 *
 * Шкала считается как взвешенная сумма долей каждого POST:
 * percent = Σ (size_i × ratio_i) / Σ size_i. Доли, а не сырые байты, потому
 * что multipart-форма чуть тяжелее блоба. Ретрай берёт максимум доли,
 * complete() ставит 1, finish() добивает до 100%.
 *
 * @param {MatchedBlob[]} blobs - Блобы, которые будут загружены.
 * @param {ProgressEmit} [emit] - Колбэк на каждое обновление шкалы.
 * @returns {ProgressAggregator} - Агрегатор { update, complete, finish }.
 * ***************************************************************************
 */
function _createProgressAggregator(blobs: MatchedBlob[], emit?: ProgressEmit): ProgressAggregator {

    // ---------- SET DEFAULT ----------

    // Размеры целей берём из блобов — это ровно то, что уйдёт в S3
    const sizes = new Map<string, number>();
    let totalBytes = 0;

    for (const item of blobs) {
        const size = Number(item?.blob?.size) || 0;
        sizes.set(item.path, size);
        totalBytes += size;
    }

    // Доля готовности каждого пути (0..1)
    const ratios = new Map<string, number>();

    // ---------- EMIT ----------

    /**
     * ***************************************************************************
     * Посчитать суммарный процент и отдать его наружу.
     * @param {string | null} path - Путь цели, вызвавшей обновление.
     * @param {number} [loaded] - Байты текущего запроса.
     * @param {number} [total] - Общий размер текущего запроса.
     * @returns {void}
     * ***************************************************************************
     */
    const emitPercent = (path: string | null, loaded?: number, total?: number): void => {

        // Взвешенная сумма: каждый объект вносит вклад пропорционально размеру
        let doneBytes = 0;
        for (const [itemPath, size] of sizes) {
            doneBytes += size * (ratios.get(itemPath) || 0);
        }

        // Без размеров (пустой набор) считать нечего — загрузка завершена
        const percent = totalBytes > 0
            ? Math.min(100, Math.round((doneBytes / totalBytes) * 100))
            : 100;

        emit?.({ path, loaded, total, percent });

    };

    // ---------- API ----------

    return {

        /**
         * ***************************************************************************
         * Обновить долю готовности одной цели.
         * @param {string} path - Путь объекта.
         * @param {number} ratio - Доля 0..1 из `loaded / total` запроса.
         * @param {number} [loaded] - Байты запроса.
         * @param {number} [total] - Общий размер запроса.
         * @returns {void}
         * ***************************************************************************
         */
        update(path: string, ratio: number, loaded?: number, total?: number): void {

            // Цель не входит в набор загрузки — игнорируем
            if (!sizes.has(path)) return;

            // Максимум: ретрай начинает POST заново, назад шкала не едет
            ratios.set(path, Math.max(ratios.get(path) || 0, Math.min(1, Number(ratio) || 0)));
            emitPercent(path, loaded, total);

        },

        /**
         * ***************************************************************************
         * Пометить цель полностью загруженной (204 получен).
         * @param {string} path - Путь объекта.
         * @returns {void}
         * ***************************************************************************
         */
        complete(path: string): void {

            if (!sizes.has(path)) return;

            ratios.set(path, 1);
            emitPercent(path, sizes.get(path), sizes.get(path));

        },

        /**
         * ***************************************************************************
         * Завершить шкалу: 100% независимо от незакрытых долей.
         * @returns {void}
         * ***************************************************************************
         */
        finish(): void {
            emitPercent(null, totalBytes, totalBytes);
        }

    };

}

/**
 * ***************************************************************************
 * POST объекта с ретраями.
 *
 * Ретраим сетевые сбои (нет статуса) и 5xx. На 4xx останавливаемся сразу.
 * @param {UploadTargetItem} target - Цель загрузки.
 * @param {Blob} blob - Данные объекта.
 * @param {PostContext} ctx - Контекст: { signal, active, onProgress }.
 * @returns {Promise<void>}
 * @throws {ApiError} Последняя ошибка после всех ретраев.
 * ***************************************************************************
 */
async function _postWithRetry(target: UploadTargetItem, blob: Blob, ctx: PostContext): Promise<void> {

    let lastError: unknown = null;

    // 1 основная попытка + 3 ретрая
    for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {

        try {

            await _post(target, blob, ctx);
            return;

        } catch (error) {

            // Отмену и невалидные данные не ретраим — поднимаем сразу
            if (getErrorCode(error) === "UPLOAD_ABORTED" || getErrorCode(error) === "INVALID_FILE") {
                throw error;
            }

            // 4xx — баг клиента или отвержение политикой, ретрай бесполезен
            const status = getErrorStatus(error);
            if (status && status >= 400 && status < 500) {
                throw error;
            }

            lastError = error;

            // Сетевая ошибка (нет статуса) или 5xx — пауза и повтор.
            // Последняя попытка не ждёт: ретраять больше нечего.
            const retryDelay = RETRY_DELAYS[attempt];
            if (retryDelay !== undefined) {
                await _delay(retryDelay);
            }

        }

    }

    throw lastError;

}

/**
 * ***************************************************************************
 * Одиночный POST формы с файлом в S3.
 * @param {UploadTargetItem} target - Цель загрузки.
 * @param {Blob} blob - Данные объекта.
 * @param {PostContext} ctx - Контекст: { signal, active, onProgress }.
 * @returns {Promise<void>}
 * @throws {ApiError} С кодом из FileUploader.
 * ***************************************************************************
 */
async function _post(target: UploadTargetItem, blob: Blob, ctx: PostContext): Promise<void> {

    const uploader = new FileUploader({
        target: target,
        file: blob,
        callback: ctx.onProgress || (() => { })
    });

    // Регистрируем загрузчик, чтобы отмена прервала и его
    ctx.active?.add(uploader);

    try {

        await uploader.upload();

    } finally {

        ctx.active?.delete(uploader);
        uploader.destroy();

    }

}

/**
 * ***************************************************************************
 * Прогон заданий с ограничением параллелизма (пул воркеров).
 * @param {T[]} jobs - Задания.
 * @param {number} limit - Максимум одновременных выполнений.
 * @param {(job: T) => Promise<void>} worker - Асинхронная функция одного задания.
 * @returns {Promise<void>}
 * ***************************************************************************
 */
async function _runConcurrent<T>(jobs: T[], limit: number, worker: (job: T) => Promise<void>): Promise<void> {

    if (jobs.length === 0) return;

    let index = 0;

    const run = async (): Promise<void> => {

        while (index < jobs.length) {

            const job = jobs[index];
            index++;

            if (job !== undefined) await worker(job);

        }

    };

    const workers: Promise<void>[] = [];

    for (let i = 0; i < Math.min(limit, jobs.length); i++) {
        workers.push(run());
    }

    await Promise.all(workers);

}

/**
 * ***************************************************************************
 * Пауза перед ретраем.
 * @param {number} ms - Миллисекунды.
 * @returns {Promise<void>}
 * ***************************************************************************
 */
function _delay(ms: number): Promise<void> {

    return new Promise<void>(resolve => setTimeout(resolve, ms));

}
