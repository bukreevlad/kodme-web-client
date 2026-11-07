// Импортируем типы
import type { ImageColors } from "../../types/media.js";

/**
 * Счётчик ячейки гистограммы (5 бит на канал RGB).
 */
interface ColorCell {
    /** Число пикселей в ячейке. */
    count: number;
    /** Сумма красного по ячейке. */
    rSum: number;
    /** Сумма зелёного по ячейке. */
    gSum: number;
    /** Сумма синего по ячейке. */
    bSum: number;
}

/**
 * ***************************************************************************
 * Извлекает доминирующий и акцентный цвета из изображения-источника.
 *
 * Зачем модуль. Раньше цвет считался на сервере через colorlip. Sharp и
 * colorlip удаляются вместе с storage-сервисом, а акцентный цвет нужен
 * всегда (тема чата, рамка превью, подложка в профиле), поэтому считаем
 * прямо в браузере на маленьком холсте — это дёшево и работает одинаково
 * для картинок, кадров видео и обложек аудио.
 *
 * Алгоритм:
 * 1. Рисуем источник на холст 48x48 (контекст с willReadFrequently).
 * 2. Квантуем цвет до 5 бит на канал — 32768 возможных ячеек вместо
 *    16.7 миллионов. Это отсекает JPEG-шум и градиенты.
 * 3. Считаем гистограмму ячеек (счёт + суммы каналов для среднего цвета).
 * 4. dominant — ячейка с максимальным счётом.
 * 5. accent — ячейка с максимумом (насыщенность x частота x штраф за
 *    близость к dominant). Так обложка не может быть «тем же серым».
 * 6. is_dark — средняя яркость (Rec. 709) всех пикселей < 128.
 *
 * Функция никогда не бросает исключение: один битый источник (tainted
 * canvas, нулевые размеры) не должен ронять обработку всего вложения.
 * В худшем случае вернётся null, и UI использует нейтральную палитру темы.
 *
 * @param {CanvasImageSource} source - Источник (img, video, canvas, ImageBitmap).
 * @returns {ImageColors | null} - Цвета в формате "#rrggbb" и флаг тёмной подложки.
 * ***************************************************************************
 */
export function extractImageColors(source: CanvasImageSource): ImageColors | null {

    try {

        // ---------- ОТРИСОВКА НА МАЛЕНЬКИЙ ХОЛСТ ----------
        // 48x48 хватает для статистики, а чтение пикселей стоит дёшево.
        // willReadFrequently просит браузер держать буфер в CPU-памяти,
        // иначе каждый getImageData прогонял бы данные через GPU.
        const SIZE = 48;

        const canvas = document.createElement("canvas");
        canvas.width = SIZE;
        canvas.height = SIZE;

        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return null;

        ctx.drawImage(source, 0, 0, SIZE, SIZE);

        // ---------- ГИСТОГРАММА ----------
        // Каждый пиксель падает в одну из 32768 ячеек (5 бит на канал).
        // В ячейке копим счёт и суммы каналов — по ним потом считается
        // средний цвет ячейки, доминанта и акцент.
        const { data } = ctx.getImageData(0, 0, SIZE, SIZE);

        const cells = new Map<number, ColorCell>();
        let lumaSum = 0;      // Сумма яркостей для is_dark
        let opaqueCount = 0;  // Непрозрачные пиксели (по ним усредняем яркость)

        for (let i = 0; i < data.length; i += 4) {

            const r = data[i] ?? 0;
            const g = data[i + 1] ?? 0;
            const b = data[i + 2] ?? 0;

            // Прозрачные пиксели (PNG с альфой) цвета не дают
            if (data[i + 3] === 0) continue;

            // Средняя яркость по Rec. 709 — только для is_dark
            lumaSum += 0.2126 * r + 0.7152 * g + 0.0722 * b;
            opaqueCount += 1;

            // Верхние 5 бит каждого канала дают индекс ячейки 0..32767
            const idx = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);

            let cell = cells.get(idx);
            if (!cell) {
                cell = { count: 0, rSum: 0, gSum: 0, bSum: 0 };
                cells.set(idx, cell);
            }

            cell.count += 1;
            cell.rSum += r;
            cell.gSum += g;
            cell.bSum += b;

        }

        // Пустой холст (всё прозрачное) — цветов нет
        if (cells.size === 0) return null;

        // ---------- HELPERS ----------
        // Средний цвет ячейки как [r, g, b] в полном диапазоне 0..255
        const cellColor = (cell: ColorCell): [number, number, number] => [
            Math.round(cell.rSum / cell.count),
            Math.round(cell.gSum / cell.count),
            Math.round(cell.bSum / cell.count)
        ];

        // Цвет ячейки в формате "#rrggbb"
        const toHex = ([r, g, b]: [number, number, number]): string => "#" + [r, g, b]
            .map(value => Math.max(0, Math.min(255, value)).toString(16).padStart(2, "0"))
            .join("");

        // ---------- DOMINANT ----------
        // Доминирующий цвет — ячейка с максимальным числом пикселей
        let dominant: ColorCell | null = null;
        for (const cell of cells.values()) {
            if (!dominant || cell.count > dominant.count) dominant = cell;
        }

        // Ячейки гарантированно есть (пустой холст отсечён выше) и цикл
        // выбрал доминанту — проверка лишь суждает тип для вычислений
        if (!dominant) return null;

        // ---------- ACCENT ----------
        // Акцент — ячейка с максимумом (насыщенность x частота x удалённость
        // от доминанты). Серая монохромная картинка так и остаётся серой,
        // а вот обложка «чёрный текст на белом» не выберет доминанту.
        const dominantColor = cellColor(dominant);

        // Максимально возможное расстояние в RGB-кубе (для нормировки)
        const maxDist = Math.sqrt(3) * 255;

        let accent = dominant;
        let accentScore = -1;

        for (const cell of cells.values()) {

            const [r, g, b] = cellColor(cell);

            // Насыщенность по HSV: 0 у серых ячеек
            const maxC = Math.max(r, g, b) / 255;
            const minC = Math.min(r, g, b) / 255;
            const saturation = maxC === 0 ? 0 : (maxC - minC) / maxC;

            // Нормированное расстояние до доминанты (0..1)
            const dist = Math.sqrt(
                (r - dominantColor[0]) ** 2 +
                (g - dominantColor[1]) ** 2 +
                (b - dominantColor[2]) ** 2
            ) / maxDist;

            // Метрика: насыщенность x частота x (0.25 + 0.75 * удалённость).
            // Множитель при dist не даёт accent выродиться в случайную
            // дальнюю ячейку с одним пикселем — частота всё ещё важна.
            const score = saturation * cell.count * (0.25 + 0.75 * dist);

            if (score > accentScore) {
                accentScore = score;
                accent = cell;
            }

        }

        // ---------- IS_DARK ----------
        // Средняя яркость по Rec. 709 < 128 — подложка «тёмная»
        const is_dark = opaqueCount > 0 && (lumaSum / opaqueCount) < 128;

        return {
            dominant: toHex(cellColor(dominant)),
            accent: toHex(cellColor(accent)),
            is_dark
        };

    } catch (error) {

        // Любой сбой (tainted canvas, битый источник) — честный null,
        // UI подставит нейтральную палитру темы
        return null;

    }

}