# TaskFlow

> A premium, highly interactive project and task management system built on React, TypeScript, and Supabase.

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/your-username/taskflow)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Status](https://img.shields.io/badge/status-active-success.svg)](#)

TaskFlow is a state-of-the-art workspace collaboration platform designed to eliminate the chaos of task tracking. By integrating smooth Scrum/Kanban boards, real-time sync via Supabase, rich-text task descriptions with mention tags, and visual project analytics, it empowers teams to organize tasks effortlessly and maintain peak efficiency.

---

## Table of Contents

- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Directory Structure](#directory-structure)
- [Prerequisites](#prerequisites)
- [Installation & Setup](#installation--setup)
- [Environment Variables](#environment-variables)
- [Database Schema (Supabase)](#database-schema-supabase)
- [Contributing](#contributing)
- [License](#license)

---

## Key Features

1. **Cinematic Loading Intro**  
   - Premium particle-simulated loading screen that elegantly transitions to the main app dashboard using Framer Motion.
2. **Interactive Scrum/Kanban Board**  
   - Full drag-and-drop columns and tasks utilizing `@dnd-kit` for fluid transitions.
3. **Advanced Project Analytics**  
   - Real-time visualizations of task statuses, priority distributions, and completion progress built with `recharts`.
4. **Rich Text Task Editor with Mentions**  
   - TipTap-powered editor allowing markdown styling, list checkboxes, and dynamic user tagging/mentions.
5. **Real-time Notifications**  
   - Activity notifications indicating assignments, updates, and member interactions.
6. **Command Palette (⌘K / Ctrl+K)**  
   - Instant project-wide fuzzy search to jump to boards, trigger settings, or search tasks.
7. **Multi-Role User Management**  
   - Built-in permission control (Super Admin, Project Owner, Member, Viewer) with a clean administration panel.

---

## Tech Stack

- **Frontend Core:** React 18, TypeScript, Vite
- **State Management:** Zustand (Global Cache), React Context (Authentication)
- **Database & Auth:** Supabase (PostgreSQL, Realtime DB, GoTrue Auth)
- **Styling & UI:** Tailwind CSS, Lucide React (Icons), Framer Motion (Animations)
- **Drag & Drop:** `@dnd-kit/core` & `@dnd-kit/sortable`
- **Data Visualization:** Recharts
- **Rich Editor:** TipTap Editor (`@tiptap/react`)

---

## Directory Structure

```text
TaskFlow/
├── public/                  # Static assets (including taskflow-symbol.png)
├── src/
│   ├── components/
│   │   ├── layout/          # Layout wrappers (Sidebar, Notifications, CreateProjectModal, Layout)
│   │   ├── shared/          # Reusable features (CommandPalette, Intro)
│   │   ├── ui/              # Fundamental UI building blocks (Button, Input, Editor, MentionList)
│   │   ├── ProjectAnalytics.tsx # Project stats & recharts graphs
│   │   ├── ProjectList.tsx  # Interactive lists & sorting of tasks
│   │   ├── TaskModal.tsx    # Comprehensive task view (comments, attachments, subtasks)
│   │   ├── TeamManagementModal.tsx # Manage project members and assign roles
│   │   └── Toast.tsx        # Toast alert wrappers
│   ├── context/
│   │   └── AuthContext.tsx  # User Session and Supabase profiles state provider
│   ├── lib/
│   │   ├── supabase.ts      # Supabase Client and Database schema TypeScript definitions
│   │   └── utils.ts         # Utility helper functions (cn Tailwind merge, date formatters)
│   ├── pages/
│   │   ├── AuthPage.tsx     # Modern Sign In / Sign Up screen with animations
│   │   ├── BoardPage.tsx    # Full Scrum Kanban Board page
│   │   ├── Dashboard.tsx    # Project Dashboard workspace list
│   │   └── UserManager.tsx  # Administration user table and system roles panel
│   ├── stores/
│   │   └── useStore.ts      # Zustand global state (sidebar, cache, project lists)
│   ├── routes.tsx           # React Router router definitions
│   ├── App.tsx              # Main entry layout with Intro wrapper
│   └── main.tsx             # Entry mount point
├── package.json             # NPM dependencies & scripts
├── tsconfig.json            # TypeScript configuration
└── tailwind.config.js       # Tailwind CSS configurations
```

---

## Prerequisites

Ensure you have the following installed on your local development machine:
- **Node.js** (v18.x or higher)
- **NPM** (v9.x or higher) or **PNPM**

---

## Installation & Setup

1. **Clone the project & Navigate to the folder:**
   ```bash
   cd TaskFlow
   ```

2. **Install npm dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create a `.env` file in the root of the `TaskFlow` directory (see [.env Configuration](#environment-variables) below).

4. **Run the Development Server:**
   ```bash
   npm run dev
   ```

5. **Build for Production:**
   ```bash
   npm run build
   ```

---

## Environment Variables

Copy the `.env.example` or create a new `.env` file in the project root:

```env
VITE_SUPABASE_URL=https://your-supabase-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.your-anon-key-here
```

- `VITE_SUPABASE_URL`: The unique API endpoint URL of your Supabase project.
- `VITE_SUPABASE_ANON_KEY`: The public API key used to make safe, authenticated browser queries.

---

## Database Schema (Supabase)

The database utilizes the following core tables managed via PostgreSQL:

- **`profiles`**: User metadata, avatar images, platform system roles (`super_admin` vs `user`).
- **`projects`**: Workspaces containing task boards.
- **`project_members`**: Link table mapping users to projects with granular roles (`admin`, `member`, `viewer`).
- **`columns`**: Task categories (e.g., To Do, In Progress, Done) sorted by position.
- **`tasks`**: Work items containing priorities (`low`, `medium`, `high`, `urgent`), assignees, tags, and due dates.
- **`subtasks`**: Checklists associated with specific tasks.
- **`task_comments`**: Collaboration comment thread inside task modals.
- **`task_attachments`**: Downloadable files related to tasks.
- **`notifications`**: Real-time app notifications triggered by project activities.

---

## Contributing

1. Fork the Project.
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`).
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`).
4. Push to the Branch (`git push origin feature/AmazingFeature`).
5. Open a Pull Request.

---

## License

Distributed under the MIT License. See [LICENSE](LICENSE) for more information.
