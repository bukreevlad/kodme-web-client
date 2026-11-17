// Импортируем events
import { subscribeAuthExpired } from "./auth/expired.js";
import { subscribeChannelFeed } from "./feed.js";
import { subscribeUserFeed } from "./user_feed.js";
import { subscribeComments } from "./comments/index.js";
import { subscribeCall } from "./call/index.js";
import { subscribeBroadcasts } from "./broadcasts/index.js";
import { subscribeUsers } from "./users/index.js";
import { subscribeChannelsMembers } from "./channels-members/index.js";

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
        subscribeChannelFeed();
        subscribeUserFeed();
        subscribeComments();
        subscribeCall();
        subscribeBroadcasts();
        subscribeUsers();
        subscribeChannelsMembers();

    }

}
