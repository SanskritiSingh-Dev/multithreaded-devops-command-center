# EchoChat: DevOps Command Center

A high-performance, real-time Engineering Dashboard built to demonstrate advanced multithreading, concurrency, and WebSockets. This project began as a simple console-based Java multithreading simulation and was systematically modernized into a production-ready, full-stack web application.

---

## 🚀 Key Features

* **Real-Time WebSockets:** Built on Spring Boot STOMP WebSockets for instant, bidirectional communication without HTTP polling.
* **Multithreaded Stress Test Engine:** Features a custom `ExecutorService` capable of instantly spinning up 50 concurrent virtual threads to load-test the server in real-time.
* **Chaos Engineering & Threat Detection:** Features a custom Rate Limiter algorithm using thread-safe `ConcurrentHashMap`. It instantly identifies "Chaos Bots" spamming the network, permanently bans their IPs, and drops their sockets.
* **Live Server Diagnostics:** A streaming diagnostics panel that displays live JVM memory consumption, active thread counts, and a real-time sorting Leaderboard.
* **Premium Dashboard UI:** A custom-built Vite + React 3-column layout featuring glassmorphism design, dedicated communication channels, and Markdown support.

---

## 🧠 Technical Challenges & Solutions

Building a highly concurrent real-time application comes with significant architectural challenges. Here is a detailed breakdown of the problems faced during development and how they were overcome:

### 1. Data Corruption Under High Concurrency
**Problem:** When the "Stress Test" is initiated, the `ExecutorService` spawns 50 virtual threads that simultaneously bombard the server with messages. Initially, attempting to track user message counts (for the Leaderboard) using standard collections like `HashMap` or `ArrayList` caused `ConcurrentModificationException` crashes and race conditions due to simultaneous memory writes.
**Solution:** Migrated all critical state-tracking logic in the Spring Boot backend to **Thread-Safe Data Structures**. Specifically, we utilized `ConcurrentHashMap<String, Integer>` for the Leaderboard and `ConcurrentHashMap.newKeySet()` for the Banned Users list. This guaranteed that thousands of rapid increments per second could happen safely without locking the main thread or corrupting data.

### 2. Defending Against DDoS / Spam Floods
**Problem:** During the stress test, the server needed a way to identify bad actors (Chaos Bots) that were spamming the network, without pausing or slowing down the processing of legitimate messages.
**Solution:** Built a **Custom Rate Limiter (Velocity Tracker)** inside the `ChatController`. We mapped each user to an array of their most recent message timestamps (`Map<String, List<Long>>`). The system checks if a user has sent more than 5 messages within a 1000ms sliding window. If they breach this threshold, they are instantly added to the `bannedUsers` Set. Crucially, banned users have their future WebSocket messages dropped at the very top of the controller layer, saving valuable CPU cycles from being wasted on filtering or broadcasting.

### 3. WebSocket Event Flooding (Typing Indicators)
**Problem:** We wanted to add live "User is typing..." indicators. However, emitting a WebSocket event to the server on *every single keystroke* overloaded the network and caused massive UI jitter.
**Solution:** Implemented **Event Throttling** on the React frontend. Using React's `useRef` and `setTimeout`, we throttle the `onChange` input event so that a `TYPING` STOMP payload is only broadcasted to the server a maximum of once every 2 seconds per user. This drastically reduced network overhead while perfectly maintaining the real-time UX feel.

### 4. UI/UX Architecture for Disparate Data Streams
**Problem:** The application had three very different streams of data: real humans chatting, system logs from the stress test, and server health diagnostics. Mixing all of this into a single "WhatsApp-style" chat room made the application chaotic and unusable during a stress test.
**Solution:** Executed a massive architectural pivot to a **"DevOps Command Center"** layout. We implemented dynamic STOMP topic routing (`/topic/{channel}`) in the backend. On the frontend, we built a 3-column CSS Grid layout featuring a Discord-style Workspace Sidebar. This allowed us to cleanly segregate human conversation (`#general-chat`) from automated testing data (`#stress-test-logs`), ensuring the app remains perfectly usable even when 50 bots are actively attacking the server.

---

## 🛠 Tech Stack

* **Backend:** Java, Spring Boot, WebSockets (STOMP), ExecutorService Concurrency.
* **Frontend:** React, Vite, SockJS, StompJS, Lucide React.
* **Architecture:** Microservice-ready, Event-driven, Rate-Limited.

---

## ⚙️ How to Run Locally

### 1. Start the Backend
Navigate to the `backend` directory and run the Spring Boot server:
```bash
cd backend
.\mvnw spring-boot:run
```
*The backend will start on `http://localhost:8080`*

### 2. Start the Frontend
Open a new terminal, navigate to the `frontend` directory, install dependencies, and start the Vite dev server:
```bash
cd frontend
npm install
npm run dev
```
*The frontend will start on `http://localhost:5173`*

---

## 🎯 The "WOW" Factor Test
To see the system's full power during an interview or demo:
1. Join the `#stress-test-logs` channel in the browser.
2. Click the red **Run Stress Test** button.
3. Watch as 50 concurrent bot threads spawn instantly.
4. Observe the **Blocked Threats** panel automatically catch and ban the 5 hidden "Chaos Bots" for exceeding the rate limit.
5. Watch the **Top Active Users** Leaderboard sort thousands of messages in real-time without locking the main thread.
