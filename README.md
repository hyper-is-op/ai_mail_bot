# Mail AI Automation Platform

Mail AI Automation is a scalable, containerized system that intelligently reads, processes, and responds to incoming emails using AI. It integrates a FastAPI backend, a Celery task queue, an IMAP listener, Redis, and a MySQL database to automate support ticket generation, reply handling, and order status tracking.

## 🏗 System Architecture

The platform consists of four main Docker containers:
1. **api (FastAPI)**: Exposes REST APIs for managing email records, inserting payload tickets, checking order statuses, and triggering email processing tasks. Runs on port `8024`.
2. **worker (Celery)**: Background task processor that consumes events queued by the API and listener. Handles tasks like AI-driven parsing and sending replies asynchronously.
3. **listener (IMAP Reader)**: A persistent Python process that constantly monitors registered email accounts via IMAP, fetching incoming emails and queuing them into Celery for processing.
4. **redis**: In-memory data store acting as the message broker for Celery queues.

---

## 🛠 Prerequisites

- [Docker](https://www.docker.com/) and [Docker Compose](https://docs.docker.com/compose/)
- Access to a MySQL database server
- An active Groq API Key for LLM processing

---

## 🚀 Getting Started

1. **Clone the repository** and navigate to the root directory.
2. **Setup the `.env` file** in the project root. (See [Environment Variables](#-environment-variables) below).
3. **Run the services** using Docker Compose:
   ```bash
   docker-compose up --build -d
   ```
4. The API will be available at: `http://localhost:8024`

To check logs of a specific service:
```bash
docker logs -f mail_ai_api
docker logs -f mail_ai_worker
docker logs -f mail_ai_listener
```

---

## ⚙️ Environment Variables

Create a `.env` file at the root of the project with the following configuration:

```env
# Database (MySQL)
DB_HOST=172.16.3.215
DB_USER=root
DB_PASS=sqladmin
DB_NAME=ai_mail_bot

# Groq LLM API
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=llama-3.3-70b-versatile

# Redis Broker URL
REDIS_URL=redis://mail_ai_redis:6379/0

# RAG (optional, defaults to https://aai.c-zentrixcloud.com/utils/query)
RAG_QUERY_URL=https://aai.c-zentrixcloud.com/utils/query

# Email Account API
ACCOUNT_API_URL=http://172.16.3.215:8024/email-account/4
```

---

## 📚 API Endpoints

### 1. Health Check
- **Endpoint**: `GET /`
- **Description**: Returns the status of the API server.
- **cURL**:
  ```bash
  curl -X GET "http://localhost:8024/"
  ```

### 2. Process Email Task
- **Endpoint**: `POST /process-email`
- **Description**: Queues a raw email for background processing.
- **Payload**:
  ```json
  {
    "from_email": "customer@example.com",
    "subject": "Need help with order",
    "body": "Can you check where my order is?"
  }
  ```

### 3. Accept / Save Email Credentials
- **Endpoint**: `POST /accept-email`
- **Description**: Securely saves the email credentials used by the IMAP listener. Password must be at least 8 characters.
- **Payload**:
  ```json
  {
    "user_id": 4,
    "email": "support@yourdomain.com",
    "password": "securepassword123"
  }
  ```

### 4. Get Email Account
- **Endpoint**: `GET /email-account/{user_id}`
- **Description**: Retrieves the saved email account details for a given `user_id`.
- **cURL**:
  ```bash
  curl -X GET "http://localhost:8024/email-account/4"
  ```

### 5. Create Ticket
- **Endpoint**: `POST /create-ticket`
- **Description**: Manually records an email status as a support ticket.
- **Payload**:
  ```json
  {
    "user_id": 4,
    "mail_id": "message-id-12345",
    "subject": "Help Request",
    "body": "I cannot access my account.",
    "status": "Ticket_Generated" 
  }
  ```
  *(Note: `status` must be either `Ticket_Generated` or `Done_Replied`)*

### 6. Check Order Status
- **Endpoint**: `POST /order-status`
- **Description**: Fetches order tracking details based on the provided order ID.
- **Payload**:
  ```json
  {
    "order_id": "ORD-98765"
  }
  ```

### 7. Insert Create Payload Ticket
- **Endpoint**: `POST /insert-create_payload_ticket`
- **Description**: Stores payload request configurations for generating new tickets.
- **Payload**:
  ```json
  {
    "url": "https://api.thirdparty.com/webhook",
    "paylod": {
        "key1": "value1",
        "key2": "value2"
    }
  }
  ```

### 8. Insert Payload Get Ticket
- **Endpoint**: `POST /insert-payload_get_ticket`
- **Description**: Stores payload request configurations used for fetching existing tickets.
- **Payload**:
  ```json
  {
    "url": "https://api.thirdparty.com/fetch_webhook",
    "paylod": {
        "query_key": "query_value"
    }
  }
  ```

---

## 🛠 Tech Stack
- **Python 3.x**
- **FastAPI** & Uvicorn (Web Framework)
- **Celery** (Asynchronous Task Queue)
- **Redis** (Message Broker)
- **PyMySQL** (Database Driver)
- **Groq API** (Large Language Models)
- **Docker** (Containerization)
