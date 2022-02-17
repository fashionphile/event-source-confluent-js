import { BaseMessage } from "./BaseMessage";
import { TopicMessages } from "./Producer";

export class EventMessages {

    topic: string;
    messages: BaseMessage[] = []

    constructor(topic: string) {
        this.topic = topic;
    }

    addMessage(message: BaseMessage): void {
        this.messages.push(message);
    }

    toJson(): TopicMessages {
        return {
            topic: this.topic,
            messages: this.messages.map(m => {
                return {value: m.toJson()}
            })
        }
    }
}