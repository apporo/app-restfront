## app-restfront example

### Run the example

Install the dependencies of app-restfront:

```shell
npm install
```

Start the example server:

```shell
export DEVEBOT_SANDBOX=old-mappings
node test/app
```

or start the example server with mocking functions:

```shell
DEVEBOT_TEXTURE=mock node test/app
```

```shell
curl --request GET --url http://localhost:7979/restfront/rest/v2/fibonacci/calc/47
```
