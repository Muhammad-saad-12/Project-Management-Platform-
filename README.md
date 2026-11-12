# Work Management Platform

<div align="center">

[![Next.js](https://img.shields.io/badge/Next.js-16.4-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.3-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.3-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Prisma](https://img.shields.io/badge/Prisma-6.4-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-336791?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Zod](https://img.shields.io/badge/Validation-Zod-3068B7?style=for-the-badge&logo=zod&logoColor=white)](https://zod.dev/)

**An enterprise-grade, multi-tenant work management platform and agile collaboration suite engineered with modern full-stack web technologies.**

[Explore Features](#-core-features) • [Architecture](#-architecture--database-design) • [Codebase Map](#-project-structure) • [Getting Started](#-getting-started) • [API Documentation](#-api-reference)

</div>

---

## 📌 Executive Overview & Elevator Pitch

The **Work Management Platform** is a full-stack, enterprise-ready collaborative project management application designed as an agile alternative to Jira and Trello. Engineered from the ground up to solve complex distributed team coordination challenges, it delivers multi-tenant workspaces, strict role-based access control (RBAC), an interactive 4-column drag-and-drop Kanban board, slide-over task drawers with real-time commenting, live activity audit trails, and multi-parameter search and filtering.

### Key Highlights for Recruiters & Engineering Leads

- **Modern Architecture**: Built on Next.js 16 App Router with React 19 Server & Client components, utilizing full TypeScript end-to-end type safety.
- **Multi-Tenant Isolation**: Complete isolation across workspaces with unique slug identifiers, role-based permissions (`ADMIN` vs `MEMBER`), and cascade safety guarantees.
- **Fluid User Experience**: Zero-latency UI updates with native HTML5 Drag & Drop, optimistic UI updates, responsive slide-over drawers, and instant client-side filtering.
- **Enterprise Auditability**: Automatic audit logging capturing project, task, status, comment, and membership mutations with actor traceability and relative time formatting.
- **Robust Security**: Secure HTTP-only cookie-based authentication using JSON Web Tokens (JWT), salted bcrypt password hashing, and strict schema validation powered by Zod.

---

## 📸 Screenshots & Demos

### 🖥️ Main Dashboard & Workspaces
![Dashboard Preview](./public/screenshots/Dashboard.png)

### 📋 Interactive Kanban Board & Filters
![Kanban Board Preview](./public/screenshots/kanban-board.png)

### 💬 Task Details & Threaded Comments
![Task Drawer Preview](./public/screenshots/task-drawer.png)

### ⚡ Activity Audit Log
![Activity Log Preview](./public/screenshots/activity-log.png)



> *Tip: To preview the high-resolution UI in your browser, launch the development server and navigate to `http://localhost:3000`.*

</div>

---

## 🚀 Core Features

### 1. 🔐 Authentication & Session Security
- **Stateless JWT via HTTP-only Cookies**: Immune to client-side XSS token theft.
- **bcrypt Password Hashing**: Adaptive work factor with cryptographically secure salt rounds.
- **Session Verification**: Dedicated `/api/auth/me` endpoint verifying session validity on mount with non-blocking revalidation.

### 2. 🏢 Multi-Tenancy & Role-Based Access Control (RBAC)
- **Scoped Tenant Workspaces**: Users can create, join, and collaborate across isolated workspaces.
- **Unique URL Slugs**: Auto-generated collision-free URL slugs (`/workspace-slug-abc123`).
- **Granular Permissions**:
  - `ADMIN`: Full authority over workspace settings, member invitations, role updates, and deletion.
  - `MEMBER`: Access to projects, tasks, comments, and activity feeds within assigned workspaces.
- **Sole Admin Safeguard**: Prevents demoting or removing the final administrator of a workspace to avoid orphaned tenants.

### 3. 📋 Interactive Drag-and-Drop Kanban Board
- **4 Workflow Stages**: `TODO` ➔ `IN_PROGRESS` ➔ `REVIEW` ➔ `DONE`.
- **Native HTML5 Drag & Drop**: Visual drop targets with ring accents and smooth state transitions.
- **In-Card Quick Switcher**: Allows status shifts with a single click as an alternative to dragging.
- **Priority Indicators**: Standardized color-coded badges for `LOW`, `MEDIUM`, `HIGH`, and `URGENT` tiers.
- **Assignee Avatars**: Displays assignee initial badges with truncated emails and due date formatting.

### 4. 🗂️ Task Detail Slide-Over Drawer & Real-Time Comments
- **Deep Task Editing**: Clicking any task card triggers a responsive slide-over drawer allowing real-time modification of title, description, status, priority, due date, and assignee.
- **Threaded Comment Stream**: Interactive discussion thread displaying author email, exact timestamp, and cascaded cleanup upon task removal.
- **Safe Task Deletion**: In-drawer deletion action with confirmation prompt.

### 5. 👥 Team & Workspace Member Management
- **Dedicated Settings Hub**: Available at `/workspaces/[workspaceId]/settings/members`.
- **Email Invitation System**: Instant addition of registered users as either `ADMIN` or `MEMBER`.
- **Role Progression**: Workspace admins can promote members to administrators or demote them.
- **Self-Service Exit**: Members can voluntarily leave workspaces, redirecting cleanly to the dashboard.

### 6. ⚡ Workspace Activity Log / Audit Trail
- **Automated Event Interception**: Automatically records activities across key system mutations:
  - `PROJECT_CREATED`
  - `TASK_CREATED`, `STATUS_CHANGED`, `TASK_UPDATED`, `TASK_DELETED`
  - `COMMENT_ADDED`
  - `MEMBER_ADDED`, `ROLE_UPDATED`, `MEMBER_REMOVED`
  - `WORKSPACE_UPDATED`
- **Contextual Visualization**:
  - **Dashboard Tab**: Embedded `⚡ Activity Feed` tab on workspace cards.
  - **Kanban Drawer**: Header button opening a slide-over feed directly within projects.
- **Timeline Nodes**: Visual timeline nodes with action badges, actor attribution, and relative timestamps (`just now`, `5m ago`, `2h ago`).

### 7. 🔍 Advanced Real-Time Search & Multi-Filters
- **Live Search Bar**: Instantly filters tasks by matching queries against task titles or descriptions with zero debounce delay.
- **Priority Filter**: Quick-toggle pill buttons (`All`, `Low`, `Medium`, `High`, `Urgent`) or dropdown selector.
- **Assignee Filter**: Filter tasks by specific team member or isolate unassigned tasks.
- **Dynamic Board Counter**: Real-time counter displaying visible vs. total project tasks.
- **One-Click Reset**: Conditional `✕ Reset Filters` button appears whenever search or filter criteria are active.

### 8. 🛠️ Complete Workspace Lifecycle Management (CRUD)
- **Create**: Automated slug generation from workspace title.
- **Edit Modal**: Update workspace name and customize unique URL slug with instant format validation.
- **Danger Zone Deletion**: Admin-guarded permanent workspace deletion cascading to all projects, tasks, comments, memberships, and activity logs.

---

## 🏗️ Architecture & Database Design

### Tech Stack Breakdown

| Technology | Role & Justification |
| :--- | :--- |
| **Next.js 16** | App Router, Server Actions, API route handlers with streaming Turbopack bundler. |
| **React 19** | Client/Server component separation, hooks, transitions, and concurrent rendering. |
| **TypeScript** | Strict compile-time typing across database models, API payloads, and UI props. |
| **Tailwind CSS v4** | Modern utility-first styling with native dark mode support. |
| **Prisma ORM v6** | Type-safe query building, relationship mapping, and declarative migrations. |
| **PostgreSQL** | Relational database providing ACID guarantees, foreign keys, and cascading deletes. |
| **Zod** | Runtime validation for API route payloads and form submissions. |
| **bcryptjs & jsonwebtoken** | Cryptographic hashing and stateless JWT session generation. |

### Entity-Relationship Diagram (ERD)

```mermaid
erDiagram
    User ||--o{ WorkspaceMember : "has"
    User ||--o{ Task : "assigned to"
    User ||--o{ Comment : "authors"
    User ||--o{ ActivityLog : "triggers"

    Workspace ||--o{ WorkspaceMember : "contains"
    Workspace ||--o{ Project : "owns"
    Workspace ||--o{ ActivityLog : "records"

    Project ||--o{ Task : "includes"
    Task ||--o{ Comment : "contains"

    User {
        string id PK
        string email UK
        string passwordHash
        datetime createdAt
        datetime updatedAt
    }

    Workspace {
        string id PK
        string name
        string slug UK
        datetime createdAt
        datetime updatedAt
    }

    WorkspaceMember {
        string id PK
        string role "ADMIN | MEMBER"
        string userId FK
        string workspaceId FK
        datetime createdAt
    }

    Project {
        string id PK
        string name
        string description
        string workspaceId FK
        datetime createdAt
    }

    Task {
        string id PK
        string title
        string description
        string status "TODO | IN_PROGRESS | REVIEW | DONE"
        string priority "LOW | MEDIUM | HIGH | URGENT"
        int position
        datetime dueDate
        string projectId FK
        string assigneeId FK
        datetime createdAt
    }

    Comment {
        string id PK
        string content
        string taskId FK
        string authorId FK
        datetime createdAt
    }

    ActivityLog {
        string id PK
        string action
        string description
        string workspaceId FK
        string actorId FK
        datetime createdAt
    }
```

---

## 📂 Project Structure

```
Work-Management-Platform-Project/
├── prisma/
│   ├── migrations/               # Declarative SQL migrations tracking schema evolution
│   └── schema.prisma             # Primary Prisma data models & relation mapping
├── public/                       # Static web assets & SVG icons
├── src/
│   ├── app/                      # Next.js 16 App Router
│   │   ├── api/                  # RESTful API route handlers
│   │   │   ├── auth/             # Authentication (/register, /login, /logout, /me)
│   │   │   ├── projects/         # Project & task creation endpoints
│   │   │   │   └── [projectId]/
│   │   │   │       ├── route.ts
│   │   │   │       └── tasks/route.ts
│   │   │   ├── tasks/            # Task mutations & comment endpoints
│   │   │   │   └── [taskId]/
│   │   │   │       ├── route.ts
│   │   │   │       └── comments/route.ts
│   │   │   └── workspaces/       # Workspace CRUD, members, and activity audit
│   │   │       ├── route.ts
│   │   │       └── [workspaceId]/
│   │   │           ├── route.ts
│   │   │           ├── activity/route.ts
│   │   │           ├── members/
│   │   │           │   ├── route.ts
│   │   │           │   └── [memberId]/route.ts
│   │   │           └── projects/route.ts
│   │   ├── projects/             # Project Kanban board pages
│   │   │   └── [projectId]/page.tsx
│   │   ├── workspaces/           # Workspace management & settings pages
│   │   │   └── [workspaceId]/settings/members/page.tsx
│   │   ├── globals.css           # Global Tailwind CSS definitions
│   │   ├── layout.tsx            # Global HTML root layout
│   │   └── page.tsx              # Main dashboard: workspaces, projects, auth UI
│   ├── components/               # Reusable UI component modules
│   │   └── ActivityLogList.tsx   # Activity timeline component with relative timestamps
│   └── lib/                      # Core business logic & utility modules
│       ├── activity.ts           # Unified activity logging helper
│       ├── auth.ts               # JWT signing, cookie verification, password hashing
│       ├── prisma.ts             # Global singleton PrismaClient instance
│       ├── slug.ts               # URL-safe collision-free slug generator
│       └── validations/          # Runtime Zod validation schemas
│           ├── auth.ts
│           ├── comment.ts
│           ├── member.ts
│           ├── project.ts
│           ├── task.ts
│           └── workspace.ts
├── .env.example                  # Environment configuration template
├── .gitignore                    # Version control exclusion rules
├── package.json                  # NPM dependencies & operational scripts
├── tsconfig.json                 # TypeScript compiler options
└── README.md                     # Comprehensive product documentation
```

---

## ⚡ Getting Started

### Prerequisites

- **Node.js**: `v20.x` or higher
- **PostgreSQL**: `v15.x` or higher (local instance or managed service like Supabase / Neon)
- **Package Manager**: `npm` (v10+)

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/work-management-platform.git
cd work-management-platform
```

### 2. Configure Environment Variables

Copy the `.env.example` template to `.env`:

```bash
cp .env.example .env
```

Edit `.env` to configure your PostgreSQL credentials and JWT secret:

```env
# Database Connection (PostgreSQL)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/work_management?schema=public"

# Authentication Secret (JWT)
JWT_SECRET="your-secure-jwt-secret-key-min-32-characters-long"
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Apply Database Migrations & Generate Prisma Client

Execute the Prisma migration runner to provision the database schema:

```bash
npx prisma migrate dev
```

Generate the strongly-typed Prisma Client:

```bash
npx prisma generate
```

### 5. Launch Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Production Verification & Linting

Verify that all TypeScript types compile and ESLint rules pass with zero warnings:

```bash
# Run ESLint validation
npm run lint

# Compile production bundle
npm run build

# Start production server
npm run start
```

---

## 📖 API Reference

All protected endpoints require an active session via an HTTP-only JWT cookie or `Authorization: Bearer <token>` header.

### Authentication Endpoints

| Method | Endpoint | Access | Description | Request Payload |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Public | Register a new user | `{ "email": "user@example.com", "password": "password123" }` |
| `POST` | `/api/auth/login` | Public | Authenticate user & issue HTTP-only cookie | `{ "email": "user@example.com", "password": "password123" }` |
| `POST` | `/api/auth/logout` | Public | Clear session cookie | *None* |
| `GET` | `/api/auth/me` | Authenticated | Retrieve current user profile | *None* |

### Workspace Endpoints

| Method | Endpoint | Access | Description | Request Payload |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/workspaces` | Authenticated | List all workspaces caller belongs to | *None* |
| `POST` | `/api/workspaces` | Authenticated | Create workspace; creator assigned as `ADMIN` | `{ "name": "Acme Corp" }` |
| `GET` | `/api/workspaces/[workspaceId]` | Member | Get workspace details, members, and projects | *None* |
| `PATCH` | `/api/workspaces/[workspaceId]` | Admin | Update workspace name and/or slug | `{ "name": "New Name", "slug": "new-slug" }` |
| `DELETE` | `/api/workspaces/[workspaceId]` | Admin | Delete workspace cascading all child data | *None* |
| `GET` | `/api/workspaces/[workspaceId]/activity` | Member | Fetch workspace audit logs (`?limit=50`) | *None* |

### Workspace Member Endpoints

| Method | Endpoint | Access | Description | Request Payload |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/workspaces/[workspaceId]/members` | Member | List workspace members with roles | *None* |
| `POST` | `/api/workspaces/[workspaceId]/members` | Admin | Invite/add a member by email | `{ "email": "colleague@acme.com", "role": "MEMBER" }` |
| `PATCH` | `/api/workspaces/[workspaceId]/members/[memberId]` | Admin | Update member role (`ADMIN` / `MEMBER`) | `{ "role": "ADMIN" }` |
| `DELETE` | `/api/workspaces/[workspaceId]/members/[memberId]` | Admin/Self | Remove member or leave workspace | *None* |

### Project & Task Endpoints

| Method | Endpoint | Access | Description | Request Payload |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/workspaces/[workspaceId]/projects` | Member | List all projects in workspace | *None* |
| `POST` | `/api/workspaces/[workspaceId]/projects` | Member | Create project in workspace | `{ "name": "Sprint Alpha", "description": "Details" }` |
| `GET` | `/api/projects/[projectId]` | Member | Fetch project details and members | *None* |
| `GET` | `/api/projects/[projectId]/tasks` | Member | List tasks in project with assignees | *None* |
| `POST` | `/api/projects/[projectId]/tasks` | Member | Create new task | `{ "title": "Setup CI/CD", "status": "TODO", "priority": "HIGH" }` |
| `GET` | `/api/tasks/[taskId]` | Member | Fetch detailed task info with comments | *None* |
| `PATCH` | `/api/tasks/[taskId]` | Member | Update task title, status, priority, due date | `{ "status": "IN_PROGRESS", "priority": "URGENT" }` |
| `DELETE` | `/api/tasks/[taskId]` | Member | Delete task | *None* |
| `GET` | `/api/tasks/[taskId]/comments` | Member | List all comments on task | *None* |
| `POST` | `/api/tasks/[taskId]/comments` | Member | Add comment to task | `{ "content": "Code review completed." }` |

---

## 🔒 Security & Best Practices

1. **Defense in Depth**: Every API route validates identity through `getAuthenticatedUser()` and checks membership roles before reading or modifying resources.
2. **Schema Sanitization**: Every input body passes through Zod runtime validation, stripping disallowed fields and verifying lengths and regex patterns.
3. **Protection Against Orphaned Workspaces**: The platform prevents demoting or removing the last administrator of a workspace.
4. **Relational Integrity**: Foreign key constraints with `onDelete: Cascade` ensure no orphaned task or comment rows pollute the database upon entity deletion.
5. **No Secret Leaks**: All credentials and secrets are managed exclusively through environment variables.

---

## 📄 License

Distributed under open-source terms. See project documentation for details.
