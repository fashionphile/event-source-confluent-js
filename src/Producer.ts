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
        const topicConfig = this.config.topics[topic];
        const keySchemaId = topicConfig.keySchemaId;
        const valueSchemaId = topicConfig.valueSchemaId;

        let serializeMessages: KafkaMessage[] = [];

        for (const message of topicMessages.messages) {
            
            if(message.value[topicConfig.keyName] == undefined) {
                throw new ReferenceError(`Message does not contain proper keyName defined in config: ${JSON.stringify(topicMessages)}`);
            }

            let messageKey = message.value[topicConfig.keyName];
            if(topicConfig.compositKey) {
                let compositKey = topicConfig.compositKey ?? "";
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
            let messages = await this.serializeMessages(topicMessages);
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
