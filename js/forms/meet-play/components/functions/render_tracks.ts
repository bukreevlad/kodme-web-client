// Импортируем сторонние пакеты
import { Track, VideoQuality } from "livekit-client";
import type { RemoteTrackPublication, TrackPublication } from "livekit-client";

// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";
import { LiveKitRenditions } from "../../../../utils/video/livekit_renditions.js";
import type { LiveKitVideoPublication } from "../../../../utils/video/livekit_renditions.js";

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
 * Публикация принадлежит удалённому участнику: только у неё есть
 * переключение качества подписки (`setVideoQuality`) и слои simulcast.
 * @param publication - Публикация трека участника.
 * @returns true, если публикация удалённого участника.
 */
function isRemotePublication(publication: TrackPublication): publication is RemoteTrackPublication {

    return "setVideoQuality" in publication && typeof publication.setVideoQuality === "function";

}

/**
 * ***************************************************************************
 * renderTracks - Отрисовка и очистка аудио/видео треков участника LiveKit
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

        // Получаем список всех публикаций треков участника (камера, экран, микрофон)
        const publications = Array.from(participant.trackPublications.values());

        // ======================================
        // ОБРАБОТКА ВИДЕО ТРЕКОВ
        // ======================================

        // Формируем список SID всех активных видео-треков
        const activeVideoPubs = publications.filter(
            pub => pub.kind === Track.Kind.Video && pub.track && !pub.isMuted && (isLocal || pub.isSubscribed)
        );
        const activeVideoTrackSids = activeVideoPubs.map(trackSidOf);

        // Убираем только те <video>, чей трек больше не активен.
        // Раньше здесь же вызывался полный cleanupParticipantVideo() — он сносил
        // вообще все видео в слоте, включая только что созданное второе
        // (сценарий «камера + демонстрация экрана» у одного участника).
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

            // Видео (Камера или Демонстрация экрана)
            if (pub.kind === Track.Kind.Video) {

                const trackId = trackSidOf(pub);
                const shouldDisplayVideo = Boolean(pub.track) && !pub.isMuted && (isLocal || pub.isSubscribed);

                const trackVideo = item.videoSlot?.querySelector<HTMLVideoElement>(`video[data-track-id="${trackId}"]`) ?? null;

                if (shouldDisplayVideo) {

                    // Если видео должно отображаться, но его ещё нет в DOM
                    if (!trackVideo && pub.track) {

                        // Гарантированно сбрасываем старый плеер и видеослот перед добавлением нового видео
                        cleanupParticipantVideo(item);

                        // attach() создает <video> и привязывает MediaStream.
                        // Этот <video> — внешний по отношению к плееру элемент
                        // (его создаёт LiveKit), поэтому обязательно передаём
                        // его в `video:`, а не позволяем VideoPlayer создать свой.
                        const el = pub.track.attach();

                        // invariant: публикация видео — attach() возвращает
                        // именно <video>, не аудиоэлемент
                        if (el instanceof HTMLVideoElement) {

                            // ======================================
                            // НАСТРОЙКА КАЧЕСТВА ДЛЯ VIDEO.JS & LIVEKIT
                            // ======================================

                            // Меню «Качество» Video.js появляется только у медиа,
                            // умеющего renditions. У LiveKit это не hls.js, поэтому
                            // подключаем собственный адаптер поверх simulcast-слоёв.
                            // Переключение качества есть только у публикаций
                            // удалённых участников (у своих качество не меряем)
                            let renditions: LiveKitRenditions | null = null;

                            if (!isLocal && isRemotePublication(pub)) {

                                // `LiveKitVideoPublication` ждёт слои с `enum VideoQuality`
                                // самого LiveKit-клиента, а реальный TrackInfo.layers несёт
                                // одноимённый enum из @livekit/protocol. Значения у обоих
                                // совпадают (LOW/MEDIUM/HIGH = 0/1/2), различие номинальное
                                // и живёт только в типах — приведение безопасно по рантайму
                                const publication = pub as LiveKitVideoPublication;
                                const layers = publication.trackInfo?.layers || [];

                                renditions = layers.length > 0
                                    ? new LiveKitRenditions(publication, { defaultQuality: VideoQuality.HIGH })
                                    : new LiveKitRenditions(publication, {
                                        // Публикация не объявила simulcast: показываем
                                        // стандартный набор, как это делал Plyr
                                        levels: [
                                            { quality: VideoQuality.HIGH, width: 1920, height: 1080 },
                                            { quality: VideoQuality.MEDIUM, width: 1280, height: 720 },
                                            { quality: VideoQuality.LOW, width: 640, height: 360 }
                                        ]
                                    });

                            }

                            // Создаём плеер поверх <video> LiveKit.
                            // Вариант "bare": только контейнер с <video>, без скина.
                            // Управление плеером в конференции не нужно и даже
                            // вредно — панель контролов перекрывала подпись под
                            // видео и перехватывала клики по плитке (контекстное
                            // меню участника).
                            // Пропорции не задаём: их задаёт контеййн карточки
                            // (aspect-4/3), а object-fit решает вопрос с полосами.
                            const player = new VideoPlayer({
                                video: el,
                                insertInto: item.videoSlot ?? undefined,
                                options: {
                                    variant: "bare",
                                    autoplay: true,
                                    playsinline: true,
                                    // Локальный превью всегда приглушено: иначе браузер
                                    // блокирует autoplay со звуком и появляется риск
                                    // обратной связи. Аудио участников приходит
                                    // отдельными <audio>-элементами (см. ниже).
                                    muted: isLocal,
                                    className: "h-full w-full",
                                    attributes: { "data-track-id": trackId }
                                }
                            });

                            // Запоминаем плеер за треком: у участника их может
                            // быть несколько (камера + демонстрация экрана).
                            item.players.set(trackId, player);

                            // Подключаем уровни. Список статичен для публикации,
                            // поэтому sync() достаточно вызвать один раз.
                            if (renditions) {
                                player.attachRenditions(renditions);
                                renditions.sync();
                            }

                            Logger.debug(
                                `🎥 [LiveKit]: Плеер ${participant.identity} создан, качество: ${renditions ? renditions.length : "нет"}`
                            );

                        }

                    }

                } else if (trackVideo) {
                    // Видео выключили или заглушили: отсоединяем поток и
                    // уничтожаем только плеер ЭТОГО трека. Полный сброс
                    // карточки здесь ломал сценарий «камера + демонстрация
                    // экрана», поэтому работаем точечно.
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
                const existingAudioEl = document.getElementById(audioId);

                // invariant: элемент с таким id создаётся только нами —
                // attach() аудиотрека LiveKit возвращает именно <audio>
                const existingAudio = existingAudioEl instanceof HTMLAudioElement ? existingAudioEl : null;

                const shouldPlayAudio = Boolean(pub.track) && !isLocal && pub.isSubscribed && !pub.isMuted;

                if (shouldPlayAudio) {

                    if (!existingAudio && pub.track) {
                        const audioEl = pub.track.attach();
                        audioEl.id = audioId;
                        audioEl.style.display = "none";
                        document.body.appendChild(audioEl);
                    }

                } else if (existingAudio) {

                    if (pub.track) {
                        pub.track.detach(existingAudio);
                    }
                    existingAudio.remove();
                }
            }

        });

    } catch (error) {
        Logger.error("🚨 [app][LiveKit]: Ошибка отрисовки треков участника:", error);
    }

}

/**
 * ***************************************************************************
 * destroyPlayer - Уничтожает плеер конкретного видеотрека карточки участника.
 *                 Вызывается точечно, когда трек перестал быть активен
 *                 (выключили камеру/экран или заглушили публикацию), чтобы
 *                 не сносить остальные видео участника.
 * @param item - Экземпляр карточки участника в UI.
 * @param trackId - SID видеотрека (камера либо демонстрация экрана).
 * @returns {void}
 * ***************************************************************************
 */
function destroyPlayer(item: ParticipantItem, trackId: string | null): void {

    if (!item || !trackId) return;

    // Уничтожаем экземпляр VideoPlayer. Он снимает подписки с <video>,
    // отпускает адаптер renditions и убирает <video-player> из DOM.
    const player = item.players?.get(trackId);

    if (player) {
        try {
            player.destroy();
        } catch (error) {
            Logger.warn("⚠️ [LiveKit]: Ошибка при уничтожении плеера:", error);
        }
        item.players.delete(trackId);
    }

    // Страховка на случай, если destroy() не успел: убираем из слота только
    // теги конкретного трека, сохраняя остальные видео и служебные
    // [data-avatar] / [data-speaking].
    if (item.videoSlot) {
        const staleVideo = item.videoSlot.querySelector(
            `video[data-track-id="${trackId}"]`
        );
        staleVideo?.closest("video-player, video-skin")?.remove();
        staleVideo?.remove();
    }

}

/**
 * ***************************************************************************
 * cleanupParticipantVideo - Полное уничтожение всех плееров карточки участника
 *                           и очистка видеослота.
 * @param item - Экземпляр карточки участника в UI.
 * @returns {void}
 * ***************************************************************************
 */
function cleanupParticipantVideo(item: ParticipantItem): void {

    if (!item) return;

    // Уничтожаем все заведённые плееры: у участника их может быть
    // несколько одновременно (камера + демонстрация экрана).
    if (item.players) {
        Array.from(item.players.keys()).forEach(trackId => {
            destroyPlayer(item, trackId);
        });
        item.players.clear();
    }

    // Страховка на случай, если destroy() не успел: безопасно удаляем из
    // videoSlot только теги <video> и обёртки Video.js, сохраняя
    // [data-avatar] и [data-speaking].
    //
    // Селектор учитывает структуру Video.js: <video> лежит в light DOM
    // внутри <video-player>/<video-skin>, поэтому обычный querySelector
    // его находит. Селектор `.plyr` больше не нужен — в конференции
    // обёрток Plyr не осталось.
    if (item.videoSlot) {
        const elementsToRemove = item.videoSlot.querySelectorAll(
            "video-player, video-skin, video"
        );
        elementsToRemove.forEach(el => el.remove());
    }

}
