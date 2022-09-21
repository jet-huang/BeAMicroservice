## Prepare images
DOWNLOAD required images from:
https://filedrop.solace.com/support/bucket/Distributed_Tracing_EA/

```shell
tar -xf tracing-ea.tar.gz
cd tracing-ea
docker load --input solace-pubsub-standard-100.0distributed_tracing_1_1.0.261-docker.tar.gz
docker load --input opentelemetry-collector-contrib-docker.tar.gz
```

## Deplayment
### Initialize
```shell
cd solace-dt-dev
mkdir -p badger
mkdir -p solace-volume
chmod 777 badger
chmod 777 solace-volume
```
### Run the containers
```shell
docker-compose up -d
```

## Configure environment
### Solace broker
```shell
SOLBROKER=dt-dev_solbroker
docker cp config-solace-general.cli $SOLBROKER:/var/lib/solace/jail/cliscripts
docker cp config-solace-tracing.cli $SOLBROKER:/var/lib/solace/jail/cliscripts
docker exec -it $SOLBROKER /usr/sw/loads/currentload/bin/cli -A -es /cliscripts/config-solace-general.cli
docker exec -it $SOLBROKER /usr/sw/loads/currentload/bin/cli -A -es /cliscripts/config-solace-tracing.cli
```