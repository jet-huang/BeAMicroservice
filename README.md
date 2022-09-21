# Be A Microservice (BAM)
Demonstrating several Solace PubSub+ features in a small game.

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
Go to each directory in order to run all containers needed for this demo.

### 00_solace-dt-dev
- DOWNLOAD required images from:
https://filedrop.solace.com/support/bucket/Distributed_Tracing_EA/

- Extract and load them
```shell
tar -xf tracing-ea.tar.gz
cd tracing-ea
docker load --input solace-pubsub-standard-100.0distributed_tracing_1_1.0.261-docker.tar.gz
docker load --input opentelemetry-collector-contrib-docker.tar.gz
```
- Initialize
```shell
cd solace-dt-dev
mkdir -p badger
mkdir -p solace-volume
chmod 777 badger
chmod 777 solace-volume
```

- Configure otel collector 
Edit otel-collector-config.yaml to make sure "cors" section listing correct host/ip addresses.

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

- Run the containers
```shell
docker-compose up --build -d
```
