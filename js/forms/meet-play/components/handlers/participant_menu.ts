// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем components
import { Overlay } from "../../../../components/overlay/index.js";
import { createPopoverMenu } from "../../../../components/overlay/popover_menu.js";

// Импортируем handlers
import { muteParticipantHandler } from "./mute_participant.js";
import { removeParticipantHandler } from "./remove.js";
import { pinParticipantHandler } from "./pin_participant.js";

// Импортируем functions
import { BLOCK_FLAGS, resolveStateBlocks, isCastIdentity } from "../../functions/parse_room_state.js";

// Импортируем типы
import type { MeetPlay } from "../../index.js";
import type { MeetBlockFlag, MeetTriggerEvent } from "../../types.js";
import type { PopoverMenuItem } from "../../../../components/overlay/popover_menu.js";
import type { Participant, RemoteParticipant } from "livekit-client";

/**
 * Иконки пунктов меню по флагам блокировки.
 * Ключ — флаг, значение — { block, unblock }.
 */
const FLAG_ICONS: Record<MeetBlockFlag, { block: string; unblock: string }> = {
    audio: { block: "microphone-off", unblock: "microphone" },
    video: { block: "video-off", unblock: "video" },
    screen: { block: "screen-share-off", unblock: "screen-share" }
};

/**
 * ***************************************************************************
 * participantMenuHandler - Контекстное меню плитки участника.
 *
 * Меню открывается всем, но состав у каждого свой:
 *
 *   - «Сделать главным» есть у всех и на любой плитке (в том числе
 *     своей и трансляции) — это личный выбор, что показывать крупно,
 *     а не модерация;
 *   - блокировки источников и исключение — только у создателя
 *     конференции, только на чужой живой плитке: себя
 *     блокировать нельзя (сервер вернёт CANNOT_BLOCK_SELF), а трансляцию
 *     блокировать нечем.
 * @param event - Событие с координатами (клика или долгого нажатия).
 * @param form - Экземпляр формы.
 * @param participant - Участник LiveKit.
 * @param tile - Плитка участника (координаты позиционирования).
 * @returns Промис открытия меню.
 * ***************************************************************************
 */
export async function participantMenuHandler(
    event: MeetTriggerEvent | null | undefined,
    form: MeetPlay,
    participant: Participant | RemoteParticipant | null | undefined,
    tile: HTMLElement | null | undefined
): Promise<void> {

    try {

        // ---------- ДОСТУП ----------
        const identity = participant?.identity;
        if (!identity) return;

        // Модерация доступна только создателю конференции
        const isCreator = form?.isCreator === true;

        // Трансляцию нельзя блокировать, но можно закрепить и отключить
        const isCast = isCastIdentity(identity);

        // Локального участника нельзя ни блокировать, ни исключать
        const isLocal = identity === form?.room?.localParticipant?.identity;
        // ---------- ДОСТУП ----------

        // Отменяем стандартное контекстное меню браузера
        event?.preventDefault?.();

        // ---------- ITEMS ----------
        // Собираем модерацию отдельно: она есть не у всех, и закреплённый
        // пункт отделён от неё разделителем, чтобы «Отключить трансляцию»
        // не читалось как продолжение «Сделать главным»
        const moderationItems: PopoverMenuItem[] = [];

        // Модерация доступна только создателю конференции
        if (isCreator) {

            // Живой участник: три независимых пункта блокировки
            if (!isCast && !isLocal) {

                const current = resolveStateBlocks(form.roomState, identity);

                for (const flag of BLOCK_FLAGS) {

                    // Снимаем блокировку — меняем текст и иконку
                    const willBlock = !current[flag];

                    moderationItems.push({
                        text: willBlock
                            ? window._lc.forms.meet_play.context_menu.block[flag]
                            : window._lc.forms.meet_play.context_menu.unblock[flag],
                        iconName: willBlock ? FLAG_ICONS[flag].block : FLAG_ICONS[flag].unblock,
                        onClick: () => muteParticipantHandler(form, participant, flag)
                    });

                }

            }

            // Исключение доступно и для трансляции, но не для себя
            if (!isLocal) {
                moderationItems.push({
                    text: isCast
                        ? window._lc.forms.meet_play.context_menu.remove_cast
                        : window._lc.forms.meet_play.context_menu.remove_participant,
                    iconName: "user-x",
                    onClick: () => removeParticipantHandler(form, participant)
                });
            }

        }
        // ---------- МОДЕРАЦИЯ ----------

        const menuItems: PopoverMenuItem[] = [];

        // Закрепление крупной плитки — доступно всем, состояние
        // показываем текстом и иконкой, ровно как у блокировок
        const isPinned = form?.pinnedIdentity === identity;
        menuItems.push({
            text: isPinned
                ? window._lc.forms.meet_play.context_menu.unpin
                : window._lc.forms.meet_play.context_menu.make_main,
            iconName: isPinned ? "pinned-off" : "pinned",
            onClick: () => pinParticipantHandler(form, identity)
        });

        if (moderationItems.length > 0) {
            menuItems.push({ text: "", isSeparator: true }); // text обязателен типом пункта, при isSeparator не читается
            menuItems.push(...moderationItems);
        }
        // ---------- ITEMS ----------

        // Меню пустое — открывать нечего
        if (menuItems.length === 0) return;

        // ---------- POSITION ----------
        // Координаты клика; если событие системное (долгое нажатие),
        // позиционируемся по самой плитке
        const x = event?.clientX
            ?? event?.changedTouches?.[0]?.clientX
            ?? tile?.getBoundingClientRect?.().left ?? 0;

        const y = event?.clientY
            ?? event?.changedTouches?.[0]?.clientY
            ?? tile?.getBoundingClientRect?.().top ?? 0;
        // ---------- POSITION ----------

        // Открываем меню у точки нажатия
        const contextMenu = new Overlay(createPopoverMenu(menuItems), {
            type: "popover",
            x,
            y
        });
        contextMenu.open();

    } catch (error) {
        Logger.error(error);
    }

}
