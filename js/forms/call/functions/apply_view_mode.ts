// Импортируем config
import { CALL_MAX_GRID_COLUMNS, CALL_MIN_TILE_PX, CALL_GRID_GAP } from "../../../config/constants.js";

// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем functions
import { applyImmersive } from "../handlers/toggle_immersive.js";
import { syncMiniTileDrag } from "./self_view.js";

// Импортируем типы
import type { Call } from "../index.js";
import type { CallTileRole, CallViewMode } from "../types.js";

/**
 * Длительность анимации «устаивания» раскладки. Должна совпадать с
 * `call-settle` в css/forms/call.css: класс снимается по таймеру,
 * а не по событию animationend (см. settleLayout).
 */
const SETTLE_MS = 240;

/**
 * ***************************************************************************
 * Раскладывает участников звонка по экрану.
 *
 * У каждого участника есть ровно одна роль, и роли эти одинаковы для чужих
 * плиток и для плашки «я» (см. css/forms/call.css):
 *
 *   - `stage`  — на сцене, занимает рабочую область;
 *   - `corner` — в углу, движимая мини-плитка;
 *   - `null`   — в группе вне сцены, спрятан.
 *
 * Отсюда и режимы:
 *
 *   - `spotlight` — ровно двое: один на сцене, второй в углу. Клик по
 *     угловой плитке меняет их местами — это смена роли, ничего больше;
 *   - `grid`      — 3+ участника: сцены нет, все равны, колонки считаются
 *     от доступной площади, а не от брейкпоинта окна (см. pickGridColumns);
 *   - `focus`     — по клику на плитку в сетке: выбранный на сцене,
 *     остальные спрятаны, кнопка в шапке возвращает в сетку.
 *
 * Элементы никуда не переносятся и не пересоздаются — меняются только
 * классы, поэтому видео при смене раскладки не перезапускается.
 * @param form - Экземпляр формы.
 * @returns {void}
 * ***************************************************************************
 */
export function applyViewMode(form: Call): void {

    try {

        const list = form?.list;
        if (!list) return;

        // ---------- СБРОС ----------
        // Роли назначаются заново на каждом проходе: элементы остаются
        // на месте, меняется лишь то, кому что позволено. Плашка «я»
        // лежит внутри списка (в сетке она равная ячейка), но в набор
        // чужих плиток не входит — роль она получает отдельно ниже
        const localItem = form?.selfTile?.firstElementChild;
        const tiles = Array.from(list.children).filter(
            (node): node is HTMLElement => node instanceof HTMLElement
                && node.classList.contains("item")
                && node !== localItem
        );
        tiles.forEach(item => setRole(item, null));
        // ---------- СБРОС ----------

        // Собеседник ещё не в комнате — раскладывать нечего, своя плашка
        // просто стоит в углу (во время прозвона она поверх оверлея)
        if (tiles.length === 0) {
            form.viewMode = null;
            setRole(form?.selfTile, "corner");
            syncGridButton(form, null);
            form.tpl?.classList.remove("call-floating-bars");
            syncMiniTileDrag(form, form?.selfTile);
            return;
        }

        // ---------- РЕЖИМ ----------
        const localIdentity = form?.room?.localParticipant?.identity || null;

        // Что было нарисовано до этого прохода: режим меняется не только
        // кликом, но и составом комнаты, и переход из пары в группу нужно
        // отличить от обычного перестроения
        const resolved = resolveMode({
            remoteIdentities: tiles.map(item => item.dataset.identity),
            localIdentity: localIdentity,
            stageIdentity: form.stageIdentity,
            wasMode: form.viewMode
        });

        const mode = resolved.mode;
        form.stageIdentity = resolved.stageIdentity;
        form.viewMode = mode;

        // Что нарисовано прямо сейчас: по этому отличаем реальную смену
        // режима от обычного перестроения из-за вошедшего участника
        const wasLayout: CallViewMode | null = list.classList.contains("call-layout-grid") ? "grid"
            : list.classList.contains("call-layout-focus") ? "focus"
                : list.classList.contains("call-layout-spotlight") ? "spotlight" : null;

        list.classList.toggle("call-layout-spotlight", mode === "spotlight");
        list.classList.toggle("call-layout-grid", mode === "grid");
        list.classList.toggle("call-layout-focus", mode === "focus");

        if (wasLayout && wasLayout !== mode) settleLayout(list, form);
        // ---------- РЕЖИМ ----------

        // Прятать панели можно только там, где есть одно крупное видео:
        // в сетке скрытие футера просто накрыло бы нижний ряд плиток
        if (mode === "grid" && form.isImmersive) applyImmersive(form, false);

        // Кнопка «в сетку» нужна только в режиме фокуса
        syncGridButton(form, mode);

        // Панели плавают над видео везде, кроме сетки: там раскладка
        // оставляет под футером место, чтобы не накрывать плитки
        form.tpl?.classList.toggle("call-floating-bars", mode !== "grid");

        // ---------- СЕТКА ----------
        if (mode === "grid") {

            // Сцены нет ни у кого, своя плашка становится равной ячейкой
            // сетки: роль снимается, и в CSS плашка без роли ведёт себя
            // как обычная плитка (4:3, подпись с именем)
            setRole(form?.selfTile, null);

            // Число колонок по доступной площади, а не по ширине окна.
            // Считается только от чужих плиток: своя ячейка — четвёртая
            // в сетке — просто достаёт место в том же ряду
            const columns = pickGridColumns(list, tiles.length);
            for (let i = 1; i <= CALL_MAX_GRID_COLUMNS; i++) {
                list.classList.toggle(`call-cols-${i}`, i === columns);
            }

            // В сетке угол пуст — перетаскивание снимается
            syncMiniTileDrag(form, null);
            return;

        }
        // ---------- СЕТКА ----------

        applyStage(list, tiles, form, localIdentity, mode);

    } catch (error) {
        Logger.error("🚨 [app][call]: Ошибка раскладки звонка:", error);
    }

}

/**
 * ***************************************************************************
 * Выставляет роли «сцена / угол» для режимов spotlight и focus.
 *
 * Роли считает чистая функция resolveStageRoles — здесь они лишь ложатся
 * на элементы. В паре обе роли заняты: тот, кто не на сцене, обязан быть
 * в углу — на этом и построен обмен местами. В группе несценические просто
 * спрятаны, а угол занимает своя плашка.
 * @param list - Контейнер раскладки.
 * @param tiles - Плитки участников (только чужие).
 * @param form - Экземпляр формы.
 * @param localIdentity - Identity локального участника.
 * @param mode - Режим раскладки.
 * @returns {void}
 * ***************************************************************************
 */
function applyStage(list: HTMLElement, tiles: HTMLElement[], form: Call, localIdentity: string | null, mode: CallViewMode): void {

    const roles = resolveStageRoles({
        remoteIdentities: tiles.map(item => item.dataset.identity),
        localIdentity: localIdentity,
        stageIdentity: form.stageIdentity,
        mode: mode
    });

    tiles.forEach(item => {
        setRole(item, roleOf(item.dataset.identity, roles));
    });

    setRole(form.selfTile, roleOf(localIdentity, roles));

    // Угол всегда занят, иначе перетаскивание не к чему привязать
    syncMiniTileDrag(form, findCorner(form, list));

}

/**
 * Какая роль у конкретного участника по готовому расчёту.
 * @param identity - Identity участника.
 * @param roles - Роли (сцена и угол).
 * @returns Роль плитки ("stage" | "corner") либо null.
 */
function roleOf(identity: string | null | undefined, roles: { stage: string | null; corner: string | null }): CallTileRole | null {

    if (identity && identity === roles.stage) return "stage";
    if (identity && identity === roles.corner) return "corner";

    return null;

}

/**
 * Результат расчёта режима раскладки.
 */
export interface ResolvedViewMode {

    /** Режим раскладки. */
    mode: CallViewMode;

    /** Кто должен быть на сцене (null — сцены нет). */
    stageIdentity: string | null;

}

/**
 * ***************************************************************************
 * Определяет режим раскладки и, если нужно, того, кто на сцене.
 *
 * Чистая функция: ничего не трогает, только считает — поэтому её можно
 * проверить тестом без браузера.
 *
 * В паре сцена всегда конкретна: по умолчанию там собеседник, своё видео
 * попадает туда только по обмену. Обе ситуации держит одно поле
 * `stageIdentity` — второго флага под «обмен местами» не нужно.
 * @param params - Входные данные расчёта.
 * @returns Режим и участник на сцене.
 * ***************************************************************************
 */
export function resolveMode(params: {

    /** Identity чужих участников. */
    remoteIdentities: (string | undefined)[];

    /** Identity локального участника. */
    localIdentity: string | null;

    /** Кто сейчас на сцене. */
    stageIdentity: string | null;

    /** Режим, нарисованный до этого прохода. */
    wasMode: CallViewMode | null;

}): ResolvedViewMode {

    // Ровно двое — личный звонок
    if (params.remoteIdentities.length === 1) {

        const isSelfStage = Boolean(params.localIdentity) && params.stageIdentity === params.localIdentity;

        return {
            mode: "spotlight",
            stageIdentity: isSelfStage ? params.localIdentity : params.remoteIdentities[0] ?? null
        };

    }

    // Из личного звонка в группу сцена не переезжает: в паре она была
    // просто «кто крупный», а в группе её выбирают кликом по плитке в
    // сетке — поэтому по умолчанию здесь сетка
    if (params.wasMode === "spotlight") return { mode: "grid", stageIdentity: null };

    // Своё видео в группе на сцене не бывает: там сетка или чужой участник
    const isStaged = params.stageIdentity !== null
        && params.stageIdentity !== params.localIdentity
        && params.remoteIdentities.includes(params.stageIdentity);

    if (isStaged) return { mode: "focus", stageIdentity: params.stageIdentity };

    // Выбранного участника больше нет — возвращаемся в сетку
    return { mode: "grid", stageIdentity: null };

}

/**
 * Роли участников в режиме со сценой.
 */
export interface StageRoles {

    /** Участник на сцене. */
    stage: string | null;

    /** Участник в углу (движимая мини-плитка). */
    corner: string | null;

}

/**
 * ***************************************************************************
 * Считает, кому досталась сцена, а кому угол в режимах со сценой.
 * @param params - Входные данные расчёта.
 * @returns Роли. Остальные участники в режимах со сценой спрятаны.
 * ***************************************************************************
 */
export function resolveStageRoles(params: {

    /** Identity чужих участников. */
    remoteIdentities: (string | undefined)[];

    /** Identity локального участника. */
    localIdentity: string | null;

    /** Кто должен быть на сцене. */
    stageIdentity: string | null;

    /** Режим раскладки. */
    mode: CallViewMode;

}): StageRoles {

    // В сетке ни сцены, ни угла: плашка «я» там равная ячейка списка
    if (params.mode === "grid") return { stage: null, corner: null };

    // В паре обе роли заняты: непременно остаётся один несценический
    if (params.remoteIdentities.length === 1) {

        const remote = params.remoteIdentities[0] ?? null;
        const selfOnStage = params.stageIdentity === params.localIdentity;

        return selfOnStage
            ? { stage: params.localIdentity, corner: remote }
            : { stage: remote, corner: params.localIdentity };

    }

    // Группа: на сцене выбранный участник, в углу своё видео
    return { stage: params.stageIdentity, corner: params.localIdentity };

}

/**
 * Навешивает на элемент одну из ролей — или снимает все.
 * @param element - Плашка «я» или плитка участника.
 * @param role - Роль ("stage" | "corner") либо null.
 * @returns {void}
 */
function setRole(element: HTMLElement | null | undefined, role: CallTileRole | null): void {

    if (!element) return;

    element.classList.toggle("call-stage", role === "stage");
    element.classList.toggle("call-corner", role === "corner");

}

/**
 * Ищет элемент, который сейчас занимает угол.
 *
 * Нужен для привязки перетаскивания: углом владеет то своё видео, то чужая
 * плитка — ровно один элемент на весь экран.
 * @param form - Экземпляр формы.
 * @param list - Контейнер раскладки.
 * @returns Элемент в углу (null — угол пуст).
 */
function findCorner(form: Call, list: HTMLElement): HTMLElement | null {

    if (form?.selfTile?.classList.contains("call-corner")) return form.selfTile;

    return list.querySelector<HTMLElement>(":scope .call-corner");

}

/**
 * Считает, сколько колонок в сетке даст плитки нормального размера.
 *
 * Брейкпоинт по ширине окна для звонка не годится: телефон в альбомной
 * ориентации шире 480px, но по-прежнему не вытянет четыре колонки. Поэтому
 * берётся самый широкий вариант, при котором каждая плитка остаётся крупнее
 * CALL_MIN_TILE_PX по обеим сторонам.
 * @param list - Контейнер раскладки.
 * @param count - Число участников.
 * @returns Число колонок.
 */
function pickGridColumns(list: HTMLElement, count: number): number {

    const rect = list.getBoundingClientRect();
    if (!rect.width || !rect.height) return Math.min(count, CALL_MAX_GRID_COLUMNS);

    // Вычитаем отступы самой раскладки: колонки считаются от полезной области
    const style = getComputedStyle(list);
    const usableW = rect.width - parseFloat(style.paddingLeft || "0") - parseFloat(style.paddingRight || "0");
    const usableH = rect.height - parseFloat(style.paddingTop || "0") - parseFloat(style.paddingBottom || "0");

    const maxColumns = Math.min(count, CALL_MAX_GRID_COLUMNS);
    let best = 1;

    for (let columns = 1; columns <= maxColumns; columns++) {

        const rows = Math.ceil(count / columns);
        const cellW = (usableW - CALL_GRID_GAP * (columns - 1)) / columns;
        const cellH = (usableH - CALL_GRID_GAP * (rows - 1)) / rows;

        if (cellW >= CALL_MIN_TILE_PX && cellH >= CALL_MIN_TILE_PX) best = columns;

    }

    return best;

}

/**
 * Показывает или прячет кнопку «вернуться в сетку».
 *
 * Она нужна только в режиме фокуса: крупная плитка занята иммерсивным
 * режимом, поэтому без кнопки способа вернуть участников не было бы вовсе.
 * @param form - Экземпляр формы.
 * @param mode - Текущий режим.
 * @returns {void}
 */
function syncGridButton(form: Call, mode: CallViewMode | null): void {

    const button = form?.tpl?.querySelector<HTMLElement>(":scope > [data-header] [data-back-to-grid]");
    if (!button) return;

    const isVisible = mode === "focus";

    // Пара hidden/flex: в собранном Tailwind .hidden идёт после .flex
    button.classList.toggle("hidden", !isVisible);
    button.classList.toggle("flex", isVisible);

}

/**
 * Перезапускает анимацию «устаивания» раскладки.
 *
 * Класс снимается и ставится заново с принудительным чтением раскладки:
 * без этого повторное добавление того же класса в том же кадре браузер
 * проигнорирует и анимация не начнётся второй раз.
 * @param list - Контейнер раскладки.
 * @param form - Экземпляр формы (нужен для хранения таймера).
 * @returns {void}
 */
function settleLayout(list: HTMLElement, form: Call): void {

    list.classList.remove("call-settling");

    // Принудительный reflow: только он заставляет браузер считать
    // повторное добавление класса новым изменением
    void list.offsetWidth;

    list.classList.add("call-settling");

    // Класс снимаем сами: ждать animationend опасно — анимация
    // отключается в prefers-reduced-motion и событие не придёт вовсе
    if (form.settleTimer !== null) clearTimeout(form.settleTimer);
    form.settleTimer = setTimeout(() => {
        list.classList.remove("call-settling");
    }, SETTLE_MS);

}
