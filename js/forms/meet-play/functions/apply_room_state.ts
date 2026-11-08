// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем functions
import {
    applyExempt,
    BLOCK_FLAGS,
    parseRoomState,
    resolveLayout,
    resolveStateBlocks
} from "./parse_room_state.js";
import { applyLayout } from "./apply_layout.js";
import { syncPins } from "./sync_pins.js";
import { updateFooter } from "./update_footer.js";

// Импортируем типы
import type { MeetPlay } from "../index.js";
import type { MeetBlockFlag, MeetRoomState } from "../types.js";
import { I18n } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Применяет состояние комнаты (режим сетки и карту блокировок)
 * к форме: обновляет плитки участников, блокирует кнопки футера
 * и показывает тост самому заблокированному участнику.
 *
 * Единственный источник правды — `room.metadata`: дополнительный сокет-push
 * сознательно не используется, иначе появился бы риск рассинхрона между
 * двумя каналами доставки одного и того же состояния.
 * @param form - Экземпляр формы.
 * @param metadata - Строка metadata комнаты LiveKit.
 * @returns Промис применения состояния.
 * ***************************************************************************
 */
export async function applyRoomState(form: MeetPlay, metadata?: string | null): Promise<void> {

    try {

        // ---------- STATE ----------
        // Предыдущее состояние нужно для тоста: показываем его только
        // на переходе «не заблокирован → заблокирован», а не на каждом
        // обновлении metadata (оно может прилетать и по другим причинам)
        const previousState = form.roomState || null;

        const rawState = parseRoomState(metadata);

        // Организатор выводится из-под правила комнаты — ровно как на
        // сервере, где `generateToken` не урезает ему права.
        // Исключение делается в СОСТОЯНИИ, а не в отрисовке, иначе правило
        // продолжало бы действовать на всех остальных: у участника на плитке
        // организатора появлялись бы иконки запретов и красная обводка
        const state = applyExempt(rawState, form.meet?.created_user_id);

        // Итоговое состояние держим целиком: блокировка участника — это
        // правило комнаты плюс его личное отступление, и взять только одну
        // половину нельзя. `blocks` и `defaultBlocks` оставлены
        // отдельными полями для удобства чтения в разных местах
        form.roomState = state;
        form.blocks = state.blocks;

        // ПРАВИЛО показываем без исключения: по нему организатор понимает,
        // что именно включил, иначе в меню не появился бы пункт
        // «Разрешить микрофон всем», и запрет было бы уже не снять
        form.defaultBlocks = rawState.defaults;

        // Принудительный режим и личный выбор хранятся раздельно:
        // принудительный перекрывает личный, но сам по себе не затирает его
        form.forcedLayout = state.layout;
        form.layout = resolveLayout(state.layout, form.localLayout);

        // Принудительный фокус — правило комнаты, поэтому
        // организатор и участники видят одно и то же значение. Отдельной
        // «локальной» версии нет: это не личный выбор, в отличие от
        // закрепления «Сделать главным»
        form.forcedFocus = state.focus;
        // ---------- STATE ----------

        // ---------- TILES ----------
        // Перерисовываем все плитки: на них должны появиться бейджи блокировки
        refreshTiles(form);

        // Значок закрепления — отдельно от плиток: он зависит не от
        // блокировок, а от принудительного фокуса, который как раз
        // мог только что прийти в metadata
        syncPins(form);
        // ---------- TILES ----------

        // ---------- LAYOUT ----------
        // Принудительный режим мог смениться: перестраиваем сетку
        applyLayout(form);
        // ---------- LAYOUT ----------

        // ---------- FOOTER ----------
        // Кнопки, которые организатор запретил, нажать нельзя
        updateFooter(form);
        // ---------- FOOTER ----------

        // ---------- SELF NOTIFY ----------
        // Сообщаем участнику, что именно у него забрали
        notifySelfBlocked(form, previousState);
        // ---------- SELF NOTIFY ----------

    } catch (error) {
        Logger.error("🚨 [meet-play]: Ошибка применения состояния комнаты:", error);
    }

}

/**
 * Перерисовывает все плитки участников, чтобы они подхватили новые бейджи.
 * Плитка читает `form.roomState` в `_setup`, поэтому достаточно точечного
 * обновления каждого элемента хранилища.
 * @param form - Экземпляр формы.
 * @returns void
 */
export function refreshTiles(form: MeetPlay): void {

    if (!form.store.items) return;

    for (const [id, item] of form.store.items) {

        // Элемент мог выпасть из стора между итерациями
        if (!item) continue;

        // Данные не меняем — меняется только отображение, но update()
        // эмитит `item::updated::id`, на который подписан ParticipantItem
        form.store.update(id, { participant: item.participant });

    }

}

/**
 * Показывает тост участнику, которому только что заблокировали источник.
 * @param form - Экземпляр формы.
 * @param previousState - Состояние комнаты до изменения.
 * @returns void
 */
export function notifySelfBlocked(form: MeetPlay, previousState?: MeetRoomState | null): void {

    try {

        const identity = form.room?.localParticipant?.identity;
        if (!identity) return;

        const current = resolveStateBlocks(form.roomState, identity);
        const previous = resolveStateBlocks(previousState, identity);

        // Только переход «было разрешено → стало запрещено»:
        // повторные обновления metadata не должны сыпать тостами
        const newlyBlocked = BLOCK_FLAGS.filter(flag => current[flag] && !previous[flag]);
        if (newlyBlocked.length === 0) return;

        // ---------- TEXT ----------
        const text = buildSelfBlockedText(newlyBlocked);

        Toast.warning(text, { duration: 5000 });

    } catch (error) {
        Logger.error("🚨 [meet-play]: Ошибка уведомления о блокировке:", error);
    }

}

/**
 * Текст тоста о только что заблокированных источниках.
 *
 * Один источник называем по имени, несколько — обобщаем перечислением.
 * @param newlyBlocked - Флаги, запрещённые только что.
 * @returns Текст тоста.
 * ***************************************************************************
 */
export function buildSelfBlockedText(newlyBlocked: readonly MeetBlockFlag[]): string {

    const locales = I18n.tree.forms.meet_play;

    if (!Array.isArray(newlyBlocked) || newlyBlocked.length === 0) {
        return locales.toasts.you_were_blocked;
    }

    const names = newlyBlocked
        // Явная аннотация: после `Array.isArray` сузка readonly-массива
        // деградирует до any[], и флаг «теряет» тип
        .map((flag: MeetBlockFlag) => locales.block_sources[flag])
        .filter(Boolean);

    if (names.length === 0) return locales.toasts.you_were_blocked;

    return `${locales.toasts.you_were_blocked}: ${names.join(", ")}`;

}
