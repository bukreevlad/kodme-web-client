// Импортируем сторонние пакеты
import { Track } from "livekit-client";

// Импортируем components
import { Avatars } from "../../../../components/avatars.js";

// Импортируем типы
import type { ParticipantItem } from "../participant.js";

/**
 * ***************************************************************************
 * Есть ли у участника живая картинка с камеры.
 *
 * Проверяем публикацию, а не `participant.isCameraEnabled`: флаг
 * переключается мгновенно по нажатию, а кадр приходит через десятки-сотни
 * миллисекунд. Если ориентироваться на флаг, аватар исчезает на пустом
 * чёрном прямоугольнике, и этот «мигающий» эффект повторялся бы при каждом
 * вкл/выкл камеры.
 * @param item - Экземпляр плитки участника.
 * @returns Есть ли активный видеотрек камеры.
 * ***************************************************************************
 */
export function hasCameraVideo(item: ParticipantItem): boolean {

    const participant = item?.data?.participant;
    if (!participant) return false;

    const localIdentity = item?.form?.room?.localParticipant?.identity;
    const isLocal = participant.identity === localIdentity;

    for (const pub of participant.trackPublications.values()) {

        if (pub.kind !== Track.Kind.Video) continue;
        if (pub.source !== Track.Source.Camera) continue;
        if (!pub.track || pub.isMuted) continue;
        if (!isLocal && !pub.isSubscribed) continue;

        return true;

    }

    return false;

}

/**
 * ***************************************************************************
 * Показывает или прячет заглушку с аватаром в плитке участника.
 *
 * Заглушка нужна не для красоты: без неё плитка с выключенной камерой
 * остаётся чёрным прямоугольником, и в сетке невозможно понять, сколько
 * людей в комнате и кто где.
 *
 * Аватара-картинки у участников LiveKit нет: сервер кладёт в токен только
 * `identity` (id пользователя) и `name` (отображаемое имя), документ
 * картинки сюда не доезжает. Поэтому рисуем акроним, а не заказываем
 * загрузку файла, которого не будет.
 *
 * Контейнер заглушки живёт в шаблоне плитки и никогда не удаляется, поэтому
 * видимость переключаем классом `hidden`.
 * @param item - Экземпляр плитки участника.
 * @param isVisible - Показывать ли заглушку. По умолчанию
 *                   определяется по наличию живого видео.
 * @returns {void}
 * ***************************************************************************
 */
export function renderParticipantAvatar(item: ParticipantItem, isVisible?: boolean): void {

    const participant = item?.data?.participant;
    const element = item?.videoSlot?.querySelector<HTMLElement>(":scope [data-avatar]");
    if (!participant || !element) return;

    // ---------- ПОКАЗЫВАТЬ ЛИ ----------
    // Прячем, только когда пришёл живой кадр с камеры: если камера
    // опубликована, но кадра ещё нет, заглушка остаётся на месте и
    // исчезает сама, как только поток оживёт
    const show = isVisible ?? !hasCameraVideo(item);
    element.classList.toggle("hidden", !show);
    if (!show) return;

    // ---------- ПЕРВЫЙ РЕНДЕР ----------
    // Экземпляр Avatars держит состояние и не должен двоиться
    if (!item.avatar) {
        item.avatar = new Avatars({
            element,
            id: participant.identity || participant.name,
            name: participant.name || participant.identity,
            size: "2xl",
            wrapClasses: ["rounded-full"],
            classes: ["call-avatar"]
        });
        return;
    }

    // ---------- ОБНОВЛЕНИЕ ----------
    // Имя уезжает на p2p-канале и может прийти позже, чем сама плитка
    item.avatar.setName(participant.name || participant.identity);

}
