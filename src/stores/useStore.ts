import { create } from 'zustand';
import { supabase, Project, Profile, Task, Column } from '../lib/supabase';

interface AppState {
  // Global View State
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  
  // Command Palette
  cmdOpen: boolean;
  setCmdOpen: (open: boolean) => void;

  // Create Project Modal
  createProjectModalOpen: boolean;
  setCreateProjectModalOpen: (open: boolean) => void;

  // Active Context
  activeProjectId: string | null;
  setActiveProjectId: (id: string | null) => void;

  // Global Data Cache (To avoid prop drilling and excessive fetching)
  projects: Project[];
  setProjects: (projects: Project[]) => void;
  addProject: (project: Project) => void;
  removeProject: (id: string) => void;
  
  users: Profile[];
  setUsers: (users: Profile[]) => void;

  // Initialization
  initialized: boolean;
  initializeGlobalData: () => Promise<void>;

  // Reset (on sign out)
  resetStore: () => void;
}

export const useStore = create<AppState>((set) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  cmdOpen: false,
  setCmdOpen: (open) => set({ cmdOpen: open }),

  createProjectModalOpen: false,
  setCreateProjectModalOpen: (open) => set({ createProjectModalOpen: open }),

  activeProjectId: null,
  setActiveProjectId: (id) => set({ activeProjectId: id }),

  projects: [],
  setProjects: (projects) => set({ projects }),
  addProject: (project) => set((state) => ({ projects: [project, ...state.projects] })),
  removeProject: (id) => set((state) => ({ projects: state.projects.filter(p => p.id !== id) })),

  users: [],
  setUsers: (users) => set({ users }),

  initialized: false,
  initializeGlobalData: async () => {
    // Fetch global projects and users for quick access
    const [projectsRes, usersRes] = await Promise.all([
      supabase.from('projects').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*')
    ]);

    set({ 
      projects: projectsRes.data ?? [], 
      users: usersRes.data ?? [],
      initialized: true
    });
  },

  // Clear all data on sign out
  resetStore: () => set({
    projects: [],
    users: [],
    initialized: false,
    activeProjectId: null,
    cmdOpen: false,
    createProjectModalOpen: false,
  }),
}));
