# Harpia Framework

Harpia Core is the foundational module of the Harpia Framework, designed exclusively for the Bun runtime. Like Express, Fastify, or Hono, it can be used independently, offering a lightweight yet powerful foundation for building modern web applications optimized for Bun.


[![TypeScript](https://img.shields.io/badge/TypeScript-%3E%3D%205.x-blue.svg)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-%3E%3D%201.x-blue.svg)](https://bun.sh/)
[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](https://github.com/@harpia/core/core/blob/main/LICENSE)
[![Coverage](https://img.shields.io/badge/Coverage-100%25-brightgreen.svg)]()


Table of Contents
- [Installation](#installation)
- [Features](#features)
- [Examples](#examples)
  - [Start the Server](#start-the-server)
  - [Route Management](#route-management)
  - [Middlewares](#middlewares)
  - [Web Socket](#web-socket)
  - [Static Files](#static-files)
  - [Template Engine](#template-engine)
  - [Method Override](#method-override)
  - [Custom "Not Found" Route](#custom-not-found-route)
  - [CORS](#cors)
  - [Cookies](#cookies)
  - [Cache](#cache)
  - [Session](#session)
  - [CSRF](#csrf)
  - [Upload](#upload)
  - [Request Monitor](#request-monitor)
  - [Security Headers (Shield)](#security-headers-shield)
  - [Test Client](#test-client)
  - [Memory Storage](#memory-storage)
  - [Redis](#redis)
- [Authors](#authors)

## Installation

```bash
  bun add @harpia/core
```

## Features

- Route management
- Middleware support
- Web Socket support
- Static file support
- Template engine support
- Harpia template engine
- Custom "not found" route
- Custom cors
- Cookie handling
- Cache management
- Session management
- Upload
- Request monitor and performance metrics
- Test client (like Supertest)
- Memory storage and redis support

## Examples

### Start the server
```typescript
import harpia from "@harpia/core";

const app = harpia();

app.listen({
  port: 3000,
  development: true,
  reusePort: true,
  hostname: "localhost",
}, () => console.log("Server is running at http://localhost:3000/"));
```

### Server configuration
A Harpia application starts with the `app.listen()` method, which accepts a configuration object of type `ServerOptions`.
This object defines how the HTTP and WebSocket servers behave, including port, host, TLS settings, and connection performance options.

#### Example

```typescript
import harpia from "@harpia/core";

const app = harpia();

app.listen({
  port: 3000,
  development: true,
  reusePort: true,
  hostname: "localhost",
}, () => console.log("Server is running at http://localhost:3000/"));
```

---

### `ServerOptions` Reference

| Property                 | Type                      | Description                                                                                                                             |
| ------------------------ | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **`port`**               | `number` *(optional but required if `unix` is not set)*     | The TCP port the server will listen on.                                                             |
| **`development`**        | `boolean` *(optional)*    | Enables development mode, which may include detailed error messages, automatic restarts, and verbose logging.                           |
| **`hostname`**           | `string` *(optional)*     | The hostname or IP address where the server should bind. Defaults to `"0.0.0.0"` (all interfaces).                                      |
| **`tls`**                | `TLSOptions` *(optional)* | Enables HTTPS by providing TLS/SSL configuration (e.g., `cert`, `key`). When present, the server will start over HTTPS instead of HTTP. |
| **`unix`**               | `string` *(optional but required if `port` is not set)*     | Path to a Unix domain socket file. If specified, the server will listen on this socket instead of a TCP port.                           |
| **`reusePort`**          | `boolean` *(optional)*    | When `true`, allows multiple processes to listen on the same port. Useful for load balancing across workers.                            |
| **`maxRequestBodySize`** | `number` *(optional)*     | Maximum size (in bytes) of an incoming HTTP request body. Requests exceeding this limit will be rejected.                               |
| **`ws`** | `object` *(optional)* | Defines advanced options for WebSocket behavior and resource limits |

---

#### WebSocket Configuration (`ServerOptions.ws`)

The `ws` property defines advanced options for WebSocket behavior and resource limits.

| Property                           | Type                   | Description                                                                                                                |
| ---------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **`maxPayloadLength`**             | `number` *(optional)*  | Maximum size (in bytes) allowed for an incoming WebSocket message. Messages exceeding this limit will be dropped.          |
| **`idleTimeout`**                  | `number` *(optional)*  | Time in seconds a WebSocket connection can stay idle before being automatically closed.                                    |
| **`backpressureLimit`**            | `number` *(optional)*  | The maximum amount of unsent data (in bytes) a WebSocket can buffer before triggering backpressure handling.               |
| **`closeOnBackpressureLimit`**     | `boolean` *(optional)* | When `true`, the server will automatically close connections that exceed the backpressure limit.                           |
| **`sendPings`**                    | `boolean` *(optional)* | When `true`, the server will automatically send periodic ping frames to connected clients to detect broken connections.    |
| **`publishToSelf`**                | `boolean` *(optional)* | Determines whether messages published to a channel are also delivered to the sender. Useful for broadcast implementations. |
| **`perMessageDeflate`**            | `object` *(optional)*  | Controls compression for WebSocket messages using the `permessage-deflate` extension.                                      |
| **`perMessageDeflate.compress`**   | `boolean` *(optional)* | Enables compression for outgoing WebSocket messages.                                                                       |
| **`perMessageDeflate.decompress`** | `boolean` *(optional)* | Enables decompression for incoming WebSocket messages.                                                                     |

---

#### Notes

* If both `port` and `unix` are provided, the server will prefer the **Unix socket**.
* WebSocket options (`ws`) apply globally to all routes using `app.ws()` or `router.ws()`.
* TLS options must include valid certificate and private key paths for secure HTTPS/WebSocket connections.
* `reusePort` is typically used in production setups with multiple workers or clustered processes.

### Route management

Creating a route in a different file.

```typescript
import { Router } from "@harpia/core";

const books = Router();

books.get("/books", () => console.log("Books route"));

export default books;
```

Creating a route with a prefix

```typescript
import { Router } from "@harpia/core";

const books = Router("books");

books.get("/", () => console.log("Books route"));

export default books;
```

Creating a websocket route

```typescript
import { Router } from "@harpia/core";

const routes = Router();

// Define a custom type for WebSocket connection data
type CustomWebSocketData = {
  userId: string;
  username: string;
  sessionId: string;
};

// Create a WebSocket route for the chat
routes.ws<CustomWebSocketData>("/chat", {
  // Called when a new WebSocket connection is opened
  open(ws) {
    const data = ws.data;

    console.log("New WebSocket connection opened on /chat");

    // Set custom data for this connection
    data.userId = "123";
    data.username = "Alice";
    data.sessionId = "abc";

    ws.send(`Welcome to the chat, ${data.username}!`);
  },

  // Called when a message is received from the client
  message(ws, message) {
    const data = ws.data;
    console.log(`Message received from ${data.username}: ${message}`);
  },

  // Called when the WebSocket connection is closed
  close(ws, code, reason) {
    const data = ws.data;
    console.log(`Connection closed (${code}) by ${data.username}: ${reason}`);
  },

  // Called when the socket is ready to send more data
  drain(ws) {
    const data = ws.data;
    console.log(`Socket for ${data.username} is ready to send data`);
  },

  // Called when an error occurs on the WebSocket connection
  error(ws, error) {
    const data = ws.data;
    console.error(`Error on ${data.username}'s connection:`, error);
  },
});

export default routes;
```

Import the route into the main application.

```typescript
import harpia from "@harpia/core";
import books from "./books.routes";

const app = harpia();

app.routes(books);
app.listen({
  port: 3000,
  development: true,
  reusePort: true,
  hostname: "localhost",
}, () => console.log("Server is running at http://localhost:3000/"));
```

### Middlewares
**Set a global middleware**

```typescript
const app = harpia();

app.use((req, res, next) => {
  // Your middleware logic
  next();
});
```

**Set a middleware with path**

```typescript
app.use("/panel", (req, res, next) => {
  // Your middleware logic
  next();
});
```

**Set a middleware to a specific route**

```typescript
import { Router } from "@harpia/core";

const books = Router();

books.get(
    "/books",
    () => console.log("auth middleware"),
    () => console.log("Books route")
);

export default books;
```

### Web Socket
You can define a route and a custom data for each WebSocket connection and implement handlers for events like connection opening, message reception, connection closing, and errors.


You can define **WebSocket routes** that handle events for real-time connections.
Each connection creates its own `ServerWebSocket` instance, which can hold **custom connection data** using the `ws.data` property.

You can create WebSocket routes using either the **application instance (`app`)** or a **router instance (`Router`)**:

```typescript
import { Router } from "@harpia/core";

const routes = Router();

routes.ws("/chat", { /** handlers */ });
```

or

```typescript
import harpia from "@harpia/core";

const app = harpia();

app.ws("/chat", { /** handlers */ });
```

---

#### Supported Handlers

| Handler                       | Description                                                                                                             |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **`open(ws)`**                | Called when a new WebSocket connection is successfully opened.                                                          |
| **`message(ws, message)`**    | Called whenever a message is received from the client. The `message` can be a `string`, `ArrayBuffer`, or `Uint8Array`. |
| **`close(ws, code, reason)`** | Called when the connection is closed. Receives the close code and an optional reason message.                           |
| **`drain(ws)`**               | Called when the socket is ready to receive more data (after backpressure is relieved).                                  |
| **`error(ws, error)`**        | Called when an error occurs on the WebSocket connection (e.g., failure to send data).                                   |

---

#### Example with Custom Connection Data

You can define a custom data type for each WebSocket connection using `ws.data`.
This is useful for storing user info, session data, or connection-specific context.

```typescript
// Define a custom type for WebSocket connection data
type CustomWebSocketData = {
  userId: string;
  username: string;
  sessionId: string;
};

// Create a WebSocket route for the chat
app.ws<CustomWebSocketData>("/chat", {
  // Called when a new WebSocket connection is opened
  open(ws) {
    const data = ws.data;

    console.log("New WebSocket connection opened on /chat");

    // Set custom data for this connection
    data.userId = "123";
    data.username = "Alice";
    data.sessionId = "abc";

    ws.send(`Welcome to the chat, ${data.username}!`);
  },

  // Called when a message is received from the client
  message(ws, message) {
    const data = ws.data;
    console.log(`Message received from ${data.username}: ${message}`);
  },

  // Called when the WebSocket connection is closed
  close(ws, code, reason) {
    const data = ws.data;
    console.log(`Connection closed (${code}) by ${data.username}: ${reason}`);
  },

  // Called when the socket is ready to send more data
  drain(ws) {
    const data = ws.data;
    console.log(`Socket for ${data.username} is ready to send data`);
  },

  // Called when an error occurs on the WebSocket connection
  error(ws, error) {
    const data = ws.data;
    console.error(`Error on ${data.username}'s connection:`, error);
  },
});
```

#### Key Notes

* `ws.data` is **persistent** for the entire lifetime of a connection — each connected client has its own data object.
* You can **send messages** with `ws.send("text")` or send binary data (`Uint8Array`).
* To **broadcast messages to all connected clients**, keep a global list of open connections and iterate through them.
* The `error` handler is optional but highly recommended in production environments.
* Harpia provides native WebSocket integration — no additional libraries like `ws` or `socket.io` are required for basic functionality.



### Static Files
To serve static files, you need to create a folder for them—e.g., `public`.

```typescript
const app = harpia();

app.static("public");
```

### Template Engine
To set up a template engine, you can follow these steps:

Create a file for engine configuration:
```typescript
// src/ejs.ts
import ejs from "ejs";
import path from "node:path";
import type { Harpia } from "@harpia/core";

export const ejsEngine = {
  configure: (app: Harpia) => {
    app.engine.set(ejsEngine);
  },
  render: async (view: string, data: Record<string, any>) => {
    const filePath = path.resolve(process.cwd(), "src/views", `${view}.ejs`);   

    return await ejs.renderFile(filePath, data);
  }
};
```

Set up the application to use the engine:
```typescript
import harpia from "@harpia/core";
import { ejsEngine } from "./ejs";

const app = harpia();

ejsEngine.configure(app);

app.get("/books", async (req, res) => {
  await res.render("home", { title: "Books" })
});

app.listen...
```

Sample EJS Template (e.g., `src/views/home.ejs`):
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><%= title %></title>
  </head>
  <body>
    <h1>Hello World!</h1>
  </body>
</html>
```

To use the harpia template engine, you can follow these steps:

create a `template-engine.ts` file:
```typescript
import path from "node:path";
import { TemplateEngine } from "@harpia/core/template-engine";

const baseDir = process.cwd();

export const engine = new TemplateEngine({
  viewName: "page", // page.html will be rendered
  useModules: false, // true if uses a module structure (e.g. modules/users/pages/home/page.html)
  fileExtension: ".html", // The default is `.html`, but you can use `.txt`, `.hml`, or any other.
  path: {
    views: path.join(baseDir, "src", "resources", "pages"),
    layouts: path.join(baseDir, "src", "resources", "layouts"), // optional
    components: path.join(baseDir, "src", "resources", "components"), // optional
  },
});
```

And set up the application to use the engine:

```typescript
import harpia from "@harpia/core";
import { engine } from "./template-engine";

const app = harpia();
engine.configure(app);

app.get("/books", async (req, res) => {
  await res.render("home", { title: "Books" });
});

app.listen...
```

If you want to use the [Security Header Protection](#security-headers-shield):
```typescript
import harpia from "@harpia/core";
import { shield } from "./shield";
import { engine } from "./template-engine";

const app = harpia();

// Apply security headers middleware
app.use(shield.middleware(app));

// Setup template engine
engine.configure(app, shield.instance);

// Routes
app.get("/books", async (req, res) => {
  await res.render("home", { title: "Books" });
});

app.listen...
```

If you would like use a module structure, e.g. `modules/users/pages/home/page.html`, then create a `template-engine.ts` file:
```typescript
import path from "node:path";
import { TemplateEngine } from "@harpia/core/template-engine";

const baseDir = process.cwd();

export const engine = new TemplateEngine({
  viewName: "page", // page.html will be rendered
  useModules: true, // true if uses a module structure (e.g. modules/users/pages/home/page.html)
  fileExtension: ".html", // The default is `.html`, but you can use `.txt`, `.hml`, or any other.
  path: {
    views: path.join(baseDir, "modules", "**", "pages"),
    layouts: path.join(baseDir, "resources", "layouts"),
    components: path.join(baseDir, "resources", "components"),
  },
});
```

And set up the application to use the engine:

```typescript
import harpia from "@harpia/core";
import { engine } from "app/config/template-engine";

const app = harpia();
engine.configure(app);

app.get("/books", async (req, res) => {
  await res.module("books").render("home", { title: "Books" });
});

app.listen...
```

It is also possible to render a template from its path, regardless of where it is in the application. To do this, we can follow the example:
```typescript
import harpia from "@harpia/core";
import { engine } from "app/config/template-engine";

const app = harpia();
engine.configure(app);

app.post("/send-email", async (req, res) => {
  const data = {}
  const content = await engine.generate("app/services/mailer/templates/account-created", { data });

  console.log(content);
});

app.listen...
```

#### Harpia Template Engine Syntax Overview

| Type                          | Syntax                                            | Description                                                                | Example                                                                 |
| ------------------------------ | ------------------------------------------------ | -------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| **Variable / Output**          | `{{ expr }}`                                     | Inserts the result of an expression into the template.                     | `<h1>{{ title }}</h1>`                                                  |
| **Plugin / Function**          | `{{ fn(arg1, arg2) }}`                           | Calls a registered plugin or function and inserts its result.              | `<p>{{ uppercase(username) }}</p>`                                      |
| **Local Assignment**           | `@set var = value @endset`                       | Declares a local variable available within the template scope.             | `@set name = "Lucas" @endset\n<p>{{ name }}</p>`                        |
| **Conditional**                | `@if condition ... @elseif ... @else ... @endif` | Defines conditional logic with optional branches.                          | `@if isAdmin\n  <p>Admin</p>\n@else\n  <p>User</p>\n@endif`             |
| **Array Loop**                 | `@for item in items ... @endfor`                 | Iterates over an array; `item` represents the current element.             | `@for item in items\n  <li>{{ item }}</li>\n@endfor`                    |
| **Object Loop**                | `@for [key, value] in obj ... @endfor`           | Iterates over key/value pairs in an object.                                | `@for [k, v] in obj\n  <li>{{ k }}: {{ v }}</li>\n@endfor`              |
| **Layout / Inheritance**       | `@layout("default", { key: value })`             | Defines the base layout and optionally passes static parameters.           | `@layout("default", { title: "Homepage" })`                             |
| **Block Placeholder**          | `@yield("block_name")`                           | Defines a placeholder inside the layout for injected content.              | `<body>\n  @yield("content")\n</body>`                                  |
| **Content Block**              | `@block("block_name") ... @endblock`             | Defines the content for a named block to be inserted into a layout.        | `@block("content")\n  <h1>Hello</h1>\n@endblock`                        |
| **Import/Include**             | `@import("component", { key: value })`           | Includes another template relative to the current view, with props.        | `@import("button", { text: "Save" })`                                   |
| **Partial/Component**          | `@component("name", { key: value })`             | Includes a reusable component from the components directory.               | `@component("header", { user: currentUser })`                           |
| **Comment**                    | `## comment`                                     | Defines a comment line that is not rendered in the final HTML.             | `## This is a comment`                                                  |

#### Plugin Usage Example:

```typescript
import path from "node:path";
import { TemplateEngine } from "@harpia/core/template-engine";

const baseDir = process.cwd();

export const engine = new TemplateEngine({
  viewName: "page",
  useModules: false,
  fileExtension: ".html",
  path: {
    views: path.join(baseDir, "src", "resources", "pages"),
    layouts: path.join(baseDir, "src", "resources", "layouts"),
    components: path.join(baseDir, "src", "resources", "components"),
  },
});

// Register custom plugins
engine.registerPlugin("uppercase", (str: string) => str.toUpperCase());
engine.registerPlugin("sum", (a: number, b: number) => a + b);
```

and in the .html file:
```html
  <p>Uppercase plugin: {{ uppercase(user.name) }}</p>
  <p>Sum plugin: {{ sum(10, 20) }}</p>
```

#### Layout Example

Layout name: default.html
```html
<html>
  <head>
    <title>{{ title }}</title>
  </head>
  <body>
    @yield("content")
  </body>
</html>
```

View:
```html
@layout("default", { title: "Homepage" })

@block("content")
  <h1>Welcome, {{ user.name }}!</h1>
  <p>{{ uppercase("this page uses the default layout.") }}</p>
@endblock
```

#### Unescaped Content

Using the `raw(...)` plugin, you can add content without escaping.

```html
<p>{{ raw("<script>alert('xss')</script>") }}</p>
```

#### Nonce Value

When using the Shield module for security headers, the template engine automatically registers a `generateNonce` plugin. This plugin generates a unique nonce for each request, which you can use to secure inline scripts and styles for Content Security Policy (CSP).

```html
<script nonce="{{ nonce }}">
  console.log("This script is CSP-compliant");
</script>
```

> The `generateNonce` plugin is automatically available when `app.shield()` is configured in the application. See the [Shield](#security-headers-shield) section for setup instructions.

### Method Override
The Method Override technique is commonly used to simulate HTTP methods like `PUT`, `DELETE`, and `PATCH` in web applications where the client (e.g., browsers) may not natively support these methods. This is particularly useful when working with HTML forms, which only support `GET` and `POST` methods.

The idea is to include a hidden input field (e.g., `_method`) within a `POST` form to indicate the desired HTTP method. The form must use the `enctype="application/x-www-form-urlencoded"` attribute to ensure the data is properly encoded. When the form is submitted, the server reads the `_method` value and overrides the actual `POST` method with the specified one.

#### Example
```html
<form action="/account" method="POST" enctype="application/x-www-form-urlencoded">
  <input type="hidden" name="_method" value="DELETE">
  <button type="submit">Delete</button>
</form>
```

### Custom not found route
You can define a custom "Not Found" route to handle requests to undefined paths.
```typescript
const app = harpia();

app.setNotFound((req, res) => {
  res.json({ status: 404, message: "Not Found" });
});
```

If you want to specify a particular HTTP method for the "Not Found" route (e.g., only for `GET` requests), you can do it as follows:
```typescript
const app = harpia();

app.setNotFound((req, res) => {
  res.json({ status: 404, message: "Not Found" });
}, ["GET"]);
```

**Note**: Currently, the framework does not support multiple "Not Found" routes for different HTTP methods or paths. You can only define one "Not Found" route.

### Cors
Harpia provides a way to configure Cross-Origin Resource Sharing (CORS) for your application, allowing you to specify which origins, HTTP methods, and headers are permitted.

You can define CORS settings globally for the entire application or specify them for individual routes.

#### Basic CORS Setup

To set up basic CORS for your application:

```typescript
import harpia from "@harpia/core";

const app = harpia();

app.cors({
  origin: "*",  // Allow all origins
  methods: ["GET", "POST", "PUT", "DELETE"],  // Allow specific HTTP methods
  allowedHeaders: ["Content-Type", "Authorization"],  // Allow specific headers
});

app.listen...
```

#### Customizing CORS for Specific Routes

You can also apply different CORS configurations to specific routes or groups of routes.

```typescript
import harpia, { Router } from "@harpia/core";

const books = Router();

books.get("/books", () => {
  console.log("Books route with custom CORS");
});

const app = harpia();
app.routes(books);

app.cors({
  origin: "https://example.com",  // Allow only this origin
  methods: "GET",  // Allow only GET method
}, "/books");  // Apply CORS only to the "/books" route

app.listen...
```

#### CORS Options

You can configure the following options for CORS:

- **`origin`**: Specifies the allowed origins. Can be a boolean (`true` to allow all), a string (a specific origin), a regular expression, or an array of origins or regular expressions.
  
  Example:
  - `true`: Allow all origins.
  - `"https://example.com"`: Allow only `example.com`.
  - `/^https:\/\/.*\.com$/`: Allow any `.com` domain.

- **`methods`**: Defines the allowed HTTP methods. It can be a single method (`"GET"`, `"POST"`, etc.), an array of methods, or `"*"`, which means all methods are allowed.

- **`allowedHeaders`**: Specifies which headers can be included in the request. It can be a string (e.g., `"Content-Type"`) or an array of headers.

- **`exposedHeaders`**: Allows you to specify which headers can be exposed to the browser. It can be a string or an array of headers.

- **`credentials`**: Indicates whether the browser should send cookies and HTTP authentication information with cross-origin requests. Set to `true` to allow credentials.

- **`maxAge`**: Specifies the maximum time (in seconds) that the browser should cache the CORS response.

- **`preflightContinue`**: If `true`, the framework will not respond to preflight requests automatically; this must be handled by the user manually.

- **`optionsSuccessStatus`**: Allows you to specify a custom success status code for preflight requests (defaults to `204`).

#### Example with All Options

```typescript
import type { CorsOptions } from 'harpia';

const corsOptions: CorsOptions = {
  origin: "https://example.com",  // Allow only requests from example.com
  methods: ["GET", "POST"],       // Allow only GET and POST methods
  allowedHeaders: ["Content-Type", "Authorization"],  // Allow specific headers
  exposedHeaders: ["X-Custom-Header"],  // Expose custom headers to the client
  credentials: true,  // Allow credentials (cookies) in cross-origin requests
  maxAge: 3600,  // Cache the CORS preflight response for 1 hour
  optionsSuccessStatus: 200,  // Custom success status code for preflight requests
}

app.cors(corsOptions);
```

### Cookies
You can use this to store session information, authentication tokens, or any other data that needs to persist across requests.

#### Setting a Cookie

To set a cookie, you can use the `res.cookies.set` method. You can specify various options such as expiration date, domain, path, and security settings.

```typescript
import harpia, { type CookiesOptions } from "@harpia/core";

const app = harpia();

app.get("/set-cookie", (req, res) => {
  const cookieOptions: CookiesOptions = {
    path: "/",
    maxAge: 3600,  // 1 hour
    secure: true,  // Only send cookie over HTTPS
    httpOnly: true,  // Make the cookie inaccessible to JavaScript
    sameSite: "Strict",  // Restrict the cookie to first-party contexts
  };
  
  res.cookies.set("userSession", "abcd1234", cookieOptions);  // Set a cookie with options
  res.send("Cookie has been set!");
});

app.listen...
```

#### Getting a Cookie

To retrieve a cookie, you can use the `get` method. It returns the value of the specified cookie if it exists, or `undefined` if the cookie is not found.

```typescript
app.get("/get-cookie", (req, res) => {
  const userSession = req.cookies.get("userSession");  // Get the cookie

  if (userSession) {
    res.send(`User session: ${userSession}`);
  } else {
    res.send("No user session cookie found.");
  }
});
```

#### Deleting a Cookie

To delete a cookie, you can use the `delete` method. This sets the cookie value to an empty string and expires it immediately.

```typescript
app.get("/delete-cookie", (req, res) => {
  res.cookies.delete("userSession");  // Delete the cookie
  res.send("Cookie has been deleted.");
});
```

#### Cookie Options

You can customize cookies using the following options:

- **`path`**: The URL path for which the cookie is valid. Defaults to the root path (`/`).
- **`domain`**: The domain for which the cookie is valid. Defaults to the current domain.
- **`maxAge`**: The maximum age of the cookie in seconds. If not set, the cookie will be a session cookie, expiring when the browser closes.
- **`expires`**: The exact expiration date for the cookie. Can be set as a `Date` object.
- **`httpOnly`**: If `true`, the cookie will be inaccessible to JavaScript, protecting it from cross-site scripting (XSS) attacks.
- **`secure`**: If `true`, the cookie will only be sent over HTTPS connections, ensuring its security.
- **`sameSite`**: Controls whether the cookie should be sent with cross-origin requests. Possible values are:
  - `"Strict"`: The cookie will only be sent in a first-party context (i.e., when navigating to the origin site).
  - `"Lax"`: The cookie will be sent for top-level navigations and GET requests.
  - `"None"`: The cookie will be sent with all requests, including cross-origin requests. If using `"None"`, the `secure` flag must also be set to `true`.

Example of using `SameSite`:

```typescript
const cookieOptions: CookiesOptions = {
  sameSite: "Strict",  // Only send the cookie in a first-party context
  secure: true,        // Send only over HTTPS
};
res.cookie("userSession", "abcd1234", cookieOptions);
```

#### Getting All Cookies

To retrieve all cookies in the request, you can use the `getAll` method, which returns a dictionary of cookie names and values.

```typescript
app.get("/get-all-cookies", (req, res) => {
  const allCookies = req.cookies.getAll();  // Get all cookies
  res.json(allCookies);
});
```

### Cache

Harpia includes a `Cache` class that allows you to store and manage cached data for your web applications.

#### Creating a Cache Instance

To create a new cache instance, simply instantiate the `Cache` class. You can optionally provide a custom `store` (e.g., using a custom memory store or a third-party store like Redis).

```typescript
import harpia, { Cache } from "@harpia/core";

const app = harpia();
const cache = new Cache();
```

#### Storing and Retrieving Data in Cache via Routes

You can store data in the cache or retrieve it from the cache within route handlers. Here's an example of caching a value in a route and retrieving it from the cache in a different route:

```typescript
import harpia, { Cache } from "@harpia/core";

const app = harpia();
const cache = new Cache();

// Route to set data in the cache
app.get("/set-cache", async (req, res) => {
  const userProfile = { username: "john_doe", age: 30 };
  await cache.set("userProfile", userProfile);
  res.json({ message: "User profile cached!" });
});

// Route to retrieve data from the cache
app.get("/get-cache", async (req, res) => {
  const userProfile = await cache.get("userProfile");
  if (!userProfile) {
    res.json({ status: "not found", message: "User profile not found in cache." });
    return;  
  }

  res.json({ status: "success", data: userProfile });
});

app.listen(3000, () => console.log("Server started at http://localhost:3000/"));
```

In the example above:
1. **`/set-cache`** stores a user profile object in the cache under the key `userProfile`.
2. **`/get-cache`** retrieves the cached user profile if available. If it's not found, it returns a "not found" message.

#### Deleting Data from Cache via Route

You can also delete cached data using a route. Here's an example of how to delete a cache entry:

```typescript
app.get("/delete-cache", async (req, res) => {
  await cache.delete("userProfile");
  res.json({ message: "User profile cache deleted!" });
});
```

#### Example Usage

Here's an example of using caching in a real-world scenario, such as caching user profile data for performance optimization. In this case, if the user profile is already cached, it will be returned from the cache instead of fetching it again from the database.

```typescript
app.get("/user-profile/:id", async (req, res) => {
  const userId = req.params.id;
  const cacheKey = `userProfile:${userId}`;

  // Try to fetch the user profile from the cache
  const cachedProfile = await cache.get(cacheKey);
  if (cachedProfile) {
    res.json({ status: "success", data: cachedProfile });
    return;
  }

  // If not in cache, fetch the profile from the database (simulated here)
  const profile = { id: userId, username: "john_doe", age: 30 };

  // Store the profile in cache for future requests
  await cache.set(cacheKey, profile);

  // Respond with the fetched profile
  res.json({ status: "success", data: profile });
});
```

### Session

Harpia includes a `Session` class that allows you to manage user sessions. The `Session` class utilizes a store (default is in-memory) to manage session data, and a cookie is used to track the session ID on the client-side.

#### Creating a Session Instance

To use the session management functionality, you first need to create an instance of the `Session` class.

```typescript
import harpia, { Session } from "@harpia/core";

const app = harpia();
const session = new Session();
```

#### Creating a New Session

You can create a new session with a given data object. When a session is created, a session ID is generated and the session data is stored.

```typescript
app.get("/login", async (req, res) => {
  const userData = { username: "john_doe", role: "admin" };
  const sessionId = await session.create(userData);
  
  // Set the session ID in the cookie
  session.setCookie(res, sessionId, { httpOnly: true, secure: true });
  
  res.json({ message: "User logged in successfully!" });
});
```

In this example, when a user logs in, a new session is created with the user data, and the session ID is stored in a cookie on the client.

#### Retrieving Session Data

You can retrieve session data from the store using the session ID stored in the client's cookies. The session ID is sent with each request in the cookie.

```typescript
app.get("/profile", async (req, res) => {
  const userSession = await session.fromRequest(req);
  
  if (userSession) {
    res.json({ status: "success", data: userSession });
  } else {
    res.json({ status: "not authenticated", message: "Please log in first." });
  }
});
```

Here, the session data is retrieved based on the session ID from the client's cookies. If the session exists, the user's data is returned; otherwise, the user is prompted to log in.

#### Updating Session Data

Session data can be updated by fetching the existing data and modifying it.

```typescript
app.get("/update-profile", async (req, res) => {
  const sessionId = req.cookies.get("session_id");
  if (sessionId) {
    const updatedData = { role: "super_admin" };
    const success = await session.update(sessionId, updatedData);
    
    if (success) {
      res.json({ status: "success", message: "Profile updated." });
    } else {
      res.json({ status: "error", message: "Session not found." });
    }
  } else {
    res.json({ status: "error", message: "Session not found." });
  }
});
```

In this example, the session data is updated by passing the new data. If the session is valid, the updated information is stored in the session.

#### Deleting a Session

When a user logs out or you want to clear the session data, you can delete the session both from the store and the client's cookies.

```typescript
app.get("/logout", async (req, res) => {
  const sessionId = req.cookies.get("session_id");
  if (sessionId) {
    await session.delete(sessionId, res);
    res.json({ message: "User logged out successfully!" });
  } else {
    res.json({ message: "No active session found." });
  }
});
```

Here, the session is deleted, and the corresponding cookie is also cleared.

#### Custom Session Cookie Options

When setting the session cookie, you can specify options such as `httpOnly`, `secure`, and `maxAge`.

```typescript
app.get("/set-cookie", (req, res) => {
  const sessionId = "example-session-id";
  session.setCookie(res, sessionId, { httpOnly: true, secure: true, maxAge: 3600 });
  res.json({ message: "Session cookie set." });
});
```

In this example, the session cookie is set with options that make it HTTP-only (not accessible via JavaScript) and secure (only sent over HTTPS). The `maxAge` option is also set to define how long the cookie should last (in seconds).

### CSRF

The `CSRF` class provides a simple and lightweight mechanism for generating and validating CSRF (Cross-Site Request Forgery) tokens tied to user sessions. It includes built-in token expiration and supports either a custom store or a default in-memory store.

#### Setup

```ts
import { CSRF } from "@harpia/core/csrf";
import { MemoryStore } from "@harpia/core/memory-store";

const csrf = new CSRF({
  store: new MemoryStore(),
  ttl: 10 * 60 * 1000, // 10 minutes
});
````

**Parameters:**

* `store` *(optional)* — Custom store implementing the `Store` interface. Defaults to `MemoryStore`.
* `ttl` *(optional)* — Token lifetime in milliseconds. Defaults to 5 minutes (`5 * 60 * 1000`).

#### Methods

##### `generate(sessionId: string): Promise<string>`

Generates a new CSRF token for the specified session ID.
If a token already exists for the session, it will be replaced.

**Example:**

```ts
const token = await csrf.generate("user-session-123");
console.log(token); // e.g. "a1b2c3d4..."
```

##### `check(sessionId: string, token: string): Promise<boolean>`

Validates a CSRF token for a given session ID.
Returns `true` if the token matches and is not expired; otherwise returns `false`.

**Parameters:**

* `sessionId`: The session identifier.
* `token`: The token to validate.

**Example:**

```ts
const isValid = await csrf.check("user-session-123", token);
console.log(isValid); // true or false
```

##### `delete(sessionId: string): Promise<void>`

Deletes the CSRF token associated with the specified session ID.

**Example:**

```ts
await csrf.delete("user-session-123");
```

#### Basic Usage

```ts
const csrf = new CSRF();

// Step 1: Generate a token for the user's session
const sessionId = "session-001";
const token = await csrf.generate(sessionId);

// Step 2: Send the token to the client (e.g., as a hidden form field)

// Step 3: When the client submits a form, verify the token
const isValid = await csrf.check(sessionId, token);

if (isValid) {
  console.log("CSRF token is valid. Proceed with request.");
} else {
  console.log("Invalid or expired CSRF token.");
}

// Step 4: Optionally delete the token after use
await csrf.delete(sessionId);
```

#### Notes

* Tokens expire automatically based on the configured TTL.
* Always use HTTPS and proper session handling in production environments.
* The default `MemoryStore` is intended for testing or small applications; for distributed or persistent setups, use a custom store.


### Upload
You can set up a middleware to manage single or multiple file uploads, specifying options like allowed file types, extensions, and maximum file size.

#### Setting Up the Upload Middleware

First, create an instance of the Upload module with your desired configuration:

```typescript
import { Upload } from "@harpia/core/upload";

export const upload = new Upload({
  fieldName: "file",       // Field name for the file in the request
  prefix: "profile",       // Prefix for the uploaded file name
  fileName: Date.now().toString(), // Custom file name (e.g., using a timestamp)
  path: "tmp",             // Directory to save the uploaded files
  options: {
    allowedExtensions: [".jpg"], // Allowed file extensions
    allowedTypes: ["image/jpeg"], // Allowed MIME types
    maxSize: 1024 * 1024 * 2, // Maximum file size (2MB in this case)
  },
});
```

#### Using the Upload Middleware in Routes
Once the Upload instance is configured, you can use it as middleware in your routes to handle file uploads.

**For Single File Uploads:**
```typescript
app.post("/user", upload.single, async (req, res) => {
  // Handle the uploaded file here
});
```

**For Multiple File Uploads:**
```typescript
app.post("/user", upload.multiple, async (req, res) => {
  // Handle the uploaded files here
});
```

### Request monitor
The Request Monitor tracks and analyzes request metrics, including visitor data, traffic sources, response times, and errors. It helps monitor application performance and user behavior.

**Setting Up the Request Monitor**
First, instantiate the RequestMonitor and configure it with a storage mechanism (e.g., MemoryStore). You can also define routes to ignore, such as favicon.ico.

```typescript
import type { NextFunction, Request, Response } from "@harpia/core";
import { MemoryStore } from "@harpia/core/memory-store";
import { RequestMonitor } from "@harpia/core/monitor";
import { app } from "start/server";

// Initialize the RequestMonitor
export const Monitor = new RequestMonitor({
  store: new MemoryStore(), // Use MemoryStore for storing metrics
  ignore: ["favicon.ico"], // Ignore specific routes
});

// Middleware to track requests
export const monitor = (req: Request, res: Response, next: NextFunction) => {
  if (process.env.ENV === "test") {
    return next(); // Skip monitoring in test environment
  }

  // Extract traffic source data from the request
  const trafficSource = {
    utm: {
      id: req.query?.utm_id,
      source: req.query?.utm_source,
      medium: req.query?.utm_medium,
      campaign: req.query?.utm_campaign,
      sourcePlatform: req.query?.utm_source_platform,
      term: req.query?.utm_term,
      content: req.query?.utm_content,
      creativeFormat: req.query?.utm_creative_format,
      marketingTactic: req.query?.utm_marketing_tactic,
    },
    referer: req.headers.get("referer") || undefined, // Referer header
    userAgent: req.headers.get("User-Agent") || undefined, // User-Agent header
  };

  // Initialize monitoring for the request
  Monitor.initialize(req, app.requestIP() as string, trafficSource);
  Monitor.handleRequest();

  next(); // Proceed to the next middleware or route handler
};
```

**Using the Request Monitor**
Add the monitor middleware to your application. You can access metrics via a dedicated route, such as /metrics.

```typescript
const app = harpia();

// Add the monitor middleware
app.use(monitor);

// Route to fetch metrics
app.get("/metrics", async (req, res) => {
  const metrics = await Monitor.getMetrics();
  console.log(metrics);
  res.json(metrics); // Return metrics as JSON
});
```

**Using Redis as a Store**
Create a redis.ts file:
```typescript
import type { Store } from "@harpia/core";
import { RedisClient } from "bun";

export class RedisStore implements Store {
  private client: RedisClient;
  private ready: Promise<void>;

  constructor(db?: number) {
    const host = process.env.REDIS_HOST || "localhost";
    const port = process.env.REDIS_PORT || "6379";
    const user = process.env.REDIS_USER || "";
    const pass = process.env.REDIS_PASS || "";
    const auth = user || pass ? `${encodeURIComponent(user)}:${encodeURIComponent(pass)}@` : "";
    let url = `redis://${auth}${host}:${port}`;

    if (db !== undefined && db !== 0) {
      url = `${url.replace(/\/\d+$/, "")}/${db}`;
    }

    this.client = new RedisClient(url, {
      autoReconnect: true,
      maxRetries: 10,
      connectionTimeout: 10000,
    });

    this.client.onconnect = () => console.log("Connected to Redis");
    this.client.onclose = (err) => console.error("Redis error:", err);

    this.ready = this.client.connect();
  }

  async on(): Promise<boolean> {
    try {
      await this.ready;
      return this.client.connected;
    } catch {
      return false;
    }
  }

  async get(key: string): Promise<Record<string, any> | undefined> {
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : undefined;
  }

  async set(key: string, data: any): Promise<void> {
    await this.client.set(key, JSON.stringify(data));
  }

  async setEx(key: string, data: any, ttlSeconds: number): Promise<void> {
    await this.client.send("SET", [key, JSON.stringify(data), "EX", String(ttlSeconds)]);
  }

  async delete(key: string): Promise<void> {
    await this.client.del(key);
  }
}
```

And use it like this:

```typescript
import { RedisStore } from "./redis";

export const Monitor = new RequestMonitor({
  store: new RedisStore(), // Use RedisStore for storing metrics
  ignore: ["favicon.ico"], // Ignore specific routes
});
```

### Security Headers (Shield)
The Shield module is designed to enhance the security of your application by automatically adding HTTP security headers to responses. These headers help protect against common web vulnerabilities such as cross-site scripting (XSS), clickjacking, and content injection.

**Key Features**
1. Security Headers:
    - Content Security Policy (CSP): Restricts sources for scripts, styles, and other resources.
    - Cross-Origin Policies: Controls how resources are shared across origins.
    - Strict Transport Security (HSTS): Enforces HTTPS connections.
    - Referrer Policy: Controls the information sent in the Referer header.
    - X-Content-Type-Options: Prevents MIME type sniffing.
    - X-Frame-Options: Protects against clickjacking.
    - X-XSS-Protection: Disables browser XSS filters (if not needed).
    - Nonce Support: Generates cryptographic nonces for CSP inline scripts/styles.
2. Customizable:
    - Override default headers by passing options to the constructor.
    - Merge custom directives with sensible defaults.
3. Middleware:
    - Easily integrate into your application as middleware.
4. Template Engine Integration:
    - Automatic nonce generation for secure inline scripts/styles.
    - Seamless integration with the template engine.

#### Basic Usage
Configure your security headers and apply them to the application using the native `app.shield()` method.

```typescript
import harpia from "@harpia/core";
import type { SecurityHeaders } from "@harpia/core";

const app = harpia();

const shieldOptions: SecurityHeaders = {
  useNonce: true, // Enable nonce generation, false as default.
};

// Apply security headers
app.shield(shieldOptions);

// Your routes
app.get("/", (req, res) => {
  res.send("Hello, World!");
});

app.listen({ port: 3000 }, () => console.log("Server running on http://localhost:3000"));
```

If you want to use the Harpia template engine, the `generateNonce` plugin is automatically registered when `app.shield()` is initialized:

```typescript
import harpia from "@harpia/core";
import { engine } from "./template-engine";

const app = harpia();

// Apply security headers
app.shield({ useNonce: true });

// Setup template engine
engine.configure(app);
```

> To understand more about the Harpia template engine, see the [Template Engine](#template-engine) section.

#### Customizing Security Headers
You can customize the security headers by passing options to `app.shield`:

```typescript
app.shield({
  useNonce: true,
  contentSecurityPolicy: {
    directives: {
      "default-src": ["'self'", "https://trusted.com"],
      "script-src": ["'self'", "'unsafe-inline'"],
    },
  },
  strictTransportSecurity: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
});
```

#### Use nonce in templates:
```html
<!-- Use @set to define a variable to hold the nonce value -->
@set nonce = generateNonce() @endset

<!DOCTYPE html>
<html>
  <head>
    <title>Secure Page</title>
  </head>
  <body>
    <h1>Hello, {{ name }}!</h1>
    
    <!-- Secure inline script with nonce -->
    <script nonce="{{ nonce }}">
      console.log("This script is CSP-compliant");
    </script>
    
    <!-- Secure inline styles with nonce -->
    <style nonce="{{ nonce }}">
      body { color: blue; }
    </style>
  </body>
</html>
```

> `generateNonce()` is a Template Engine Plugin. You can see more about the plugins in [Template Engine](#template-engine) section.

#### Important Notes

- **Nonce Security**: Each nonce is unique per request and automatically invalidated after use. Since the `generateNonce()` plugin generates a new value on each call, you should cache it using `@set` if you need to use it in multiple places.
- **CSP Compliance**: Use @set nonce = generateNonce() @endset to cache the nonce value in templates.
- **Development**: Consider adding 'unsafe-inline' for easier development with hot reload.
- **Production**: Remove unsafe directives and rely exclusively on nonces for inline content.

The Shield module provides enterprise-grade security headers with zero configuration while remaining fully customizable for your specific needs.

### Test Client
The **Test Client** is a powerful tool for testing your application's routes. It supports all HTTP methods (`GET`, `POST`, `PUT`, `DELETE`, `PATCH`, `OPTIONS`, `HEAD`), query parameters, headers, JSON payloads, form data, and file uploads. Below is a detailed explanation of its features and usage.

#### Key Features

1. **HTTP Methods**:
   - `.get(url)` - Simulate a `GET` request.
   - `.post(url)` - Simulate a `POST` request.
   - `.put(url)` - Simulate a `PUT` request.
   - `.delete(url)` - Simulate a `DELETE` request.
   - `.patch(url)` - Simulate a `PATCH` request.
   - `.options(url)` - Simulate an `OPTIONS` request.
   - `.head(url)` - Simulate a `HEAD` request.

2. **Query Parameters**:
   - `.query(name, value)` - Add query parameters to the request.

3. **Headers**:
   - `.set(name, value)` - Set custom headers for the request.

4. **Request Body**:
   - `.send(data)` - Send raw data in the request body.
   - `.json(data)` - Send JSON data in the request body.
   - `.formData(data)` - Send form data in the request body.

5. **File Uploads**:
   - `.file(files)` - Upload a single file or multiple files.
   - `.files(files)` - Upload multiple files for a single field.

6. **Execution**:
   - `.execute()` - Execute the request and return the response.

#### Example Usage

#### Testing a GET Request with Query Parameters

```typescript
import { expect, test } from "bun:test";
import { TestClient } from "@harpia/core";
import { app } from "start/server";

test("GET /hello returns status 401", async () => {
  const request = new TestClient(app)
    .get("/hello")
    .query("number", "123456"); // Add query parameter

  const response = await request.execute();

  // Validate the response
  expect(response.status).toBe(401);
  expect(await response.json()).toEqual({ message: "Unauthorized" });
});
```

#### Testing a POST Request with JSON Payload

```typescript
test("POST /user returns status 201", async () => {
  const request = new TestClient(app)
    .post("/user")
    .json({ name: "John", age: 30 }); // Send JSON data

  const response = await request.execute();

  // Validate the response
  expect(response.status).toBe(201);
  expect(await response.json()).toEqual({ id: 1, name: "John", age: 30 });
});
```

#### Testing a POST Request with File Upload

```typescript
import path from "node:path";

test("POST /upload handles file upload", async () => {
  const filePath = path.resolve(__dirname, "./uploads/image.jpg");

  const request = new TestClient(app)
    .post("/upload")
    .file({ file: filePath }) // Upload a single file
    .formData({ username: "example" }); // Add form data

  const response = await request.execute();
  console.log(await response.json()); // Log the response
});
```

#### Testing a POST Request with Multiple Files

```typescript
test("POST /upload handles multiple files", async () => {
  const filePath1 = path.resolve(__dirname, "./uploads/image1.jpg");
  const filePath2 = path.resolve(__dirname, "./uploads/image2.jpg");

  const request = new TestClient(app)
    .post("/upload")
    .files({ files: [filePath1, filePath2] }); // Upload multiple files

  const response = await request.execute();
  console.log(await response.json()); // Log the response
});
```

---

#### Advanced Usage

#### Setting Custom Headers

```typescript
test("GET /protected requires authorization", async () => {
  const request = new TestClient(app)
    .get("/protected")
    .set("Authorization", "Bearer token123"); // Set custom header

  const response = await request.execute();
  expect(response.status).toBe(200);
});
```

#### Sending Raw Data

```typescript
test("POST /raw sends raw data", async () => {
  const request = new TestClient(app)
    .post("/raw")
    .send("raw data"); // Send raw data

  const response = await request.execute();
  expect(response.status).toBe(200);
});
```

#### Response Handling

The `.execute()` method returns includes:

- **Status Code**: `response.status`
- **Headers**: `response.headers`
- **Body**: `response.json()`, `response.text()`, or `response.blob()`

#### Error Handling

- If you try to mix incompatible body types (e.g., `.json()` after `.formData()`), an error will be thrown.
- If a file path does not exist, an error will be thrown.

### Memory Storage
The Memory Storage module provides an in-memory key-value store for managing session data or other temporary storage needs. It implements the Store interface, offering methods to get, set, and delete data.

**Storing and Retrieving Data**
```typescript
const memoryStore = new MemoryStore();

// Store session data
await memoryStore.set("session123", { userId: 1, username: "Alice" });

// Retrieve session data
const sessionData = await memoryStore.get("session123");
console.log(sessionData); // { userId: 1, username: "Alice" }

// Delete session data
await memoryStore.delete("session123");
console.log(await memoryStore.get("session123")); // undefined
```

**Using with Session Management**
```typescript
import { MemoryStore } from "@harpia/core/memory-store";
import { SessionManager } from "@harpia/core/session";

const memoryStore = new MemoryStore();
const sessionManager = new SessionManager({ store: memoryStore });

// Create a new session
const sessionId = await sessionManager.createSession({ userId: 1, username: "Alice" });

// Retrieve session data
const session = await sessionManager.getSession(sessionId);
console.log(session); // { userId: 1, username: "Alice" }

// Delete the session
await sessionManager.deleteSession(sessionId);
```

### Redis

The Redis Storage provides a persistent key-value store using Redis. It implements the Store interface, offering methods to get, set, and delete data. Redis is ideal for distributed systems, caching, and persistent session storage.

**Implementation**
```typescript
import type { Store } from "@harpia/core";
import { RedisClient } from "bun";

export class RedisStore implements Store {
  private client: RedisClient;
  private ready: Promise<void>;

  constructor(db?: number) {
    const host = process.env.REDIS_HOST || "localhost";
    const port = process.env.REDIS_PORT || "6379";
    const user = process.env.REDIS_USER || "";
    const pass = process.env.REDIS_PASS || "";
    const auth = user || pass ? `${encodeURIComponent(user)}:${encodeURIComponent(pass)}@` : "";
    let url = `redis://${auth}${host}:${port}`;

    if (db !== undefined && db !== 0) {
      url = `${url.replace(/\/\d+$/, "")}/${db}`;
    }

    this.client = new RedisClient(url, {
      autoReconnect: true,
      maxRetries: 10,
      connectionTimeout: 10000,
    });

    this.client.onconnect = () => console.log("Connected to Redis");
    this.client.onclose = (err) => console.error("Redis error:", err);

    this.ready = this.client.connect();
  }

  async on(): Promise<boolean> {
    try {
      await this.ready;
      return this.client.connected;
    } catch {
      return false;
    }
  }

  async get(key: string): Promise<Record<string, any> | undefined> {
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : undefined;
  }

  async set(key: string, data: any): Promise<void> {
    await this.client.set(key, JSON.stringify(data));
  }

  async setEx(key: string, data: any, ttlSeconds: number): Promise<void> {
    await this.client.send("SET", [key, JSON.stringify(data), "EX", String(ttlSeconds)]);
  }

  async delete(key: string): Promise<void> {
    await this.client.del(key);
  }
}
```

#### Example Usage

Once you've set up the `RedisStore`, you can use it in your routes to manage sessions. Below is an example of how to use Redis to manage user sessions in a Harpia app:

```typescript
import { Router, Session } from "@harpia/core";
import { RedisStore } from "redis.ts";

// Redis Setup
const redisStore = new RedisStore();
const useSession = new Session({ store: redisStore, cookieName: "my_session_id" });

// Routes Setup
const session = Router();

session.post("/login", async (req, res) => {
  const sessionExists = await useSession.fromRequest(req);
  if (sessionExists) {
    res.json({ message: "Session does not exists." });
  } else {
    const sessionData = { userId: "12345", username: "pyro" };
    const sessionId = await useSession.create(sessionData);
  
    useSession.setCookie(res, sessionId, { maxAge: 3600, httpOnly: true, secure: true });
    res.cookies.set("theme", "dark");
    res.json({ message: "Successful login!" });
  }
});

session.get("/profile", async (req, res) => {
  const sessionData = await useSession.fromRequest(req);  

  if (sessionData) {
    res.json({ profile: sessionData });
  } else {
    res.status(401).json({ message: "Session expired or not found!" });
  }
});

session.post("/logout", async (req, res) => {
  const sessionId = req.cookies.get("my_session_id");

  if (sessionId) {
    await useSession.delete(sessionId, res);
    res.json({ message: "Successful logout!" });
  } else {
    res.status(400).json({ message: "Session not found!" });
  }
});

export { session };
```

#### How It Works:

- **Login Route (`/login`)**: When a user logs in, a new session is created with the user's data. The session ID is stored in a Redis database and sent to the client as a cookie. If a session already exists, the user is notified.
- **Profile Route (`/profile`)**: The user's session data is fetched from Redis using the session ID stored in the client's cookie. If the session is valid, the user's profile data is returned.
- **Logout Route (`/logout`)**: When the user logs out, the session is deleted from Redis, and the session cookie is cleared from the client.

This integration provides a persistent session management system backed by Redis, allowing you to scale your application efficiently. The session data is stored securely and can be accessed across different instances of your application.

## Authors

- [@lucasnjsilva](https://www.github.com/lucasnjsilva)
