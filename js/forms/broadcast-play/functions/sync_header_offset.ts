// Импортируем типы
import type { BroadcastPlay } from "../index.js";

/**
 * ***************************************************************************
 * SYNC_HEADER_OFFSET - следит за высотой шапки формы и пишет её в
 * CSS-переменную `--bp-header-height`.
 *
 * Зачем отдельная переменная
 * ------------------------------------------------
 * Шапка формы абсолютная (`CDM_FORM_HEADER_CLASSES`), а её высоту нельзя
 * вычислить в CSS: на неё влияют и медиазапрос, и системный масштаб
 * шрифта, и safe-area (`.cdm-form` сам объявляет `--form-header-height: 0px`,
 * поэтому `calc(var(--form-header-height, 0px) + …)` молча получал `0px`).
 *
 * Почему ResizeObserver, а не событие resize
 * ------------------------------------------------
 * Высоту шапки меняет ещё и изменение медиазапроса, и подстройка под
 * системный шрифт, и safe-area. Ни одно из этих событий не является
 * `resize` окна, поэтому на resize шапка оставалась бы устаревшей.
 *
 * @param form - Экземпляр формы.
 * @returns Функция отписки от наблюдателя либо null.
 * ***************************************************************************
 */
export function syncHeaderOffset(form: BroadcastPlay): (() => void) | null {

    // Без формы или без шапки отписываться нечего
    if (!form?.tpl || !form?.header) return null;

    // Без ResizeObserver откатываемся на одноразовое измерение: переменная
    // останется правильной на текущем кадре, просто не будет следить за
    // дальнейшими изменениями
    if (typeof ResizeObserver === "undefined") {
        form.tpl.style.setProperty("--bp-header-height", `${form.header.offsetHeight}px`);
        return null;
    }

    // Пишем высоту в переменную. Отдельная функция нужна, чтобы размер
    // обновлялся и как реакция ResizeObserver, и как разовый вызов сразу
    // после первого измерения
    const apply = () => {
        form.tpl?.style.setProperty("--bp-header-height", `${form.header?.offsetHeight}px`);
    };

    // Первое измерение — сразу, не дожидаясь срабатывания наблюдателя:
    // он отрабатывает асинхронно, и на первом кадре переменная была бы 0px
    apply();

    const observer = new ResizeObserver(apply);
    observer.observe(form.header);

    // Отписка нужна в _onBeforeClose(): наблюдатель переживёт форму и
    // продолжит писать в отсоединённый элемент
    return () => observer.disconnect();

}
