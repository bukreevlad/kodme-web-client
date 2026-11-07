// Импортируем типы
import {
    isMeetLayout,
    type MeetBlockFlag,
    type MeetBlockRecord,
    type MeetBlocks,
    type MeetBlocksMap,
    type MeetLayout,
    type MeetRoomState
} from "../types.js";

/**
 * ***************************************************************************
 * Разбор и нормализация состояния комнаты конференции.
 *
 * Состояние приходит одной строкой в `room.metadata` комнаты LiveKit
 * (без миграции БД) и разлетается всем участникам событием
 * `RoomEvent.RoomMetadataChanged`. Логика разбора намеренно зеркалит
 * серверную (`MeetManager.parseRoomState`): мусор в строке не должен
 * ронять форму, а неизвестные значения — превращаться в «истину».
 *
 * Состояние состоит из четырёх частей:
 *   - `layout` — принудительный режим сетки;
 *   - `focus` — ПРИНУДИТЕЛЬНЫЙ ФОКУС: кого организатор сделал крупным
 *     у всех. Отличается от личного закрепления тем, что это
 *     правило комнаты, а не личный выбор участника;
 *   - `defaults` — ПРАВИЛО КОМНАТЫ: что запрещено всем, кроме организатора,
 *     включая тех, кто ещё не зашёл. Благодаря нему запреты работают заранее;
 *   - `blocks` — карта ТОЧЕЧНЫХ отступлений от правила. Отсутствие записи
 *     означает «действует правило комнаты».
 *
 * Итоговые флаги участника получаются функцией `resolveBlocks`. Правило и
 * отступление нельзя было бы хранить одной картой: запрет «всем» обязан
 * переживать выход участника, иначе вернувшийся снова окажется без него.
 * ***************************************************************************
 */

/**
 * Режимы отображения сетки участников.
 * Порядок задаёт подсказку в меню: от простого к сложному.
 */
export const LAYOUTS: readonly MeetLayout[] = ["grid", "spotlight", "sidebar", "presentation"];

/**
 * Режим сетки по умолчанию. Совпадает с первым элементом LAYOUTS,
 * поэтому при `layout: null` разница для пользователя незаметна.
 */
export const DEFAULT_LAYOUT: MeetLayout = "grid";

/**
 * Имена независимых флагов блокировки:
 * камера, микрофон и демонстрация экрана блокируются по отдельности.
 */
export const BLOCK_FLAGS: readonly MeetBlockFlag[] = ["audio", "video", "screen"];

/**
 * Префикс identity участника-трансляции.
 * Трансляции заходят в конференцию через WHIP Ingress с identity `cast-<cast_id>`.
 */
export const CAST_IDENTITY_PREFIX = "cast-";

/**
 * ***************************************************************************
 * Приводит набор флагов блокировки к трём булевым полям.
 * Всё, что не равно строгому `true`, считается `false` — это защищает от
 * подделки строками вида `"true"` или `1`.
 * @param flags - Исходные флаги.
 * @returns Нормализованные флаги.
 * ***************************************************************************
 */
export function normalizeBlocks(flags?: Record<string, unknown>): MeetBlocks {

    const result = { audio: false, video: false, screen: false };
    for (const flag of BLOCK_FLAGS) {
        result[flag] = flags?.[flag] === true;
    }

    return result;

}

/**
 * ***************************************************************************
 * Пустой набор флагов — участнику ничего не запрещено.
 * @returns Пустые флаги.
 * ***************************************************************************
 */
export function emptyBlocks(): MeetBlocks {

    return normalizeBlocks({});

}

/**
 * ***************************************************************************
 * Нормализует ТОЧЕЧНОЕ отступление от правила комнаты.
 * Здесь, в отличие от `normalizeBlocks`, важно убрать лишнее: запись
 * хранит только флаги, которые реально отличаются от правила комнаты.
 * Всё, что не булево, отбрасывается — подделка строкой не должна ни
 * разрешить, ни запретить источник.
 * @param record - Исходная запись отступления.
 * @returns Только булевы отступления.
 * ***************************************************************************
 */
export function normalizeBlockRecord(record: unknown): MeetBlockRecord {

    const result: MeetBlockRecord = {};

    if (!record || typeof record !== "object" || Array.isArray(record)) return result;

    const source = record as Record<string, unknown>;

    for (const flag of BLOCK_FLAGS) {
        if (typeof source[flag] === "boolean") result[flag] = source[flag] as boolean;
    }

    return result;

}

/**
 * ***************************************************************************
 * Складывает правило комнаты и точечное отступление участника.
 * Точечное решение организатора важнее общего правила: иначе нельзя было
 * бы разрешить говорить одному человеку в конференции, где микрофон
 * запрещён всем.
 * @param defaults - Правило комнаты.
 * @param record - Точечное отступление участника.
 * @returns Итоговые флаги.
 * ***************************************************************************
 */
export function resolveBlocks(defaults?: Record<string, unknown>, record?: MeetBlockRecord): MeetBlocks {

    const blocks = normalizeBlocks(defaults);

    for (const flag of BLOCK_FLAGS) {
        if (typeof record?.[flag] === "boolean") blocks[flag] = record[flag];
    }

    return blocks;

}

/**
 * ***************************************************************************
 * Нормализует identity участника: строка непустой разумной длины.
 *
 * В `room.metadata` лежит содержимое документа комнаты, а не аргумент
 * только что проверенного запроса, — доверять ему нельзя. Всё, что не
 * строка, становится null, а не «каким-то участником».
 * @param value - Значение из metadata комнаты.
 * @returns Identity участника или null.
 * ***************************************************************************
 */
export function normalizeIdentity(value: unknown): string | null {

    if (typeof value !== "string") return null;

    const identity = value.trim();

    // 128 — предел identity в LiveKit, длиннее быть не может
    if (!identity || identity.length > 128) return null;

    return identity;

}

/**
 * Данные для выбора крупной плитки (см. `pickFocus`).
 */
export interface PickFocusParams {

    /** Принудительный фокус из metadata комнаты. */
    forced?: string | null;

    /** Лично закреплённый участник. */
    pinned?: string | null;

    /** Режим сетки. */
    layout?: MeetLayout | null;

    /** Identity в порядке хранилища. */
    ordered?: string[];

    /** Identity тех, кто делится экраном. */
    sharing?: string[];

}

/**
 * ***************************************************************************
 * Выбирает, чья плитка будет крупной.
 *
 * Функция чистая и вынесена сюда сознательно: порядок приоритетов — это
 * правило продукта, а не деталь отрисовки, и его обязана быть можно
 * проверить без DOM. Здесь же становится видно, что принудительный фокус
 * организатора важнее ВСЕГО остального, включая личное «Сделать главным»:
 * иначе обещание «у всех я буду главным» оказывалось бы неправдой
 * у того участника, который закрепил коллегу.
 *
 * Приоритеты, от высшего к низшему:
 *   1. принудительный фокус (`forced`);
 *   2. личное закрепление (`pinned`);
 *   3. в режиме презентации — тот, кто делится экраном;
 *   4. первый в порядке хранилища.
 *
 * Любой кандидат проверяется на присутствие среди отрисованных плиток:
 * ушедшего участника показывать нельзя, иначе крупная плитка останется
 * пустой. В этом случае выбор просто падает на следующий уровень.
 * @param params - Данные для выбора.
 * @returns Identity крупной плитки или null.
 * ***************************************************************************
 */
export function pickFocus({ forced, pinned, layout, ordered, sharing }: PickFocusParams = {}): string | null {

    const identities = Array.isArray(ordered) ? ordered.filter(Boolean) : [];

    // ---------- ПРИНУДИТЕЛЬНЫЙ ФОКУС ----------
    if (forced && identities.includes(forced)) return forced;
    // ---------- ПРИНУДИТЕЛЬНЫЙ ФОКУС ----------

    // ---------- ЛИЧНОЕ ЗАКРЕПЛЕНИЕ ----------
    if (pinned && identities.includes(pinned)) return pinned;
    // ---------- ЛИЧНОЕ ЗАКРЕПЛЕНИЕ ----------

    // ---------- ДЕМОНСТРАЦИЯ ----------
    // В режиме презентации приоритет у того, кто делится экраном.
    // Кто первый из делящих — тот и крупный: несколько демонстраций
    // разом показать крупно нельзя, и порядок хранилища здесь
    // единственное, чем можно выбирать
    if (layout === "presentation" && Array.isArray(sharing)) {
        const sharer = identities.find(identity => sharing.includes(identity));
        if (sharer) return sharer;
    }
    // ---------- ДЕМОНСТРАЦИЯ ----------

    return identities[0] || null;

}

/**
 * ***************************************************************************
 * Приводит metadata комнаты к нормализованному состоянию.
 * @param metadata - Строка metadata комнаты.
 * @returns Состояние комнаты.
 * ***************************************************************************
 */
export function parseRoomState(metadata?: string | null): MeetRoomState {

    // Пустое состояние по умолчанию. layout остаётся null: значит
    // «создатель ничего не навязал» и каждый смотрит как удобно ему.
    // focus — тоже null: «принудительного фокуса нет».
    // defaults — пустые флаги: «правила комнаты нет»
    const state: MeetRoomState = { layout: null, focus: null, defaults: emptyBlocks(), blocks: {} };

    // ---------- VALIDATE ----------
    // Комната могла достаться в наследство от прошлой версии или быть
    // переключена вручную через CLI — мусор не должен ронять форму
    let raw: unknown = null;
    try { raw = JSON.parse(metadata || "{}"); } catch (error) { raw = null; }
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return state;
    // ---------- VALIDATE ----------

    const source = raw as Record<string, unknown>;

    // Режим сетки принимаем только из известного набора
    if (isMeetLayout(source.layout)) {
        state.layout = source.layout;
    }

    // Принудительный фокус — строка identity, всё остальное в null
    state.focus = normalizeIdentity(source.focus);

    // Правило комнаты приводим к трём булевым флагам
    if (source.defaults && typeof source.defaults === "object" && !Array.isArray(source.defaults)) {
        state.defaults = normalizeBlocks(source.defaults as Record<string, unknown>);
    }

    // Карту точечных отступлений тоже нормализуем, но оставляем неполной:
    // флаг, совпадающий с правилом комнаты, смысла не несёт
    if (source.blocks && typeof source.blocks === "object" && !Array.isArray(source.blocks)) {
        for (const [identity, flags] of Object.entries(source.blocks as Record<string, unknown>)) {

            // Пустые identity и мусорные значения пропускаем
            if (!identity || typeof identity !== "string" || !flags || typeof flags !== "object") continue;

            state.blocks[identity] = normalizeBlockRecord(flags);

        }
    }

    return state;

}

/**
 * ***************************************************************************
 * Выводит организатора из-под правила комнаты.
 *
 * Правило «запрещено всем, кроме организатора» — это соглашение между
 * сервером и клиентом, а не строчка в `room.metadata`: в самой комнате
 * правило лежит общим для всех, и identity организатора там не записано.
 * Без этого шага клиент УЧАСТНИКА применял бы правило и к плитке
 * организатора, и тот видел бы у себя красную обводку и иконки запретов,
 * которых на самом деле нет (сервер организатора не трогает — см.
 * `MeetManager.generateToken`).
 *
 * Реализация через отступления, а не отдельное поле: организатор получает
 * явное `false` по всем флагам, поэтому его личные отступления (если они
 * когда-нибудь появятся) сохраняются, а правило до него не доходит.
 * @param state - Нормализованное состояние комнаты.
 * @param identity - Identity организатора конференции.
 * @returns Состояние, в котором организатор свободен от правила.
 * ***************************************************************************
 */
export function applyExempt(state: MeetRoomState, identity?: string | null): MeetRoomState {

    if (!state || !identity) return state;

    const record: MeetBlockRecord = {};
    for (const flag of BLOCK_FLAGS) record[flag] = false;

    return {
        ...state,
        blocks: {
            ...state.blocks,
            [identity]: { ...record, ...(state.blocks[identity] || {}) }
        }
    };

}

/**
 * ***************************************************************************
 * Возвращает ИТОГОВЫЕ флаги блокировки участника: правило комнаты плюс
 * его личное отступление. Отсутствие отступления — «действует правило».
 * @param state - Состояние комнаты { defaults, blocks }.
 * @param identity - Identity участника.
 * @returns Флаги участника.
 * ***************************************************************************
 */
export function resolveStateBlocks(state?: MeetRoomState | null, identity?: string | null): MeetBlocks {

    if (!identity) return emptyBlocks();

    return resolveBlocks(state?.defaults, state?.blocks?.[identity]);

}

/**
 * ***************************************************************************
 * Проверяет, установлен ли хотя бы один флаг блокировки.
 * @param blocks - Флаги блокировки.
 * @returns true, если участнику что-то запрещено.
 * ***************************************************************************
 */
export function hasAnyBlock(blocks?: MeetBlockRecord): boolean {

    return BLOCK_FLAGS.some(flag => blocks?.[flag] === true);

}

/**
 * ***************************************************************************
 * Проверяет, относится ли identity к трансляции.
 * @param identity - Identity участника в комнате LiveKit.
 * @returns true, если это трансляция.
 * ***************************************************************************
 */
export function isCastIdentity(identity?: string | null): boolean {

    return typeof identity === "string" && identity.startsWith(CAST_IDENTITY_PREFIX);

}

/**
 * ***************************************************************************
 * Определяет итоговый режим сетки.
 *
 * Приоритет у принудительного режима: если создатель конференции выбрал
 * режим для всех, личный выбор участника не применяется. Иначе каждый
 * смотрит так, как удобно ему.
 * @param forcedLayout - Принудительный режим из room.metadata.
 * @param localLayout - Личный выбор участника.
 * @returns Итоговый режим из набора LAYOUTS.
 * ***************************************************************************
 */
export function resolveLayout(forcedLayout?: MeetLayout | string | null, localLayout?: MeetLayout | string | null): MeetLayout {

    // Принудительный режим важнее, но только если он ещё актуален:
    // это защищает от мусора в metadata
    if (isMeetLayout(forcedLayout)) return forcedLayout;

    if (isMeetLayout(localLayout)) return localLayout;

    return DEFAULT_LAYOUT;

}
