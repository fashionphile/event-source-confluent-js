import { IHeaders, Kafka, KafkaConfig, Message as KafkaMessage } from 'kafkajs';
import { SchemaRegistry } from '@kafkajs/confluent-schema-registry';
import { SchemaRegistryAPIClientArgs } from '@kafkajs/confluent-schema-registry/dist/api';
import { v5 as uuid } from 'uuid';
import { EventMessages } from './EventMessages';

type ConfigType = {
    namespace: string,
    uuid: string,
    topics: {
        [topic: string]: {
            keyName: string, 
            compositKey?: string, 
            keySchemaId: number,
            valueSchemaId: number,
        }
    }
    skipSerialization?: boolean; 
}

type Message = {
    key?: Buffer | string | null
    value: {[name: string]: any}
    partition?: number
    headers?: IHeaders
    timestamp?: string
}

export type TopicMessages = {
    topic: string
    messages: Message[]
}


export class Producer {

    private config: ConfigType;
    private registry: SchemaRegistry;
    private kafka: Kafka;
    private producer?: any;

    constructor(config: ConfigType, registryConfig: SchemaRegistryAPIClientArgs, kafkaConfig: KafkaConfig) {
        this.config = config;
        this.registry = new SchemaRegistry(registryConfig);
        this.kafka = new Kafka(kafkaConfig);
    }

    private async serializeMessages(topicMessages: TopicMessages) {
        if(this.config.topics[topicMessages.topic] == undefined) {
            throw new ReferenceError(`${topicMessages.topic} was not defined in config`)
        }

        const topic = topicMessages.topic;
        const keySchemaId = this.config.topics[topic].keySchemaId;
        const valueSchemaId = this.config.topics[topic].valueSchemaId;

        let serializeMessages: KafkaMessage[] = [];

        for (const message of topicMessages.messages) {
            
            if(message.value[this.config.topics[topic].keyName] == undefined) {
                throw new ReferenceError(`Message does not conatined proper keyName defined in config: ${JSON.stringify(topicMessages)}`);
            }

            let messageKey = message.value[this.config.topics[topic].keyName];
            if(this.config.topics[topic].compositKey) {
                let compositKey = this.config.topics[topic].compositKey ?? "";
                messageKey = messageKey.concat("|", message.value[compositKey]);
            }

            const outgoingMessage: KafkaMessage = {
            key: await this.registry.encode(keySchemaId, messageKey),
            value: await this.registry.encode(valueSchemaId, {
                event_key: messageKey,
                event_type: topic,
                event_namespace: this.config.namespace,
                payload: message.value
            })
          }
          serializeMessages.push(outgoingMessage)
        }
        return serializeMessages;
    }

    public async send(topicMessages: TopicMessages | EventMessages) {

        if(topicMessages instanceof EventMessages) {
            topicMessages = topicMessages.toJson();
        }

        await this.getProducer();

        try {

            let messages = await this.processMessages(topicMessages);
            let response = await this.producer.send({
                topic: topicMessages.topic,
                messages: messages,
            });
            console.debug(response);
            return response;
        } finally {
            await this.producer.disconnect();
            this.producer = undefined;
        }  
    }

    private async processMessages(topicMessages: TopicMessages) {

        if (this.config.skipSerialization) {
            return topicMessages.messages.map((message): KafkaMessage => {
                const outgoingMessage: KafkaMessage = {
                    key: message.key ?? undefined,
                    headers: message.headers ?? undefined,
                    value: JSON.stringify(message.value)
                }
                return outgoingMessage;
            })
        }
        return await this.serializeMessages(topicMessages);
    }

    private async getProducer(){

        if(!this.producer) {
            this.producer = this.kafka.producer();
            await this.producer.connect();
        }   
    }

    public generateUuid(key: string): string {
        return uuid(key, this.config.uuid)
    }
}
