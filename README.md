# Sven — AI-Powered Search Assistant

A full-stack Perplexity-style AI search assistant. Ask anything, get a real-time streaming answer grounded in live web search results, and continue the conversation with follow-up questions. Every conversation is persisted per user.

---

## How It Works

1. The user submits a query from the frontend.
2. The backend performs a live web search (via Tavily) to retrieve up-to-date sources.
3. The search results are injected into a prompt alongside the user's query and sent to an LLM (via an AI Gateway).
4. The LLM's response is **streamed back token-by-token** over a chunked HTTP response.

---

## Architecture

```
perplexity-clone/
├── backend/          # Express API server (Bun runtime)
└── frontend/         # React SPA (Bun runtime, Tailwind CSS)
```

The two services run independently and communicate over HTTP. The frontend calls the backend API directly from the browser.

---

## Backend

**Runtime:** Bun  
**Framework:** Express v5  
**Database ORM:** Prisma (PostgreSQL)  
**Auth:** Supabase (JWT verification)

### File Structure

```
backend/
├── index.ts              # Entry point — app setup, CORS, route mounting
├── middleware.ts         # Auth middleware — verifies Supabase JWT, upserts user
├── llm.ts                # Wrapper around OpenAI-compatible streaming chat completions
├── prompt.ts             # System prompt and user prompt template
├── db.ts                 # Prisma client singleton
├── client.ts             # Supabase client factory
├── env.ts                # Typed environment variable exports
├── routes/
│   ├── conversations.ts  # GET /conversations, GET /conversations/:id
│   ├── messages.ts       # GET /messages/:messageId
│   └── ask.ts            # POST /sven_ask, POST /sven_ask/follow_up
└── prisma/
    └── schema.prisma     # Database schema
```

### API Endpoints

All endpoints (except health) require a `Authorization` header containing a valid Supabase JWT.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/conversations` | List all conversations for the authenticated user |
| `GET` | `/conversations/:id` | Fetch a single conversation with its ordered messages |
| `GET` | `/messages/:id` | Fetch a single message (ownership verified) |
| `POST` | `/sven_ask` | Start a new conversation — streams the LLM response |
| `POST` | `/sven_ask/follow_up` | Continue an existing conversation — streams the LLM response |

### Streaming Protocol

Both `POST /sven_ask` and `POST /sven_ask/follow_up` respond with `Content-Type: text/plain` and `Transfer-Encoding: chunked`. The stream follows this structure:

```
<CONVERSATION_ID>{uuid}</CONVERSATION_ID>   ← only on new conversations
<MESSAGE_ID>{id}</MESSAGE_ID>
...raw LLM tokens...
<SOURCES>
[{"url": "https://..."}, ...]
</SOURCES>
```

The frontend parses these sentinels out of the raw stream to extract metadata and sources without a separate round-trip.

### Authentication Middleware

Every request is intercepted by `middleware.ts`, which:

1. Reads the `Authorization` header (Supabase access token).
2. Calls `supabase.auth.getUser()` to validate the JWT.
3. On success, **upserts the user** into the local PostgreSQL database (capturing email, OAuth provider, and display name).
4. Attaches `req.userId` for downstream route handlers.
5. Returns `403` if the token is missing or invalid.

This means users are automatically registered in the app's database on their first authenticated request — no separate signup flow needed.

### Prompt Engineering

`prompt.ts` defines two exports:

- **`SYSTEM_PROMPT`** — instructs the LLM to act as "Sven", synthesize web search results, and structure its response using XML-style tags (`<ANSWER>`, `<FOLLOW_UPS>`, `<question>`).
- **`PROMPT_TEMPLATE`** — a user-turn template with `{{WEB_SEARCH_RESULTS}}` and `{{USER_QUERY}}` placeholders that are filled in at request time.

For follow-up questions, the full conversation history is forwarded to the LLM to maintain context across turns.

### Database Schema

```prisma
model User {
  id            String         @id
  email         String         @unique
  provider      AuthProvider           // github | google
  name          String
  supabaseId    String
  conversations Conversation[]
}

model Conversation {
  id       String    @id @default(uuid())
  title    String?                      // first 50 chars of the opening query
  slug     String                       // random UUID, used in frontend URLs
  userId   String
  messages Message[]
}

model Message {
  id             Int           @id @default(autoincrement())
  content        String
  role           MessageRole           // user | assistant
  conversationId String
  status         MessageStatus         // PENDING | COMPLETED
  sources        Json?                 // array of {url} objects from Tavily
  createdAt      DateTime      @default(now())
}
```

Messages start life as `PENDING` while the LLM is streaming, and are updated to `COMPLETED` once the stream ends. This allows the frontend to detect in-progress responses (e.g. show a "Thinking…" indicator) by checking message status.

---

## Frontend

**Runtime:** Bun (custom HTTP server — no Vite/Next)  
**UI Library:** React 19  
**Styling:** Tailwind CSS v4  
**Routing:** React Router v7  
**Auth:** Supabase JS (`@supabase/supabase-js`)

### File Structure

```
frontend/src/
├── index.ts                        # Bun HTTP server + SSR entry
├── frontend.tsx                    # React hydration entry
├── App.tsx                         # Route definitions
├── index.css                       # Global styles + Tailwind imports
├── env.ts                          # Typed env vars (public Supabase keys)
├── components/
│   ├── auth/
│   │   ├── ProtectedRoute.tsx      # Redirects to /auth if not signed in
│   │   └── PublicRoute.tsx         # Redirects to / if already signed in
│   ├── layout/
│   │   ├── Layout.tsx              # Shell: sidebar + outlet
│   │   └── Sidebar.tsx             # Conversation history list
│   ├── pages/
│   │   ├── Auth.tsx                # Sign in with Google / GitHub (OAuth)
│   │   └── Dashboard.tsx           # Main chat interface + streaming renderer
│   └── ui/                         # Reusable shadcn-style primitives
└── lib/
    └── utils.ts                    # cn() helper (clsx + tailwind-merge)
```

### Routing

| Path | Component | Guard |
|------|-----------|-------|
| `/` | `Dashboard` | 🔒 Protected |
| `/c/:conversationId` | `Dashboard` | 🔒 Protected |
| `/auth` | `Auth` | 🌐 Public (redirects if signed in) |

`ProtectedRoute` and `PublicRoute` wrap routes to enforce auth state, preventing authenticated users from seeing the login page and unauthenticated users from accessing the app — without any flash of incorrect content.

---

> [!NOTE]
> This project is currently **still in development**. I am actively working on optimizing the performance, refining the UI/UX, and enhancing the LLM response accuracy.


