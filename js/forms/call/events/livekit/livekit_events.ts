// Импортируем events
import { subscribeParticipantConnected } from "./participant_connected.js";
import { subscribeParticipantDisconnected } from "./participant_disconnected.js";
import { subscribeTrackPublished } from "./track_published.js";
import { subscribeTrackUnpublished } from "./track_unpublished.js";
import { subscribeTrackSubscribed } from "./track_subscribed.js";
import { subscribeTrackUnsubscribed } from "./track_unsubscribed.js";
import { subscribeTrackMuted } from "./track_muted.js";
import { subscribeTrackUnmuted } from "./track_unmuted.js";
import { subscribeDisconnected } from "./disconnected.js";
import { subscribeConnectionQualityChanged } from "./connection_quality_changed.js";

// Импортируем типы
import type { Call } from "../../index.js";

/**
 * ***************************************************************************
 * Подписка формы звонка на события комнаты LiveKit.
 * @param form - Экземпляр формы.
 * @returns {void}
 * ***************************************************************************
 */
export function subscribeLiveKitEvents(form: Call): void {

    subscribeParticipantConnected(form);
    subscribeParticipantDisconnected(form);
    subscribeTrackPublished(form);
    subscribeTrackUnpublished(form);
    subscribeTrackSubscribed(form);
    subscribeTrackUnsubscribed(form);
    // Легаси подписывал RoomEvent.IsMutedChanged — такого события нет в
    // livekit-client v2 (было в v1): слушатель висел на undefined и никогда
    // не срабатывал. Реакцию на mute закрывают TrackMuted/TrackUnmuted
    subscribeTrackMuted(form);
    subscribeTrackUnmuted(form);
    subscribeConnectionQualityChanged(form);
    subscribeDisconnected(form);

}
