// Импортируем events
import { subscribeUpdateLastViewedMessage } from "./update_last_viewed_message.js";
import { subscribeUpdateParticipantViewedMessage } from "./update_participant_viewed_message.js";
import { subscribeTypingStatus } from "./typing_status.js";

/**
 * ***************************************************************************
 * Подписки на события участников каналов (просмотренные сообщения,
 * активность собеседников).
 * ***************************************************************************
 */
export function subscribeChannelsMembers(): void {

    subscribeUpdateLastViewedMessage();
    subscribeUpdateParticipantViewedMessage();
    subscribeTypingStatus();

}
