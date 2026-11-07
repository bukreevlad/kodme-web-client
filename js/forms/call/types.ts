// ***************************************************************************
// Типы формы звонка: данные участников стора, состояния звонка и
// служебные сущности. Колокейт-модуль: используются индексом формы,
// функциями, событиями и компонентами самой формы звонка.
// ***************************************************************************

// Импортируем сторонние пакеты
import type { LocalParticipant, RemoteParticipant } from "livekit-client";

// Импортируем components
import type { AvatarImageDocument } from "../../components/avatars.js";

// Импортируем utils
import type { StoreItem } from "../../utils/store.js";

// Импортируем типы
import type { ParticipantItem } from "./components/participant.js";

/**
 * Аватар собеседника: документ картинки либо готовая URL-строка.
 */
export type CallAvatar = AvatarImageDocument | string | null;

/**
 * Состояния звонка:
 *   - `starting` — форма открыта, звонок регистрируется/комната поднимается;
 *   - `ringing`  — звонок зарегистрирован, ждём ответа (только инициатор);
 *   - `active`   — собеседник в комнате, идёт разговор.
 */
export type CallState = "starting" | "ringing" | "active";

/**
 * Режим раскладки участников: личный звонок, сетка или фокус на одном
 * участнике. Считается в functions/apply_view_mode.ts.
 */
export type CallViewMode = "spotlight" | "grid" | "focus";

/**
 * Роль плитки в раскладке: на сцене, в углу (движимая мини-плитка)
 * либо спрятана (вне пары).
 */
export type CallTileRole = "stage" | "corner";

/**
 * Причина закрытия формы звонка — от неё зависит, нужно ли извещать
 * сервер о выходе и какой тост показать.
 */
export type CallCloseReason = "hangup" | "no_answer" | "remote_hangup"
    | "start_error" | "connect_error" | "cancelled";

/**
 * Уровень качества связи (значения enum ConnectionQuality из livekit-client).
 */
export type CallQualityLevel = "excellent" | "good" | "poor" | "lost" | "unknown";

/**
 * Позиция мини-плитки в долях рабочей области (0..1 по каждой оси).
 */
export interface CallTileFraction {
    /** Доля по X: 0 — у правого края, 1 — у левого. */
    x: number;
    /** Доля по Y: 0 — низ, 1 — верх. */
    y: number;
}

/**
 * Данные участника звонка в хранилище формы.
 *
 * Поля `__domElements__` / `__component__` / `__unsubscribeStore__`
 * обслуживают жизненный цикл карточки: копии DOM-элементов, саму карточку
 * (для освобождения плееров и аудио) и подписку на точечное событие
 * обновления (снимается при удалении элемента из стора).
 */
export interface CallParticipantData extends StoreItem {

    /** Identity участника в комнате (UUID строка). */
    id: string;

    /** Участник LiveKit (локальный либо удалённый). */
    participant?: LocalParticipant | RemoteParticipant;

    /** Отображённые копии карточки в DOM (плашка «я» либо список). */
    __domElements__?: HTMLElement[];

    /** Экземпляр карточки участника (для destroy при удалении). */
    __component__?: ParticipantItem | null;

    /** Подписка на обновление карточки (снимается при удалении). */
    __unsubscribeStore__?: (() => void) | null;

}

/**
 * Guard данных участника звонка: payload стора приходит как unknown.
 * @param value - Проверяемое значение.
 * @returns - Является ли данными участника звонка.
 */
export function isCallParticipantData(value: unknown): value is CallParticipantData {

    // Сначала отсекаем не-объекты: "in" на null/undefined бросает TypeError
    if (typeof value !== "object" || value === null) return false;

    return "id" in value && typeof value.id === "string";

}
