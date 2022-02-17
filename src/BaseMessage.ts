export default class BaseMessage {

    keyMap: {[key: string]: any} = {};

    mapkey( property: string,key: string) {
        this.keyMap[property] = key; 
    }

    messageToJson(): {[name: string]: any} {
        let jsonMessage: {[key: string]: any} = {};
        for(const keyValue of Object.entries(this)) {
            if(keyValue[0] === 'keyMap') continue;
            let key: string = keyValue[0];
            const value: any = keyValue[1];
            key = this.keyMap[key] ?? key;
            jsonMessage[key] = value;
        }

        return jsonMessage;
    }
}
