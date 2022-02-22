# event-source-confluent-js

## Considerations when using this package
- You are using and have a basic understanding of Kakfa
- You are capable of creating and working with avro schemas
 - You are using [schema registry](https://docs.confluent.io/platform/current/schema-registry/index.html) and [avro](https://avro.apache.org/) schemas
 - Your schemas conform to the event source message structure this package utilizes (more on that later)
 - Your Schemas must follow the proper naming convention.
 
## Usage  
The following example should be sufficient for local development if you are using the confluent docker stack or something similar
```typescript
import  Producer  from  "./Producer";
import  BaseMessage  from  './BaseMessage';
import  EventMessages  from  './EventMessages';

//The producer takes three configuration objects as parameters
const  producer = new  Producer(
{   //The first object is specific to this package
	namespace:  'web-app',  //Most commonly the application producing messages
	uuid:  '6b8a0747-dc13-49f4-9ded-7fc68c24aab3', //Any unique uuid you choose to represent your application, just make sure it is always the same
	topics: { //Map of topics you plan on producing to
		user_created_event: { //topic name
			keyName:  'user_uuid', //The name of the unique identifier field you want used as a kafka key
			valueSchemaId:  1,
			keySchemaId:  7
		},
	}
},
{ host:  'http://localhost:8081' }, // The second if for confluent-schema-registry and can be cusomized based on their documentation
{	// The third os for kakfajs and can also be customized based on their documentation
	brokers: ['localhost:9092'],
	clientId:  'web-app',
	retry: {
		initialRetryTime:  100,
		retries:  8
	}
});

//The are two ways to produce messages

//You can use the following json structure
await  producer.send({
	topic:  'user_created_event',
	messages: [
		{value: { user_uuid:  "7b8a0747-ab13-49f4-9ded-7fc68c24aab3", first_name:  "first_name_", last_name:  "last_name_", email:  "email@email.com"}},
		{value: { user_uuid:  "8b8a0747-dc13-49f4-9ded-7fc68c65sab3", first_name:  "first_name_", last_name:  "last_name_", email:  "email@email.com"}},
		{value: { user_uuid:  "6b8a0747-dc13-49f4-9ded-7fc68c45bab3", first_name:  "first_name_", last_name:  "last_name_", email:  "email@email.com"}},
	]
});

//Or you can extent the base message class and all the attributes you need
class  UserMessage  extends  BaseMessage {
	firstName!: string;
	last_name!: string;
	created_timestamp!: number;
	user_uuid!: string;
	email!: string;
}

let  userMessage = new  UserMessage;
//mapkey can be used if class attribute needs
//to be mapped to a different name in your message body
userMessage.mapkey("firstName", "first_name");

userMessage.firstName = "User";
userMessage.last_name = "Tester";
userMessage.email = "test@gmail.com";
userMessage.user_uuid = "6b8a0747-dc13-49f4-9ded-7fc68c45bab3";

let  eventMessages = new  EventMessages('user_created_event');

eventMessages.addMessage(userMessage); // you can add as many message as you would like
eventMessages.addMessage(userMessage2);
await  producer.send(eventMessages);
```

 ## Schemas
 The following is an example of the event source json structure this package produces.
```json
{
	"event_key": "6c7320c5-267a-41c9-a38a-dafabbf25751",
	"event_type": "user_created_event",
	"event_namespace": "customer_checkout",
	"payload": {
		"user_uuid": "6c7320c5-267a-41c9-a38a-dafabbf25751",
		"first_name": "Marie",
		"last_name": "Roberts",
		"email": "onlineshopper@gmail.com"
	}
}
```
 The top level of the json body will always contain `event_key`, `event_type`, `event_namespace` and `payload`.  This json structure will be produced dynamically based on your configuration. The `payload` object will contain fields unique to the event or object you are producing. 

#### Why is this important? 
This package is in it's early stages and we do not yet have support for generating or managing schemas, it's on our radar. So for now you need to make sure your schemas are structured properly to work with this package. 
```json
   {
	"doc": "Schema for user created event",
	"name": "user_created_event",
	"namespace": "fashionphile.events.user",
	"type": "record"
	"fields": [
			{
				"doc": "Record key: For user the user uuid",
				"name": "event_key",
				"type": "string"
			},
			{
				"doc": "The type of action being performed on the object",
				"name": "event_type",
				"type": "string"
			},
			{
				"doc": "The namespace assigned to system of origin",
				"name": "event_namespace",
				"type": "string"
			},
			{
				"name": "payload",
				"type": {
				"name": "user_created_event_payload",
				"type": "record",
				"fields": [
					//add any addional fields you need here
					{
						"doc": "Unique uuid identifier for user",
						"name": "user_uuid",
						"type": "string"
					}
				]
			}
		}
	]
}
```
The above example can be used as a template when creating schemas to use with this package, just make sure the fields specific to your event are added to the field array in the payload record. Currently there is only one field `user_uuid`.

### Naming Schemas
If you are using schema registry directly via the API or with a package such as [confluent-schema-registry](https://www.npmjs.com/package/@kafkajs/confluent-schema-registry) you properly name the subjects the schemas are assigned to. 

Given the example topic `user_created_event` we we use the following names following the pattern `<topic>-value` and `<topic>-key`

|Topic|user_created_event|
|--|--|
|Value Schema|user_created_event-value|
|Key Schema|user_created_event-key|

If you use the confluent interface to assign key and value schemas to your topics this naming convention will automatically be applied.  Furthermore, using this strict naming convention works well with KsqlDB if and when we decide to use that in our projects.
