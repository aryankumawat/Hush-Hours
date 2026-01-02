# Hush-Hours: Technical Documentation

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Database Schema](#database-schema)
4. [API Architecture](#api-architecture)
5. [Frontend Architecture](#frontend-architecture)
6. [Data Flow Pipelines](#data-flow-pipelines)
7. [Authentication & Authorization](#authentication--authorization)
8. [Connection Pooling & Performance](#connection-pooling--performance)
9. [Message Ordering Algorithm](#message-ordering-algorithm)
10. [Deployment Architecture](#deployment-architecture)
11. [Technology Stack](#technology-stack)
12. [Development Setup](#development-setup)

---

## System Overview

Hush-Hours is a real-time messaging application built with Flask (Python) backend and vanilla JavaScript frontend. The system supports one-on-one conversations, group chats, user profiles, friend management, and a gift system. The application uses PostgreSQL (Supabase) for data persistence and implements connection pooling for optimal performance.

### Key Features

- **Real-time Messaging**: One-on-one and group conversations
- **User Management**: Registration, authentication, profile management
- **Friend System**: User search, friend management, conversation initiation
- **Group Chats**: Public groups, group membership, group messaging
- **Message Customization**: Per-message color customization
- **Gift System**: User gift tracking and display
- **Favorites**: Liked chats and groups functionality

---

## Architecture

### High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Browser                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Frontend (Vanilla JavaScript)                │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │  │
│  │  │   App    │  │  Chats   │  │ Messages │  │ Groups  │ │  │
│  │  │   JS     │  │  Module  │  │  Module  │  │ Module  │ │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └─────────┘ │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐               │  │
│  │  │   API    │  │  State   │  │   DOM    │               │  │
│  │  │  Module  │  │ Manager  │  │  Utils   │               │  │
│  │  └──────────┘  └──────────┘  └──────────┘               │  │
│  └──────────────────────────────────────────────────────────┘  │
└───────────────────────────┬─────────────────────────────────────┘
                             │ HTTP/HTTPS (REST API)
                             │ Session-based Auth
                             │ JSON Payloads
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Flask Application Server                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                      Flask App (app.py)                   │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │  │
│  │  │   Routes     │  │   Services   │  │  Database    │   │  │
│  │  │  Blueprints  │  │   Layer      │  │  Connection   │   │  │
│  │  │              │  │              │  │  Pool         │   │  │
│  │  │ - auth_bp    │  │ - auth_svc   │  │              │   │  │
│  │  │ - chat_bp    │  │ - chat_svc   │  │ Threaded     │   │  │
│  │  │ - user_bp    │  │ - user_svc   │  │ Connection   │   │  │
│  │  │ - group_bp   │  │ - group_svc  │  │ Pool (1-20)  │   │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘   │  │
│  └──────────────────────────────────────────────────────────┘  │
└───────────────────────────┬─────────────────────────────────────┘
                             │ psycopg2
                             │ Connection Pool
                             │ SSL/TLS
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              Supabase PostgreSQL Database                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Connection Pooler (Session Mode)              │  │
│  │  aws-1-ap-southeast-1.pooler.supabase.com:5432           │  │
│  └───────────────────────────┬───────────────────────────────┘  │
│                                │                                 │
│  ┌─────────────────────────────┴─────────────────────────────┐ │
│  │                    PostgreSQL Database                       │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │ │
│  │  │   users      │  │ conversations│  │   messages    │     │ │
│  │  │   groups     │  │group_members │  │group_messages │     │ │
│  │  │   gifts      │  │liked_chats   │  │liked_groups   │     │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘     │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Request Flow Architecture

```
Client Request
    │
    ├─► [1] HTTP Request → Flask Router
    │       │
    │       ├─► [2] Session Validation
    │       │       │
    │       │       ├─► Valid → Continue
    │       │       └─► Invalid → 401 Unauthorized
    │       │
    │       ├─► [3] Route Handler (Blueprint)
    │       │       │
    │       │       ├─► [4] Service Layer
    │       │       │       │
    │       │       │       ├─► [5] Database Connection Pool
    │       │       │       │       │
    │       │       │       │       ├─► [6] Get Connection (with retry)
    │       │       │       │       │       │
    │       │       │       │       │       ├─► Pool Available → Return Connection
    │       │       │       │       │       └─► Pool Exhausted → Direct Connection
    │       │       │       │       │
    │       │       │       │       ├─► [7] Execute SQL Query
    │       │       │       │       │
    │       │       │       │       └─► [8] Return Connection to Pool
    │       │       │       │
    │       │       │       └─► [9] Process Results
    │       │       │
    │       │       └─► [10] Return JSON Response
    │       │
    │       └─► [11] HTTP Response → Client
    │
    └─► [12] Frontend Processes Response
            │
            ├─► Update State
            ├─► Update DOM
            └─► Trigger Side Effects
```

---

## Database Schema

### Entity Relationship Diagram

```
┌─────────────────┐
│     users       │
├─────────────────┤
│ id (PK)         │
│ username (UK)   │
│ display_name    │
│ password_hash   │
│ avatar_key      │
│ age             │
│ gender          │
│ points          │
│ message_color   │
└────────┬────────┘
         │
         │ 1:N
         │
         ├─────────────────────────────────────┐
         │                                     │
         ▼                                     ▼
┌─────────────────┐                  ┌─────────────────┐
│ conversations   │                  │  user_gifts     │
├─────────────────┤                  ├─────────────────┤
│ id (PK)         │                  │ id (PK)         │
│ user1_id (FK)   │──┐               │ user_id (FK)   │
│ user2_id (FK)   │──┼──► users      │ gift_type      │
└────────┬────────┘  │               │ count           │
         │           │               │ created_at      │
         │ 1:N       │               │ updated_at      │
         │           │               └─────────────────┘
         ▼           │
┌─────────────────┐  │
│   messages      │  │
├─────────────────┤  │
│ id (PK)         │  │
│ conversation_id │──┘               ┌─────────────────┐
│ sender_id (FK) │──► users          │ liked_chats     │
│ content         │               ├─────────────────┤
│ timestamp       │               │ id (PK)         │
│ message_color   │               │ user_id (FK)    │──┐
└─────────────────┘               │ conversation_id │──┼──► conversations
                                   │ created_at      │  │
┌─────────────────┐               └─────────────────┘  │
│     groups      │                                     │
├─────────────────┤                                     │
│ id (PK)         │                                     │
│ name            │                                     │
│ created_by (FK) │──► users                            │
│ is_public       │                                     │
│ created_at      │                                     │
└────────┬────────┘                                     │
         │                                             │
         │ 1:N                                         │
         │                                             │
         ├─────────────────────────────────────────────┘
         │
         ├─► [1:N] group_members
         │   ├─► group_id (FK)
         │   ├─► user_id (FK)
         │   └─► joined_at
         │
         └─► [1:N] group_messages
             ├─► id (PK)
             ├─► group_id (FK)
             ├─► sender_id (FK) ──► users
             ├─► content
             ├─► timestamp
             └─► message_color

         ┌─────────────────┐
         │  liked_groups   │
         ├─────────────────┤
         │ id (PK)         │
         │ user_id (FK)    │──► users
         │ group_id (FK)   │──► groups
         │ created_at      │
         └─────────────────┘
```

### Table Definitions

#### users
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100),
    password VARCHAR(255) NOT NULL,  -- bcrypt hashed
    avatar_key VARCHAR(50),
    age INTEGER,
    gender VARCHAR(20),
    points INTEGER DEFAULT 0,
    message_color VARCHAR(7) DEFAULT '#6b7280',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_username ON users(username);
```

#### conversations
```sql
CREATE TABLE conversations (
    id SERIAL PRIMARY KEY,
    user1_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user2_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user1_id, user2_id)
);

CREATE INDEX idx_conversations_user1 ON conversations(user1_id);
CREATE INDEX idx_conversations_user2 ON conversations(user2_id);
```

#### messages
```sql
CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT NOW(),
    message_color VARCHAR(7) DEFAULT '#6b7280'
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_timestamp ON messages(timestamp);
CREATE INDEX idx_messages_sender ON messages(sender_id);
```

#### groups
```sql
CREATE TABLE groups (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_groups_created_by ON groups(created_by);
CREATE INDEX idx_groups_public ON groups(is_public);
```

#### group_members
```sql
CREATE TABLE group_members (
    id SERIAL PRIMARY KEY,
    group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(group_id, user_id)
);

CREATE INDEX idx_group_members_group ON group_members(group_id);
CREATE INDEX idx_group_members_user ON group_members(user_id);
```

#### group_messages
```sql
CREATE TABLE group_messages (
    id SERIAL PRIMARY KEY,
    group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT NOW(),
    message_color VARCHAR(7) DEFAULT '#6b7280'
);

CREATE INDEX idx_group_messages_group ON group_messages(group_id);
CREATE INDEX idx_group_messages_timestamp ON group_messages(timestamp);
```

---

## API Architecture

### Route Blueprints

The application uses Flask Blueprints for modular route organization:

```
app.py (Flask Application)
    │
    ├─► auth_bp (Authentication Routes)
    │   ├─► POST /register
    │   ├─► POST /login
    │   └─► POST /logout
    │
    ├─► chat_bp (Chat Routes)
    │   ├─► GET  /conversations
    │   ├─► GET  /conversations/<id>/messages
    │   ├─► POST /messages
    │   ├─► POST /conversations/<id>/like
    │   └─► DELETE /conversations/<id>/like
    │
    ├─► user_bp (User Routes)
    │   ├─► GET  /me
    │   ├─► POST /update-avatar
    │   ├─► GET  /friends
    │   ├─► DELETE /friends/<id>
    │   ├─► GET  /search-users
    │   ├─► POST /start-conversation
    │   ├─► GET  /message-color
    │   ├─► POST /message-color
    │   └─► GET  /users/<id>
    │
    └─► group_bp (Group Routes)
        ├─► GET  /groups
        ├─► POST /groups
        ├─► GET  /groups/<id>/messages
        ├─► POST /groups/<id>/messages
        ├─► GET  /groups/<id>
        ├─► POST /groups/<id>/members
        ├─► POST /groups/<id>/like
        └─► DELETE /groups/<id>/like
```

### API Endpoint Specifications

#### Authentication Endpoints

**POST /register**
```
Request Body:
{
    "username": "string",
    "display_name": "string",
    "age": integer,
    "gender": "string",
    "password": "string",
    "avatar": "string"
}

Response:
{
    "success": boolean,
    "error": "string" (if failed)
}
```

**POST /login**
```
Request Body:
{
    "username": "string",
    "password": "string"
}

Response:
{
    "success": boolean,
    "user": {
        "id": integer,
        "username": "string",
        "display_name": "string",
        "avatar": "string",
        "points": integer,
        "message_color": "string"
    }
}
```

#### Chat Endpoints

**GET /conversations**
```
Response:
[
    {
        "conversation_id": integer,
        "other_user_id": integer,
        "other_username": "string",
        "other_display_name": "string",
        "other_avatar": "string",
        "last_message_time": "ISO8601",
        "last_message_content": "string",
        "is_liked": boolean,
        "is_group": boolean
    }
]
```

**GET /conversations/<conversation_id>/messages**
```
Response:
[
    {
        "id": integer,
        "sender_id": integer,
        "content": "string",
        "timestamp": "ISO8601",
        "created_at": "ISO8601",
        "sender_avatar": "string",
        "message_color": "string"
    }
]
```

**POST /messages**
```
Request Body:
{
    "conversation_id": integer,
    "content": "string"
}

Response:
{
    "success": boolean
}
```

#### User Endpoints

**GET /me**
```
Response:
{
    "id": integer,
    "username": "string",
    "display_name": "string",
    "avatar": "string",
    "age": integer,
    "gender": "string",
    "points": integer,
    "message_color": "string"
}
```

**GET /search-users?q=<search_term>**
```
Response:
[
    {
        "user_id": integer,
        "username": "string",
        "display_name": "string",
        "avatar": "string",
        "points": integer,
        "has_conversation": boolean
    }
]
```

#### Group Endpoints

**GET /groups**
```
Response:
[
    {
        "group_id": integer,
        "name": "string",
        "created_by": integer,
        "is_public": boolean,
        "is_member": boolean,
        "is_liked": boolean,
        "last_message_time": "ISO8601",
        "last_message_content": "string"
    }
]
```

**POST /groups/<group_id>/messages**
```
Request Body:
{
    "content": "string"
}

Response:
{
    "success": boolean
}
```

---

## Frontend Architecture

### Module Structure

```
static/js/
├── app.js                    # Application entry point
├── state.js                   # Global state management
├── register.js                # Registration page logic
│
├── modules/
│   ├── api.js                 # API communication layer
│   ├── navigation.js          # Tab navigation & routing
│   ├── chats.js               # Chat list rendering
│   ├── messages.js            # Message rendering & sending
│   ├── friends.js             # Friends management
│   ├── groups.js               # Group list & management
│   ├── groupChat.js           # Group chat view
│   ├── groupMessages.js       # Group message rendering
│   ├── profile.js             # User profile display
│   ├── settings.js            # Settings management
│   └── avatarCarousel.js      # Avatar selection
│
└── utils/
    └── dom.js                 # DOM utility functions
```

### State Management

The application uses a centralized state object (`state.js`):

```javascript
{
    ACTIVE_CONVERSATION_ID: integer | null,
    ACTIVE_GROUP_ID: integer | null,
    ACTIVE_CHAT_OTHER_USER_ID: integer | null,
    CURRENT_USER_ID: integer | null,
    CURRENT_USER_AVATAR: string | null,
    CURRENT_USER_MESSAGE_COLOR: string,
    allConversations: Array,
    CAME_FROM_FRIENDS: boolean,
    CAME_FROM_GROUPS: boolean,
    VIEWING_PROFILE_USER_ID: integer | null,
    PROFILE_VIEW_PREVIOUS_TAB: string | null,
    PROFILE_VIEW_PREVIOUS_CONVERSATION_ID: integer | null,
    PROFILE_VIEW_PREVIOUS_GROUP_ID: integer | null,
    PROFILE_VIEW_PREVIOUS_PAGE_TITLE: string | null,
    NAVIGATION_HISTORY: Array
}
```

### Frontend Data Flow

```
User Action
    │
    ├─► [1] Event Handler
    │       │
    │       ├─► [2] Update State
    │       │
    │       ├─► [3] API Call (api.js)
    │       │       │
    │       │       ├─► [4] HTTP Request
    │       │       │       │
    │       │       │       └─► [5] Flask Backend
    │       │       │
    │       │       └─► [6] Response Processing
    │       │
    │       └─► [7] DOM Update
    │               │
    │               ├─► Render Messages
    │               ├─► Update Chat List
    │               └─► Update UI State
    │
    └─► [8] Side Effects
            │
            ├─► Scroll to Bottom
            ├─► Update Navigation
            └─► Trigger Related Updates
```

### Component Interaction Diagram

```
┌─────────────┐
│   app.js    │ (Entry Point)
└──────┬──────┘
       │
       ├─► Initializes Navigation
       ├─► Loads User Data
       └─► Sets Up Event Listeners
            │
            ▼
┌─────────────────────────────────────────┐
│         navigation.js                   │
│  (Tab Management & Routing)            │
└──────┬──────────────────────────────────┘
       │
       ├─► showTab("chats")
       │       │
       │       └─► chats.js
       │               │
       │               ├─► renderChats()
       │               │       │
       │               │       ├─► api.js → fetchConversations()
       │               │       │
       │               │       └─► Display Chat List
       │               │
       │               └─► onChatClick()
       │                       │
       │                       └─► messages.js
       │                               │
       │                               ├─► loadMessages()
       │                               │       │
       │                               │       ├─► api.js → fetchMessages()
       │                               │       │
       │                               │       └─► Render Messages
       │                               │
       │                               └─► sendMessage()
       │                                       │
       │                                       └─► api.js → sendMessageApi()
       │
       ├─► showTab("friends")
       │       │
       │       └─► friends.js
       │               │
       │               ├─► renderFriends()
       │               │
       │               └─► searchUsers()
       │
       ├─► showTab("groups")
       │       │
       │       └─► groups.js
       │               │
       │               ├─► renderGroups()
       │               │
       │               └─► onGroupClick()
       │                       │
       │                       └─► groupChat.js
       │                               │
       │                               └─► groupMessages.js
       │
       └─► showTab("profile")
               │
               └─► profile.js
                       │
                       └─► viewProfile(userId)
```

---

## Data Flow Pipelines

### Message Sending Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│                    Message Sending Pipeline                  │
└─────────────────────────────────────────────────────────────┘

[1] User Input
    │
    ├─► User types message in input field
    │
    └─► User presses Enter or clicks Send
            │
            ▼
[2] Frontend: sendMessage() (messages.js)
    │
    ├─► Validate input (non-empty, conversation_id exists)
    │
    ├─► Clear input field
    │
    └─► Call sendMessageApi(conversation_id, content)
            │
            ▼
[3] API Layer: sendMessageApi() (api.js)
    │
    ├─► Construct HTTP POST request
    │   ├─► URL: /messages
    │   ├─► Method: POST
    │   ├─► Headers: Content-Type: application/json
    │   ├─► Body: { conversation_id, content }
    │   └─► Credentials: include (for session cookie)
    │
    └─► Send request to backend
            │
            ▼
[4] Backend: POST /messages (chat_routes.py)
    │
    ├─► Extract session user_id
    │
    ├─► Validate request data
    │   ├─► conversation_id exists
    │   ├─► content is non-empty
    │   └─► user is part of conversation
    │
    ├─► Get user's message_color from database
    │
    └─► Call database insert
            │
            ▼
[5] Database: INSERT INTO messages
    │
    ├─► Get connection from pool
    │
    ├─► Execute INSERT query
    │   ├─► conversation_id
    │   ├─► sender_id (from session)
    │   ├─► content
    │   ├─► timestamp (NOW())
    │   └─► message_color
    │
    ├─► Commit transaction
    │
    └─► Return connection to pool
            │
            ▼
[6] Backend Response
    │
    └─► Return { "success": true }
            │
            ▼
[7] Frontend: Process Response
    │
    ├─► Reload messages (loadMessages())
    │   │
    │   ├─► Fetch all messages for conversation
    │   │
    │   ├─► Sort messages (timestamp ASC, id ASC)
    │   │
    │   ├─► Render messages in DOM
    │   │
    │   └─► Scroll to bottom
    │
    └─► Update chat list (if needed)
            │
            ▼
[8] UI Update Complete
    │
    └─► Message appears in chat interface
```

### Message Loading Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│                    Message Loading Pipeline                   │
└─────────────────────────────────────────────────────────────┘

[1] Trigger: User opens conversation
    │
    ├─► Chat list item clicked
    ├─► Navigation to conversation
    └─► Message refresh
            │
            ▼
[2] Frontend: loadMessages() (messages.js)
    │
    ├─► Check ACTIVE_CONVERSATION_ID exists
    │
    ├─► Call fetchMessages(conversation_id)
    │
    └─► Process response
            │
            ▼
[3] API Layer: fetchMessages() (api.js)
    │
    ├─► GET /conversations/<id>/messages
    │
    └─► Return JSON array of messages
            │
            ▼
[4] Backend: GET /conversations/<id>/messages (chat_routes.py)
    │
    ├─► Validate user is part of conversation
    │
    └─► Call get_messages_for_conversation(id)
            │
            ▼
[5] Service: get_messages_for_conversation() (chat_service.py)
    │
    ├─► Get database connection
    │
    ├─► Check if message_color column exists
    │
    ├─► Execute SQL query:
    │   SELECT m.id, m.sender_id, m.content, m.timestamp,
    │          u.avatar_key, m.message_color
    │   FROM messages m
    │   JOIN users u ON u.id = m.sender_id
    │   WHERE m.conversation_id = %s
    │   ORDER BY m.timestamp ASC NULLS LAST, m.id ASC
    │
    ├─► Fetch all rows
    │
    ├─► Convert to JSON format
    │   ├─► Format timestamps (ISO8601)
    │   ├─► Include message_color
    │   └─► Include sender_avatar
    │
    ├─► Python-side sort (safeguard)
    │   ├─► Sort by timestamp (oldest first)
    │   └─► Then by ID (lower ID first)
    │
    └─► Return messages array
            │
            ▼
[6] Frontend: Process Messages
    │
    ├─► Sort messages (additional safeguard)
    │   ├─► Parse timestamps
    │   ├─► Sort by timestamp ASC
    │   └─► Sort by ID ASC (tiebreaker)
    │
    ├─► Clear existing messages in DOM
    │
    ├─► Build message elements
    │   ├─► For each message:
    │   │   ├─► Determine if own message or incoming
    │   │   ├─► Create message row element
    │   │   ├─► Apply message color
    │   │   ├─► Calculate text color (light/dark)
    │   │   ├─► Add avatar image
    │   │   └─► Add message content
    │   │
    │   └─► Append to document fragment
    │
    ├─► Append fragment to messages container
    │
    └─► Scroll to bottom
            │
            ▼
[7] UI Rendered
    │
    └─► Messages displayed in chronological order
```

### Conversation List Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│                Conversation List Pipeline                   │
└─────────────────────────────────────────────────────────────┘

[1] Trigger
    │
    ├─► App initialization
    ├─► Tab switch to "chats"
    └─► Manual refresh
            │
            ▼
[2] Frontend: renderChats() (chats.js)
    │
    ├─► Call fetchConversations()
    │
    └─► Process response
            │
            ▼
[3] API: fetchConversations() (api.js)
    │
    ├─► GET /conversations?t=<timestamp> (cache-busting)
    │
    └─► Return conversations array
            │
            ▼
[4] Backend: GET /conversations (chat_routes.py)
    │
    └─► Call get_conversations_for_user(user_id)
            │
            ▼
[5] Service: get_conversations_for_user() (chat_service.py)
    │
    ├─► Get database connection
    │
    ├─► Query conversations:
    │   SELECT
    │       c.id AS conversation_id,
    │       u.id AS other_user_id,
    │       u.username AS other_username,
    │       u.display_name AS other_display_name,
    │       u.avatar_key AS other_avatar,
    │       (SELECT MAX(timestamp) FROM messages 
    │        WHERE conversation_id = c.id) AS last_message_time,
    │       (SELECT content FROM messages 
    │        WHERE conversation_id = c.id 
    │        ORDER BY timestamp DESC, id DESC LIMIT 1) AS last_message_content,
    │       CASE WHEN lc.id IS NOT NULL THEN TRUE ELSE FALSE END AS is_liked
    │   FROM conversations c
    │   INNER JOIN users u ON u.id = CASE
    │       WHEN c.user1_id = %s THEN c.user2_id
    │       ELSE c.user1_id
    │   END
    │   LEFT JOIN liked_chats lc ON lc.conversation_id = c.id AND lc.user_id = %s
    │   WHERE (c.user1_id = %s OR c.user2_id = %s)
    │   ORDER BY last_message_time DESC NULLS LAST, c.id DESC
    │
    ├─► Fetch all rows
    │
    ├─► Get user's joined groups
    │   └─► Call get_user_joined_groups(user_id)
    │
    ├─► Combine conversations and groups
    │
    ├─► Sort by last_message_time (DESC)
    │
    └─► Return combined list
            │
            ▼
[6] Frontend: Process Conversations
    │
    ├─► Sort conversations
    │   ├─► By last_message_time (DESC)
    │   └─► By ID (DESC) as tiebreaker
    │
    ├─► Store in state.allConversations
    │
    ├─► Render conversation list
    │   ├─► For each conversation:
    │   │   ├─► Create list item element
    │   │   ├─► Add avatar image
    │   │   ├─► Add display name
    │   │   ├─► Add last message preview
    │   │   ├─► Add timestamp
    │   │   ├─► Add like indicator (if liked)
    │   │   └─► Add click handler
    │   │
    │   └─► Append to chat list container
    │
    └─► Update UI
            │
            ▼
[7] UI Rendered
    │
    └─► Conversation list displayed, sorted by most recent
```

---

## Authentication & Authorization

### Authentication Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Authentication Flow                        │
└─────────────────────────────────────────────────────────────┘

[1] User Registration
    │
    ├─► POST /register
    │   │
    │   ├─► Validate input
    │   │   ├─► Username uniqueness check
    │   │   ├─► Password strength (if implemented)
    │   │   └─► Required fields
    │   │
    │   ├─► Hash password
    │   │   └─► bcrypt.hashpw(password, bcrypt.gensalt())
    │   │
    │   ├─► Insert user into database
    │   │   ├─► username
    │   │   ├─► display_name
    │   │   ├─► password (hashed)
    │   │   ├─► avatar_key
    │   │   ├─► age
    │   │   ├─► gender
    │   │   └─► points (default: 0)
    │   │
    │   └─► Create session
    │       ├─► session["user_id"] = user_id
    │       └─► session.permanent = True
    │
    └─► Return success response

[2] User Login
    │
    ├─► POST /login
    │   │
    │   ├─► Validate credentials
    │   │   ├─► Find user by username
    │   │   └─► Verify password
    │   │       └─► bcrypt.checkpw(password, stored_hash)
    │   │
    │   ├─► Create session
    │   │   ├─► session["user_id"] = user_id
    │   │   └─► session.permanent = True
    │   │
    │   └─► Return user data
    │
    └─► Frontend stores user info in state

[3] Session Management
    │
    ├─► Session Configuration
    │   ├─► PERMANENT_SESSION_LIFETIME: 86400 (24 hours)
    │   ├─► SESSION_COOKIE_HTTPONLY: True
    │   └─► SESSION_COOKIE_SAMESITE: 'Lax'
    │
    ├─► Session Validation
    │   └─► Each protected route checks:
    │       └─► user_id = session.get("user_id")
    │
    └─► Session Expiration
        └─► Automatic after 24 hours of inactivity

[4] Authorization Checks
    │
    ├─► Conversation Access
    │   └─► Verify user is part of conversation:
    │       SELECT id FROM conversations
    │       WHERE id = %s AND (user1_id = %s OR user2_id = %s)
    │
    ├─► Group Access
    │   └─► Verify user is member of group:
    │       SELECT id FROM group_members
    │       WHERE group_id = %s AND user_id = %s
    │
    └─► Message Access
        └─► Messages inherit from conversation/group access
```

### Password Security

- **Hashing Algorithm**: bcrypt
- **Salt Generation**: Automatic via `bcrypt.gensalt()`
- **Verification**: `bcrypt.checkpw(plain_password, hashed_password)`
- **Storage**: Hashed passwords stored in `users.password` column

---

## Connection Pooling & Performance

### Connection Pool Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              Connection Pool Implementation                  │
└─────────────────────────────────────────────────────────────┘

Pool Configuration:
├─► Type: ThreadedConnectionPool (psycopg2)
├─► Minimum Connections: 1
├─► Maximum Connections: 20
├─► Connection Timeout: 10 seconds
└─► SSL Mode: require

Pool Lifecycle:
    │
    ├─► [1] Initialization (app startup)
    │   │
    │   ├─► init_connection_pool() called
    │   │
    │   ├─► Create ThreadedConnectionPool
    │   │   ├─► minconn=1
    │   │   ├─► maxconn=20
    │   │   ├─► Database connection parameters
    │   │   └─► connect_timeout=10
    │   │
    │   └─► Pool ready for connections
    │
    ├─► [2] Connection Acquisition
    │   │
    │   ├─► get_connection() called
    │   │
    │   ├─► Attempt to get connection from pool
    │   │   ├─► pool.getconn()
    │   │   │
    │   │   ├─► Success → Test connection (SELECT 1)
    │   │   │   └─► Return connection
    │   │   │
    │   │   └─► Failure → Retry (max 3 attempts)
    │   │       ├─► Exponential backoff (0.1s, 0.2s, 0.3s)
    │   │       └─► Fallback to direct connection
    │   │
    │   └─► Connection returned to caller
    │
    ├─► [3] Connection Usage
    │   │
    │   ├─► Execute SQL queries
    │   │
    │   └─► Process results
    │
    ├─► [4] Connection Return
    │   │
    │   ├─► return_connection(conn) called
    │   │
    │   ├─► Attempt to return to pool
    │   │   ├─► pool.putconn(conn)
    │   │   │
    │   │   └─► Success → Connection available for reuse
    │   │
    │   └─► Failure → Close connection directly
    │
    └─► [5] Cleanup (app shutdown)
        │
        └─► close_all_connections()
            └─► pool.closeall()
```

### Performance Optimizations

1. **Connection Reuse**: Connections are reused from pool, reducing connection overhead
2. **Connection Retry**: Automatic retry with exponential backoff on connection failures
3. **Fallback Mechanism**: Direct connections if pool is exhausted
4. **Connection Testing**: Each connection is tested before use
5. **Indexed Queries**: Database indexes on frequently queried columns
6. **Query Optimization**: Efficient SQL queries with proper JOINs and WHERE clauses

### Database Query Optimization

**Indexes Created:**
- `users.username` (UNIQUE)
- `conversations.user1_id`
- `conversations.user2_id`
- `messages.conversation_id`
- `messages.timestamp`
- `messages.sender_id`
- `group_members.group_id`
- `group_members.user_id`
- `group_messages.group_id`
- `group_messages.timestamp`
- `liked_chats.user_id`
- `liked_chats.conversation_id`
- `liked_groups.user_id`
- `liked_groups.group_id`

---

## Message Ordering Algorithm

### Chronological Ordering Implementation

The application implements a three-layer approach to ensure messages are always displayed in correct chronological order:

```
┌─────────────────────────────────────────────────────────────┐
│              Message Ordering Algorithm                      │
└─────────────────────────────────────────────────────────────┘

Layer 1: Database Query Ordering
    │
    ├─► SQL ORDER BY clause:
    │   ORDER BY m.timestamp ASC NULLS LAST, m.id ASC
    │
    ├─► Ensures database returns messages in correct order
    │
    └─► Primary ordering mechanism

Layer 2: Python-Side Sorting (Safeguard)
    │
    ├─► Sort function:
    │   def sort_key(msg):
    │       timestamp_str = msg.get('timestamp') or msg.get('created_at')
    │       timestamp = datetime.fromisoformat(timestamp_str)
    │       timestamp_val = timestamp.timestamp()
    │       msg_id = msg.get('id', 0)
    │       return (timestamp_val, msg_id)
    │
    ├─► messages.sort(key=sort_key)
    │
    ├─► Ensures correct order even if database returns out of order
    │
    └─► Secondary safeguard

Layer 3: Frontend Sorting (Final Safeguard)
    │
    ├─► JavaScript sort:
    │   messages.sort((a, b) => {
    │       const dateA = new Date(a.timestamp || a.created_at).getTime()
    │       const dateB = new Date(b.timestamp || b.created_at).getTime()
    │       if (dateA !== dateB) {
    │           return dateA - dateB  // Oldest first
    │       }
    │       return (a.id || 0) - (b.id || 0)  // ID tiebreaker
    │   })
    │
    ├─► Ensures correct order in UI
    │
    └─► Final safeguard before rendering

Result: Messages always displayed in chronological order
    ├─► Oldest messages at top
    ├─► Newest messages at bottom
    └─► ID-based tiebreaker for messages with identical timestamps
```

### Timestamp Precision

- **Database**: PostgreSQL `TIMESTAMP` with microsecond precision
- **Insertion**: Uses `NOW()` function for consistent server-side timestamps
- **Format**: ISO8601 format for transmission (e.g., "2024-01-15T10:30:45.123456")
- **Parsing**: Frontend uses `Date` object for timestamp comparison

---

## Deployment Architecture

### Current Deployment Setup

```
┌─────────────────────────────────────────────────────────────┐
│                    Deployment Architecture                    │
└─────────────────────────────────────────────────────────────┘

Development Environment:
├─► Flask Development Server
│   ├─► Host: localhost
│   ├─► Port: 5000
│   ├─► Debug Mode: Enabled
│   └─► Auto-reload: Enabled
│
├─► Database: Supabase PostgreSQL
│   ├─► Host: aws-1-ap-southeast-1.pooler.supabase.com
│   ├─► Port: 5432
│   ├─► Connection: Pooled (Session Mode)
│   └─► SSL: Required
│
└─► Static Files: Served by Flask
    └─► Path: /static/*

Production Considerations:
├─► Web Server: Gunicorn or uWSGI (recommended)
├─► Reverse Proxy: Nginx (recommended)
├─► Process Manager: systemd or supervisor
├─► Database: Supabase (managed PostgreSQL)
└─► Static Files: CDN (optional for production)
```

### Recommended Production Setup

```
┌──────────────┐
│   Client     │
└──────┬───────┘
       │ HTTPS
       ▼
┌──────────────┐
│    Nginx     │ (Reverse Proxy)
│  Port 80/443 │
└──────┬───────┘
       │
       ├─► Static Files → /static/*
       │
       └─► API Requests → Gunicorn
                │
                ▼
       ┌──────────────┐
       │   Gunicorn   │ (WSGI Server)
       │  Workers: 4+ │
       └──────┬───────┘
              │
              ▼
       ┌──────────────┐
       │  Flask App   │
       └──────┬───────┘
              │
              ▼
       ┌──────────────┐
       │  Supabase    │
       │  PostgreSQL  │
       └──────────────┘
```

---

## Technology Stack

### Backend

- **Framework**: Flask 3.x
- **Language**: Python 3.11+
- **Database**: PostgreSQL (Supabase)
- **Database Driver**: psycopg2
- **Connection Pooling**: psycopg2.pool.ThreadedConnectionPool
- **Password Hashing**: bcrypt
- **Session Management**: Flask Sessions (server-side)

### Frontend

- **Language**: Vanilla JavaScript (ES6+)
- **Module System**: ES6 Modules
- **State Management**: Centralized state object
- **DOM Manipulation**: Native DOM API
- **HTTP Client**: Fetch API
- **Styling**: CSS3 (modular CSS architecture)

### Database

- **Type**: PostgreSQL 15+
- **Hosting**: Supabase
- **Connection**: Pooled (Session Mode)
- **SSL**: Required (sslmode=require)

### Development Tools

- **Version Control**: Git
- **Package Management**: pip (Python)
- **Code Organization**: Modular architecture

---

## Development Setup

### Prerequisites

- Python 3.11 or higher
- pip (Python package manager)
- PostgreSQL client libraries
- Git

### Installation Steps

1. **Clone Repository**
```bash
git clone https://github.com/aryankumawat/Hush-Hours.git
cd Hush-Hours
```

2. **Install Dependencies**
```bash
cd backend
pip install -r requirements.txt
```

3. **Database Configuration**
   - Update `backend/database.py` with your Supabase credentials:
     - `host`: Your Supabase pooler endpoint
     - `user`: Your Supabase database user
     - `password`: Your Supabase database password
     - `dbname`: Your database name (usually "postgres")

4. **Database Schema Setup**
   - Execute SQL scripts in order:
     ```bash
     # Run these against your Supabase database
     psql -h <host> -U <user> -d postgres -f create_liked_chats_table.sql
     psql -h <host> -U <user> -d postgres -f create_liked_groups_table.sql
     psql -h <host> -U <user> -d postgres -f create_gifts_table.sql
     psql -h <host> -U <user> -d postgres -f add_message_color_column.sql
     psql -h <host> -U <user> -d postgres -f add_message_color_to_messages.sql
     ```

5. **Run Application**
```bash
cd backend
python app.py
```

6. **Access Application**
   - Registration/Login: http://localhost:5000/
   - Main Application: http://localhost:5000/app

### Project Structure

```
Hush-Hours/
├── backend/
│   ├── app.py                 # Flask application entry point
│   ├── database.py             # Database connection pool
│   ├── requirements.txt        # Python dependencies
│   │
│   ├── routes/                 # Route blueprints
│   │   ├── auth_routes.py      # Authentication endpoints
│   │   ├── chat_routes.py      # Chat endpoints
│   │   ├── user_routes.py      # User endpoints
│   │   └── group_routes.py     # Group endpoints
│   │
│   ├── services/               # Business logic layer
│   │   ├── auth_service.py     # Authentication logic
│   │   ├── chat_service.py     # Chat logic
│   │   ├── friend_service.py   # Friend management
│   │   ├── group_service.py    # Group management
│   │   ├── gift_service.py     # Gift system
│   │   └── user_search_service.py  # User search
│   │
│   ├── static/                 # Static assets
│   │   ├── js/                 # JavaScript modules
│   │   │   ├── app.js          # Entry point
│   │   │   ├── state.js        # State management
│   │   │   ├── modules/        # Feature modules
│   │   │   └── utils/          # Utility functions
│   │   │
│   │   ├── css/                # Stylesheets
│   │   │   ├── base/           # Base styles
│   │   │   ├── components/     # Component styles
│   │   │   └── pages/          # Page-specific styles
│   │   │
│   │   ├── avatars/            # Avatar images
│   │   └── gifts/              # Gift images
│   │
│   ├── templates/              # HTML templates
│   │   ├── register.html       # Registration page
│   │   └── app.html            # Main application
│   │
│   └── *.sql                   # Database schema scripts
│
└── README.md                   # This file
```

### Environment Variables (Recommended)

For production, consider using environment variables for sensitive configuration:

```python
# database.py
import os

DB_HOST = os.getenv('DB_HOST', 'aws-1-ap-southeast-1.pooler.supabase.com')
DB_USER = os.getenv('DB_USER', 'postgres.bddnadfbblbmkjakxbvd')
DB_PASSWORD = os.getenv('DB_PASSWORD', 'your-password')
DB_NAME = os.getenv('DB_NAME', 'postgres')
DB_PORT = os.getenv('DB_PORT', '5432')
```

### Testing Database Connection

```bash
cd backend
python test_db.py
```

This will verify your database connection is working correctly.

---

## API Response Times & Performance Metrics

### Expected Performance

- **Connection Pool Acquisition**: < 10ms (from pool)
- **Database Query Execution**: 50-200ms (depending on query complexity)
- **Message Retrieval**: 100-300ms (for typical conversation)
- **Conversation List**: 200-500ms (depending on number of conversations)
- **Message Send**: 100-200ms (including database insert)

### Optimization Strategies

1. **Connection Pooling**: Reduces connection overhead by 90%+
2. **Database Indexes**: Improve query performance by 10-100x
3. **Query Optimization**: Efficient JOINs and WHERE clauses
4. **Frontend Caching**: State management reduces redundant API calls
5. **Lazy Loading**: Messages loaded on-demand, not all at once

---

## Security Considerations

### Implemented Security Measures

1. **Password Hashing**: bcrypt with automatic salt generation
2. **Session Security**: HTTPOnly cookies, SameSite protection
3. **SQL Injection Prevention**: Parameterized queries (psycopg2)
4. **SSL/TLS**: Required for all database connections
5. **Input Validation**: Server-side validation for all user inputs
6. **Authorization Checks**: Route-level authorization for protected endpoints

### Recommended Additional Security

1. **Rate Limiting**: Implement rate limiting for API endpoints
2. **CORS Configuration**: Configure CORS headers appropriately
3. **Content Security Policy**: Implement CSP headers
4. **XSS Protection**: Additional XSS protection measures
5. **CSRF Protection**: CSRF tokens for state-changing operations
6. **Environment Variables**: Move sensitive data to environment variables

---

## Future Enhancements

### Potential Improvements

1. **Real-time Messaging**: WebSocket integration for real-time updates
2. **Message Encryption**: End-to-end encryption for messages
3. **File Attachments**: Support for image/file sharing
4. **Push Notifications**: Browser push notifications for new messages
5. **Message Search**: Full-text search across messages
6. **Read Receipts**: Message read status indicators
7. **Typing Indicators**: Real-time typing indicators
8. **Message Reactions**: Emoji reactions to messages
9. **Voice Messages**: Audio message support
10. **Video Calls**: WebRTC integration for video calls

---

## License

[Specify your license here]

---

## Contributors

[Add contributor information]

---

## Contact

[Add contact information]

---

*Last Updated: [Current Date]*
*Version: 1.0.0*
