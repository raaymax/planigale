### 2025.06.28

#### @planigale/sse 0.2.7 (patch)

- fix(sse): signal aborted without reason (#26)

### 2025.03.22

#### @planigale/sse 0.2.6 (patch)

- feat(sse): disconnect source by keep-alive

### 2025.03.08

#### @planigale/testing 0.3.6 (patch)

- fix(testing): types alignment after update

### 2025.01.19

#### @planigale/planigale 0.6.10 (patch)

- feat(planigale): better logging for internal errors

#### @planigale/sse 0.2.5 (patch)

- fix(sse): message sending when stream is closed

### 2024.12.27

#### @planigale/planigale 0.6.9 (patch)

- feat(planigale): internal server error can be unknown

### 2024.12.27

#### @planigale/body-parser 0.2.1 (patch)

- feat(body-parser): replaced qs with querystring

#### @planigale/planigale 0.6.8 (patch)

- feat(planigale): replaced qs with querystring

#### @planigale/querystring 0.1.0 (minor)

- feat(querystring): add querystring module to replace qs

### 2024.12.27

#### @planigale/planigale 0.6.7 (patch)

- feat(planigale): migrate to import maps

### 2024.11.18

#### @planigale/planigale 0.6.6 (patch)

- fix(planigale): ip type error in req

### 2024.10.14

#### @planigale/sse 0.2.4 (patch)

- fix(sse): default fetch failing on browser

#### @planigale/testing 0.3.5 (patch)

- fix(testing): fix types of fetch

### 2024.10.14

#### @planigale/planigale 0.6.5 (patch)

- feat(planigale): allow matching any method for route
- fix(planigale): internal server error was not logged

### 2024.10.11

#### @planigale/planigale 0.6.4 (patch)

- feat(planigale): upgrade to deno 2.0

#### @planigale/schema 0.1.4 (patch)

- feat(schema): upgrade to deno 2.0

#### @planigale/sse 0.2.3 (patch)

- feat(sse): upgrade to deno 2.0

#### @planigale/testing 0.3.4 (patch)

- feat(testing): upgrade to deno 2.0
- feat(testing): ability to check any number of status codes

### 2024.10.02-2

#### @planigale/testing 0.3.3 (patch)

- fix(testing): add arguments for then should be optional

### 2024.10.02

#### @planigale/planigale 0.6.3 (patch)

- feat(planigale): add ability to delete cookies for a specific path

#### @planigale/testing 0.3.2 (patch)

- feat(testing): add SSE connection for agent with auto close

### 2024.09.28

#### @planigale/schema 0.1.3 (patch)

- feat(schema): add custom keyword validation support

#### @planigale/planigale 0.6.2 (patch)

- feat(planigale): add sending files using Res

#### @planigale/sse 0.2.2 (patch)

- fix(sse): code formatting
- fix(sse): SSE source error handling

#### @planigale/testing 0.3.1 (patch)

- fix(testing): uncaught assertion errors in tests
- feat(testing): ability to discard/cancel body stream
- fix(testing): testing agent not closing correctly on error
- fix(testing): SSESource should throw when fail to connect
- fix(testing): error message is not visible

### 2024.08.02

#### @planigale/body-parser 0.2.0 (minor)

- BREAKING(body-parser): only some methods will have body parsed

#### @planigale/planigale 0.6.1 (patch)

- feat(planigale): ability to add headers to ApiErrors
- feat(planigale): added Res.empty() for 204 No Content responses

#### @planigale/schema 0.1.2 (patch)

- feat(schema): ability to add custom formats

### 2024.07.31

#### @planigale/planigale 0.6.0 (minor)

- BREAKING(planigale): non-strict url matching mode by default

#### @planigale/schema 0.1.1 (patch)

- feat(schema): ability to add schemas and reference them

#### @planigale/testing 0.3.0 (minor)

- BREAKING(testing): added new testing method and fixed cookie jar
