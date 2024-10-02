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
