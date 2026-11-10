// Импортируем events
import { subscribeAuthExpired } from "./auth/expired.js";
import { subscribeMessages } from "./messages/index.js";
import { subscribeComments } from "./comments/index.js";
import { subscribeCall } from "./call/index.js";
import { subscribeBroadcasts } from "./broadcasts/index.js";
import { subscribeUsers } from "./users/index.js";
import { subscribeChannels } from "./channels/index.js";
import { subscribeChannelsMembers } from "./channels-members/index.js";
import { subscribeModeration } from "./moderation/index.js";

/**
 * ***************************************************************************
 * SOCKET_EVENTS - инициализация всех сокет-подписок главной формы.
 * ***************************************************************************
 */
export class SocketEvents {

    /**
     * ***************************************************************************
     * Подписаться на события сокета, относящиеся к главной форме.
     * ***************************************************************************
     */
    static init(): void {

        subscribeAuthExpired();
        subscribeMessages();
        subscribeComments();
        subscribeCall();
        subscribeBroadcasts();
        subscribeUsers();
        subscribeChannels();
        subscribeChannelsMembers();
        subscribeModeration();

    }

}
