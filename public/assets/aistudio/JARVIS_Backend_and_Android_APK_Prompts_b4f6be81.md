# JARVIS AI Personal Assistant --- Backend & Android APK Prompts

This document contains two separate development prompts for the existing
JARVIS project:

1.  **Backend prompt** --- upgrade the existing backend, add reliable
    live AI chat, provider routing, and integrations.
2.  **Android APK prompt** --- build the futuristic JARVIS app UI based
    on the supplied screenshot and connect it to the backend.

Repository: https://github.com/aswiiz/JARVIS

------------------------------------------------------------------------

# Prompt 1 --- JARVIS Backend Upgrade & Live AI Assistant

## Project

You are a senior Python backend engineer, AI integration specialist, API
architect, and cloud deployment engineer.

Upgrade the **existing** JARVIS backend into a production-ready personal
AI assistant. The project already has existing code, an LLM7
integration, and a Pollinations fallback change in `jarvis_core.py`.

**Do not rebuild the project from scratch.** First inspect the
repository, preserve working features, and modify the existing
architecture carefully.

## 1. Inspect the repository first

Repository: https://github.com/aswiiz/JARVIS

Before coding:

-   Inspect the complete project structure and Python files.
-   Identify the current framework, API routes, database, and deployment
    configuration.
-   Inspect `jarvis_core.py`, LLM7, Pollinations, provider order, and
    environment variables.
-   Review `requirements.txt`, Render configuration, frontend
    communication, and existing tests.
-   Identify missing or broken features.
-   Make an implementation plan before editing.

Do not remove existing functionality without a clear reason. If a
feature already exists, improve it rather than duplicating it.

## 2. Main objective

Build a real backend for JARVIS that supports:

-   Live AI chat and streamed responses
-   Conversation history and multiple conversations
-   AI provider selection and fallback
-   Voice-assistant request processing
-   Calendar integration
-   Clock, timer, alarm, and reminder request interpretation
-   Location-aware requests
-   Email integration
-   Android device-action responses
-   ChatGPT, Claude, Gemini, Copilot, and Freebuff integration where
    supported
-   Authentication, user preferences, and secure connected accounts
-   Stable APIs for the Android app

The backend must not depend on one AI provider.

## 3. AI provider architecture

Create modular provider adapters with a shared interface, such as:

-   `generate_response()`
-   `stream_response()`
-   `get_status()`
-   `validate_configuration()`

Support the providers that the repository and documentation can
legitimately support:

-   Existing LLM7 provider
-   Pollinations, if its current API supports the intended anonymous use
-   OpenAI API
-   Anthropic Claude API
-   Google Gemini API
-   Groq API
-   Microsoft Copilot only through an official, supported API or
    authorized integration
-   Freebuff only after identifying the exact service and its supported
    API

Do not invent endpoints or assume consumer subscriptions grant API
access. Do not scrape websites or bypass authentication. If an
integration is unavailable, report it honestly and provide a
configurable adapter where useful.

## 4. Provider order and fallback

Support a configurable provider order, for example:

`LLM_PROVIDER_ORDER=llm7,pollinations,groq,gemini,openai,claude`

Requirements:

1.  Attempt the selected provider.
2.  Fall back only for eligible transient failures, timeouts, or service
    errors.
3.  Do not repeatedly retry invalid credentials.
4.  Respect rate limits and provider retry guidance.
5.  Avoid duplicate paid requests.
6.  Stop after a valid response.
7.  Return a useful error if all providers fail.
8.  Log provider errors without exposing secrets.

Keep LLM7 working. Keep Pollinations as an optional keyless fallback if
supported, but do not describe it as unlimited or guaranteed. Use
configurable timeouts and rate limits.

## 5. Live chat API

Implement a complete chat system compatible with the Android app.

Example request:

``` json
{
  "message": "Hello JARVIS",
  "conversation_id": "optional",
  "provider": "auto",
  "stream": true
}
```

Example response:

``` json
{
  "conversation_id": "generated-id",
  "message": "Hello, how can I help?",
  "provider": "llm7",
  "status": "success"
}
```

Support streaming through Server-Sent Events or WebSockets. Prefer SSE
unless the current architecture already uses WebSockets.

Implement or adapt routes such as:

-   `POST /api/chat`
-   `POST /api/chat/stream`
-   `POST /api/chat/stop`
-   `GET /api/chat/history`
-   `GET /api/chat/conversations`
-   `DELETE /api/chat/conversations/{id}`

Requirements:

-   Stream tokens as they arrive.
-   Support stopping/canceling generation.
-   Handle client disconnects and provider timeouts.
-   Maintain conversation context and message ordering.
-   Prevent duplicate submissions.
-   Return provider and message metadata.
-   Follow the existing framework's routing conventions.

## 6. JARVIS assistant behavior

JARVIS should be professional, friendly, natural, helpful, and
context-aware.

It must distinguish between:

-   General AI questions
-   Personal-information requests
-   Calendar actions
-   Email actions
-   Location requests
-   Android device actions
-   App-launch requests

Do not claim that an action succeeded until the integration reports
success.

Example:

User: "JARVIS, what do I have tomorrow?"

JARVIS should retrieve authorized calendar data and summarize real
events, or explain that Calendar is not connected.

## 7. AI assistant integrations

### ChatGPT

Use the official OpenAI API. Support chat, streaming, context, model
selection, and configurable server-side credentials.

### Claude

Use the official Anthropic API. Support chat, streaming, context, model
selection, and server-side credentials.

### Gemini

Use the official Google Gemini API. Support chat, streaming, context,
and model selection.

### Microsoft Copilot

Investigate official supported APIs and authorized integration options.
Do not scrape Copilot or automate browser sessions to bypass
authentication. Show unavailable status if a supported integration is
not available.

### Freebuff

Identify the exact Freebuff service intended by the project owner.
Inspect its API documentation. Do not invent endpoints or
authentication. If it cannot be identified, leave a documented
adapter/configuration point and request the necessary API details.

## 8. Google Calendar integration

Integrate Google Calendar using OAuth 2.0 and explicit user
authorization.

Support:

-   Read and list events
-   Upcoming events
-   Search events
-   Create, update, and delete events
-   Schedule summaries
-   Conflict checks

Use `Asia/Kolkata` as the default timezone unless the user configures
another timezone.

Example routes:

-   `GET /api/calendar/events`
-   `POST /api/calendar/events`
-   `PATCH /api/calendar/events/{id}`
-   `DELETE /api/calendar/events/{id}`

Ask for clarification when event details are ambiguous. Confirm before
creating or deleting events when appropriate. Store OAuth credentials
securely; never return refresh tokens to Android.

## 9. Clock, alarms, and reminders

Interpret requests for:

-   Current date and time
-   Timezone
-   Timer
-   Countdown
-   Reminder
-   Alarm
-   Alarm cancellation and listing

The backend should return a structured instruction. **The Android device
must create local alarms and timers** using Android APIs. Do not claim
an alarm is scheduled merely because the backend parsed the request.

## 10. Location integration

Support authorized location-aware requests, nearby queries, and
navigation intents.

Android should request location permission and send location only when
the user has authorized it. Avoid continuous tracking and unnecessary
location storage.

Example:

`POST /api/location/context`

Use validated coordinates supplied by the authorized device. Do not
hardcode or fabricate a user's location.

## 11. Gmail integration

Integrate Gmail using OAuth 2.0 and supported Gmail APIs.

Support:

-   Inbox and message listing
-   Search
-   Read message details
-   Summarize messages
-   Draft email
-   Reply
-   Send email

Example routes:

-   `GET /api/email/messages`
-   `GET /api/email/messages/{id}`
-   `POST /api/email/search`
-   `POST /api/email/draft`
-   `POST /api/email/send`

Before sending, show recipient, subject, and body and require user
confirmation. Send only after confirmation and report the actual API
result. Never expose credentials.

## 12. Android device-control actions

The backend must interpret device commands and return structured
actions. It must not attempt to control the phone directly from Render.

Example:

``` json
{
  "type": "device_action",
  "action": "open_app",
  "app": "calendar",
  "requires_confirmation": false
}
```

Support appropriate action types such as:

-   Open an installed app
-   Open settings
-   Set timer or reminder
-   Open calendar or email
-   Open maps or navigation
-   Display a notification
-   Launch supported Android actions

The Android client must validate actions, request permissions, and
execute them using Android APIs/intents. Never return arbitrary
executable code.

## 13. Database

Inspect the existing database first. If persistent production storage is
missing, use PostgreSQL for production and SQLite only where suitable
for local development.

Possible entities:

-   User
-   Conversation
-   Message
-   UserPreference
-   ConnectedAccount
-   AssistantAction
-   IntegrationStatus

Persist conversation history and preferences. Use migrations and
suitable indexes.

Do not store raw API keys in ordinary database fields. Protect OAuth
tokens. Avoid unnecessary location history.

## 14. Security

Implement:

-   Authentication and authorization
-   User-specific conversation access
-   HTTPS-compatible deployment
-   Environment-based secrets
-   OAuth token protection
-   Request validation
-   Rate limiting
-   CORS allowlist
-   Safe error handling
-   Logging without secrets
-   Prompt-injection-aware handling of external content

Never commit API keys to GitHub or expose provider secrets in frontend
code or the APK.

## 15. Environment configuration

Update `.env.example` with documented placeholders, for example:

``` env
APP_ENV=production
APP_SECRET_KEY=
DATABASE_URL=

LLM_PROVIDER_ORDER=llm7,pollinations,groq,gemini,openai,claude

LLM7_API_KEY=
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GEMINI_API_KEY=
GROQ_API_KEY=

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=

CORS_ALLOWED_ORIGINS=
```

These are examples only. Do not require keys for providers that do not
need them. Validate configuration on startup.

## 16. Render deployment

Preserve the existing Render deployment setup after inspecting it.

Ensure:

-   Correct startup command
-   Correct dependencies
-   Environment variables
-   Database configuration
-   Health check
-   Logging
-   CORS
-   HTTPS support

Update `requirements.txt`, `.env.example`, README, and deployment
instructions as necessary. Do not assume local disk persistence or
unlimited uptime on free instances.

## 17. Android API contract

Document stable JSON responses, errors, streaming events, and action
schemas.

Example:

``` json
{
  "status": "success",
  "conversation_id": "abc123",
  "message_id": "msg123",
  "content": "Hello",
  "provider": "llm7",
  "actions": [],
  "timestamp": "ISO-8601"
}
```

Validate all responses. Never send executable code as an assistant
action.

## 18. Testing

Write tests for:

-   LLM7 and Pollinations adapters
-   Provider fallback and timeouts
-   Invalid credentials
-   All providers unavailable
-   Chat history and streaming
-   Authentication and authorization
-   Calendar and Gmail adapters
-   Device-action parsing
-   Rate limits
-   Secret redaction

Mock external APIs so tests do not require paid credentials. Run tests
and fix regressions.

## 19. Backend final delivery

Provide:

1.  Architecture summary
2.  Modified and added files
3.  Provider status and requirements
4.  OAuth setup instructions
5.  Render environment configuration
6.  Android API documentation
7.  Deployment instructions
8.  Test results

Do not claim live integrations were tested unless they were actually
tested with credentials and a live service.

**Priority:** preserve the project, make live chat reliable, implement
provider fallback, add structured actions, secure integrations, document
APIs, and keep Render deployment working.

------------------------------------------------------------------------

# Prompt 2 --- JARVIS Android APK with Futuristic UI

## Project

Application: **JARVIS --- Just A Rather Very Intelligent System**

Backend repository: https://github.com/aswiiz/JARVIS

Use the user's uploaded screenshot as the main visual reference. Build a
real Android application, not a static mockup.

You are a senior Android developer, Kotlin engineer, UI/UX designer, and
AI integration architect.

Build a complete Android personal assistant that connects to the
existing JARVIS backend.

## 1. Design reference

Create an original futuristic HUD interface inspired by the screenshot:

-   Dark navy/black background
-   Cyan and blue neon accents
-   Glass-like panels
-   Circular holographic AI visualization
-   Animated rings and segments
-   Audio waveform
-   Glowing buttons and borders
-   Premium sci-fi appearance
-   Smooth, restrained animations

Use original JARVIS-inspired visuals. Do not use copyrighted Iron Man
artwork, movie assets, or logos.

Do not use the screenshot as a static background. Build real interactive
UI components.

## 2. Home screen

### Header

Display:

-   JARVIS title
-   "Just A Rather Very Intelligent System"
-   Hamburger menu
-   Settings/profile shortcut
-   Backend connection indicator

Use the real Android status bar for time, Wi-Fi, and battery. Do not
fake system status.

### AI visualization

Create a large circular holographic visualization with concentric rings,
rotating segments, a pulsing center, and waveform.

Support states:

-   Idle
-   Listening
-   Thinking
-   Speaking
-   Processing
-   Error

Center label: `JARVIS`

Use efficient animations and pause/reduce them when the app is
backgrounded.

### Greeting

Display a time-based greeting, such as:

"Good evening."

"How can I assist you today?"

Use the device's real time and allow personalization.

## 3. Dashboard actions

Create six functional buttons in a 2-row, 3-column layout when the
screen permits:

1.  Chat
2.  System Control
3.  Create
4.  Search
5.  Analyze
6.  Automate

Each button must navigate to a real feature.

### Chat

Open live AI chat.

### System Control

Show supported Android actions and device integrations.

### Create

Open a workspace for writing, notes, email drafts, ideas, and prompts.

### Search

Open supported AI-powered search.

### Analyze

Allow supported text and document analysis.

### Automate

Show reminders, schedules, and supported automations.

Do not leave inert buttons or pretend features work.

## 4. Voice assistant

Create a large circular microphone button matching the reference.

Use:

-   Cyan ring
-   Microphone icon
-   Listening animation
-   Pulsing glow

Implement real speech recognition using Android-supported APIs and
spoken responses using Android TextToSpeech.

Flow:

1.  User activates microphone.
2.  Request permission if needed.
3.  Recognize speech.
4.  Display recognized text.
5.  Send it to backend.
6.  Display streamed response.
7.  Speak response if voice output is enabled.

Support stop listening, stop speaking, and text input fallback.

Do not record continuously without explicit permission and user action.
Handle denied permissions gracefully.

## 5. Live chat

Connect the chat screen to the existing JARVIS backend.

Features:

-   Real-time streaming
-   User and assistant messages
-   Conversation history
-   New conversation
-   Delete conversation
-   Copy message
-   Retry
-   Stop generation
-   Markdown and code formatting
-   Loading and error states
-   Provider selection
-   Assistant selection
-   Action cards

Display tokens as they arrive. Do not wait for the complete response.

Do not hardcode AI responses.

## 6. AI assistant selector

Provide options:

-   JARVIS
-   ChatGPT
-   Claude
-   Gemini
-   Microsoft Copilot
-   Freebuff

Show each assistant's name, icon/visual, description, availability, and
connection status.

JARVIS is the default.

Use supported official APIs through the backend. Do not embed consumer
AI websites in WebViews as a substitute for integration. Do not bypass
authentication.

If a provider requires credentials, show a connection/configuration
state. Keep provider API keys on the backend, never in the APK.

If Copilot or Freebuff lacks a supported API, show a truthful
unavailable state rather than fabricating functionality.

## 7. System control

Build a device-control dashboard.

Support only actions allowed by Android and the user's permissions, such
as:

-   Open supported installed apps
-   Open Android settings
-   Create local timers and reminders
-   Open calendar or email
-   Open maps and navigation
-   Display notifications
-   Launch supported intents

The backend interprets natural language and returns a structured action.
The Android app validates and executes it.

If an app is missing or permission is denied, show a clear message. Do
not claim an action succeeded before Android confirms it.

## 8. Calendar

Integrate Google Calendar through OAuth or a supported authorized
integration.

Features:

-   Today's events
-   Tomorrow's events
-   Upcoming events
-   Search
-   Event details
-   Create, edit, and delete events
-   Schedule summaries

Show event title, date/time, location, and description where available.

Use real authorized calendar data. Do not use fake production events.

Ask the user to connect Google account when required. Confirm
consequential actions where appropriate.

## 9. Clock, timer, and alarm

Create a clock screen with:

-   Digital clock
-   Date
-   Timezone
-   Stopwatch
-   Timer
-   Countdown
-   Alarm

Use Android APIs to schedule actual device alarms and notifications.

Handle required permissions and Android background restrictions.

Example: "JARVIS, wake me up at 6 AM."

Clarify ambiguous dates/times. Use the device timezone.

Do not rely on a Render server to trigger a local phone alarm.

## 10. Location

Create a location screen with:

-   Current location
-   Permission status
-   Map integration
-   Place search
-   Nearby places
-   Navigation
-   Location-aware assistant requests

Use Android location APIs and request permission only when needed.

Allow location access to be disabled. Avoid background tracking by
default.

For navigation, open a supported map application using Android intents.

## 11. Email

Integrate Gmail through the backend and OAuth.

Features:

-   Inbox
-   Search
-   Read messages
-   Summarize
-   Draft
-   Reply
-   Send

Never place Gmail secrets in the APK.

Before sending, show recipient, subject, and body and require
confirmation. Report the actual backend result.

## 12. Create workspace

Support:

-   AI writing
-   Notes
-   Email drafts
-   Text generation
-   Ideas
-   Prompts
-   Summaries

Allow copying and saving content. Use a futuristic but readable editor.

## 13. Search

Create an AI search screen with:

-   Search field
-   Voice search
-   Results and summaries
-   Source links
-   Search history
-   Clear history

Use backend-supported search. Do not fabricate sources or results. If
live search is unavailable, communicate that clearly.

## 14. Analyze

Create a text/file analysis workspace.

Support:

-   Text analysis
-   Summarization
-   Questions and answers
-   Supported document upload
-   Explanations

Show progress, results, errors, and retry. Only claim supported file
types were processed.

## 15. Automations

Create an automation dashboard for:

-   Reminders
-   Calendar-based actions
-   Timers
-   Scheduled assistant tasks
-   Automation history
-   Enable/disable
-   Edit/delete

Example: "Remind me tomorrow at 8 AM to study."

Create real Android reminders using local scheduling APIs where
appropriate. Use backend scheduling only for genuinely server-side
tasks.

Require confirmation for sensitive actions.

## 16. Bottom navigation

Create a bottom navigation bar matching the reference:

-   Home
-   Commands
-   Files
-   Settings

### Home

Main JARVIS dashboard.

### Commands

List supported voice commands and actions.

### Files

Show supported files, generated content, saved notes, and documents.

### Settings

Manage provider, connected accounts, voice, permissions, notifications,
theme, backend URL, and assistant preferences.

## 17. Settings

Include:

### AI

-   Selected assistant
-   Provider
-   Provider status
-   Backend URL
-   Streaming preference

### Voice

-   Speech recognition
-   Text-to-speech
-   Voice selection
-   Speech speed
-   Speech volume

### Connected services

-   Google Calendar
-   Gmail
-   Location

### Device

-   Notification permissions
-   Microphone
-   Location

### Appearance

-   Dark mode
-   Cyan accent
-   Animation intensity

### Privacy

-   Clear conversation history
-   Clear local data
-   Manage permissions
-   Disconnect accounts

Never expose server-side API keys.

## 18. Backend connection

Connect to the existing JARVIS backend hosted on Render.

Inspect the repository and actual API routes before implementation. Do
not invent a Render URL.

Create a configurable HTTPS backend URL and implement:

-   API client
-   Authentication
-   Streaming chat
-   Conversation history
-   Error handling
-   Retry logic
-   Timeout handling
-   Connection status
-   Health check

Show connected status only after a successful health check.

## 19. Android technology

Prefer:

-   Kotlin
-   Jetpack Compose
-   Material 3
-   MVVM or a suitable modern architecture
-   ViewModel
-   Repository pattern
-   Coroutines
-   Retrofit or suitable HTTP client
-   OkHttp for streaming if needed
-   Android SpeechRecognizer
-   Android TextToSpeech
-   AlarmManager
-   Notification APIs
-   Android location APIs

Keep networking out of UI components. Use lifecycle-aware behavior and
maintainable modules.

## 20. APK and project requirements

Deliver a real Android project with:

-   Source code
-   Gradle configuration
-   Android manifest
-   App icons
-   Splash screen
-   Runtime permissions
-   Backend configuration
-   Debug APK
-   Release build configuration

The APK must be installable on a compatible Android device.

Do not deliver only screenshots, HTML, a web app, or a static prototype.

## 21. Security

Never package these in the APK:

-   OpenAI API keys
-   Claude API keys
-   Gemini API keys
-   Gmail client secrets
-   Render environment secrets
-   Private backend credentials

Keep sensitive provider credentials on the backend.

Use HTTPS, secure authentication, permission checks, and careful
logging. Avoid unnecessary storage of email contents or precise location
history.

## 22. Performance

Optimize for real Android devices:

-   Smooth animations
-   Low memory usage
-   Efficient networking
-   Lifecycle handling
-   Reduced background work
-   Battery-aware HUD animation
-   Network-loss handling
-   Backend downtime handling
-   Responsive layouts

## 23. Testing

Test:

-   Home screen
-   Chat and streaming
-   Provider switching
-   Backend health
-   Microphone permissions
-   Speech recognition
-   Text-to-speech
-   Calendar
-   Gmail
-   Location
-   Alarms
-   Notifications
-   Navigation
-   App launching
-   Offline behavior

Use mock backend responses for tests. Do not require real API keys for
UI tests. Clearly distinguish mocked features from live integrations.

## 24. Final delivery

Provide:

1.  Complete Android source code
2.  Gradle configuration
3.  Backend integration
4.  Functional home screen
5.  Live chat
6.  Voice assistant
7.  Provider selector
8.  Calendar
9.  Clock and alarms
10. Location
11. Email
12. System-control dashboard
13. Settings
14. Permission handling
15. Debug APK
16. Release build configuration
17. Build instructions
18. API configuration instructions
19. Testing report

Build and test the APK. Explain any integration that requires
credentials or account authorization. Do not claim mocked features are
live.

**Priority:** reference-inspired UI, working live chat, voice
input/output, backend connection, AI provider selection, calendar,
clock/alarms, email, location, supported system actions, and APK
generation.

Build a real Android assistant, not merely a visual prototype.

------------------------------------------------------------------------

# Recommended implementation order

1.  Inspect and upgrade the existing backend.
2.  Test live chat and streaming.
3.  Deploy backend to Render.
4.  Confirm API routes and response formats.
5.  Build the Android HUD UI.
6.  Connect Android to backend.
7.  Add voice input and spoken responses.
8.  Add calendar, clock, location, and Gmail.
9.  Add supported external AI providers.
10. Build and test the APK.

## Important integration notes

-   ChatGPT, Claude, Gemini, and Copilot consumer subscriptions do not
    automatically provide API access. Use supported official APIs and
    show connection status.
-   Freebuff must be identified and its API verified before
    implementation.
-   Calendar and Gmail require user authorization through OAuth.
-   Android alarms, app launching, microphone, and device actions must
    be executed by the Android client, not directly by Render.
-   Pollinations is a fallback, not an unlimited or guaranteed provider.
-   Keep API keys and OAuth secrets out of GitHub and the APK.
