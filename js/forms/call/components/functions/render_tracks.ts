// Импортируем сторонние пакеты
import { Track } from "livekit-client";
import type { TrackPublication } from "livekit-client";

// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем components
import { VideoPlayer } from "../../../../components/video_player.js";

// Импортируем типы
import type { ParticipantItem } from "../participant.js";

/**
 * SID активного трека публикации: у живого трека — его sid, у публикации
 * без трека — sid самой публикации.
 * @param publication - Публикация трека участника.
 * @returns SID трека.
 */
function trackSidOf(publication: TrackPublication): string {

    return publication.track?.sid || publication.trackSid;

}

/**
 * ***************************************************************************
 * Отрисовка и очистка аудио/видео треков участника LiveKit.
 *
 * Упрощённый вариант встреч: экран в звонках не транслируется (запрет стоит
 * в грантах токена), поэтому здесь только камера и микрофон, а меню выбора
 * качества убрано — надёжность потока в звонке целиком берёт на себя
 * adaptiveStream комнаты.
 * @param item - Экземпляр карточки участника в UI.
 * @returns Промис отрисовки.
 * ***************************************************************************
 */
export async function renderTracks(item: ParticipantItem): Promise<void> {

    try {

        // Извлекаем объект участника LiveKit из структуры данных
        const participant = item?.data?.participant;
        if (!participant) return;

        // Определяем, является ли участник локальным пользователем (собой)
        const localIdentity = item?.form?.room?.localParticipant?.identity;
        const isLocal = participant.identity === localIdentity;

        // Получаем список всех публикаций треков участника (камера, микрофон).
        // Участник бывает локальным и удалённым — собираем в массив общего
        // базового типа поитератором (for..of понимает union итераторов)
        const publications: TrackPublication[] = [];
        for (const pub of participant.trackPublications.values()) {
            publications.push(pub);
        }

        // ======================================
        // ОБРАБОТКА ВИДЕО ТРЕКОВ
        // ======================================

        // Формируем список SID всех активных видео-треков
        const activeVideoPubs = publications.filter(
            pub => pub.kind === Track.Kind.Video && pub.track && !pub.isMuted && (isLocal || pub.isSubscribed)
        );
        const activeVideoTrackSids = activeVideoPubs.map(trackSidOf);

        // Убираем только те <video>, чей трек больше не активен
        const existingVideos = Array.from(item.videoSlot?.querySelectorAll("video") ?? []);
        existingVideos.forEach(videoEl => {
            const domTrackId = videoEl.getAttribute("data-track-id");
            if (domTrackId !== null && activeVideoTrackSids.includes(domTrackId)) return;

            // Отсоединяем поток устаревшего трека
            const pub = publications.find(p => trackSidOf(p) === domTrackId);
            if (pub?.track) {
                pub.track.detach(videoEl);
            }

            // Удаляем плеер именно этого трека вместе с его обёрткой
            destroyPlayer(item, domTrackId);
        });

        // Если активных видео не осталось вовсе — сбрасываем карточку целиком
        if (activeVideoTrackSids.length === 0) {
            cleanupParticipantVideo(item);
        }

        // Итерация по публикациям и создание нового видео при необходимости
        publications.forEach(pub => {

            // Видео (камера)
            if (pub.kind === Track.Kind.Video) {

                const trackId = trackSidOf(pub);
                const shouldDisplayVideo = Boolean(pub.track) && !pub.isMuted && (isLocal || pub.isSubscribed);

                const trackVideo = item.videoSlot?.querySelector<HTMLVideoElement>(`video[data-track-id="${trackId}"]`) ?? null;

                if (shouldDisplayVideo) {

                    // Если видео должно отображаться, но его ещё нет в DOM
                    if (!trackVideo && pub.track) {

                        // Гарантированно сбрасываем старый плеер и видеослот
                        cleanupParticipantVideo(item);

                        // attach() создает <video> и привязывает MediaStream.
                        // Этот <video> — внешний по отношению к плееру элемент,
                        // поэтому обязательно передаём его в `video:`, а не
                        // позволяем VideoPlayer создать свой
                        const el = pub.track.attach();

                        // invariant: публикация видео — attach() возвращает
                        // именно <video>, не аудиоэлемент
                        if (el instanceof HTMLVideoElement) {

                            // Создаём плеер поверх <video> LiveKit.
                            // Вариант "bare": только контейнер с <video>, без скина.
                            // Управление плеером в звонке не нужно: панель
                            // контролов перекрывала бы подпись под видео и
                            // перехватывала клики по плитке (выбор крупного кадра)
                            const player = new VideoPlayer({
                                video: el,
                                insertInto: item.videoSlot ?? undefined,
                                options: {
                                    variant: "bare",
                                    autoplay: true,
                                    playsinline: true,
                                    // Локальное превью всегда приглушено: иначе
                                    // браузер блокирует autoplay со звуком и
                                    // появляется риск обратной связи. Звук
                                    // участников идёт отдельными <audio> ниже
                                    muted: isLocal,
                                    className: "h-full w-full",
                                    attributes: { "data-track-id": trackId }
                                }
                            });

                            // Запоминаем плеер за треком
                            item.players.set(trackId, player);

                            Logger.debug(`🎥 [app][call]: Видео участника ${participant.identity} подключено`);

                        }

                    }

                } else if (trackVideo) {

                    // Видео выключили или заглушили: отсоединяем поток
                    if (pub.track) {
                        pub.track.detach(trackVideo);
                    }
                    destroyPlayer(item, trackId);

                }
            }

            // ======================================
            // ОБРАБОТКА АУДИО ТРЕКОВ
            // ======================================

            if (pub.kind === Track.Kind.Audio) {

                const trackId = trackSidOf(pub);
                const audioId = `audio-${trackId}`;
                const existingAudio = document.getElementById(audioId);

                const shouldPlayAudio = Boolean(pub.track) && !isLocal && pub.isSubscribed && !pub.isMuted;

                // Реестр заведённых аудиоэлементов: при выходе участника
                // из звонка его голос надо снять точечно, а SID трека к
                // тому моменту известен только здесь
                if (!item.audioIds) item.audioIds = new Set();

                if (shouldPlayAudio) {

                    if (!existingAudio && pub.track) {
                        const audioEl = pub.track.attach();
                        audioEl.id = audioId;
                        audioEl.style.display = "none";
                        document.body.appendChild(audioEl);
                    }

                    item.audioIds.add(audioId);

                } else if (existingAudio) {

                    // invariant: элемент создавался через attach() аудиотрека —
                    // это всегда <audio>; подтверждаем guard'ом для detach
                    if (pub.track && existingAudio instanceof HTMLAudioElement) {
                        pub.track.detach(existingAudio);
                    }
                    existingAudio.remove();
                    item.audioIds.delete(audioId);

                }
            }

        });

    } catch (error) {
        Logger.error("🚨 [app][call]: Ошибка отрисовки треков участника:", error);
    }

}

/**
 * Уничтожает плеер конкретного видеотрека карточки участника.
 * Вызывается точечно, когда трек перестал быть активен
 * (выключили камеру или заглушили публикацию).
 * @param item - Экземпляр карточки участника в UI.
 * @param trackId - SID видеотрека.
 * @returns {void}
 */
function destroyPlayer(item: ParticipantItem, trackId: string | null): void {

    if (!item || !trackId) return;

    // Уничтожаем экземпляр VideoPlayer: он снимает подписки с <video>
    // и убирает <video-player> из DOM
    const player = item.players?.get(trackId);

    if (player) {
        try {
            player.destroy();
        } catch (error) {
            Logger.warn("⚠️ [app][call]: Ошибка при уничтожении плеера:", error);
        }
        item.players.delete(trackId);
    }

    // Страховка на случай, если destroy() не успел: убираем из слота только
    // теги конкретного трека, сохраняя служебный [data-avatar]
    if (item.videoSlot) {
        const staleVideo = item.videoSlot.querySelector(
            `video[data-track-id="${trackId}"]`
        );
        staleVideo?.closest("video-player, video-skin")?.remove();
        staleVideo?.remove();
    }

}

/**
 * Полное уничтожение всех плееров карточки участника и очистка видеослота.
 * @param item - Экземпляр карточки участника в UI.
 * @returns {void}
 */
function cleanupParticipantVideo(item: ParticipantItem): void {

    if (!item) return;

    // Уничтожаем все заведённые плееры
    if (item.players) {
        Array.from(item.players.keys()).forEach(trackId => {
            destroyPlayer(item, trackId);
        });
        item.players.clear();
    }

    // Страховка: безопасно удаляем из videoSlot только теги <video> и
    // их обёртки, сохраняя [data-avatar]
    if (item.videoSlot) {
        const elementsToRemove = item.videoSlot.querySelectorAll(
            "video-player, video-skin, video"
        );
        elementsToRemove.forEach(el => el.remove());
    }

}
