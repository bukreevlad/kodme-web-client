// ***************************************************************************
// Доменные типы формы конференции (meet-play).
//
// Единое место для типов комнаты LiveKit, состояния конференции и элементов
// хранилища участников. Импортируются модулями handlers/ / functions/ /
// events/ / components/ / dialogs/, чтобы сигнатуры говорили об одних и тех
// же сущностях, а не о `Object`.
//
// Состояние комнаты (режим сетки, блокировки) приходит одной строкой в
// `room.metadata` и разбирается в `functions/parse_room_state.ts`; здесь —
// только форма, к которой разбор приводит.
// ***************************************************************************

// Импортируем сторонние пакеты
import type { Participant, RemoteParticipant } from "livekit-client";

// Импортируем типы
import type { StoreItem } from "../../utils/store.js";

/**
 * Режимы отображения сетки участников.
 * Значения совпадают с серверным белым списком `MeetManager.LAYOUTS`.
 */
export type MeetLayout = "grid" | "spotlight" | "sidebar" | "presentation";

/**
 * Независимые флаги блокировки источников:
 * камера, микрофон и демонстрация экрана блокируются по отдельности.
 */
export type MeetBlockFlag = "audio" | "video" | "screen";

/**
 * Итоговый набор флагов блокировки участника (все три ключа присутствуют).
 */
export type MeetBlocks = Record<MeetBlockFlag, boolean>;

/**
 * Точечное отступление участника от правила комнаты: записаны только
 * реально отличающиеся флаги, остальные ключи отсутствуют.
 */
export type MeetBlockRecord = Partial<MeetBlocks>;

/**
 * Карты точечных отступлений: identity участника → его отступление.
 */
export type MeetBlocksMap = Record<string, MeetBlockRecord>;

/**
 * Нормализованное состояние комнаты из `room.metadata`.
 */
export interface MeetRoomState {

    /** Принудительный режим сетки (null — не задан). */
    layout: MeetLayout | null;

    /** Принудительный фокус: identity крупной плитки у всех (null — не задан). */
    focus: string | null;

    /** Правило комнаты: что запрещено всем, кроме организатора. */
    defaults: MeetBlocks;

    /** Карта точечных отступлений от правила комнаты. */
    blocks: MeetBlocksMap;

}

/**
 * Данные элемента хранилища участников: объект участника LiveKit плюс
 * служебные поля, которые добавляют плита и события хранилища.
 */
export interface MeetParticipantItem extends StoreItem {

    /** Участник LiveKit (заполняется при синхронизации хранилища). */
    participant?: Participant | RemoteParticipant | undefined;

    /** Говорит ли участник сейчас (заполняется событием ActiveSpeakersChanged). */
    isSpeaking?: boolean;

    /** Корневые DOM-элементы плиток этого участника (может быть несколько копий). */
    __domElements__?: HTMLElement[];

    /** Функция отписки плитки от точечного события обновления. */
    __unsubscribeStore__?: (() => void) | null;

}

/**
 * Событие с координатами, по которым открывается контекстное меню.
 *
 * Покрывает `MouseEvent`, `TouchEvent`, вызов с клавиатуры и литералы:
 * обработчики меню читают только координаты (в т.ч. из `changedTouches`)
 * и зовут `preventDefault`.
 */
export interface MeetTriggerEvent {

    /** Координата X курсора (0, если события нет). */
    clientX?: number;

    /** Координата Y курсора (0, если события нет). */
    clientY?: number;

    /** Тач-точки: координаты берутся у первого касания. */
    changedTouches?: ArrayLike<{ clientX: number; clientY: number }>;

    /** Отмена стандартного поведения браузера (контекстного меню). */
    preventDefault?: () => void;

    /** Остановка всплытия (используется обработчиком удаления). */
    stopPropagation?: () => void;

}

/**
 * Данные трансляции, которые читает форма конференции (ответ `Broadcasts`).
 */
export interface MeetCastData {

    /** Id трансляции. */
    id: string;

    /** Отображаемое имя трансляции. */
    name?: string;

}

/**
 * Meta конференции из ответа `meets/open`: строка таблицы `meets` плюс
 * подписанные токеном адреса и токен входа в комнату LiveKit.
 */
export interface MeetInfo {

    /** Id конференции. */
    id: string;

    /** Название конференции. */
    name: string | null;

    /** Описание конференции. */
    about: string | null;

    /** Публичная ли конференция. */
    is_public: boolean;

    /** Есть ли у конференции чат-канал. */
    is_chat: boolean;

    /** Id чат-канала конференции. */
    chat_channel_id: string;

    /** Время создания конференции (ISO). */
    created_at: string | string[];

    /** Id создателя конференции. */
    created_user_id: string;

    /** Отображаемое имя создателя. */
    created_display_name: string | null;

    /** Id документа превью (null — превью нет). */
    thumbnail_document_id: string | null;

    /** Подписанный адрес превью (null — превью нет). */
    thumbnail?: string | null;

    /** Токен входа в комнату LiveKit. */
    token: string;

}

/**
 * Настройки качества демонстрации экрана на форме.
 */
export interface MeetScreenSettings {

    /** Ключ пресета разрешения ("original" | "h1080fps30" | ...). */
    presetKey?: string;

    /** Частота кадров демонстрации. */
    fps?: number;

    /** Пресет разрешения LiveKit (null — оригинальное разрешение). */
    resolution?: unknown;

    /** Звук при демонстрации (по умолчанию true). */
    captureAudio?: boolean;

}

/**
 * Настройки качества камеры на форме.
 */
export interface MeetVideoSettings {

    /** Направление съёмки: "user" (фронтальная) или "environment" (задняя). */
    facingMode: "user" | "environment";

}

/**
 * Guard: значение — один из известных режимов сетки.
 * Защищает `room.metadata` (мусор в строке не должен попасть в состояние).
 * @param value - Проверяемое значение.
 * @returns true, если значение — валидный режим сетки.
 */
export function isMeetLayout(value: unknown): value is MeetLayout {
    return value === "grid" || value === "spotlight"
        || value === "sidebar" || value === "presentation";
}

/**
 * Guard: значение — один из известных флагов блокировки.
 * @param value - Проверяемое значение.
 * @returns true, если значение — валидный флаг блокировки.
 */
export function isMeetBlockFlag(value: unknown): value is MeetBlockFlag {
    return value === "audio" || value === "video" || value === "screen";
}

/**
 * Guard: значение похоже на строку identity участника (непустая строка).
 * @param value - Проверяемое значение.
 * @returns true, если значение — строка identity.
 */
export function isMeetIdentity(value: unknown): value is string {
    return typeof value === "string" && value.length > 0;
}

/**
 * Guard: значение — данные элемента участника конференции.
 * События хранилища гетерогенны (payload честно `unknown`), поэтому
 * перед обновлением/удалением плитки тип сужается проверкой, а не
 * приведением.
 * @param value - Проверяемое значение.
 * @returns true, если значение — данные участника.
 */
export function isMeetParticipantItem(value: unknown): value is MeetParticipantItem {

    return !!value && typeof value === "object" && "id" in value;

}
