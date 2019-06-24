## app-restfront example

### Run the example

Install the dependencies of app-restfront:

```shell
npm install
```

Start the example server:

```shell
node test/app
```

or start the example server with mocking functions:

```shell
DEVEBOT_TEXTURE=mock node test/app
```

```shell
curl --request GET --url http://localhost:7979/restfront/api/v1/fibonacci/calc/47
```
