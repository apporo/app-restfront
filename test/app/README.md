## app-restfront example

### Run the example

Install the dependencies of app-restfront:

```shell
npm install
```

Show all of log messages:

```shell
export DEBUG=devebot*,app*
export LOGOLITE_DEBUGLOG_ENABLED=true
```

Start the example server:

```shell
export DEVEBOT_SANDBOX=old-mappings
npm run clean && npm run build && node test/app
```

```shell
export DEVEBOT_SANDBOX=new-mappings
npm run clean && npm run build && node test/app
```

or start the example server with mocking functions:

```shell
DEVEBOT_TEXTURE=mock node test/app
```

```shell
curl --request GET \
--url http://localhost:7979/restfront/rest/sub/v2/fibonacci/calc/47
```
