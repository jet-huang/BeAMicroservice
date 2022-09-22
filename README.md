# Be A Microservice (BAM)
Build a microservice,  
_or_  
Be Part of One?

This repository contains a demo to show several fascinating Solace PubSub+ features in a small game.

## Introduction
### Purposes of this demo
- Our audiences are not always technical savvy.
- Experience PubSub+ features directly and visually.
- For fun ^_^

### Features in this demo
![image](https://user-images.githubusercontent.com/24413042/189151803-6052f137-7a15-4ad6-a300-6b56df3d4b5b.png)

### Architecture briefing
![image](https://user-images.githubusercontent.com/24413042/190535747-742f66be-9ceb-449c-a3d1-f4d672b5704f.png)

### Roles briefing
![image](https://user-images.githubusercontent.com/24413042/189151314-9951a50f-32bc-4f5b-97b0-57788db58393.png)

### Technology stack
![image](https://user-images.githubusercontent.com/24413042/189151503-03293d25-bd7e-4852-aa36-20dd95615edb.png)

### Screenshots
- Admin panel
![image](https://user-images.githubusercontent.com/24413042/190535660-ac40f4d1-1b3e-4865-b904-39c3f09a4006.png)

- Dashboard
![image](https://user-images.githubusercontent.com/24413042/190536062-56381472-d676-4cc9-abf6-d42b38567765.png)

- Running on mobile devices  
so we can invite the audiences to join us (by simply scanning an QR code), mimicking microservices.
![image](https://user-images.githubusercontent.com/24413042/189152870-8c0119e0-340e-48f1-ae29-41dd933e9b0c.png)

- Click to track the processing by Distributed Tracing
![image](https://user-images.githubusercontent.com/24413042/189153311-1062c825-2496-4f83-8e1a-e28d2dba244c.png)

- DT (in detail)
![image](https://user-images.githubusercontent.com/24413042/189153555-6a79efe6-935c-4075-97af-f7b8fcc1f1fa.png)

## How to run it locally
- Clone this repository.
- Go to each directory sequentially to run all containers needed for this demo.

### BEFORE YOU START
- DOWNLOAD required images from:

https://filedrop.solace.com/support/bucket/Distributed_Tracing_EA/tracing-ea.tar.gz

- Extract and load them
```shell
tar -xf tracing-ea.tar.gz
cd tracing-ea
docker load --input solace-pubsub-standard-100.0distributed_tracing_1_1.0.261-docker.tar.gz
docker load --input opentelemetry-collector-contrib-docker.tar.gz
```

### 00_solace-dt-dev
- Initialize
```shell
mkdir -p badger
mkdir -p solace-volume
chmod 777 badger
chmod 777 solace-volume
```

- Run the containers  
You may check .env and solace_config_keys.env to make sure settings there are correct for your environment.
```shell
docker-compose up -d
```

- Configure Solace PS+ broker
```shell
SOLBROKER=dt-dev_solbroker
docker cp config-solace-general.cli $SOLBROKER:/var/lib/solace/jail/cliscripts
docker cp config-solace-tracing.cli $SOLBROKER:/var/lib/solace/jail/cliscripts
docker exec -it $SOLBROKER /usr/sw/loads/currentload/bin/cli -A -es /cliscripts/config-solace-general.cli
docker exec -it $SOLBROKER /usr/sw/loads/currentload/bin/cli -A -es /cliscripts/config-solace-tracing.cli
```

### 05_backend
- Set up runtime configuration with .env  
You must have a valid .env to make sure settings there are correct for your environment.
```shell
# Clone from env.sample
cp .env.sample .env
```

- Run the containers
```shell
docker-compose up --build -d
```

### 10_frontend
- Set up runtime configuration with .env  
You must have a valid .env to make sure settings there are correct for your environment.

```shell
# Clone from env.sample
cp .env.sample .env
```

If you follow the instruction, then the value of "API_BASE_URL" should be 
```
http://[YOUR_IP]:38888
```


- Run the containers
```shell
docker-compose up --build -d
```

After all containers are running, check with "docker ps" to make sure there are 6 containers running.
![image](https://user-images.githubusercontent.com/24413042/191641358-79d55cf5-6aaf-421c-ad96-0834d48a64e8.png)


## How to show this demo (locally in your computer)
1. Access Admin Panel with:
    ```  
    http://[YOUR_IP]:8805/admin  
    ```
    then configure game parameters in Admin Panel.

    For running locally, I suggest __1__ server/ __1__ watcher should be a good start.

    However, if we want to involve our audiences, then we may consider the number of audiences and set up suitable capacity for each role. Usually __40%__ servers/__20%__ watchers/__40%__ requestors is suitable. 

![image](https://user-images.githubusercontent.com/24413042/191641457-9c482612-42f9-43e0-b96f-c48d24f5bb60.png)


2. Leave the game as disabled in Admin Panel.

3. Open Dashboard Panel with:
    ```  
    http://[YOUR_IP]:8805/dashboard  
    ```
Switch on to connect to Solace.

4. Open 3 browsers (we may also use phone/tablet as well), navigate to:  
    ```
    http://[YOUR_IP]:8805  
    ```
    You should be able to see a "JOIN" button with disabled state.

5. Go back to Admin Panel, start (enable) the game.

6. Now you should see "JOIN" is enabled in the 3 browsers, just click "JOIN" and backend will assign a role to that player (browser).

7. Switch on the conncection to Solace on all players. Also, do __NOT__ forget to switch on service in Server/Watcher roles.

8. Send requests from Requestor role and reply with Server/Watcher role.
    - Server role will access some 3rd party API while you "process" each request (by clicking the button). This may cause some delay and some failures. (Let's trace them with DT!)
    - Each server role is throttled if there are more than 9 requests waiting for processing.
    - If some requests waiting in the queue more than 8 seconds, they will be moved to Watcher's queue.
    - Watcher role is responsible for keeping service quality so if it receives requests, then we should "notify" requestor role to understand its requests are "failed".
    - If Server/Watcher cannot process/notify requestor over 16 seconds, the request will be marked as "timedout" (and requestor role has the reason to be angry ^_^||)

![image](https://user-images.githubusercontent.com/24413042/191642519-03069eac-5d33-4214-a85e-ad5d4c13a2ce.png)

9. While the game is running, we can see aggregated statistics in dashboard. Aggregated statistics will be delivered with 3 trasfer types (and we can check "diff" column to explain those differences):
    - Realtime
    - Elided
    - Delayed  

![image](https://user-images.githubusercontent.com/24413042/191641713-f4cabb7f-3515-4a7c-8294-78cabeb401e2.png)

![image](https://user-images.githubusercontent.com/24413042/191641751-5025abe6-aaa7-42c5-a051-8f4afb133eb7.png)

10. After firing some requests, you can also check "Players' Stats". We can see who is the slowest/laziest microservices there. Investigate with clicking their "PlayerId" to open Jaeger UI for more details.  

![image](https://user-images.githubusercontent.com/24413042/191641986-e3e68894-9db0-4c63-92d7-b38fcfcdc572.png)

11. In Jaeger UI, we can see several traces there then we can explain how useful an end-to-end tracing is. _(currently Solace broker doesn't support context propagation yet, but we can manually inject/extract trace id and transfer them with user properties in SMF)_

![image](https://user-images.githubusercontent.com/24413042/191642021-541568d5-674c-4ad4-bf53-d04369579c3a.png)

![image](https://user-images.githubusercontent.com/24413042/191642146-ca693c22-8c97-4573-9057-57c360b99fe6.png)

## How to involve our audiences
Most important of all, we need some "public accessible" URLs for running this demo on Internet, therefore we can invite our customers/prospects to experience Solace features physically. Besides, there are some additional steps we should take:

- Generating QR code for frontend's URL.
- Before starting the demo, show architecture and brief 3 roles which our audiences will play.
- Ask our audiences to prepare their QR code reader (usually their phones) in step 4. 
- We may quickly introduce each part of the dashboard panel. _(Don’t forget switch on “Connect to Solace” to receive stats from the broker)_
- Show QR code and ask them to scan.
- Once most of customers have scanned, enable the game, then prompt them click “JOIN” to join the game.
- Remind them to connect and send requests/reply requests.

## Todo
- Refine RWD in player panel.
- Replay.
- Tuning once context propagation is available in PS+ broker.
- Integration with 3rd party monitoring.
- More gamification
